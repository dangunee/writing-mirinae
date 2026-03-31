import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import '../landing.css'
import '../components/atelier-detail/atelier-detail.css'
import LandingNav from '../components/landing/LandingNav'
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

  const goApp = useCallback(() => {
    navigate('/writing/course')
  }, [navigate])

  return (
    <div className="landing-stitch-root relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 bg-[#F5F5F5] text-[#1e1b13]">
      <LandingNav goApp={goApp} anchorBase="/writing" />
      <main>
        <IntroCorrectionWorkspace />
        <div className="atelier-koto-root min-h-0 bg-background font-[family-name:var(--font-body)] text-on-surface selection:bg-primary-fixed-dim selection:text-primary">
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
