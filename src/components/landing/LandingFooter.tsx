export default function LandingFooter() {
  const linkClass =
    "font-['Manrope'] text-[10px] md:text-xs tracking-widest uppercase text-[#1e1b13]/50 hover:text-[#000666] underline underline-offset-4 decoration-[#000666]/30 transition-all"

  return (
    <footer className="w-full py-12 md:py-16 px-6 md:px-8 bg-[#ECECEC] border-t border-[#1e1b13]/10">
      <div className="flex flex-col items-center gap-6 md:gap-8 max-w-7xl mx-auto text-center">
        <div>
          <div className="text-sm font-bold text-[#000666] tracking-widest uppercase mb-1">作文トレーニング</div>
          <div className="text-lg md:text-xl font-bold text-[#000666] headline-font">ミリネ韓国語教室</div>
        </div>
        <div className="flex flex-wrap justify-center gap-4 md:gap-8">
          <a className={linkClass} href="#cta-apply">
            お申し込み
          </a>
          <a className={linkClass} href="https://mirinae.jp" target="_blank" rel="noopener noreferrer">
            公式サイト
          </a>
        </div>
        <p className="font-['Manrope'] text-[10px] md:text-xs text-[#1e1b13]/70 leading-relaxed max-w-xl">
          〒160-0022 東京都新宿区新宿2-8-1 新宿セブンビル606号
          <br />
          TEL: 03-5925-8245 / FAX: 03-5925-8249
        </p>
        <p className="font-['Manrope'] text-[9px] md:text-xs tracking-widest uppercase text-[#1e1b13]/60">
          © {new Date().getFullYear()} ミリネ韓国語教室 · 作文トレーニング
        </p>
      </div>
    </footer>
  )
}
