import { FLASHCARDS, LESSONS } from './content.js';
import { isFlashcardKnown, markFlashcardKnown, markFlashcardUnknown } from './progress.js';

export function renderFlashcards(app) {
  let filterLesson = 0; // 0 = all
  let showUnknownFirst = true;
  let deck = [];
  let currentIdx = 0;
  let flipped = false;

  function buildDeck() {
    let cards = filterLesson ? FLASHCARDS.filter(c => c.lesson === filterLesson) : [...FLASHCARDS];
    if (showUnknownFirst) {
      const unknown = cards.filter(c => !isFlashcardKnown(c.term));
      const known = cards.filter(c => isFlashcardKnown(c.term));
      // Weak items first within unknown
      unknown.sort((a, b) => (b.weak ? 1 : 0) - (a.weak ? 1 : 0));
      cards = [...unknown, ...known];
    }
    deck = cards;
    currentIdx = 0;
    flipped = false;
  }

  function render() {
    if (deck.length === 0) buildDeck();
    const card = deck[currentIdx];
    const knownCount = deck.filter(c => isFlashcardKnown(c.term)).length;
    const isKnown = isFlashcardKnown(card.term);

    app.innerHTML = `
      <div class="mode-header">
        <button class="back-btn" id="back-home">&larr; Home</button>
        <h2>Know It</h2>
      </div>
      <div class="lesson-tabs">
        <button class="lesson-tab ${filterLesson === 0 ? 'active' : ''}" data-lesson="0">All</button>
        ${LESSONS.map(l => `
          <button class="lesson-tab ${l.id === filterLesson ? 'active' : ''}" data-lesson="${l.id}">L${l.id}</button>
        `).join('')}
      </div>
      <div class="flashcard-progress">
        <span>${knownCount}/${deck.length} known</span>
        <div class="progress-bar-mini">
          <div class="progress-bar-fill" style="width: ${deck.length ? (knownCount / deck.length * 100) : 0}%"></div>
        </div>
      </div>
      <div class="flashcard ${flipped ? 'flipped' : ''} ${card.weak ? 'weak-card' : ''}" id="flashcard">
        <div class="flashcard-inner">
          <div class="flashcard-front">
            ${card.weak ? '<span class="weak-badge">Weak Spot</span>' : ''}
            <span class="flashcard-lesson">Lesson ${card.lesson}</span>
            <h3>${card.term}</h3>
            <p class="tap-hint">Tap to flip</p>
          </div>
          <div class="flashcard-back">
            <span class="flashcard-lesson">Lesson ${card.lesson}</span>
            <h3>${card.term}</h3>
            <p>${card.definition}</p>
          </div>
        </div>
      </div>
      <div class="flashcard-counter">${currentIdx + 1} of ${deck.length}</div>
      <div class="flashcard-actions">
        <button class="btn btn-wrong" id="study-again">Study Again</button>
        <button class="btn btn-correct" id="got-it">Got It</button>
      </div>
    `;

    document.getElementById('back-home').onclick = () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'home' }));

    document.getElementById('flashcard').onclick = () => {
      flipped = !flipped;
      document.getElementById('flashcard').classList.toggle('flipped', flipped);
    };

    document.querySelectorAll('.lesson-tab').forEach(tab => {
      tab.onclick = () => {
        filterLesson = parseInt(tab.dataset.lesson);
        buildDeck();
        render();
      };
    });

    document.getElementById('got-it').onclick = () => {
      markFlashcardKnown(card.term);
      advance();
    };

    document.getElementById('study-again').onclick = () => {
      markFlashcardUnknown(card.term);
      advance();
    };
  }

  function advance() {
    flipped = false;
    if (currentIdx < deck.length - 1) {
      currentIdx++;
    } else {
      // Check if all known
      const unknownLeft = deck.filter(c => !isFlashcardKnown(c.term));
      if (unknownLeft.length === 0) {
        showComplete();
        return;
      }
      // Rebuild deck (unknowns shuffle to front)
      buildDeck();
    }
    render();
  }

  function showComplete() {
    app.innerHTML = `
      <div class="mode-header">
        <button class="back-btn" id="back-home">&larr; Home</button>
        <h2>Know It</h2>
      </div>
      <div class="complete-screen">
        <div class="complete-icon">&#127942;</div>
        <h3>All Cards Known!</h3>
        <p>You know all ${deck.length} terms${filterLesson ? ' in Lesson ' + filterLesson : ''}. Nice work!</p>
        <button class="btn btn-primary" id="restart">Go Again</button>
        <button class="btn btn-secondary" id="go-home">Back to Home</button>
      </div>
    `;
    document.getElementById('back-home').onclick = () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'home' }));
    document.getElementById('restart').onclick = () => { buildDeck(); render(); };
    document.getElementById('go-home').onclick = () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'home' }));
  }

  buildDeck();
  render();
}
