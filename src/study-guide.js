import { STUDY_GUIDE, LESSONS } from './content.js';

export function renderStudyGuide(app) {
  let currentLesson = 1;
  let currentTopicIdx = 0;
  let currentFactIdx = 0;

  function getTopic() {
    return STUDY_GUIDE[currentLesson][currentTopicIdx];
  }

  function render() {
    const topic = getTopic();
    const totalTopics = STUDY_GUIDE[currentLesson].length;
    const totalFacts = topic.facts.length;
    const lessonTitle = LESSONS.find(l => l.id === currentLesson).title;

    app.innerHTML = `
      <div class="mode-header">
        <button class="back-btn" id="back-home">&larr; Home</button>
        <h2>Learn It</h2>
      </div>
      <div class="lesson-tabs">
        ${LESSONS.map(l => `
          <button class="lesson-tab ${l.id === currentLesson ? 'active' : ''}" data-lesson="${l.id}">
            Lesson ${l.id}
          </button>
        `).join('')}
      </div>
      <div class="study-card">
        <div class="study-card-header">
          <span class="study-lesson-label">Lesson ${currentLesson}: ${lessonTitle}</span>
          <span class="study-progress">${currentTopicIdx + 1}/${totalTopics} topics</span>
        </div>
        <h3 class="study-topic">${topic.topic}</h3>
        <div class="study-fact">
          ${formatFact(topic.facts[currentFactIdx])}
        </div>
        <div class="study-fact-counter">${currentFactIdx + 1} of ${totalFacts} facts</div>
        <div class="study-nav">
          <button class="btn btn-secondary" id="prev-fact" ${currentFactIdx === 0 && currentTopicIdx === 0 ? 'disabled' : ''}>Previous</button>
          <button class="btn btn-primary" id="next-fact">
            ${currentFactIdx < totalFacts - 1 ? 'Next Fact' : currentTopicIdx < totalTopics - 1 ? 'Next Topic' : currentLesson < 3 ? 'Next Lesson' : 'Done!'}
          </button>
        </div>
      </div>
    `;

    document.getElementById('back-home').onclick = () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'home' }));

    document.querySelectorAll('.lesson-tab').forEach(tab => {
      tab.onclick = () => {
        currentLesson = parseInt(tab.dataset.lesson);
        currentTopicIdx = 0;
        currentFactIdx = 0;
        render();
      };
    });

    document.getElementById('prev-fact').onclick = () => {
      if (currentFactIdx > 0) {
        currentFactIdx--;
      } else if (currentTopicIdx > 0) {
        currentTopicIdx--;
        currentFactIdx = STUDY_GUIDE[currentLesson][currentTopicIdx].facts.length - 1;
      }
      render();
    };

    document.getElementById('next-fact').onclick = () => {
      const topic = getTopic();
      if (currentFactIdx < topic.facts.length - 1) {
        currentFactIdx++;
      } else if (currentTopicIdx < STUDY_GUIDE[currentLesson].length - 1) {
        currentTopicIdx++;
        currentFactIdx = 0;
      } else if (currentLesson < 3) {
        currentLesson++;
        currentTopicIdx = 0;
        currentFactIdx = 0;
      } else {
        window.dispatchEvent(new CustomEvent('navigate', { detail: 'home' }));
        return;
      }
      render();
    };
  }

  render();
}

function formatFact(text) {
  // Bold **text** and highlight vocab
  return '<p>' + text.replace(/\*\*(.*?)\*\*/g, '<strong class="vocab-highlight">$1</strong>') + '</p>';
}
