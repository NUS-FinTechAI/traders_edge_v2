const screen = document.body.dataset.screen
const validStates = [
  'default',
  'empty',
  'loading',
  'error',
  'locked',
  'success',
]
const requested = new URLSearchParams(location.search).get('state')
const state = validStates.includes(requested) ? requested : 'default'
const compass = `<svg viewBox="0 0 32 36" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 2v32M2 18h28M6 7l20 22M6 29 26 7"/><path fill="currentColor" d="m16 6 5 12-5 12-5-12Z"/><path stroke="#f7f2e7" d="M16 8v20"/></svg>`
const star = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m12 2 3 6.5 7 1-5 5 1.2 7-6.2-3.4-6.2 3.4 1.2-7-5-5 7-1Z"/></svg>`
const cache = `<svg class="cache" viewBox="0 0 100 85" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M18 32h64v40H18zM23 32V19h54v13M18 47h64M43 42h14v12H43zM28 58v14M72 58v14M35 19v13M65 19v13M44 13V5h22v8H44"/><path d="m31 10-6-5m52 8 9-4M10 29l-6-2"/></svg>`
const action = (label, href, secondary = false) =>
  `<a class="button${secondary ? ' secondary' : ''}" href="${href}">${label}<span aria-hidden="true">→</span></a>`
