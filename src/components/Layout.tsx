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
  const p = location.pathname
  const writingAppFullBleed = p === '/writing/app' || p.startsWith('/writing/app/view')

  if (
    location.pathname === '/writing/login' ||
    location.pathname === '/writing/signup' ||
    location.pathname === '/writing/forgot-password' ||
    location.pathname === '/writing/reset-password' ||
    location.pathname === '/writing/reset-password/complete' ||
    location.pathname === '/writing/oauth-complete' ||
    location.pathname === '/writing/invite' ||
    writingAppFullBleed ||
    location.pathname === '/writing/app/mypage' ||
    location.pathname === '/writing/correction-detail' ||
    location.pathname === '/writing/course' ||
    location.pathname === '/writing/intro' ||
    location.pathname === '/writing/trial-payment' ||
    location.pathname === '/writing/trial-payment/checkout' ||
    location.pathname === '/writing/bank-complete' ||
    location.pathname === '/writing/trial/start' ||
    location.pathname === '/writing/trial/access' ||
    location.pathname === '/writing/trial/reissue' ||
    location.pathname === '/writing/regular/access' ||
    location.pathname === '/writing/app/complete' ||
    location.pathname === '/writing/admin/trial-applications'
  ) {
    return <>{children}</>
  }

  return (
    <div className={embedded ? 'layout layout-embedded' : 'layout'}>
      <main
        className={
          p === '/writing/app' || p.startsWith('/writing/app/view')
            ? 'main main-writing-stitch'
            : location.pathname === '/writing/correction-detail'
              ? 'main main-atelier-detail'
              : 'main'
        }
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
