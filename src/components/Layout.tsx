import { Link, useLocation } from 'react-router-dom'

interface LayoutProps {
  children: React.ReactNode
}

function isEmbedded(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('embed') === '1'
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const embedded = isEmbedded()

  if (location.pathname === '/writing/app/mypage') {
    return <>{children}</>
  }

  return (
    <div className={embedded ? 'layout layout-embedded' : 'layout'}>
      {!embedded && (
        <header className="header">
          <Link to="/writing" className="logo">
            <span className="logo-text">writing</span>
            <span className="logo-domain">.mirinae.jp</span>
          </Link>
          <p className="tagline">ミリネ韓国語教室 · 作文トレーニング</p>
        </header>
      )}

      <main
        className={location.pathname === '/writing/app' ? 'main main-writing-stitch' : 'main'}
      >
        {children}
      </main>

      {!embedded && (
        <footer className="footer">
          <p>
            <a href="https://mirinae.jp" target="_blank" rel="noopener noreferrer">
              ミリネ韓国語教室
            </a>
          </p>
        </footer>
      )}
    </div>
  )
}
