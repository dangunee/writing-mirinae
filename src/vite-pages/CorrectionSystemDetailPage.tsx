import '../components/atelier-detail/atelier-detail.css'
import AtelierNav from '../components/atelier-detail/AtelierNav'
import AtelierHero from '../components/atelier-detail/AtelierHero'
import AtelierCorrectionExample from '../components/atelier-detail/AtelierCorrectionExample'
import AtelierCurriculumMobile from '../components/atelier-detail/AtelierCurriculumMobile'
import AtelierCurriculumDesktop from '../components/atelier-detail/AtelierCurriculumDesktop'
import AtelierTrialFlow from '../components/atelier-detail/AtelierTrialFlow'
import AtelierFinalCta from '../components/atelier-detail/AtelierFinalCta'
import AtelierFooter from '../components/atelier-detail/AtelierFooter'

export default function CorrectionSystemDetailPage() {
  return (
    <div className="atelier-koto-root min-h-screen bg-background font-[family-name:var(--font-body)] text-on-surface selection:bg-primary-fixed-dim selection:text-primary">
      <AtelierNav />
      <main className="pb-0 pt-16">
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
