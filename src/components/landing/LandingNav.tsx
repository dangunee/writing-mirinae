import { Link, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuthMe } from '../../hooks/useAuthMe'
import { apiUrl } from '../../lib/apiUrl'

type Props = {
  goApp: () => void
}

function AccountDropdown({ onClose }: { onClose: () => void }) {
  const itemClass =
    "block w-full px-4 py-2.5 text-left text-sm font-['Manrope'] font-semibold text-[#1e1b13] hover:bg-[#000666]/5 transition-colors"
  return (
    <div className="absolute right-0 top-full z-[60] mt-2 min-w-[11rem] rounded-lg border border-[#1e1b13]/10 bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
      <Link to="/writing/login" className={itemClass} onClick={onClose}>
        ログイン
      </Link>
      <Link to="/writing/signup" className={itemClass} onClick={onClose}>
        新規登録
      </Link>
    </div>
  )
}

export default function LandingNav({ goApp }: Props) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountDesktopRef = useRef<HTMLDivElement>(null)
  const accountMobileRef = useRef<HTMLDivElement>(null)
  const { me, loading, refetch } = useAuthMe()

  const handleLogout = useCallback(async () => {
    try {
      await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' })
    } catch {
      /* still clear client state */
    }
    await refetch()
    setAccountMenuOpen(false)
    setOpen(false)
    navigate('/writing')
  }, [navigate, refetch])

  useEffect(() => {
    if (!accountMenuOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (accountDesktopRef.current?.contains(t) || accountMobileRef.current?.contains(t)) return
      setAccountMenuOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [accountMenuOpen])

  const handleAccountClick = () => {
    if (loading) return
    if (me?.user) {
      setAccountMenuOpen(false)
      navigate('/writing/app/mypage')
      return
    }
    setAccountMenuOpen((v) => !v)
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F5F5F5]/80 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.05)] border-b-[0.5px] border-[#1e1b13]/10">
      <div className="flex justify-between items-center max-w-7xl mx-auto px-6 md:px-8 h-16 md:h-20">
        <div className="min-w-0 max-w-[min(100%,14rem)] leading-tight sm:max-w-none">
          <Link
            to="/writing"
            className="block text-sm font-extrabold tracking-tight text-[#000666] headline-font transition-opacity hover:opacity-80 md:text-xl md:tracking-tighter"
          >
            ミリネ韓国語教室　作文トレーニング
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {me?.user && !loading ? (
            <>
              <Link
                to="/writing/app/mypage"
                className="rounded-lg border border-[#000666] bg-white px-5 py-2 font-['Manrope'] text-sm font-bold text-[#000666] hover:bg-[#000666]/5 transition-colors"
              >
                マイページ
              </Link>
              {me.role === 'admin' ? (
                <Link
                  to="/writing/admin"
                  className="font-['Manrope'] text-sm font-bold text-[#4052b6] hover:underline"
                >
                  관리 콘솔
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="font-['Manrope'] text-sm font-semibold text-[#1e1b13]/70 hover:text-[#000666] transition-colors"
              >
                ログアウト
              </button>
              <button
                type="button"
                onClick={goApp}
                className="bg-[#000666] px-6 py-2 font-['Manrope'] text-sm font-bold uppercase tracking-widest text-white hover:opacity-90 active:scale-[0.99] transition-all rounded-lg"
              >
                お申し込み
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={goApp}
                className="bg-[#000666] px-6 py-2 font-['Manrope'] text-sm font-bold uppercase tracking-widest text-white hover:opacity-90 active:scale-[0.99] transition-all rounded-lg"
              >
                お申し込み
              </button>
              <div className="relative" ref={accountDesktopRef}>
                <button
                  type="button"
                  onClick={handleAccountClick}
                  disabled={loading}
                  aria-busy={loading}
                  aria-expanded={accountMenuOpen && !me?.user}
                  aria-haspopup={me?.user ? undefined : 'menu'}
                  className="material-symbols-outlined text-[#000666] cursor-pointer bg-transparent border-0 p-0 disabled:cursor-wait disabled:opacity-50"
                  aria-label="アカウント"
                >
                  account_circle
                </button>
                {accountMenuOpen && !me?.user && !loading ? <AccountDropdown onClose={() => setAccountMenuOpen(false)} /> : null}
              </div>
            </>
          )}
        </div>

        <div className="flex md:hidden items-center gap-2">
          {me?.user && !loading ? (
            <>
              <Link
                to="/writing/app/mypage"
                className="font-['Manrope'] text-xs font-bold text-[#000666] px-1"
              >
                マイページ
              </Link>
              {me.role === 'admin' ? (
                <Link to="/writing/admin" className="font-['Manrope'] text-xs font-bold text-[#4052b6] px-1">
                  관리
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="font-['Manrope'] text-xs font-semibold text-[#1e1b13]/70 px-1"
              >
                ログアウト
              </button>
            </>
          ) : (
            <div className="relative" ref={accountMobileRef}>
              <button
                type="button"
                onClick={handleAccountClick}
                disabled={loading}
                aria-busy={loading}
                aria-expanded={accountMenuOpen && !me?.user}
                aria-haspopup={me?.user ? undefined : 'menu'}
                className="material-symbols-outlined text-[#000666] bg-transparent border-0 p-0 disabled:cursor-wait disabled:opacity-50"
                aria-label="アカウント"
              >
                account_circle
              </button>
              {accountMenuOpen && !me?.user && !loading ? <AccountDropdown onClose={() => setAccountMenuOpen(false)} /> : null}
            </div>
          )}
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
          <button
            type="button"
            onClick={() => {
              goApp()
              setOpen(false)
            }}
            className="w-full bg-[#000666] px-4 py-2.5 font-['Manrope'] text-xs font-bold uppercase tracking-widest text-white rounded-lg hover:opacity-90 active:scale-[0.99] transition-all text-center"
          >
            お申し込み
          </button>
          <div className="mt-2 border-t border-[#1e1b13]/10 pt-3 flex flex-col gap-2">
            {me?.user ? (
              <>
                <Link
                  to="/writing/app/mypage"
                  className="font-['Manrope'] text-sm font-bold text-[#000666]"
                  onClick={() => setOpen(false)}
                >
                  マイページ
                </Link>
                <button
                  type="button"
                  className="text-left font-['Manrope'] text-sm font-semibold text-[#1e1b13]/70"
                  onClick={() => {
                    setOpen(false)
                    void handleLogout()
                  }}
                >
                  ログアウト
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/writing/login"
                  className="font-['Manrope'] text-sm font-bold text-[#000666]"
                  onClick={() => setOpen(false)}
                >
                  ログイン
                </Link>
                <Link
                  to="/writing/signup"
                  className="font-['Manrope'] text-sm font-bold text-[#000666]"
                  onClick={() => setOpen(false)}
                >
                  新規登録
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </nav>
  )
}
