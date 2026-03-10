import { QUESTIONS, LESSONS, STREAK_MESSAGES } from './content.js';
import { addXP, recordAnswer, getQuestionRecord, getProgress, getLevel } from './progress.js';

// Fuzzy match — this isn't a spelling test!
// Allows up to ~30% character errors (Levenshtein distance)
function fuzzyMatch(input, target) {
  const a = input.toLowerCase().trim();
  const b = target.toLowerCase().trim();
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // Levenshtein distance
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = a[i - 1] === b[j - 1]
        ? matrix[i - 1][j - 1]
        : 1 + Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]);
    }
  }
  const dist = matrix[a.length][b.length];
  const maxLen = Math.max(a.length, b.length);
  return dist <= Math.max(1, Math.floor(maxLen * 0.3));
}

export function renderQuiz(app) {
  let filterLesson = 0;
  let queue = [];
  let currentIdx = 0;
  let answered = false;
  let selectedAnswer = null;
  let sessionCorrect = 0;
  let sessionTotal = 0;
  let sessionXP = 0;
  let streak = 0;
  let lastStreakMessage = '';
  // For sequence questions
  let dragOrder = [];

  function buildQueue() {
    let qs = filterLesson ? QUESTIONS.filter(q => q.lesson === filterLesson) : [...QUESTIONS];
    // Prioritize: weak items first, then unanswered, then missed, then answered correctly
    qs.sort((a, b) => {
      const aKey = qKey(a);
      const bKey = qKey(b);
      const aRec = getQuestionRecord(aKey);
      const bRec = getQuestionRecord(bKey);
      // Weak items first
      if (a.weak && !b.weak) return -1;
      if (!a.weak && b.weak) return 1;
      // Unanswered before answered
      if (!aRec && bRec) return -1;
      if (aRec && !bRec) return 1;
      // Missed before correct
      if (aRec && bRec) {
        if (!aRec.correct && bRec.correct) return -1;
        if (aRec.correct && !bRec.correct) return 1;
      }
      return Math.random() - 0.5;
    });
    queue = qs;
    currentIdx = 0;
    sessionCorrect = 0;
    sessionTotal = 0;
    sessionXP = 0;
    streak = 0;
    lastStreakMessage = '';
    answered = false;
    selectedAnswer = null;
  }

  function qKey(q) {
    return `L${q.lesson}-${q.topic}-${q.type}`;
  }

  function render() {
    if (queue.length === 0) buildQueue();
    if (currentIdx >= queue.length) {
      showResults();
      return;
    }

    const q = queue[currentIdx];
    const key = qKey(q);
    const rec = getQuestionRecord(key);

    app.innerHTML = `
      <div class="mode-header">
        <button class="back-btn" id="back-home">&larr; Home</button>
        <h2>Prove It</h2>
      </div>
      <div class="lesson-tabs">
        <button class="lesson-tab ${filterLesson === 0 ? 'active' : ''}" data-lesson="0">All</button>
        ${LESSONS.map(l => `
          <button class="lesson-tab ${l.id === filterLesson ? 'active' : ''}" data-lesson="${l.id}">L${l.id}</button>
        `).join('')}
      </div>
      <div class="quiz-progress-bar">
        <div class="quiz-progress-fill" style="width: ${queue.length ? (currentIdx / queue.length * 100) : 0}%"></div>
      </div>
      <div class="quiz-meta">
        <span>Question ${currentIdx + 1} of ${queue.length}</span>
        ${streak >= 3 ? `<span class="streak-badge">${streak} in a row</span>` : ''}
        <span class="quiz-score">${sessionCorrect}/${sessionTotal} correct</span>
      </div>
      ${lastStreakMessage ? `<div class="streak-message">${lastStreakMessage}</div>` : ''}
      <div class="quiz-card ${q.weak ? 'weak-card' : ''}">
        ${q.weak ? '<span class="weak-badge">Weak Spot</span>' : ''}
        <span class="question-type-badge">${typeLabel(q.type)}</span>
        <span class="flashcard-lesson">Lesson ${q.lesson}</span>
        ${renderQuestion(q)}
      </div>
    `;

    document.getElementById('back-home').onclick = () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'home' }));
    document.querySelectorAll('.lesson-tab').forEach(tab => {
      tab.onclick = () => {
        filterLesson = parseInt(tab.dataset.lesson);
        buildQueue();
        render();
      };
    });

    attachHandlers(q);
  }

  function typeLabel(type) {
    const labels = { mc: 'Multiple Choice', fill: 'Fill in the Blank', 'cause-effect': 'Cause & Effect', 'who-am-i': 'Who Am I?', sequence: 'Put in Order' };
    return labels[type] || type;
  }

  function renderQuestion(q) {
    switch (q.type) {
      case 'mc': return renderMC(q);
      case 'fill': return renderFill(q);
      case 'cause-effect': return renderCauseEffect(q);
      case 'who-am-i': return renderWhoAmI(q);
      case 'sequence': return renderSequence(q);
      default: return '<p>Unknown question type</p>';
    }
  }

  function renderMC(q) {
    return `
      <p class="quiz-question">${q.question}</p>
      <div class="mc-choices">
        ${q.choices.map((c, i) => `
          <button class="mc-choice ${answered ? (i === q.answer ? 'correct' : (i === selectedAnswer ? 'wrong' : '')) : ''}"
                  data-idx="${i}" ${answered ? 'disabled' : ''}>
            <span class="choice-letter">${'ABCD'[i]}</span> ${c}
          </button>
        `).join('')}
      </div>
      ${answered ? `<div class="explanation">${q.explanation}</div><button class="btn btn-primary quiz-next" id="next-q">Next</button>` : ''}
    `;
  }

  function renderFill(q) {
    return `
      <p class="quiz-question">${q.question}</p>
      <div class="fill-input-wrap">
        <input type="text" id="fill-input" class="fill-input ${answered ? (selectedAnswer ? 'correct' : 'wrong') : ''}"
               placeholder="Type your answer..." ${answered ? 'disabled' : ''} autocomplete="off" autocapitalize="off">
        ${!answered ? '<button class="btn btn-primary" id="fill-submit">Check</button>' : ''}
      </div>
      ${answered ? `
        ${!selectedAnswer ? `<div class="correct-answer">Correct answer: ${q.answer[0]}</div>` : ''}
        <div class="explanation">${q.explanation}</div>
        <button class="btn btn-primary quiz-next" id="next-q">Next</button>
      ` : ''}
    `;
  }

  function renderCauseEffect(q) {
    const allEffects = [q.effect, ...q.wrongEffects].sort(() => Math.random() - 0.5);
    return `
      <p class="quiz-question">${q.question}</p>
      <div class="cause-box"><strong>Cause:</strong> ${q.cause}</div>
      <p class="effect-label">What was the effect?</p>
      <div class="mc-choices">
        ${allEffects.map((e, i) => `
          <button class="mc-choice ${answered ? (e === q.effect ? 'correct' : (e === selectedAnswer ? 'wrong' : '')) : ''}"
                  data-effect="${e}" ${answered ? 'disabled' : ''}>
            ${e}
          </button>
        `).join('')}
      </div>
      ${answered ? `<div class="explanation">${q.explanation}</div><button class="btn btn-primary quiz-next" id="next-q">Next</button>` : ''}
    `;
  }

  function renderWhoAmI(q) {
    return `
      <p class="quiz-question">Who Am I?</p>
      <div class="clues-list">
        ${q.clues.map(c => `<div class="clue-item">${c}</div>`).join('')}
      </div>
      <div class="fill-input-wrap">
        <input type="text" id="fill-input" class="fill-input ${answered ? (selectedAnswer ? 'correct' : 'wrong') : ''}"
               placeholder="Type the name..." ${answered ? 'disabled' : ''} autocomplete="off" autocapitalize="off">
        ${!answered ? '<button class="btn btn-primary" id="fill-submit">Check</button>' : ''}
      </div>
      ${answered ? `
        ${!selectedAnswer ? `<div class="correct-answer">Correct answer: ${q.answer}</div>` : ''}
        <div class="explanation">${q.explanation}</div>
        <button class="btn btn-primary quiz-next" id="next-q">Next</button>
      ` : ''}
    `;
  }

  function renderSequence(q) {
    if (!answered && dragOrder.length === 0) {
      dragOrder = [...q.correctOrder].sort(() => Math.random() - 0.5);
    }
    const display = answered ? q.correctOrder : dragOrder;

    return `
      <p class="quiz-question">${q.question}</p>
      <div class="sequence-list" id="sequence-list">
        ${display.map((item, i) => `
          <div class="sequence-item ${answered ? 'correct' : ''}" data-idx="${i}" ${!answered ? 'draggable="true"' : ''}>
            <span class="sequence-num">${i + 1}</span>
            <span>${item}</span>
            ${!answered ? '<span class="drag-handle">&#8661;</span>' : ''}
          </div>
        `).join('')}
      </div>
      ${!answered ? `<button class="btn btn-primary" id="seq-submit">Check Order</button>` : ''}
      ${answered ? `
        <div class="explanation">${q.explanation}</div>
        <button class="btn btn-primary quiz-next" id="next-q">Next</button>
      ` : ''}
    `;
  }

  function attachHandlers(q) {
    // MC handlers
    document.querySelectorAll('.mc-choice').forEach(btn => {
      btn.onclick = () => {
        if (answered) return;
        if (q.type === 'mc') {
          selectedAnswer = parseInt(btn.dataset.idx);
          const correct = selectedAnswer === q.answer;
          handleAnswer(q, correct);
        } else if (q.type === 'cause-effect') {
          selectedAnswer = btn.dataset.effect;
          const correct = selectedAnswer === q.effect;
          handleAnswer(q, correct);
        }
      };
    });

    // Fill / Who Am I handlers
    const fillSubmit = document.getElementById('fill-submit');
    const fillInput = document.getElementById('fill-input');
    if (fillSubmit && fillInput) {
      const checkFill = () => {
        if (answered) return;
        const userAnswer = fillInput.value.trim().toLowerCase();
        if (!userAnswer) return;
        let correct = false;
        if (q.type === 'fill') {
          correct = q.answer.some(a => fuzzyMatch(userAnswer, a));
        } else if (q.type === 'who-am-i') {
          const valid = [q.answer, ...(q.acceptAlso || [])];
          correct = valid.some(a => fuzzyMatch(userAnswer, a));
        }
        selectedAnswer = correct;
        handleAnswer(q, correct);
      };
      fillSubmit.onclick = checkFill;
      fillInput.onkeydown = (e) => { if (e.key === 'Enter') checkFill(); };
      fillInput.focus();
    }

    // Sequence handlers
    const seqSubmit = document.getElementById('seq-submit');
    if (seqSubmit) {
      seqSubmit.onclick = () => {
        const correct = dragOrder.every((item, i) => item === q.correctOrder[i]);
        handleAnswer(q, correct);
      };

      // Simple tap-to-swap reordering (mobile friendly)
      let firstTap = null;
      document.querySelectorAll('.sequence-item').forEach(item => {
        item.onclick = () => {
          if (answered) return;
          const idx = parseInt(item.dataset.idx);
          if (firstTap === null) {
            firstTap = idx;
            item.classList.add('selected');
          } else {
            // Swap
            const temp = dragOrder[firstTap];
            dragOrder[firstTap] = dragOrder[idx];
            dragOrder[idx] = temp;
            firstTap = null;
            render();
          }
        };
      });
    }

    // Next button
    const nextBtn = document.getElementById('next-q');
    if (nextBtn) {
      nextBtn.onclick = () => {
        answered = false;
        selectedAnswer = null;
        dragOrder = [];
        currentIdx++;
        render();
      };
    }
  }

  function handleAnswer(q, correct) {
    answered = true;
    sessionTotal++;
    if (correct) {
      sessionCorrect++;
      streak++;
      const rec = getQuestionRecord(qKey(q));
      const firstTry = !rec || rec.attempts === 0;
      const result = addXP(q.type, firstTry);
      sessionXP += result.earned;
      // Check for streak message
      const streakKeys = Object.keys(STREAK_MESSAGES).map(Number).sort((a, b) => a - b);
      for (const k of streakKeys) {
        if (streak >= k) lastStreakMessage = STREAK_MESSAGES[k];
      }
      recordAnswer(qKey(q), correct);
      render();
      // Show XP popup
      showXPPopup(result.earned, firstTry);
      // Show level-up if applicable
      if (result.leveledUp) {
        setTimeout(() => showLevelUp(result.newLevel), 400);
      }
    } else {
      streak = 0;
      lastStreakMessage = '';
      recordAnswer(qKey(q), correct);
      render();
    }
  }

  function showXPPopup(earned, firstTry) {
    const popup = document.createElement('div');
    popup.className = 'xp-popup';
    popup.textContent = `+${earned} XP${firstTry ? ' (first try!)' : ''}`;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 1200);
  }

  function showLevelUp(newTitle) {
    const icons = { Scribe: '\u270D\uFE0F', Apprentice: '\uD83D\uDCDA', Scholar: '\uD83C\uDF93', Priest: '\u2626\uFE0F', Advisor: '\uD83D\uDCDC', Vizier: '\uD83D\uDC51', Commander: '\u2694\uFE0F', Pharaoh: '\uD83D\uDC52', 'Great Pharaoh': '\uD83C\uDFDB\uFE0F', 'Living God': '\uD83C\uDF1F' };
    const overlay = document.createElement('div');
    overlay.className = 'level-up-overlay';
    overlay.innerHTML = `
      <div class="level-up-card">
        <div class="level-up-icon">${icons[newTitle] || '\uD83C\uDF1F'}</div>
        <div class="level-up-title">LEVEL UP!</div>
        <div class="level-up-name">${newTitle}</div>
        <div class="level-up-sub">Keep going — you're building real knowledge.</div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.onclick = () => overlay.remove();
    setTimeout(() => overlay.remove(), 3000);
  }

  function showResults() {
    const pct = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0;
    const p = getProgress();
    const level = getLevel();
    const resultMessage = pct === 100 ? 'Perfect! You nailed every single one.'
      : pct >= 90 ? 'Excellent — you really know this material.'
      : pct >= 75 ? 'Solid work. A few topics to review, then you\'ll have it.'
      : pct >= 50 ? 'Good start. Hit "Learn It" for the tricky ones, then come back.'
      : 'No worries — use "Learn It" and "Know It" to build up, then try again.';
    app.innerHTML = `
      <div class="mode-header">
        <button class="back-btn" id="back-home">&larr; Home</button>
        <h2>Prove It - Results</h2>
      </div>
      <div class="results-screen">
        <div class="results-score">${pct}%</div>
        <p>${sessionCorrect} out of ${sessionTotal} correct</p>
        <div class="session-xp-earned">+${sessionXP} XP this session</div>
        <div class="session-level">${level.title} — ${level.currentXP} XP total${level.nextTitle ? ` (${level.nextXP - level.currentXP} to ${level.nextTitle})` : ''}</div>
        <p class="results-message">${resultMessage}</p>
        <div class="mastery-bars">
          ${LESSONS.map(l => `
            <div class="mastery-row">
              <span>Lesson ${l.id}</span>
              <div class="progress-bar-mini">
                <div class="progress-bar-fill" style="width: ${p.lessonMastery[l.id]}%"></div>
              </div>
              <span>${p.lessonMastery[l.id]}%</span>
            </div>
          `).join('')}
        </div>
        <div class="results-actions">
          <button class="btn btn-primary" id="retry">Try Again</button>
          <button class="btn btn-secondary" id="go-home">Back to Home</button>
        </div>
      </div>
    `;

    document.getElementById('back-home').onclick = () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'home' }));
    document.getElementById('retry').onclick = () => { buildQueue(); render(); };
    document.getElementById('go-home').onclick = () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'home' }));
  }

  buildQueue();
  render();
}