const stateCopy = {
  dashboard: {
    empty: [
      'Your fieldbook starts here',
      'Begin with money you need soon. No example checkpoints have been recorded yet.',
      'Explore Module 1',
      'map.html?state=empty',
    ],
    loading: [
      'Opening your fieldbook',
      'Your learning path stays below while progress is being checked. This prototype does not connect to an account.',
      'Load example progress',
      'dashboard.html',
    ],
    error: [
      'Progress could not be loaded',
      'Your next step is still available. Retry to restore the example progress shown in this prototype.',
      'Try again',
      'dashboard.html',
    ],
    locked: [
      'Market practice comes later',
      'First complete the readiness, markets, products, portfolio, execution and risk prerequisites. Begin with the foundations below.',
      'Review the learning path',
      'map.html',
    ],
    success: [
      'A learning note recorded',
      'Example only: you identified why money needed soon should be kept separate from market risk.',
      'See your path',
      'map.html?state=success',
    ],
  },
  map: {
    empty: [
      'A fresh route',
      'Start at checkpoint 1. The route makes each prerequisite visible before you move on.',
      'Read the first note',
      '#first-note',
    ],
    loading: [
      'Checking your checkpoints',
      'The route remains visible. Completion markers below are example placeholders while this loading state is shown.',
      'Load example route',
      'map.html',
    ],
    error: [
      'Your route could not be updated',
      'The checkpoint descriptions are available below. Retry to restore example completion markers.',
      'Try again',
      'map.html',
    ],
    locked: [
      'The readiness cache is locked',
      'Complete the three learning checkpoints and the readiness check before this summary can be recorded.',
      'Review the current checkpoint',
      '#current-checkpoint',
    ],
    success: [
      'Checkpoint 2 recorded · example',
      'You explained why essential near-term money should not depend on uncertain market prices. Later checkpoints are shown for context.',
      'Review the reasoning',
      'quiz.html?state=success',
    ],
  },
  quiz: {
    empty: [
      'A new practice page',
      'No answer is selected. Read the situation and choose the reason that best protects essential spending.',
      'Read the question',
      '#question',
    ],
    loading: [
      'Opening the practice page',
      'This example question stays available while the lesson is loading. No answer has been sent.',
      'Load example question',
      'quiz.html',
    ],
    error: [
      'Your answer was not recorded',
      'You can retry this example question. This prototype has no saved account progress.',
      'Try again',
      'quiz.html',
    ],
    locked: [
      'Read the field note first',
      'The check opens after the note: money needed for essentials soon should not depend on uncertain market outcomes.',
      'Try the example question',
      'quiz.html',
    ],
    success: [
      'Practice complete · example',
      'You chose to keep essential spending separate from market uncertainty. Completion here is a prototype state, not a mastery award.',
      'Return to the path',
      'map.html?state=success',
    ],
  },
}
function banner() {
  if (state === 'default') return ''
  const [title, copy, label, href] = stateCopy[screen][state]
  return `<section class="state-banner" aria-label="${state} state"><h2>${title}</h2><p>${copy}</p>${action(label, href, true)}</section>`
}
function header() {
  return `<a class="skip" href="#main">Skip to content</a><header class="masthead"><a class="brand" href="dashboard.html">${compass}<span>Trader’s Edge</span></a><nav aria-label="Main navigation"><a href="dashboard.html"${screen === 'dashboard' ? ' aria-current="page"' : ''}>Fieldbook</a><a href="map.html"${screen === 'map' ? ' aria-current="page"' : ''}>My path</a></nav></header>`
}
function routeChart(overview = false) {
  const fresh = state === 'empty',
    complete = state === 'success'
  const dest = (id) =>
    overview
      ? `map.html${fresh ? '?state=empty' : complete ? '?state=success' : ''}#${id}`
      : `#${id}`
  return `<section class="chart-section" aria-label="Foundations chart"><div class="chart-heading"><h2>Foundations chart</h2><span class="small">Example · ${fresh ? '0' : complete ? '2' : '1'} / 4</span></div><p class="chart-caption">Protect near-term needs on the shore. Cross into uncertainty only after the foundations.</p><nav class="cartographic-route" aria-label="Module 1 checkpoint map"><svg class="chart-lines" viewBox="0 0 300 500" preserveAspectRatio="none" aria-hidden="true"><path class="shore" d="M0 0H300V177L273 185 257 177 232 196 210 185 184 209 160 193 129 214 96 193 68 203 36 186 0 198Z"/><path class="boundary" d="M0 198 36 186 68 203 96 193 129 214 160 193 184 209 210 185 232 196 257 177 273 185 300 177"/><path class="main-route" d="M75 50C190 40 70 150 225 150S74 204 75 250 223 288 225 350 75 385 75 450"/><path class="bonus-route" d="M225 350C280 367 273 421 225 450"/></svg><a class="chart-stop stop-one${fresh ? ' active' : ''}" href="${dest('first-note')}"><span class="chart-number" aria-hidden="true">${fresh ? '1' : '✓'}</span><strong>Name your goals</strong><span>${fresh ? 'Start here' : 'Reviewed · example'}</span></a><a class="chart-stop stop-two${!fresh ? ' active' : ''}" href="${fresh ? dest('current-checkpoint') : overview ? dest('current-checkpoint') : complete ? 'quiz.html?state=success' : 'quiz.html'}"><span class="chart-number" aria-hidden="true">${complete ? '✓' : '2'}</span><strong>Essential money</strong><span>${fresh ? 'Locked · finish 1' : complete ? 'Recorded · review' : 'Ready · try practice'}</span></a><a class="chart-stop stop-three" href="${dest('uncertainty')}"><span class="chart-number" aria-hidden="true">3</span><strong>Uncertainty</strong><span>${complete ? 'Later lesson · outside this preview' : 'Locked · finish 2'}</span></a><a class="chart-stop stop-four" href="${dest('readiness')}"><span class="chart-number" aria-hidden="true">4</span><strong>Readiness</strong><span>Locked · finish 3</span></a><a class="chart-stop stop-cache" href="${dest('knowledge-cache')}"><span class="chart-number" aria-hidden="true">◇</span><strong>Knowledge cache</strong><span>Destination · finish 4</span></a><a class="chart-stop stop-bonus" href="${dest('bonus-note')}"><span class="chart-number" aria-hidden="true">☆</span><strong>Reflection</strong><span>Optional · after 4</span></a></nav><p class="small chart-key"><span>Solid route · required checkpoints</span><span>Dashed branch · optional reflection</span></p></section>`
}
function dashboard() {
  const fresh = state === 'empty',
    complete = state === 'success'
  return `<div class="fieldbook-spread"><section class="today-entry"><p class="eyebrow"><span class="number">01</span>Money before markets</p><h1>Your next field note</h1><section class="main-entry"><div class="entry-top">${star}<span>${fresh ? 'Start with checkpoint 1' : complete ? 'Example · checkpoint 2 recorded' : 'Next · checkpoint 2 of 4'}</span></div><h2>${fresh ? 'Name what your money is for' : complete ? 'A reason worth keeping' : 'Protect essential money'}</h2><p>${fresh ? 'Begin with essential bills and when they are due. The route opens one idea at a time.' : complete ? 'You identified why rent money should stay separate from uncertain market prices. Review the reasoning whenever useful.' : 'Separate money you need soon from money you can leave exposed to uncertainty.'}</p>${action(complete ? 'Review my reasoning' : fresh ? 'Begin with goals' : 'Open this checkpoint', complete ? 'quiz.html?state=success' : fresh ? 'map.html?state=empty#first-note' : 'map.html#current-checkpoint')}</section><aside class="note field-note"><h3>In the margin</h3><p>Choosing to keep money out of the market can be a considered decision. Learning comes before trading.</p></aside><section class="activity-entry"><h2>A week of learning</h2><p class="small">${fresh ? 'Example new learner · no learning days recorded yet.' : 'Example activity · 3 learning days. Return when it suits you.'}</p>${fresh ? '' : `<div class="week" role="img" aria-label="Example learning week: learning completed on Monday, Wednesday and Saturday. No learning activity on Tuesday, Thursday, Friday or Sunday.">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => `<div class="day" aria-hidden="true">${day}<i class="${[0, 2, 5].includes(i) ? 'filled' : ''}" aria-label="${[0, 2, 5].includes(i) ? 'Learning completed' : 'No activity'}">${[0, 2, 5].includes(i) ? '✓' : '·'}</i></div>`).join('')}</div>`}</section></section><aside class="chart-overview">${routeChart(true)}<a class="text-link" href="map.html${fresh ? '?state=empty' : complete ? '?state=success' : ''}">Open the full learning path →</a></aside></div>`
}
function map() {
  const fresh = state === 'empty',
    complete = state === 'success'
  return `<div class="map-intro"><p class="eyebrow"><span class="number">01</span>Your learning route</p><h1>Money before markets</h1><p class="intro">Follow the numbered route from essential needs to a readiness check. Each stop explains the next.</p></div><div class="fieldbook-map-layout">${routeChart()}<aside class="map-reading"><h2>Read this chart</h2><p>The shaded shore holds your foundations: goals and essential money. The boundary marks the move to uncertain outcomes; its checkpoints stay locked until the earlier learning is complete.</p><div class="legend"><p class="small">${star}<strong>Standard star</strong><br>A required learning checkpoint completed.</p><p class="small">${star}<strong>Bonus star</strong><br>An optional reflection completed.</p><p class="small">Stars mark learning, never trading profit.</p></div></aside></div><section class="checkpoint-notes" aria-label="Checkpoint notes"><h2>Notes along the route</h2><div class="route-note" id="first-note"><span class="status">Checkpoint 1 · ${fresh ? 'start here' : 'reviewed in this example'}</span><h3>Name your goals</h3><p>Some goals cannot wait. Identify essential bills and when they are due before considering money for uncertain outcomes.</p>${fresh ? action('Try the learning example', 'quiz.html') : ''}</div><div class="route-note" id="current-checkpoint"><span class="status">Checkpoint 2 · ${fresh ? 'locked' : complete ? 'practice recorded · example' : 'ready'}</span><h3>Protect essential money</h3><p>${fresh ? 'First read Name your goals and try its learning example. No checkpoints are complete in this fresh-learner preview.' : 'Money needed soon should not depend on market prices being favorable.'}</p>${fresh ? '' : action(complete ? 'Review the reasoning' : 'Try a short practice', complete ? 'quiz.html?state=success' : 'quiz.html')}</div><div class="route-note" id="uncertainty"><span class="status">Checkpoint 3 · ${complete ? 'later lesson · outside this preview' : 'locked'}</span><h3>Allow for uncertainty</h3><p>${complete ? 'Your example essential-money practice is recorded. The next lesson on uncertainty is outside this preview.' : 'Complete the essential-money lesson and explain your decision before this checkpoint. Its learning activity is outside this prototype.'}</p></div><div class="route-note" id="readiness"><span class="status">Checkpoint 4 · locked</span><h3>The readiness check</h3><p>Complete checkpoints 1–3 before applying the foundations to a different situation. This assessment is outside the prototype.</p></div><div class="route-note cache-note" id="knowledge-cache">${cache}<span class="status">Destination · locked</span><h3>Your knowledge cache</h3><p>After the readiness check, gather the foundation notes you can explain. This is a learning record, not a financial reward.</p></div><div class="route-note" id="bonus-note"><span class="status">Optional branch · locked</span><h3>Leave yourself a note</h3><p>After checkpoint 4, reflect on a spending need you would protect. This bonus mission does not block the required route.</p></div></section>`
}
function quiz() {
  const complete = state === 'success'
  const locked = state === 'locked'
  return `<div class="quiz-layout"><section><p class="eyebrow"><span class="number">02</span>Protect essential money · practice</p><h1 id="question">Which money needs to stay out of market risk?</h1><p class="case">Sam has set aside <strong>$600 for rent due next month</strong>. A friend suggests investing it briefly, hoping it grows before rent is due.</p>${locked ? '<div class="note"><h3>Field note</h3><p>A market investment can fall in value just when the money is needed. Essential near-term spending needs a different role from money available for uncertain outcomes.</p></div>' : `<form id="practice"><fieldset class="choices"${complete ? ' disabled' : ''}><legend>Choose the decision and its reason.</legend><label class="answer"><input type="radio" name="answer" value="protect"${complete ? ' checked' : ''} required><span><b>Keep the rent money separate.</b><span>Rent is due soon, and the investment could lose value.</span></span></label><label class="answer"><input type="radio" name="answer" value="short"><span><b>Invest it for only a few days.</b><span>A shorter time in the market removes the risk.</span></span></label><label class="answer"><input type="radio" name="answer" value="part"><span><b>Invest half of the rent money.</b><span>Keeping half aside guarantees enough for rent.</span></span></label></fieldset>${complete ? '' : `<details class="confidence"><summary>Add your confidence (optional)</summary><fieldset class="choices"><legend class="visually-hidden">How confident are you?</legend><label><input type="radio" name="confidence" value="unsure"> Still unsure</label><label><input type="radio" name="confidence" value="somewhat"> Fairly sure</label><label><input type="radio" name="confidence" value="very"> Very sure</label></fieldset></details><div class="submit-row"><button class="button" type="submit">Check my reasoning <span aria-hidden="true">→</span></button></div>`}</form>`}<div id="feedback" aria-live="polite">${complete ? correctFeedback() : ''}</div></section><aside class="quiz-note"><h2>A field note</h2><p><strong>Market risk</strong> means an investment’s value can fall. You cannot rely on it being worth enough on the day a bill is due.</p><p class="small">This practice checks your reasoning. It does not ask you to place a trade.</p><a class="text-link" href="map.html">Return to the route →</a></aside></div>`
}
function correctFeedback() {
  return `<section class="feedback" tabindex="-1"><span class="status">Correct reasoning · example practice</span><h2>The due date matters.</h2><p>Sam needs all $600 next month. A fall in the investment’s value could leave rent unpaid. Keeping this money separate protects the spending need; future market gains are uncertain.</p><p class="small">You identified a risk to essential spending. One answer alone does not establish mastery.</p>${action('Back to my learning path', 'map.html?state=success')}</section>`
}
document.body.innerHTML = `${header()}<main class="folio" id="main"><div class="metadata"><span>Learning fieldbook / ${screen === 'dashboard' ? 'Overview' : screen === 'map' ? 'Module 01' : 'Checkpoint 02'}</span><span class="example">Example learner · concept preview</span></div>${screen === 'quiz' ? '<a class="back" href="map.html">← Money before markets</a>' : ''}${banner()}${screen === 'dashboard' ? dashboard() : screen === 'map' ? map() : quiz()}</main><footer class="footer"><span>Trader’s Edge · Fieldbook direction</span><span>Static concept. Progress is not saved.</span></footer><details class="diagnostics"><summary>Prototype state controls</summary><nav aria-label="Prototype states">${validStates.map((item) => `<a href="${screen}.html${item === 'default' ? '' : `?state=${item}`}"${state === item ? ' aria-current="true"' : ''}>${item[0].toUpperCase() + item.slice(1)}</a>`).join('')}</nav></details>`
const form = document.querySelector('#practice')
form?.addEventListener('submit', (event) => {
  event.preventDefault()
  const value = new FormData(form).get('answer')
  const feedback = document.querySelector('#feedback')
  if (value === 'protect') {
    feedback.innerHTML = correctFeedback()
    form.querySelector('fieldset').disabled = true
    form.querySelector('.submit-row').hidden = true
    form.querySelector('.confidence').hidden = true
  } else {
    feedback.innerHTML = `<section class="feedback wrong" tabindex="-1"><span class="status">Not yet · reconsider the spending need</span><h2>${value === 'short' ? 'A few days can still bring a loss.' : 'Half the rent is still needed.'}</h2><p>${value === 'short' ? 'A shorter holding period does not remove uncertainty. If the investment falls, Sam may not have enough when rent is due.' : 'Sam needs the full $600. Putting half at risk can still create a shortfall; the amount kept aside does not cover the bill.'}</p><button class="button secondary" type="button" id="retry">Try again <span aria-hidden="true">↺</span></button></section>`
    document.querySelector('#retry').addEventListener('click', () => {
      feedback.innerHTML = ''
      form
        .querySelectorAll('[name=answer]')
        .forEach((input) => (input.checked = false))
      form.querySelector('[name=answer]').focus()
    })
  }
  feedback.querySelector('section').focus()
})
