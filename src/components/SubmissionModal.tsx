import { useState, useRef } from 'react'
import { apiUrl } from '../lib/apiUrl'

interface SubmissionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  sessionId: string | null
  sessionIndex: number | null
  canSubmit: boolean
}

export default function SubmissionModal({
  isOpen,
  onClose,
  onSuccess,
  sessionId,
  sessionIndex,
  canSubmit,
}: SubmissionModalProps) {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  // [FIX] 리렌더 전 연속 클릭 차단 (제출 중복 방지)
  const submitLockRef = useRef(false)

  const handleSubmit = async () => {
    if (!sessionId || !content.trim() || !canSubmit || saving || submitLockRef.current) return
    submitLockRef.current = true
    setSaving(true)
    try {
      const res = await fetch(apiUrl(`/api/writing/sessions/${sessionId}/submission`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', bodyText: content.trim() }),
      })
      if (!res.ok) return
      setContent('')
      onSuccess()
    } catch {
      /* minimal: 실패 시 버튼만 다시 활성화 */
    } finally {
      submitLockRef.current = false
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content submission-modal submission-modal-stitch"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>과제 제출</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="modal-body">
          {!canSubmit && sessionId && (
            <p className="status pending submission-modal-hint">이 세션에서는 제출할 수 없습니다.</p>
          )}

          <section className="submission-modal-assignment-card rounded-2xl p-6 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)] border border-gray-100 mb-6">
            <div className="flex flex-col md:flex-row gap-8 p-4 md:p-6">
              <div className="flex-1">
                <div className="mb-6">
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold font-label tracking-widest uppercase">
                    과제
                  </span>
                  <h2 className="text-2xl font-bold text-on-background mt-3 font-headline">
                    {sessionIndex != null ? `제${sessionIndex}회 작문` : '작문 과제'}
                  </h2>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <label htmlFor="submission-body" className="block text-sm font-bold text-on-surface-variant mb-2 font-headline">
              작문 내용
            </label>
            <div className="relative">
              <textarea
                id="submission-body"
                placeholder="작문을 입력하세요."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="submission-modal-stitch-textarea w-full h-80 bg-white p-8 rounded-2xl border border-gray-100 shadow-[0_20px_60px_rgba(0,0,0,0.08)] focus:ring-2 focus:ring-green-500/30 text-lg leading-relaxed placeholder:text-gray-300"
              />
              <div className="absolute bottom-4 right-6 text-sm font-label tracking-widest text-on-surface/40">
                {String(content.length)}
              </div>
            </div>
          </section>
        </div>

        <div className="modal-footer submission-modal-footer">
          <div className="flex flex-wrap justify-end gap-4 w-full">
            <button type="button" className="modal-footer-cancel" onClick={onClose}>
              취소
            </button>
            <button
              type="button"
              className="submission-modal-submit-btn px-6 py-3 rounded-xl font-semibold bg-green-700 text-white shadow-lg hover:bg-green-800 active:scale-95 transition disabled:cursor-not-allowed"
              onClick={() => void handleSubmit()}
              disabled={saving || !content.trim() || !sessionId || !canSubmit}
            >
              {saving ? '제출 중…' : '제출'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
