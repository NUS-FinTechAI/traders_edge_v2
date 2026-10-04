const screen = document.body.dataset.screen
const allowed = ['default', 'empty', 'loading', 'error', 'locked', 'success']
const requested = new URLSearchParams(location.search).get('state') || 'default'
const state = allowed.includes(requested) ? requested : 'default'
const root = document.querySelector('#screen')
const arrow = '<span class="arrow" aria-hidden="true">→</span>'
const link = (href, text, secondary = false) =>
  `<a class="${secondary ? 'secondary' : 'primary'}" href="${href}">${text}${arrow}</a>`
const note = (title, body, kind = '', action = '') =>
  `<section class="status ${kind}" aria-label="Example ${state} state"><h2>${title}</h2><p>${body}</p>${action ? `<div class="actions">${action}</div>` : ''}</section>`
const term = `<details id="uncertainty-note" class="term"><summary>What does “uncertain outcome” mean?</summary><p>You could end with less money than you started with. The timing and size of a gain or loss are not guaranteed.</p></details>`
const progress = (n) =>
  `<div class="progress-track" aria-hidden="true">${[0, 1, 2].map((i) => `<span class="${i < n ? 'done' : ''}"></span>`).join('')}</div><p class="small muted">Example progress · ${n} of 3 checkpoints</p>`
const days = `<div class="days" role="img" aria-label="Example activity: learning recorded Monday, Wednesday and Friday. No record on other days.">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => `<span class="day ${[0, 2, 4].includes(i) ? 'active' : ''}" aria-hidden="true"><span>${d}</span><b>${[0, 2, 4].includes(i) ? '✓' : '·'}</b></span>`).join('')}</div>`
const loading = (name) =>
  note(
    `Loading ${name}`,
    'Example loading state. Your place remains visible while this section is prepared.',
    '',
    link(`${screen}.html`, 'Show ready example', true),
  ) +
  '<div class="skeleton" aria-hidden="true"><span></span><span></span><span></span></div>'
const error = (name) =>
  note(
    `${name} could not load`,
    'Example connection error. Nothing was submitted. You can retry this section when you are ready.',
    'error',
    link(`${screen}.html`, 'Try again'),
  )
