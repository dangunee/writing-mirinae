import { useLocation } from 'react-router-dom'

interface LayoutProps {
  children: React.ReactNode
}

function isEmbedded(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('embed') === '1'
}

/**
 * 전역 레이아웃 — 상단 녹색 헤더는 사용하지 않음(랜딩·각 페이지 자체 헤더만 사용).
 */
export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const embedded = isEmbedded()

  if (location.pathname === '/writing/app/mypage') {
    return <>{children}</>
  }

  return (
    <div className={embedded ? 'layout layout-embedded' : 'layout'}>
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
