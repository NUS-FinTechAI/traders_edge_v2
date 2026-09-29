function SiteHeader() {
  return (
    <header className="site-header">
      <div className="page-width header-inner">
        <a className="brand" href="#top" aria-label="Trader's Edge home">
          <img src="/favicon.svg" width="36" height="36" alt="" />
          <span>
            Trader’s <span className="brand-accent">Edge</span>
          </span>
        </a>
        <span className="header-note">
          A foundation for better understanding.
        </span>
      </div>
    </header>
  )
}

export default SiteHeader
