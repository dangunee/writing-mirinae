import { useState, useRef } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

function apiUrl(path: string) {
  return `${API_BASE}${path}`
}

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

          <div className="form-group">
            <label htmlFor="submission-session">회차</label>
            <div className="submission-session-value" id="submission-session">
              {sessionIndex != null ? `제${sessionIndex}회` : '—'}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="submission-body">작문 내용</label>
            <textarea
              id="submission-body"
              placeholder="작문을 입력하세요."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="submission-textarea"
            />
          </div>
        </div>

        <div className="modal-footer submission-modal-footer">
          <button type="button" className="modal-footer-cancel" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="submit-button"
            onClick={() => void handleSubmit()}
            disabled={saving || !content.trim() || !sessionId || !canSubmit}
          >
            {saving ? '제출 중…' : '제출'}
          </button>
        </div>
      </div>
    </div>
  )
}
