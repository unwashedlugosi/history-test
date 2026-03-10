import { LESSONS, FLASHCARDS } from './content.js';
import { getProgress, getLevel, loadFromSupabase, isFlashcardKnown } from './progress.js';
import { renderStudyGuide } from './study-guide.js';
import { renderFlashcards } from './flashcards.js';
import { renderQuiz } from './quiz.js';
import { renderPracticeTest } from './practice-test.js';
import './styles.css';

const app = document.getElementById('app');

// Load cloud progress on start
loadFromSupabase();

function renderHome() {
  const p = getProgress();
  const level = getLevel();
  const flashcardsKnown = FLASHCARDS.filter(c => isFlashcardKnown(c.term)).length;

  app.innerHTML = `
    <div class="home">
      <div class="home-header">
        <h1>Ancient Egypt & Kush</h1>
        <p class="test-date">Test this week!</p>
      </div>

      <div class="xp-bar">
        <div class="xp-level">
          <span class="level-icon">${levelIcon(level.title)}</span>
          <span class="level-title">${level.title}</span>
        </div>
        <div class="xp-progress">
          <div class="xp-fill" style="width: ${level.nextXP ? ((level.currentXP - level.minXP) / (level.nextXP - level.minXP) * 100) : 100}%"></div>
        </div>
        <span class="xp-count">${level.currentXP} XP</span>
        ${level.nextTitle ? `<span class="xp-next">Next: ${level.nextTitle} (${level.nextXP} XP)</span>` : ''}
      </div>

      <div class="mastery-overview">
        ${LESSONS.map(l => `
          <div class="mastery-chip">
            <span>L${l.id}</span>
            <div class="progress-bar-mini">
              <div class="progress-bar-fill" style="width: ${p.lessonMastery[l.id]}%"></div>
            </div>
            <span>${p.lessonMastery[l.id]}%</span>
          </div>
        `).join('')}
      </div>

      <div class="mode-grid">
        <button class="mode-card" data-mode="study">
          <div class="mode-icon">&#128214;</div>
          <h3>Learn It</h3>
          <p>Study the key facts lesson by lesson</p>
        </button>
        <button class="mode-card" data-mode="flashcards">
          <div class="mode-icon">&#127183;</div>
          <h3>Know It</h3>
          <p>${flashcardsKnown}/${FLASHCARDS.length} terms known</p>
        </button>
        <button class="mode-card" data-mode="quiz">
          <div class="mode-icon">&#9889;</div>
          <h3>Prove It</h3>
          <p>Mixed questions, adaptive difficulty</p>
        </button>
        <button class="mode-card" data-mode="test">
          <div class="mode-icon">&#128220;</div>
          <h3>Test Day</h3>
          <p>Full practice test${p.practiceTests.length ? ` (${p.practiceTests.length} taken)` : ''}</p>
        </button>
      </div>

      ${p.practiceTests.length > 0 ? `
        <div class="recent-test">
          <h4>Last Practice Test</h4>
          <p>${Math.round(p.practiceTests[p.practiceTests.length - 1].score / p.practiceTests[p.practiceTests.length - 1].total * 100)}% (${p.practiceTests[p.practiceTests.length - 1].score}/${p.practiceTests[p.practiceTests.length - 1].total})</p>
        </div>
      ` : ''}
    </div>
  `;

  document.querySelectorAll('.mode-card').forEach(card => {
    card.onclick = () => navigate(card.dataset.mode);
  });
}

function levelIcon(title) {
  const icons = {
    Scribe: '&#9997;',
    Apprentice: '&#128218;',
    Scholar: '&#127891;',
    Priest: '&#9764;',
    Advisor: '&#128220;',
    Vizier: '&#128081;',
    Commander: '&#9876;',
    Pharaoh: '&#128082;',
    'Great Pharaoh': '&#127963;',
    'Living God': '&#127775;'
  };
  return icons[title] || '&#9997;';
}

function navigate(mode) {
  switch (mode) {
    case 'home': renderHome(); break;
    case 'study': renderStudyGuide(app); break;
    case 'flashcards': renderFlashcards(app); break;
    case 'quiz': renderQuiz(app); break;
    case 'test': renderPracticeTest(app); break;
    default: renderHome();
  }
}

window.addEventListener('navigate', (e) => navigate(e.detail));

renderHome();
