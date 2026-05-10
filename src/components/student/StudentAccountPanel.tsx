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

/** 旧左サイドバーの白カード／ナビ行トーン（右サイドバー埋め込み時） */
const writingSidebarAccountCard =
  'bg-white p-6 rounded-2xl shadow-[0_10px_40px_rgba(30,27,19,0.04)] border border-[#c6c5d4]/10 font-[\'Manrope\',sans-serif]'

/** アクティブナビ項目と同系統のフル幅ボタン */
const writingSidebarNavBtn =
  'flex w-full items-center justify-center rounded-xl border border-[#c6c5d4]/30 bg-white px-4 py-3 text-sm font-bold uppercase tracking-widest text-[#000666] hover:bg-[#f5f5f5] transition-colors text-center'

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
        className={
          embedSidebar
            ? `${writingSidebarAccountCard} text-sm text-[#595c5e] ${outerMb}`
            : `rounded-xl border border-[#1e1b13]/10 bg-white/90 px-4 py-3 font-['Manrope',sans-serif] text-sm text-[#595c5e] shadow-sm ${outerMb}`
        }
        role="status"
      >
        アカウント情報を読み込み中…
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={
          embedSidebar
            ? `${writingSidebarAccountCard} text-sm leading-relaxed text-[#8b1a1a] ${outerMb}`
            : `rounded-xl border border-[#fde8e8] bg-[#fff8f8] px-4 py-3 font-['Manrope',sans-serif] text-sm text-[#8b1a1a] ${outerMb}`
        }
      >
        アカウント情報を取得できませんでした。
        <button
          type="button"
          onClick={() => void refetch()}
          className={`font-bold text-[#000666] underline ${embedSidebar ? 'ml-0 mt-2 block' : 'ml-2'}`}
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
        className={
          embedSidebar
            ? `${writingSidebarAccountCard} text-sm text-[#1e1b13]/90 ${outerMb}`
            : `rounded-xl border border-[#1e1b13]/10 bg-[#F5F5F5] px-4 py-3 font-['Manrope',sans-serif] text-sm text-[#1e1b13]/80 shadow-sm ${outerMb}`
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className={badgeActive}>{anonBadge}</span>
        </div>
        <p className={`font-semibold text-[#000666] ${embedSidebar ? 'mt-3' : 'mt-2'}`}>{anonTitle}</p>
        <p className={`text-xs text-[#595c5e] ${embedSidebar ? 'mt-2' : 'mt-1'}`}>
          ログインするとマイページで学習サマリーを確認できます。
        </p>
        <div className={embedSidebar ? 'mt-4 flex flex-col gap-3' : 'mt-2 flex flex-wrap gap-2'}>
          <Link
            to="/writing/login"
            className={
              embedSidebar
                ? writingSidebarNavBtn
                : 'inline-flex rounded-lg bg-[#000666] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90'
            }
          >
            ログイン
          </Link>
          <Link
            to="/writing/signup"
            className={
              embedSidebar
                ? `${writingSidebarNavBtn} normal-case font-semibold tracking-normal`
                : 'text-xs font-semibold text-[#000666] underline'
            }
          >
            新規登録
          </Link>
        </div>
      </div>
    )
  }

  const showMypageLink = me.role === 'student'

  const accountLabelClass = embedSidebar
    ? 'text-xs font-bold uppercase tracking-widest text-[#1e1b13]/70'
    : 'text-xs font-bold uppercase tracking-widest text-[#595c5e]'

  const outerLoggedClass = embedSidebar
    ? `${writingSidebarAccountCard} ${outerMb}`
    : `rounded-xl border border-[#1e1b13]/10 bg-white px-4 py-3 font-['Manrope',sans-serif] shadow-[0_4px_20px_rgba(0,0,0,0.05)] ${outerMb}`

  const metaSpacing = embedSidebar ? 'space-y-3' : 'space-y-2'

  return (
    <div className={outerLoggedClass}>
      <div
        className={
          showAccountActions && !embedSidebar
            ? 'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'
            : 'flex flex-col gap-3'
        }
      >
        <div className={`min-w-0 flex-1 ${metaSpacing}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={accountLabelClass}>ACCOUNT</span>
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
                ? 'flex w-full flex-shrink-0 flex-col gap-3 pt-1'
                : 'flex flex-shrink-0 flex-wrap items-center gap-2 sm:justify-end'
            }
          >
            {me.role === 'admin' ? (
              <Link
                to="/writing/admin"
                className={
                  embedSidebar
                    ? writingSidebarNavBtn
                    : 'rounded-lg border border-[#1e1b13]/15 bg-white px-3 py-1.5 text-xs font-bold text-[#4052b6] hover:bg-[#fafafa]'
                }
              >
                管理コンソール
              </Link>
            ) : null}
            {!hideSettingsLink ? (
              <Link
                to="/writing/app/settings"
                className={
                  embedSidebar
                    ? writingSidebarNavBtn
                    : 'rounded-lg border border-[#1e1b13]/15 bg-white px-3 py-1.5 text-xs font-bold text-[#000666] hover:bg-[#fafafa]'
                }
              >
                設定
              </Link>
            ) : null}
            {showMypageLink ? (
              <Link
                to="/writing/app/mypage"
                className={
                  embedSidebar
                    ? writingSidebarNavBtn
                    : 'rounded-lg border border-[#1e1b13]/15 bg-[#F5F5F5] px-3 py-1.5 text-xs font-bold text-[#000666] hover:bg-[#ebebeb]'
                }
              >
                マイページ
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void onLogout()}
              className={
                embedSidebar
                  ? writingSidebarNavBtn
                  : 'rounded-lg border border-[#1e1b13]/20 px-3 py-1.5 text-xs font-semibold text-[#595c5e] hover:bg-[#fafafa]'
              }
            >
              ログアウト
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
