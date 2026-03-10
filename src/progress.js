import { createClient } from '@supabase/supabase-js';
import { XP_VALUES, LEVELS, FIRST_TRY_BONUS } from './content.js';

const SUPABASE_URL = 'https://dhwllgdxpeucldtmzhme.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRod2xsZ2R4cGV1Y2xkdG16aG1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMzI2NTMsImV4cCI6MjA4NTgwODY1M30.PmDxpoWXP0zA2sJLgRxAfODH1JcjdFOoRMdnGZwJYLE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const STORAGE_KEY = 'history-test-progress';

// Default state
function defaultProgress() {
  return {
    xp: 0,
    answeredQuestions: {}, // questionKey -> { correct: bool, attempts: number }
    flashcardsKnown: [],
    lessonMastery: { 1: 0, 2: 0, 3: 0 }, // percent
    practiceTests: [] // { date, score, total, lessonBreakdown }
  };
}

let progress = null;

export function getProgress() {
  if (!progress) {
    const stored = localStorage.getItem(STORAGE_KEY);
    progress = stored ? { ...defaultProgress(), ...JSON.parse(stored) } : defaultProgress();
  }
  return progress;
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  syncToSupabase();
}

export function addXP(questionType, firstTry = false) {
  const p = getProgress();
  const oldLevel = getLevel();
  let earned = XP_VALUES[questionType] || 10;
  if (firstTry) earned += FIRST_TRY_BONUS;
  p.xp += earned;
  save();
  const newLevel = getLevel();
  return { totalXP: p.xp, earned, leveledUp: newLevel.title !== oldLevel.title, newLevel: newLevel.title };
}

export function recordAnswer(questionKey, correct) {
  const p = getProgress();
  if (!p.answeredQuestions[questionKey]) {
    p.answeredQuestions[questionKey] = { correct: false, attempts: 0 };
  }
  p.answeredQuestions[questionKey].attempts++;
  if (correct) p.answeredQuestions[questionKey].correct = true;
  updateLessonMastery();
  save();
}

export function getQuestionRecord(questionKey) {
  return getProgress().answeredQuestions[questionKey] || null;
}

export function markFlashcardKnown(term) {
  const p = getProgress();
  if (!p.flashcardsKnown.includes(term)) {
    p.flashcardsKnown.push(term);
    save();
  }
}

export function markFlashcardUnknown(term) {
  const p = getProgress();
  p.flashcardsKnown = p.flashcardsKnown.filter(t => t !== term);
  save();
}

export function isFlashcardKnown(term) {
  return getProgress().flashcardsKnown.includes(term);
}

export function recordPracticeTest(result) {
  const p = getProgress();
  p.practiceTests.push({ ...result, date: new Date().toISOString() });
  save();
}

function updateLessonMastery() {
  const p = getProgress();
  const answered = p.answeredQuestions;
  for (const lesson of [1, 2, 3]) {
    let total = 0, correct = 0;
    for (const [key, val] of Object.entries(answered)) {
      if (key.startsWith(`L${lesson}-`)) {
        total++;
        if (val.correct) correct++;
      }
    }
    p.lessonMastery[lesson] = total > 0 ? Math.round((correct / total) * 100) : 0;
  }
}

export function getLevel() {
  const xp = getProgress().xp;
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (xp >= level.minXP) current = level;
  }
  const idx = LEVELS.indexOf(current);
  const next = LEVELS[idx + 1] || null;
  return { ...current, nextTitle: next?.title || null, nextXP: next?.minXP || null, currentXP: xp };
}

export function resetProgress() {
  progress = defaultProgress();
  save();
}

// Supabase sync
async function syncToSupabase() {
  try {
    const p = getProgress();
    await supabase.from('history_test_progress').upsert({
      id: 'max',
      xp: p.xp,
      answered_questions: p.answeredQuestions,
      flashcards_known: p.flashcardsKnown,
      lesson_mastery: p.lessonMastery,
      practice_tests: p.practiceTests,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
  } catch (e) {
    // Supabase sync is best-effort
  }
}

export async function loadFromSupabase() {
  try {
    const { data } = await supabase.from('history_test_progress').select('*').eq('id', 'max').single();
    if (data && data.xp != null) {
      const local = getProgress();
      // Use whichever has more XP (merge strategy)
      if (data.xp > local.xp) {
        progress = {
          xp: data.xp,
          answeredQuestions: data.answered_questions || {},
          flashcardsKnown: data.flashcards_known || [],
          lessonMastery: data.lesson_mastery || { 1: 0, 2: 0, 3: 0 },
          practiceTests: data.practice_tests || []
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      }
    }
  } catch (e) {
    // Supabase load is best-effort
  }
}
