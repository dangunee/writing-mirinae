import { Link, useNavigate } from 'react-router-dom'

import { useAuthMe } from '../../hooks/useAuthMe'
import { apiUrl } from '../../lib/apiUrl'
import type { AuthMePayload } from '../../types/authMe'
import type { AccessContext } from '../../types/writingAccess'

function roleLabelJa(role: AuthMePayload['role']): string {
  if (role === 'admin') return '管理者'
  if (role === 'teacher') return '講師'
  if (role === 'student') return '受講生'
  return '—'
}

const badgeActive =
  'shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold leading-tight border-[#000666]/35 bg-[#e8eef8] text-[#000666] shadow-sm'

/** Only entitlements that are actually active (omit gray placeholders). */
function ActiveEntitlementBadges({ e }: { e: AuthMePayload['entitlements'] }) {
  const items: { key: string; label: string }[] = []
  if (e.hasActiveCourse) items.push({ key: 'course', label: 'コース · 利用可' })
  if (e.isAcademyUnlimited) items.push({ key: 'academy', label: 'アカデミー · 利用可' })
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="利用中の権限">
      {items.map((x) => (
        <span key={x.key} className={badgeActive}>
          {x.label}
        </span>
      ))}
    </div>
  )
}

type Props = {
  /** 作文ページ上段などで余白を詰める */
  compact?: boolean
  /**
   * false: メール・ロール・権限バッジのみ（リンク・ログアウトなし）。
   * 管理者が /writing/app にいるときはヘッダに 管理コンソール / ログアウト があるため重複を避ける。
   */
  showAccountActions?: boolean
  /** GET /sessions/current と整合したアクセス種別（試用メールリンクのみ等の表示切替） */
  writingAppAccess?: AccessContext['type'] | null
  /** 右サイドバー埋め込み: 下マージなし・ボタン縦並び（カード見た目は同一トーン） */
  embedSidebar?: boolean
}

/**
 * Stitch トーン — GET /api/auth/me のみ（モック・クライアント userId なし）
 */
export default function StudentAccountPanel({
  compact = false,
  showAccountActions = true,
  writingAppAccess = null,
  embedSidebar = false,
}: Props) {
  const { me, loading, error, refetch } = useAuthMe()
  const navigate = useNavigate()

  const trialMailLinkContext = writingAppAccess === 'trial'
  const hideSettingsLink = trialMailLinkContext

  const onLogout = async () => {
    try {
      await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' })
    } catch {
      /* still navigate */
    }
    navigate('/writing', { replace: true })
  }

  const outerMb = embedSidebar ? 'mb-0' : compact ? 'mb-3' : 'mb-6'

  if (loading) {
    return (
      <div
        className={`rounded-xl border border-[#1e1b13]/10 bg-white/90 px-4 py-3 font-['Manrope',sans-serif] text-sm text-[#595c5e] shadow-sm ${outerMb}`}
        role="status"
      >
        アカウント情報を読み込み中…
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={`rounded-xl border border-[#fde8e8] bg-[#fff8f8] px-4 py-3 font-['Manrope',sans-serif] text-sm text-[#8b1a1a] ${outerMb}`}
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
    const anonBadge =
      writingAppAccess === 'trial'
        ? '体験 · 利用中'
        : writingAppAccess === 'regular'
          ? 'メールリンク · 利用中'
          : 'アクセス中'
    const anonTitle =
      writingAppAccess === 'trial'
        ? '体験リンクでアクセス中'
        : writingAppAccess === 'regular'
          ? 'メールリンクでアクセス中'
          : 'アクセス中'

    return (
      <div
        className={`rounded-xl border border-[#1e1b13]/10 bg-[#F5F5F5] px-4 py-3 font-['Manrope',sans-serif] text-sm text-[#1e1b13]/80 shadow-sm ${outerMb}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className={badgeActive}>{anonBadge}</span>
        </div>
        <p className="mt-2 font-semibold text-[#000666]">{anonTitle}</p>
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

  const showMypageLink = me.role === 'student'

  return (
    <div
      className={`rounded-xl border border-[#1e1b13]/10 bg-white px-4 py-3 font-['Manrope',sans-serif] shadow-[0_4px_20px_rgba(0,0,0,0.05)] ${outerMb}`}
    >
      <div
        className={
          showAccountActions && !embedSidebar
            ? 'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'
            : 'flex flex-col gap-3'
        }
      >
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[#595c5e]">ACCOUNT</span>
            <span className="rounded-full bg-[#000666]/10 px-2 py-0.5 text-[11px] font-bold text-[#000666]">
              {roleLabelJa(me.role)}
            </span>
          </div>
          <p className="truncate text-sm font-semibold text-[#1e1b13]" title={me.user.email ?? ''}>
            {me.user.email ?? me.user.id}
          </p>
          <div className="flex flex-wrap items-center gap-2" aria-label="利用権限">
            {trialMailLinkContext ? (
              <span className={badgeActive}>体験 · 利用中</span>
            ) : (
              <>
                {me.entitlements.hasTrial ? (
                  <span className={badgeActive}>体験 · 利用可</span>
                ) : null}
              </>
            )}
            <ActiveEntitlementBadges e={me.entitlements} />
          </div>
        </div>
        {showAccountActions ? (
          <div
            className={
              embedSidebar
                ? 'flex w-full flex-shrink-0 flex-col gap-2'
                : 'flex flex-shrink-0 flex-wrap items-center gap-2 sm:justify-end'
            }
          >
            {me.role === 'admin' ? (
              <Link
                to="/writing/admin"
                className="rounded-lg border border-[#1e1b13]/15 bg-white px-3 py-1.5 text-xs font-bold text-[#4052b6] hover:bg-[#fafafa]"
              >
                管理コンソール
              </Link>
            ) : null}
            {!hideSettingsLink ? (
              <Link
                to="/writing/app/settings"
                className="rounded-lg border border-[#1e1b13]/15 bg-white px-3 py-1.5 text-xs font-bold text-[#000666] hover:bg-[#fafafa]"
              >
                設定
              </Link>
            ) : null}
            {showMypageLink ? (
              <Link
                to="/writing/app/mypage"
                className="rounded-lg border border-[#1e1b13]/15 bg-[#F5F5F5] px-3 py-1.5 text-xs font-bold text-[#000666] hover:bg-[#ebebeb]"
              >
                マイページ
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void onLogout()}
              className="rounded-lg border border-[#1e1b13]/20 px-3 py-1.5 text-xs font-semibold text-[#595c5e] hover:bg-[#fafafa]"
            >
              ログアウト
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
