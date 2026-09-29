import SiteHeader from './components/site-header/SiteHeader'
import SiteFooter from './components/site-footer/SiteFooter'
import HomePage from './pages/home-page/HomePage'
import './App.css'

function App() {
  return (
    <div className="site-shell" id="top">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <HomePage />
      <SiteFooter />
    </div>
  )
}

export default App
