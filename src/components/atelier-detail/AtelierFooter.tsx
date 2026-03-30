export default function AtelierFooter() {
  return (
    <footer className="w-full border-t border-gray-200 bg-white md:border-[#1e1b13]/5">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-8 py-16 md:py-12">
        <span className="font-[family-name:var(--font-headline)] text-lg font-bold text-primary md:text-[#1e1b13]">
          ミリネ韓国語教室
        </span>
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-4">
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
        <p className="text-center text-xs text-gray-400">運営：ミリネ韓国語教室</p>
        <p className="font-['Manrope'] text-center text-[10px] font-medium uppercase tracking-[0.1em] text-stone-400 md:text-xs">
          © 2024 ミリネ韓国語教室
        </p>
      </div>
    </footer>
  )
}
