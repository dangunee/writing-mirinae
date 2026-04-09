import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../landing.css'
import '../components/atelier-detail/atelier-detail.css'
import LandingNav from '../components/landing/LandingNav'
import { useAuthMe } from '../hooks/useAuthMe'
import IntroCorrectionWorkspace from '../components/intro/IntroCorrectionWorkspace'
import AtelierCurriculumMobile from '../components/atelier-detail/AtelierCurriculumMobile'
import AtelierCurriculumDesktop from '../components/atelier-detail/AtelierCurriculumDesktop'
import AtelierTrialFlow from '../components/atelier-detail/AtelierTrialFlow'
import AtelierFinalCta from '../components/atelier-detail/AtelierFinalCta'
import AtelierFooter from '../components/atelier-detail/AtelierFooter'

/**
 * /writing/intro — 체험·첨삭 결과プレビュー（hero なし）
 */
export default function TrialLandingPage() {
  const navigate = useNavigate()
  const { me, loading } = useAuthMe()
  const [loginJustCompleted, setLoginJustCompleted] = useState(false)

  useEffect(() => {
    try {
      if (typeof sessionStorage === 'undefined') return
      if (sessionStorage.getItem('writing_intro_login_banner') === '1') {
        sessionStorage.removeItem('writing_intro_login_banner')
        setLoginJustCompleted(true)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const showLoginBanner = loginJustCompleted && Boolean(me?.user) && !loading

  const goApp = useCallback(() => {
    navigate('/writing/course')
  }, [navigate])

  return (
    <div className="landing-stitch-root relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 bg-[#F5F5F5] text-[#1e1b13]">
      <LandingNav goApp={goApp} />
      {showLoginBanner ? (
        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-20 md:pt-24">
          <p
            className="rounded-lg border border-[#000666]/10 bg-[#e8eaf6]/90 px-4 py-2 text-center text-sm font-medium text-[#000666]"
            role="status"
          >
            ログインが完了しました
          </p>
        </div>
      ) : null}
      <main>
        <IntroCorrectionWorkspace />
        <div
          id="curriculum"
          className="atelier-koto-root scroll-mt-20 min-h-0 bg-background font-[family-name:var(--font-body)] text-on-surface selection:bg-primary-fixed-dim selection:text-primary md:scroll-mt-24"
        >
          <AtelierCurriculumMobile />
          <AtelierCurriculumDesktop />
          <AtelierTrialFlow />
          <AtelierFinalCta />
        </div>
      </main>
      <div className="atelier-koto-root">
        <AtelierFooter />
      </div>
    </div>
  )
}
