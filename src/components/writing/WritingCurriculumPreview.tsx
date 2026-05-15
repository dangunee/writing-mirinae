import '../atelier-detail/atelier-detail.css'
import AtelierCurriculumDesktop from '../atelier-detail/AtelierCurriculumDesktop'
import AtelierCurriculumMobile from '../atelier-detail/AtelierCurriculumMobile'

/**
 * Shared 「カリキュラム」 preview (term selector, lesson cards, theme detail).
 * Shown on /writing/app learner 「添削完了」 tab below correction result content.
 */
export default function WritingCurriculumPreview() {
  return (
    <section
      id="curriculum"
      className="atelier-koto-root mt-10 scroll-mt-20 border-t border-[#c6c5d4]/20 pt-10 font-[family-name:var(--font-body)] text-on-surface selection:bg-primary-fixed-dim selection:text-primary md:mt-12 md:pt-12"

    >
      <AtelierCurriculumMobile />
      <AtelierCurriculumDesktop />
    </section>
  )
}
