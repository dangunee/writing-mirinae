import { Link } from 'react-router-dom'

export default function AtelierNav() {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-[#1e1b13]/10 bg-white/90 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-screen-2xl items-center justify-between px-6 md:px-8">
        <div className="flex w-full items-center justify-between md:hidden">
          <span className="material-symbols-outlined text-primary">menu</span>
          <h1 className="font-[family-name:var(--font-headline)] text-lg font-extrabold tracking-tighter text-primary">
            ミリネ韓国語教室
          </h1>
          <span className="material-symbols-outlined text-primary">account_circle</span>
        </div>

        <div className="hidden w-full items-center justify-between md:flex">
          <div className="font-[family-name:var(--font-headline)] text-2xl font-bold tracking-tighter text-primary">
            ミリネ韓国語教室
          </div>
          <div className="flex items-center gap-12">
            <a
              className="font-['Manrope'] font-semibold tracking-[-0.02em] text-[#1e1b13]/60 transition-colors hover:text-primary"
              href="#curriculum"
            >
              カリキュラム
            </a>
            <a
              className="font-['Manrope'] font-semibold tracking-[-0.02em] text-[#1e1b13]/60 transition-colors hover:text-primary"
              href="#example"
            >
              添削方法
            </a>
            <a
              className="font-['Manrope'] font-semibold tracking-[-0.02em] text-[#1e1b13]/60 transition-colors hover:text-primary"
              href="#"
            >
              受講生の声
            </a>
            <a
              className="font-['Manrope'] font-semibold tracking-[-0.02em] text-[#1e1b13]/60 transition-colors hover:text-primary"
              href="#"
            >
              料金プラン
            </a>
          </div>
          <Link
            className="rounded-lg bg-primary px-6 py-2.5 font-[family-name:var(--font-headline)] font-semibold text-on-primary transition-transform hover:opacity-90 active:scale-95"
            to="/writing/app"
          >
            体験レッスン
          </Link>
        </div>
      </div>
    </header>
  )
}
