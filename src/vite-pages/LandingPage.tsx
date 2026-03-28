import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import '../landing.css'
import LandingNav from '../components/landing/LandingNav'
import LandingHero from '../components/landing/LandingHero'
import LandingCorrection from '../components/landing/LandingCorrection'
import LandingCurriculum from '../components/landing/LandingCurriculum'
import LandingProcess from '../components/landing/LandingProcess'
import LandingDashboard from '../components/landing/LandingDashboard'
import LandingTestimonials from '../components/landing/LandingTestimonials'
import LandingCTA from '../components/landing/LandingCTA'
import LandingFooter from '../components/landing/LandingFooter'

/**
 * Stitch 랜딩 재현 (writing.mirinae.jp /writing)
 * — CTA는 navigate('/writing/app')만 사용 · fetch 없음
 */
export default function LandingPage() {
  const navigate = useNavigate()

  const goApp = useCallback(() => {
    navigate('/writing/app')
  }, [navigate])

  return (
    <div className="landing-stitch-root relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 bg-[#F5F5F5] text-[#1e1b13]">
      <LandingNav goApp={goApp} />
      <main>
        <LandingHero goApp={goApp} />
        <LandingCorrection goApp={goApp} />
        <LandingCurriculum />
        <LandingProcess />
        <LandingDashboard />
        <LandingTestimonials />
        <LandingCTA goApp={goApp} />
      </main>
      <LandingFooter />
    </div>
  )
}
