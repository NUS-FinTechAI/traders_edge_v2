import './HomePage.css'

function HomePage() {
  return (
    <main id="main" className="home-page page-width" tabIndex={-1}>
      <section className="welcome" aria-labelledby="welcome-title">
        <p className="eyebrow">
          <span className="eyebrow-line" />
          KNOWLEDGE IS YOUR EDGE
        </p>
        <h1 id="welcome-title">
          Welcome to
          <br />
          Trader’s <span>Edge.</span>
        </h1>
        <p className="welcome-description">
          Build your understanding of trading,
          <br className="desktop-break" /> one concept at a time.
        </p>
        <a className="primary-link" href="#about">
          About Trader’s Edge
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M12 4v16m-6-6 6 6 6-6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
        <div className="welcome-decoration" aria-hidden="true">
          <svg viewBox="0 0 320 240" fill="none">
            <path
              className="chart-grid"
              d="M0 40h320M0 80h320M0 120h320M0 160h320M0 200h320M40 0v240M80 0v240M120 0v240M160 0v240M200 0v240M240 0v240M280 0v240"
            />
            <g className="chart-candles" strokeWidth="2">
              <path d="M60 145v60M110 100v80M160 115v75M210 65v85M260 30v80" />
              <rect x="49" y="160" width="22" height="29" rx="2" />
              <rect x="99" y="116" width="22" height="45" rx="2" />
              <rect x="149" y="136" width="22" height="35" rx="2" />
              <rect x="199" y="85" width="22" height="45" rx="2" />
              <rect x="249" y="47" width="22" height="43" rx="2" />
            </g>
          </svg>
        </div>
      </section>
      <section
        id="about"
        className="about-panel"
        aria-labelledby="about-title"
        tabIndex={-1}
      >
        <div className="about-heading">
          <span className="section-label">THE IDEA</span>
          <h2 id="about-title">About Trader’s Edge</h2>
        </div>
        <div className="about-copy">
          <p className="about-lead">
            Understanding starts with the fundamentals.
          </p>
          <p>
            Trader’s Edge is an education project centered on trading concepts
            and how financial markets work. Its purpose is to make those ideas
            clearer and more approachable, one step at a time.
          </p>
        </div>
      </section>
    </main>
  )
}

export default HomePage
