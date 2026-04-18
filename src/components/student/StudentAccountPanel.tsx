import { Link, useNavigate } from 'react-router-dom'

import { useAuthMe } from '../../hooks/useAuthMe'
import { apiUrl } from '../../lib/apiUrl'
import type { AuthMePayload } from '../../types/authMe'

function roleLabelJa(role: AuthMePayload['role']): string {
  if (role === 'admin') return '管理者'
  if (role === 'teacher') return '講師'
  if (role === 'student') return '受講生'
  return '—'
}

function EntitlementBadges({ e }: { e: AuthMePayload['entitlements'] }) {
  const items: { key: string; label: string; on: boolean }[] = [
    { key: 'trial', label: '体験', on: e.hasTrial },
    { key: 'course', label: 'コース', on: e.hasActiveCourse },
    { key: 'academy', label: 'アカデミー', on: e.isAcademyUnlimited },
  ]
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="利用権限（体験・コース・アカデミー）"
    >
      {items.map((x) => (
        <span
          key={x.key}
          className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold leading-tight ${
            x.on
              ? 'border-[#000666]/35 bg-[#e8eef8] text-[#000666] shadow-sm'
              : 'border-[#c5c8cc] bg-[#f3f4f6] text-[#4a5056]'
          }`}
        >
          {x.label}
          {x.on ? ' · 利用可' : ''}
        </span>
      ))}
    </div>
  )
}

type Props = {
  /** 作文ページ上段などで余白を詰める */
  compact?: boolean
}

/**
 * Stitch トーン — GET /api/auth/me のみ（モック・クライアント userId なし）
 */
export default function StudentAccountPanel({ compact = false }: Props) {
  const { me, loading, error, refetch } = useAuthMe()
  const navigate = useNavigate()

  const onLogout = async () => {
    try {
      await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' })
    } catch {
      /* still navigate */
    }
    navigate('/writing', { replace: true })
  }

  if (loading) {
    return (
      <div
        className={`rounded-xl border border-[#1e1b13]/10 bg-white/90 px-4 py-3 font-['Manrope',sans-serif] text-sm text-[#595c5e] shadow-sm ${
          compact ? 'mb-3' : 'mb-6'
        }`}
        role="status"
      >
        アカウント情報を読み込み中…
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={`rounded-xl border border-[#fde8e8] bg-[#fff8f8] px-4 py-3 font-['Manrope',sans-serif] text-sm text-[#8b1a1a] ${
          compact ? 'mb-3' : 'mb-6'
        }`}
      >
        アカウント情報を取得できませんでした。
        <button
          type="button"
          onClick={() => void refetch()}
          className="ml-2 font-bold text-[#000666] underline"
        >
          再試行
        </button>
      </div>
    )
  }

  if (!me?.user) {
    return (
      <div
        className={`rounded-xl border border-[#1e1b13]/10 bg-[#F5F5F5] px-4 py-3 font-['Manrope',sans-serif] text-sm text-[#1e1b13]/80 shadow-sm ${
          compact ? 'mb-3' : 'mb-6'
        }`}
      >
        <p className="font-semibold text-[#000666]">体験・メールリンクでアクセス中</p>
        <p className="mt-1 text-xs text-[#595c5e]">
          ログインするとマイページで学習サマリーを確認できます。
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            to="/writing/login"
            className="inline-flex rounded-lg bg-[#000666] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
          >
            ログイン
          </Link>
          <Link to="/writing/signup" className="text-xs font-semibold text-[#000666] underline">
            新規登録
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl border border-[#1e1b13]/10 bg-white px-4 py-3 font-['Manrope',sans-serif] shadow-[0_4px_20px_rgba(0,0,0,0.05)] ${
        compact ? 'mb-3' : 'mb-6'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[#595c5e]">Account</span>
            <span className="rounded-full bg-[#000666]/10 px-2 py-0.5 text-[11px] font-bold text-[#000666]">
              {roleLabelJa(me.role)}
            </span>
          </div>
          <p className="truncate text-sm font-semibold text-[#1e1b13]" title={me.user.email ?? ''}>
            {me.user.email ?? me.user.id}
          </p>
          <EntitlementBadges e={me.entitlements} />
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {me.role === 'admin' ? (
            <Link
              to="/writing/admin"
              className="rounded-lg border border-[#1e1b13]/15 bg-white px-3 py-1.5 text-xs font-bold text-[#4052b6] hover:bg-[#fafafa]"
            >
              관리 콘솔
            </Link>
          ) : null}
          <Link
            to="/writing/app/settings"
            className="rounded-lg border border-[#1e1b13]/15 bg-white px-3 py-1.5 text-xs font-bold text-[#000666] hover:bg-[#fafafa]"
          >
            設定
          </Link>
          <Link
            to="/writing/app/mypage"
            className="rounded-lg border border-[#1e1b13]/15 bg-[#F5F5F5] px-3 py-1.5 text-xs font-bold text-[#000666] hover:bg-[#ebebeb]"
          >
            マイページ
          </Link>
          <button
            type="button"
            onClick={() => void onLogout()}
            className="rounded-lg border border-[#1e1b13]/20 px-3 py-1.5 text-xs font-semibold text-[#595c5e] hover:bg-[#fafafa]"
          >
            ログアウト
          </button>
        </div>
      </div>
    </div>
  )
}
