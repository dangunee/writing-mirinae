import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import LandingNav from '../components/landing/LandingNav'
import '../components/atelier-detail/atelier-detail.css'
import '../landing.css'
import AtelierHero from '../components/atelier-detail/AtelierHero'
import AtelierCorrectionExample from '../components/atelier-detail/AtelierCorrectionExample'
import AtelierCurriculumMobile from '../components/atelier-detail/AtelierCurriculumMobile'
import AtelierCurriculumDesktop from '../components/atelier-detail/AtelierCurriculumDesktop'
import AtelierTrialFlow from '../components/atelier-detail/AtelierTrialFlow'
import AtelierFinalCta from '../components/atelier-detail/AtelierFinalCta'
import AtelierFooter from '../components/atelier-detail/AtelierFooter'

export default function CorrectionSystemDetailPage() {
  const navigate = useNavigate()
  const goApp = useCallback(() => {
    navigate('/writing/course')
  }, [navigate])

  return (
    <div className="atelier-koto-root min-h-screen bg-background font-[family-name:var(--font-body)] text-on-surface selection:bg-primary-fixed-dim selection:text-primary">
      <LandingNav goApp={goApp} anchorBase="/writing" curriculumHref="#curriculum" />
      <main className="pb-0 pt-16 md:pt-20">
        <AtelierHero />
        <AtelierCorrectionExample />
        <div id="curriculum" className="scroll-mt-20 md:scroll-mt-24">
          <AtelierCurriculumMobile />
          <AtelierCurriculumDesktop />
        </div>
        <AtelierTrialFlow />
        <AtelierFinalCta />
      </main>
      <AtelierFooter />
    </div>
  )
}
