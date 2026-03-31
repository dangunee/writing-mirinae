import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

type Props = {
  goApp: () => void
}

export default function LandingNav({ goApp }: Props) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const linkClass =
    "font-['Manrope'] font-bold tracking-tight text-sm uppercase text-[#1e1b13]/70 hover:text-[#000666] transition-colors"

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F5F5F5]/80 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.05)] border-b-[0.5px] border-[#1e1b13]/10">
      <div className="flex justify-between items-center max-w-7xl mx-auto px-6 md:px-8 h-16 md:h-20">
        <div className="min-w-0 max-w-[min(100%,14rem)] leading-tight sm:max-w-none">
          <div className="text-sm font-extrabold tracking-tight text-[#000666] headline-font md:text-xl md:tracking-tighter">
            ミリネ韓国語教室 作文トレーニング
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <a className={linkClass} href="#curriculum">
            カリキュラム
          </a>
          <a className={linkClass} href="#learning-system">
            学習システム
          </a>
          <a className={linkClass} href="#reviews">
            受講生の声
          </a>
          <button
            type="button"
            onClick={goApp}
            className="bg-[#000666] px-6 py-2 font-['Manrope'] text-sm font-bold uppercase tracking-widest text-white hover:opacity-90 active:scale-[0.99] transition-all rounded-lg"
          >
            お申し込み
          </button>
          <button
            type="button"
            onClick={() => navigate('/writing/app')}
            className="material-symbols-outlined text-[#000666] cursor-pointer bg-transparent border-0 p-0"
            aria-label="アカウント"
          >
            account_circle
          </button>
        </div>

        <div className="flex md:hidden items-center gap-3">
          <a
            href="https://mirinae.jp"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-[#1e1b13]/20 text-[#000666] px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest"
          >
            MAIN SITE
          </a>
          <button
            type="button"
            onClick={goApp}
            className="bg-[#000666] px-4 py-1.5 font-['Manrope'] text-xs font-bold uppercase tracking-widest text-white rounded-lg"
          >
            お申し込み
          </button>
          <button
            type="button"
            className="material-symbols-outlined text-[#000666] bg-transparent border-0 p-0"
            aria-expanded={open}
            aria-label="メニュー"
            onClick={() => setOpen((v) => !v)}
          >
            menu
          </button>
        </div>
      </div>

      {open ? (
        <div className="md:hidden border-t border-[#1e1b13]/10 bg-[#F5F5F5]/95 px-6 py-4 flex flex-col gap-3">
          <a className={linkClass} href="#curriculum" onClick={() => setOpen(false)}>
            カリキュラム
          </a>
          <a className={linkClass} href="#learning-system" onClick={() => setOpen(false)}>
            学習システム
          </a>
          <a className={linkClass} href="#reviews" onClick={() => setOpen(false)}>
            受講生の声
          </a>
        </div>
      ) : null}
    </nav>
  )
}
