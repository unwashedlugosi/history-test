import { QUESTIONS, LESSONS } from './content.js';
import { addXP, recordAnswer, recordPracticeTest, getProgress } from './progress.js';

export function renderPracticeTest(app) {
  let testQuestions = [];
  let currentIdx = 0;
  let answers = []; // { question, userCorrect }
  let answered = false;
  let selectedAnswer = null;
  let timed = false;
  let timerInterval = null;
  let timeElapsed = 0;
  let started = false;
  let dragOrder = [];

  function pickQuestions() {
    // Pick ~18 questions, balanced across lessons and types
    const byLesson = { 1: [], 2: [], 3: [] };
    const shuffled = [...QUESTIONS].sort(() => Math.random() - 0.5);
    shuffled.forEach(q => byLesson[q.lesson].push(q));

    const picked = [];
    // 6 from each lesson, prioritizing variety of types
    for (const lesson of [1, 2, 3]) {
      const pool = byLesson[lesson];
      const types = new Set();
      // First pass: one of each type
      for (const q of pool) {
        if (!types.has(q.type) && picked.filter(p => p.lesson === lesson).length < 6) {
          picked.push(q);
          types.add(q.type);
        }
      }
      // Fill remaining
      for (const q of pool) {
        if (!picked.includes(q) && picked.filter(p => p.lesson === lesson).length < 6) {
          picked.push(q);
        }
      }
    }

    testQuestions = picked.sort(() => Math.random() - 0.5);
    answers = [];
    currentIdx = 0;
    answered = false;
    selectedAnswer = null;
    timeElapsed = 0;
  }

  function showStartScreen() {
    app.innerHTML = `
      <div class="mode-header">
        <button class="back-btn" id="back-home">&larr; Home</button>
        <h2>Test Day</h2>
      </div>
      <div class="test-start-screen">
        <div class="test-icon">&#128220;</div>
        <h3>Practice Test</h3>
        <p>${testQuestions.length} questions across all 3 lessons</p>
        <p>Mixed question types — just like the real test</p>
        <div class="timer-toggle">
          <label class="toggle-label">
            <input type="checkbox" id="timer-toggle" ${timed ? 'checked' : ''}>
            <span class="toggle-text">Timed mode (track how long it takes)</span>
          </label>
        </div>
        <button class="btn btn-primary btn-large" id="start-test">Start Test</button>
      </div>
    `;

    document.getElementById('back-home').onclick = () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'home' }));
    document.getElementById('timer-toggle').onchange = (e) => { timed = e.target.checked; };
    document.getElementById('start-test').onclick = () => {
      started = true;
      if (timed) {
        timerInterval = setInterval(() => { timeElapsed++; updateTimer(); }, 1000);
      }
      renderQuestion();
    };
  }

  function updateTimer() {
    const el = document.getElementById('timer-display');
    if (el) {
      const mins = Math.floor(timeElapsed / 60);
      const secs = timeElapsed % 60;
      el.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  }

  function qKey(q) {
    return `L${q.lesson}-${q.topic}-${q.type}`;
  }

  function renderQuestion() {
    if (currentIdx >= testQuestions.length) {
      showResults();
      return;
    }

    const q = testQuestions[currentIdx];
    const typeLabels = { mc: 'Multiple Choice', fill: 'Fill in the Blank', 'cause-effect': 'Cause & Effect', 'who-am-i': 'Who Am I?', sequence: 'Put in Order' };

    app.innerHTML = `
      <div class="mode-header">
        <button class="back-btn" id="back-home">&larr; Home</button>
        <h2>Test Day</h2>
        ${timed ? `<span class="timer" id="timer-display">0:00</span>` : ''}
      </div>
      <div class="quiz-progress-bar">
        <div class="quiz-progress-fill" style="width: ${(currentIdx / testQuestions.length * 100)}%"></div>
      </div>
      <div class="quiz-meta">
        <span>Question ${currentIdx + 1} of ${testQuestions.length}</span>
        <span class="quiz-score">${answers.filter(a => a.correct).length}/${answers.length} correct</span>
      </div>
      <div class="quiz-card">
        <span class="question-type-badge">${typeLabels[q.type]}</span>
        <span class="flashcard-lesson">Lesson ${q.lesson}</span>
        ${renderQ(q)}
      </div>
    `;

    if (timed) updateTimer();
    document.getElementById('back-home').onclick = () => {
      if (timerInterval) clearInterval(timerInterval);
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'home' }));
    };
    attachHandlers(q);
  }

  function renderQ(q) {
    switch (q.type) {
      case 'mc': return renderMC(q);
      case 'fill': return renderFill(q);
      case 'cause-effect': return renderCE(q);
      case 'who-am-i': return renderWAI(q);
      case 'sequence': return renderSeq(q);
      default: return '';
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

  function renderCE(q) {
    const allEffects = [q.effect, ...q.wrongEffects].sort(() => Math.random() - 0.5);
    return `
      <p class="quiz-question">${q.question}</p>
      <div class="cause-box"><strong>Cause:</strong> ${q.cause}</div>
      <p class="effect-label">What was the effect?</p>
      <div class="mc-choices">
        ${allEffects.map(e => `
          <button class="mc-choice ${answered ? (e === q.effect ? 'correct' : (e === selectedAnswer ? 'wrong' : '')) : ''}"
                  data-effect="${e}" ${answered ? 'disabled' : ''}>
            ${e}
          </button>
        `).join('')}
      </div>
      ${answered ? `<div class="explanation">${q.explanation}</div><button class="btn btn-primary quiz-next" id="next-q">Next</button>` : ''}
    `;
  }

  function renderWAI(q) {
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

  function renderSeq(q) {
    if (!answered && dragOrder.length === 0) {
      dragOrder = [...q.correctOrder].sort(() => Math.random() - 0.5);
    }
    const display = answered ? q.correctOrder : dragOrder;
    return `
      <p class="quiz-question">${q.question}</p>
      <div class="sequence-list" id="sequence-list">
        ${display.map((item, i) => `
          <div class="sequence-item ${answered ? 'correct' : ''}" data-idx="${i}">
            <span class="sequence-num">${i + 1}</span>
            <span>${item}</span>
            ${!answered ? '<span class="drag-handle">&#8661;</span>' : ''}
          </div>
        `).join('')}
      </div>
      ${!answered ? '<button class="btn btn-primary" id="seq-submit">Check Order</button>' : ''}
      ${answered ? `<div class="explanation">${q.explanation}</div><button class="btn btn-primary quiz-next" id="next-q">Next</button>` : ''}
    `;
  }

  function attachHandlers(q) {
    // MC
    document.querySelectorAll('.mc-choice').forEach(btn => {
      btn.onclick = () => {
        if (answered) return;
        if (q.type === 'mc') {
          selectedAnswer = parseInt(btn.dataset.idx);
          handleAnswer(q, selectedAnswer === q.answer);
        } else if (q.type === 'cause-effect') {
          selectedAnswer = btn.dataset.effect;
          handleAnswer(q, selectedAnswer === q.effect);
        }
      };
    });

    // Fill / WAI
    const fillSubmit = document.getElementById('fill-submit');
    const fillInput = document.getElementById('fill-input');
    if (fillSubmit && fillInput) {
      const check = () => {
        if (answered) return;
        const val = fillInput.value.trim().toLowerCase();
        if (!val) return;
        let correct = false;
        if (q.type === 'fill') {
          correct = q.answer.some(a => val === a.toLowerCase());
        } else if (q.type === 'who-am-i') {
          const valid = [q.answer.toLowerCase(), ...(q.acceptAlso || []).map(a => a.toLowerCase())];
          correct = valid.some(a => val === a || val.includes(a));
        }
        selectedAnswer = correct;
        handleAnswer(q, correct);
      };
      fillSubmit.onclick = check;
      fillInput.onkeydown = (e) => { if (e.key === 'Enter') check(); };
      fillInput.focus();
    }

    // Sequence
    const seqSubmit = document.getElementById('seq-submit');
    if (seqSubmit) {
      seqSubmit.onclick = () => {
        const correct = dragOrder.every((item, i) => item === q.correctOrder[i]);
        handleAnswer(q, correct);
      };
      let firstTap = null;
      document.querySelectorAll('.sequence-item').forEach(item => {
        item.onclick = () => {
          if (answered) return;
          const idx = parseInt(item.dataset.idx);
          if (firstTap === null) {
            firstTap = idx;
            item.classList.add('selected');
          } else {
            const temp = dragOrder[firstTap];
            dragOrder[firstTap] = dragOrder[idx];
            dragOrder[idx] = temp;
            firstTap = null;
            renderQuestion();
          }
        };
      });
    }

    // Next
    const nextBtn = document.getElementById('next-q');
    if (nextBtn) {
      nextBtn.onclick = () => {
        answered = false;
        selectedAnswer = null;
        dragOrder = [];
        currentIdx++;
        renderQuestion();
      };
    }
  }

  function handleAnswer(q, correct) {
    answered = true;
    answers.push({ question: q, correct });
    if (correct) addXP(q.type);
    recordAnswer(qKey(q), correct);
    renderQuestion();
  }

  function showResults() {
    if (timerInterval) clearInterval(timerInterval);
    const total = answers.length;
    const correct = answers.filter(a => a.correct).length;
    const pct = Math.round((correct / total) * 100);

    // Breakdown by lesson
    const byLesson = {};
    for (const l of LESSONS) {
      const la = answers.filter(a => a.question.lesson === l.id);
      byLesson[l.id] = {
        correct: la.filter(a => a.correct).length,
        total: la.length
      };
    }

    // Study these (missed topics)
    const missed = answers.filter(a => !a.correct).map(a => ({
      lesson: a.question.lesson,
      topic: a.question.topic,
      explanation: a.question.explanation
    }));
    // Dedupe
    const uniqueMissed = [];
    const seen = new Set();
    missed.forEach(m => {
      const key = `${m.lesson}-${m.topic}`;
      if (!seen.has(key)) { seen.add(key); uniqueMissed.push(m); }
    });

    const grade = pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F';

    recordPracticeTest({ score: correct, total, lessonBreakdown: byLesson });

    app.innerHTML = `
      <div class="mode-header">
        <button class="back-btn" id="back-home">&larr; Home</button>
        <h2>Test Day - Results</h2>
      </div>
      <div class="results-screen">
        <div class="results-grade">${grade}</div>
        <div class="results-score">${pct}%</div>
        <p>${correct} out of ${total} correct</p>
        ${timed ? `<p class="timer-result">Time: ${Math.floor(timeElapsed / 60)}:${(timeElapsed % 60).toString().padStart(2, '0')}</p>` : ''}

        <h4>By Lesson</h4>
        <div class="mastery-bars">
          ${LESSONS.map(l => {
            const lb = byLesson[l.id];
            const lpct = lb.total ? Math.round((lb.correct / lb.total) * 100) : 0;
            return `
              <div class="mastery-row">
                <span>L${l.id}: ${l.title}</span>
                <div class="progress-bar-mini">
                  <div class="progress-bar-fill" style="width: ${lpct}%"></div>
                </div>
                <span>${lb.correct}/${lb.total}</span>
              </div>
            `;
          }).join('')}
        </div>

        ${uniqueMissed.length > 0 ? `
          <h4>Study These</h4>
          <div class="study-these">
            ${uniqueMissed.map(m => `
              <div class="study-this-item">
                <span class="study-this-lesson">L${m.lesson}</span>
                <span>${m.topic}: ${m.explanation}</span>
              </div>
            `).join('')}
          </div>
        ` : '<p class="perfect-score">Perfect score! You\'re ready for the test!</p>'}

        <div class="results-actions">
          <button class="btn btn-primary" id="retake">Take Again</button>
          <button class="btn btn-secondary" id="go-home">Back to Home</button>
        </div>
      </div>
    `;

    document.getElementById('back-home').onclick = () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'home' }));
    document.getElementById('retake').onclick = () => {
      pickQuestions();
      timed = false;
      showStartScreen();
    };
    document.getElementById('go-home').onclick = () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'home' }));
  }

  pickQuestions();
  showStartScreen();
}