function dashboard() {
  let content = ''
  if (state === 'loading') content = loading('your next checkpoint')
  else if (state === 'error') content = error('Your learning activity')
  else if (state === 'locked')
    content = note(
      'Advanced practice comes later',
      'Example locked state. Multiplayer and endless practice require evidence of mastery across readiness, risk, safe execution and reflection. Your foundation path is available now.',
      '',
      link('map.html', 'Open foundation path'),
    )
  else
    content = `<section class="next-block" aria-labelledby="next-title"><div class="section-tag"><span class="mono">${state === 'success' ? 'Checkpoint complete' : 'Your next checkpoint'}</span><span class="index" aria-hidden="true">${state === 'empty' ? '01' : '03'}</span></div><h2 class="objective" id="next-title">${state === 'success' ? 'Keep essential money within reach.' : state === 'empty' ? 'Start with what your money is for.' : 'Which money needs certainty?'}</h2><p class="description">${state === 'success' ? 'Example result: you identified why rent money should stay available. Review the route and the reasoning you practised.' : state === 'empty' ? 'Begin with goals and near-term spending. There is no trading experience to catch up on.' : 'Practise separating money for essential spending from money you can expose to an uncertain outcome.'}</p>${link(`map.html${state === 'empty' ? '?state=empty' : state === 'success' ? '?state=success' : ''}`, state === 'success' ? 'Review completed route' : state === 'empty' ? 'Begin Module 1' : 'Continue Module 1')}<p class="small muted" style="margin-top:12px">${state === 'empty' ? 'Example new learner · No progress yet' : state === 'success' ? 'Example completion · Learning check passed' : 'Example next step · One decision, with an explanation'}</p></section>`
  root.innerHTML = `<p class="eyebrow mono">Module 01 / Money before markets</p><h1>Protect money<br>you need soon.</h1><p class="intro">Learn to protect the money you need before exploring what markets can offer.</p><div class="dashboard-layout"><div>${content}${term}</div><aside class="ledger" aria-label="Example learning record"><section><h3>Your learning route</h3><p class="small muted">Money before markets</p>${progress(state === 'empty' ? 0 : state === 'success' ? 3 : 2)}</section><hr class="rule"><section><h3>Learning this week</h3>${state === 'empty' ? '<p class="small muted">Example: no activity yet. Your first checkpoint will begin your record.</p>' : days + '<p class="small muted">Example: 3 learning days.<br>Return when it works for you.</p>'}</section></aside></div><a class="journey-link" href="map.html"><span><strong>See the whole route</strong><span class="small muted">Three checkpoints, one useful principle.</span></span>${arrow}</a>`
}
function map() {
  const fresh = state === 'empty' || state === 'locked',
    complete = state === 'success'
  const labels = [
    [
      'Base camp',
      'Name the near-term needs',
      'Start with essentials such as housing, food and planned bills.',
    ],
    [
      'Safe ground',
      'Keep essentials available',
      'Money needed soon needs a dependable place and access when due.',
    ],
    [
      'Decision crossing',
      'Choose what can face uncertainty',
      'Apply the distinction to one person’s situation.',
    ],
  ]
  const nodes = labels
    .map((x, i) => {
      const done = complete || (!fresh && i < 2),
        current = !complete && (fresh ? i === 0 : i === 2)
      const status = done
        ? 'Complete · standard star earned'
        : current
          ? 'Available · next checkpoint'
          : 'Locked · finish the previous checkpoint'
      const action = done
        ? `<details><summary>Review the principle</summary><p>${x[2]} Completion here is example data.</p></details>`
        : current
          ? link(
              'quiz.html',
              fresh ? 'Explore the example' : 'Open practice check',
            )
          : `<details><summary>Why is this locked?</summary><p>Complete checkpoint ${String(i).padStart(2, '0')} first. Each step gives you the reasoning used in the next.</p></details>`
      return `<li id="checkpoint-${i + 1}" class="checkpoint ${done ? 'complete' : current ? 'current' : ''}"><span class="node" aria-hidden="true">${done ? '✓' : String(i + 1).padStart(2, '0')}</span><div><p class="mono">${x[0]}</p><h3>${x[1]}</h3><p>${status}</p>${action}</div></li>`
    })
    .join('')
  const routeSketch = `<section class="survey" aria-labelledby="survey-title"><div class="survey-heading"><h2 id="survey-title">Your route to the cache</h2><span class="mono">Example map</span></div><nav class="survey-canvas" aria-label="Navigate the expedition map"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="survey-route" d="M14 14 H58 V30 H28 V60 H76 V80"/><path class="survey-branch" d="M58 30 H85 V43"/></svg><a class="waypoint waypoint-one ${fresh ? 'next' : 'earned'}" href="#checkpoint-1"><span class="waypoint-node" aria-hidden="true">${fresh ? '01' : '✓'}</span><span class="waypoint-caption"><strong>Base camp</strong><span>${fresh ? 'Start here' : 'Complete'}</span></span></a><a class="waypoint waypoint-two ${fresh ? '' : 'earned'}" href="#checkpoint-2"><span class="waypoint-node" aria-hidden="true">${fresh ? '02' : '✓'}</span><span class="waypoint-caption"><strong>Safe ground</strong><span>${fresh ? 'Locked' : 'Complete'}</span></span></a><a class="waypoint waypoint-three ${complete ? 'earned' : fresh ? '' : 'next'}" href="${fresh ? '#checkpoint-3' : complete ? '#checkpoint-3' : 'quiz.html'}"><span class="waypoint-node" aria-hidden="true">${complete ? '✓' : '03'}</span><span class="waypoint-caption"><strong>The crossing</strong><span>${complete ? 'Complete' : fresh ? 'Locked' : 'Next: practise'}</span></span></a><a class="waypoint waypoint-note" href="#uncertainty-note"><span class="waypoint-node" aria-hidden="true">?</span><span class="waypoint-caption"><strong>Field note</strong><span>Uncertainty</span></span></a><a class="waypoint waypoint-cache" href="#destination"><span class="waypoint-node" aria-hidden="true">◇</span><span class="waypoint-caption"><strong>Principle cache</strong><span>${complete ? 'Collected' : 'Destination'}</span></span></a></nav><p class="small muted survey-legend">Solid route: learning checkpoints · Dashed branch: an optional definition. Select a marker to open its step.</p></section>`
  let stateNote = ''
  if (state === 'loading') stateNote = loading('the route')
  else if (state === 'error') stateNote = error('The route')
  else if (state === 'empty')
    stateNote = note(
      'Your route starts here',
      'Example new learner. Start at Base camp; the next checkpoints unlock as you complete each step.',
    )
  else if (state === 'locked')
    stateNote = note(
      'The crossing needs two foundations',
      'Example locked state. Checkpoint 03 opens after you identify near-term needs and explain why that money should stay available. Start at Base camp.',
    )
  else if (state === 'success')
    stateNote = note(
      'Route completed',
      'Example success. You explained why essential near-term money should not depend on a market outcome.',
      'success',
    )
  root.innerHTML = `<p class="eyebrow mono">Expedition 01 / Foundation route</p><h1>Money before<br>markets.</h1><p class="intro">Follow the route from everyday needs to a decision you can explain. Your destination is a useful rule, not a trade.</p><div class="route-meta"><span>3 learning checkpoints</span><span>Destination: an essentials-first rule</span><span>Example progress · ${fresh ? '0' : complete ? '3' : '2'} of 3</span></div>${stateNote}${['loading', 'error'].includes(state) ? '' : `${routeSketch}<div class="route-board"><ol class="route-list" aria-label="Treasure route through Module 1">${nodes}<li id="destination" class="checkpoint cache"><span class="node" aria-hidden="true">◇</span><div><p class="mono">Destination cache</p><h3>A principle to carry forward</h3><p>${complete ? 'Unlocked example: protect money needed for essential near-term spending before accepting market uncertainty.' : 'Reach all three checkpoints to collect your written learning principle.'}</p>${complete ? link('dashboard.html?state=success', 'Return to today') : ''}</div></li></ol><aside class="route-key"><h3>Reading your map</h3><div class="key-row"><b><span class="star" aria-hidden="true">☆</span> Standard star</b>Complete the learning check and explain the decision.</div><div class="key-row"><b><span class="star" aria-hidden="true">✧</span> Bonus star</b>Optional: explain when the same choice could change. This route has no bonus activity yet.</div></aside></div>`}${term}`
}
const quizQuestion = `<section class="question"><div class="scenario"><p>Sam has <strong>$600</strong> set aside for rent due next month. Sam also has <strong>$100</strong> that is not needed for essential spending.</p></div><form id="quiz-form"><fieldset><legend>Which reasoning best protects Sam’s near-term needs?</legend><label class="choice"><input type="radio" name="answer" value="a"><span class="letter">A</span><span><strong>Keep the rent money available.</strong>Only consider uncertain outcomes for other money after checking the wider financial situation.</span></label><label class="choice"><input type="radio" name="answer" value="b"><span class="letter">B</span><span><strong>Put both amounts into the market.</strong>A month should leave enough time for a gain before rent is due.</span></label><label class="choice"><input type="radio" name="answer" value="c"><span class="letter">C</span><span><strong>Use half the rent money.</strong>Splitting it makes the payment safe even if the market falls.</span></label></fieldset><details class="confidence-disclosure"><summary>Add confidence · optional, not scored</summary><fieldset class="confidence"><legend>How sure are you?</legend><div class="confidence-options"><label><input type="radio" name="confidence" value="exploring">Still thinking</label><label><input type="radio" name="confidence" value="fairly">Fairly sure</label><label><input type="radio" name="confidence" value="very">Very sure</label></div></fieldset></details><p id="validation" class="validation" role="alert" hidden>Choose a reason before checking it.</p><div class="actions"><button class="primary" type="submit">Check my reasoning ${arrow}</button></div></form><div id="feedback" class="feedback" aria-live="polite" tabindex="-1"></div></section>`
function showFeedback(correct, scroll = true) {
  const f = document.querySelector('#feedback')
  if (!f) return
  f.innerHTML = note(
    correct
      ? 'That protects the essential payment.'
      : 'Reconsider the money Sam needs soon.',
    correct
      ? 'Rent has a fixed deadline; a market outcome does not. Keeping that $600 available protects an essential payment. The other $100 is not automatically suitable for investing—Sam still needs to consider savings, goals and risk capacity.'
      : 'A market can fall or stay down when rent is due. Even using half can leave Sam short. Start by separating essential spending from money that could remain unavailable or lose value.',
    correct ? 'success' : 'error',
    correct
      ? link('map.html?state=success', 'See your completed route')
      : '<button class="secondary" id="retry" type="button">Try the decision again</button>',
  )
  if (correct) {
    document.querySelector('#quiz-form').hidden = true
    f.insertAdjacentHTML(
      'beforeend',
      '<p class="small muted">Example learning result · Standard star for the explained decision. No trading reward.</p>',
    )
  } else
    document.querySelector('#retry').addEventListener('click', () => {
      f.innerHTML = ''
      document.querySelector('#quiz-form').reset()
      document.querySelector('input[name="answer"]').focus()
    })
  if (scroll) {
    f.focus()
    f.scrollIntoView({ block: 'nearest', behavior: 'auto' })
  }
}
function quiz() {
  let body = ''
  if (state === 'loading') body = loading('the practice check')
  else if (state === 'error') body = error('The practice check')
  else if (state === 'locked')
    body = `<section class="locked-note"><h2>Build the two foundations first.</h2><p class="description">Example locked state. Identify near-term needs and explain why essential money should stay available before taking this check.</p>${link('map.html?state=locked', 'Review the prerequisites')}</section>`
  else
    body =
      (state === 'empty'
        ? note(
            'No answer selected yet',
            'Example fresh attempt. Take your time. You can change your choice before checking it.',
          )
        : '') + quizQuestion
  root.innerHTML = `<div class="quiz-layout"><div class="quiz-header"><a href="map.html">← Learning path</a><span class="mono">Example · Checkpoint 03 / 03</span></div><p class="eyebrow mono">Money before markets / Practice</p><h1>Protect the money<br>with a deadline.</h1><p class="intro">Choose a reason, then compare it with the explanation.</p>${body}${term}</div>`
  const form = document.querySelector('#quiz-form')
  if (form)
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const answer = new FormData(form).get('answer')
      const validation = document.querySelector('#validation')
      validation.hidden = Boolean(answer)
      if (!answer) {
        document.querySelector('input[name="answer"]').focus()
        return
      }
      showFeedback(answer === 'a')
    })
  if (state === 'success') showFeedback(true, false)
}
;(({ dashboard, map, quiz })[screen] || dashboard)()
document.querySelector('.state-links').innerHTML = allowed
  .map(
    (s) =>
      `<a href="${screen}.html${s === 'default' ? '' : `?state=${s}`}"${s === state ? ' aria-current="page"' : ''}>${s}</a>`,
  )
  .join('')

document.querySelector('.waypoint-note')?.addEventListener('click', () => {
  document.querySelector('#uncertainty-note').open = true
})

const surveyCanvas = document.querySelector('.survey-canvas')
if (surveyCanvas) {
  const drawRoute = () => {
    const canvas = surveyCanvas.getBoundingClientRect()
    const point = (name) => {
      const box = surveyCanvas
        .querySelector(`.waypoint-${name} .waypoint-node`)
        .getBoundingClientRect()
      return {
        x: ((box.left + box.width / 2 - canvas.left) / canvas.width) * 100,
        y: ((box.top + box.height / 2 - canvas.top) / canvas.height) * 100,
      }
    }
    const a = point('one'),
      b = point('two'),
      c = point('three'),
      d = point('cache'),
      note = point('note')
    surveyCanvas
      .querySelector('.survey-route')
      .setAttribute(
        'd',
        `M${a.x} ${a.y} L${b.x} ${b.y} L${c.x} ${c.y} L${d.x} ${d.y}`,
      )
    surveyCanvas
      .querySelector('.survey-branch')
      .setAttribute('d', `M${b.x} ${b.y} L${note.x} ${note.y}`)
  }
  new ResizeObserver(drawRoute).observe(surveyCanvas)
  drawRoute()
}
