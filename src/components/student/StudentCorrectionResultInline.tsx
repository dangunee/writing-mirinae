import StudentCorrectionResultDetail from './StudentCorrectionResultDetail'
import { useWritingSubmissionResult } from '../../hooks/useWritingSubmissionResult'

type Props = {
  submissionId: string
  /** Shown when results API returns 404 (e.g. corrected but not yet published). */
  fallbackBodyText: string | null | undefined
}

/**
 * Inline loader for /writing/app 「添削完了」 tab — same payload as the standalone view page.
 */
export default function StudentCorrectionResultInline({ submissionId, fallbackBodyText }: Props) {
  const { loadState, result } = useWritingSubmissionResult(submissionId)

  if (loadState === 'loading' || loadState === 'idle') {
    return (
      <div className="rounded-xl border border-[#c6c5d4]/10 bg-white p-8 shadow-[0_10px_40px_rgba(30,27,19,0.04)]">
        <p className="text-sm text-[#454652] font-['Manrope',sans-serif]">結果を読み込み中…</p>
      </div>
    )
  }

  if (loadState === 'ok' && result != null) {
    return (
      <div className="rounded-xl border border-[#c6c5d4]/10 bg-white p-6 shadow-[0_10px_40px_rgba(30,27,19,0.04)] writing-app-correction-detail-root">
        <StudentCorrectionResultDetail result={result} />
      </div>
    )
  }

  if (loadState === 'result_pending_sync') {
    return (
      <div className="rounded-xl border border-[#c6c5d4]/10 bg-white p-8 shadow-[0_10px_40px_rgba(30,27,19,0.04)]">
        <p className="text-sm text-[#454652] font-['Manrope',sans-serif]">
          添削データを確認中です。しばらくしてから再読み込みしてください。
        </p>
      </div>
    )
  }

  const fallback =
    fallbackBodyText != null && String(fallbackBodyText).trim() !== ''
      ? fallbackBodyText
      : '（提出本文がありません）'

  return (
    <div className="space-y-3">
      <p className="pending text-sm font-['Manrope',sans-serif]">아직 공개되지 않았습니다.</p>
      <p className="text-sm font-bold text-[#454652] mb-3 font-['Manrope',sans-serif]">提出本文</p>
      <div className="w-full min-h-80 bg-white p-8 rounded-xl border border-[#c6c5d4]/10 shadow-[0_10px_40px_rgba(30,27,19,0.04)] text-lg leading-relaxed font-['Plus_Jakarta_Sans',sans-serif] text-[#1e1b13] whitespace-pre-wrap">
        {fallback}
      </div>
    </div>
  )
}
