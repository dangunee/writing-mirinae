interface LayoutProps {
  children: React.ReactNode
}

function isEmbedded(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('embed') === '1'
}

export default function Layout({ children }: LayoutProps) {
  const embedded = isEmbedded()

  return (
    <div className={embedded ? 'layout layout-embedded' : 'layout'}>
      {!embedded && (
        <header className="header">
          <a href="/" className="logo">
            <span className="logo-text">writing</span>
            <span className="logo-domain">.mirinae.jp</span>
          </a>
          <p className="tagline">ミリネ韓国語教室 · 作文トレーニング</p>
        </header>
      )}

      <main className="main">{children}</main>

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
