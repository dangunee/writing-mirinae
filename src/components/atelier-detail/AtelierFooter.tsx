export default function AtelierFooter() {
  return (
    <>
      <footer className="w-full border-t border-gray-200 bg-white md:border-[#1e1b13]/5">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-8 py-16 md:flex-row md:items-center md:justify-between md:py-12">
          <span className="font-[family-name:var(--font-headline)] text-lg font-bold text-primary md:text-[#1e1b13]">
            Atelier Koto
          </span>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-4 md:gap-8">
            <a
              className="font-['Manrope'] text-[10px] font-medium uppercase tracking-[0.1em] text-stone-500 underline underline-offset-4 transition-colors hover:text-primary md:text-xs"
              href="#"
            >
              プライバシーポリシー
            </a>
            <a
              className="font-['Manrope'] text-[10px] font-medium uppercase tracking-[0.1em] text-stone-500 underline underline-offset-4 transition-colors hover:text-primary md:text-xs"
              href="#"
            >
              利用規約
            </a>
            <a
              className="font-['Manrope'] text-[10px] font-medium uppercase tracking-[0.1em] text-stone-500 underline underline-offset-4 transition-colors hover:text-primary md:text-xs"
              href="#"
            >
              ジャーナル
            </a>
            <a
              className="font-['Manrope'] text-[10px] font-medium uppercase tracking-[0.1em] text-stone-500 underline underline-offset-4 transition-colors hover:text-primary md:text-xs"
              href="#"
            >
              お問い合わせ
            </a>
          </nav>
          <p className="font-['Manrope'] text-center text-[10px] font-medium uppercase tracking-[0.1em] text-stone-400 md:text-xs md:text-stone-400">
            © 2024 ATELIER KOTO. THE MODERN CALLIGRAPHER&apos;S METHOD.
          </p>
        </div>
      </footer>
    </>
  )
}
