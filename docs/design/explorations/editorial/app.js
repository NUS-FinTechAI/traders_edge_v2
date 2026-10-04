const screen = document.body.dataset.screen
const queryState = new URLSearchParams(location.search).get('state')
const states = {
  dashboard: {
    empty: [
      'No entries yet',
      'Begin with money you need soon. Your journal will grow as you complete lessons; there is no progress to catch up on.',
      'Begin the learning example',
      'quiz.html',
    ],
    loading: [
      'Opening your journal',
      'Your place and learning activity would appear here. This is a loading preview, not a live request.',
      'Show the example journal',
      'dashboard.html',
    ],
    error: [
      'Your journal could not load',
      'Learning progress is unavailable in this error preview. Retry the example, or open the route to see where learning begins.',
      'Retry the example',
      'dashboard.html',
    ],
    locked: [
      'Practice comes after readiness',
      'Trading practice stays locked until the foundation lessons and risk checks are passed. Begin with keeping essential spending within reach.',
      'Open the foundation route',
      'map.html',
    ],
    success: [
      'A reason worth keeping',
      'Example learning completed: money needed for essential near-term spending should stay available. An uncertain market return cannot guarantee a payment.',
      'Return to your route',
      'map.html?state=success',
    ],
  },
  map: {
    empty: [
      'Your route begins here',
      'No lessons completed in this example. The first shore is financial readiness: learn to separate essential spending from money that can face uncertain outcomes.',
      'Try the first learning example',
      'quiz.html',
    ],
    loading: [
      'Unfolding your route',
      'The route title stays in place while lesson availability is checked. This preview does not contact a server.',
      'Show the example route',
      'map.html',
    ],
    error: [
      'The route could not load',
      'Lesson availability is unknown in this preview, so no new stops are marked complete. Retry to return to the example route.',
      'Retry the example',
      'map.html',
    ],
    locked: [
      'The next shore is not open yet',
      'How Markets Work requires the Money Before Markets chapter check. First, complete the five readiness lessons and explain your choices in that check.',
      'Return to the readiness route',
      'map.html',
    ],
    success: [
      'One more reason to carry',
      'Example: stop 2 completed. Standard star earned for recognizing money that must stay available. The next lesson would introduce a reserve for surprises.',
      'Revisit the learning example',
      'quiz.html',
    ],
  },
  quiz: {
    empty: [
      'Start with a decision',
      'You have not answered this example yet. Read Sam’s situation, choose a decision and check the reason behind it.',
      'Open the question',
      'quiz.html',
    ],
    loading: [
      'Opening the learning example',
      'Money Before Markets · Stop 2. The question is loading in this preview; no answer has been submitted.',
      'Show the sample question',
      'quiz.html',
    ],
    error: [
      'The question could not load',
      'This error preview has no submitted answer. Retry to open the sample question, or return to the route.',
      'Retry the example',
      'quiz.html',
    ],
    locked: [
      'Build the foundation first',
      'This example represents a later locked learning check. Complete the earlier readiness lesson before opening it. The route explains the sequence.',
      'View the prerequisite route',
      'map.html',
    ],
    success: [
      'The essential payment comes first',
      'Correct reasoning: keep the rent money available. Its value could fall in a market, leaving Sam unable to make an essential payment. A possible gain does not remove that risk.',
      'Return to the route',
      'map.html?state=success',
    ],
  },
}
if (states[screen]?.[queryState]) {
  const [title, copy, action, href] = states[screen][queryState]
  const context =
    screen === 'dashboard'
      ? 'Your learning journal'
      : screen === 'map'
        ? 'Money Before Markets · Route'
        : 'Money Before Markets · Learning example'
  document.getElementById('state-region').innerHTML =
    `<p class="folio">${context}</p><h1>${screen === 'map' ? 'Money Before<br>Markets' : screen === 'dashboard' ? 'Your journal' : 'Money within reach'}</h1><section class="state-note" aria-labelledby="state-title"><p class="state-tag">${queryState[0].toUpperCase() + queryState.slice(1)} state · Example only</p>${queryState === 'success' ? '<p class="finish-mark" aria-label="Learning completed">✓</p>' : ''}<h2 id="state-title">${title}</h2><p>${copy}</p><div class="state-actions"><a class="primary" href="${href}">${action}</a>${screen !== 'map' ? '<a class="secondary" href="map.html">See the learning route</a>' : '<a class="secondary" href="dashboard.html">Return to your journal</a>'}</div></section><p class="quiet">Prototype only. No learning record is changed or saved.</p>`
}
const form = document.getElementById('quiz-form')
form?.addEventListener('submit', (event) => {
  event.preventDefault()
  const answer = new FormData(form).get('answer')
  const feedback = document.getElementById('feedback')
  const correct = answer === 'reserve'
  feedback.hidden = false
  if (correct) {
    form.hidden = true
    feedback.innerHTML =
      '<p class="state-tag">Correct reasoning · Example completed</p><h2>The essential payment comes first.</h2><p>Keeping the rent money available protects a payment Sam cannot postpone. Markets can fall over a month; hoping for a gain does not make that money available when needed.</p><p class="quiet">Practice feedback only. This example does not record mastery or award a real star.</p><a class="primary" href="map.html?state=success">Return to the route</a><button class="secondary" id="retry" type="button">Try the question again</button>'
  } else {
    const explanation =
      answer === 'split'
        ? 'Investing half still puts part of the rent at risk. Splitting money does not remove the chance of a shortfall.'
        : 'A possible gain is uncertain. A fall in value could leave Sam short of money for rent next month.'
    feedback.innerHTML = `<p class="state-tag">Reconsider this choice</p><h2>What if the value falls?</h2><p>${explanation} Which choice keeps the full essential payment available?</p><button class="secondary" id="retry" type="button">Try another answer</button>`
  }
  feedback.focus()
  document.getElementById('retry').addEventListener('click', () => {
    form.hidden = false
    form.reset()
    feedback.hidden = true
    form.querySelector('input').focus()
  })
})
