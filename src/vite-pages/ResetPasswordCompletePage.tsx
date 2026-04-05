import { Link } from 'react-router-dom'

export default function ResetPasswordCompletePage() {
  return (
    <div className="min-h-screen bg-[#F5F5F5] px-4 py-16 font-['Manrope',sans-serif] text-[#1e1b13]">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-[#1e1b13]/10 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <h1 className="text-xl font-extrabold text-[#000666]">パスワードを更新しました</h1>
        <p className="mt-4 text-sm leading-relaxed text-[#1e1b13]/80">
          新しいパスワードでログインしてください。
        </p>
        <p className="mt-8 text-center">
          <Link
            to="/writing/login"
            className="inline-flex w-full min-h-[44px] items-center justify-center rounded-lg bg-[#000666] py-2.5 text-sm font-bold uppercase tracking-widest text-white hover:opacity-90"
          >
            ログインへ
          </Link>
        </p>
      </div>
    </div>
  )
}
