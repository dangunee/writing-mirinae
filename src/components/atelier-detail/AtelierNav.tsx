import { Link } from 'react-router-dom'

export default function AtelierNav() {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-[#1e1b13]/10 bg-white/90 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-screen-2xl items-center justify-between px-6 md:px-8">
        <div className="flex w-full items-center justify-between gap-2 md:hidden">
          <span className="material-symbols-outlined shrink-0 text-primary">menu</span>
          <h1 className="m-0 min-w-0 flex-1 text-center">
            <Link
              to="/writing"
              className="mx-auto block max-w-full px-0.5 font-[family-name:var(--font-headline)] text-sm font-extrabold leading-snug tracking-tight text-primary no-underline transition-opacity hover:opacity-80"
            >
              ミリネ韓国語教室 作文トレーニング
            </Link>
          </h1>
          <span className="material-symbols-outlined shrink-0 text-primary">account_circle</span>
        </div>

        <div className="hidden w-full items-center justify-between md:flex">
          <Link
            to="/writing"
            className="shrink-0 font-[family-name:var(--font-headline)] text-lg font-bold tracking-tight text-primary no-underline transition-opacity hover:opacity-80 lg:text-xl"
          >
            ミリネ韓国語教室 作文トレーニング
          </Link>
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
            to="/writing/trial-checkout"
          >
            体験レッスン
          </Link>
        </div>
      </div>
    </header>
  )
}
