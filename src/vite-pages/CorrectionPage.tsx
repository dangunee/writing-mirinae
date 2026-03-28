import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import WritingLayout from '../components/WritingLayout'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

function apiUrl(path: string) {
  return `${API_BASE}${path}`
}

/** GET /api/teacher/writing/submissions/:id 응답 (TeacherSubmissionDetail 요약) */
type TeacherSubmissionDetail = {
  submission: {
    id: string
    bodyText: string | null
  }
  session: { index: number }
  correction: null | {
    id: string
    polishedSentence: string | null
    modelAnswer: string | null
    teacherComment: string | null
    /** 발행된 첨삭만 학생 결과 페이지와 정합 */
    publishedAt: string | null
  }
  evaluation?: null | {
    grammarAccuracy: number | null
    vocabularyUsage: number | null
    contextualFluency: number | null
  }
}

/** 저장용: 비어 있지 않은 경우에만 0–100 정수로 evaluation body에 포함 */
function parseScoreField(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  const n = parseInt(t, 10)
  if (Number.isNaN(n)) return null
  return Math.min(100, Math.max(0, n))
}

/** 사이드바·원문 표시용 (기존 Submission 대체) */
type ListRow = {
  id: string
  studentName: string
  content: string
}

export default function CorrectionPage() {
  const { assignmentId: submissionId } = useParams<{ assignmentId: string }>()
  const [detail, setDetail] = useState<TeacherSubmissionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSubmission, setSelectedSubmission] = useState<ListRow | null>(null)
  const [correctedContent, setCorrectedContent] = useState('')
  const [modelAnswer, setModelAnswer] = useState('')
  const [teacherComment, setTeacherComment] = useState('')
  const [grammarScore, setGrammarScore] = useState('')
  const [vocabularyScore, setVocabularyScore] = useState('')
  const [contextScore, setContextScore] = useState('')
  const [saved, setSaved] = useState(false)
  // [FIX] 저장 중복 방지 — 리렌더 전 연속 클릭 차단
  const saveLockRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)

  const loadDetail = useCallback(async () => {
    if (!submissionId) {
      setDetail(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(apiUrl(`/api/teacher/writing/submissions/${submissionId}`), {
        credentials: 'include',
      })
      if (!res.ok) {
        setDetail(null)
        return
      }
      const data = (await res.json()) as TeacherSubmissionDetail
      setDetail(data)
    } catch {
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [submissionId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  useEffect(() => {
    setSelectedSubmission(null)
  }, [submissionId])

  const submissions: ListRow[] = detail
    ? [
        {
          id: detail.submission.id,
          studentName: `세션 ${detail.session.index}회`,
          content: detail.submission.bodyText ?? '',
        },
      ]
    : []

  const activeRow = selectedSubmission ?? submissions[0] ?? null

  useEffect(() => {
    if (!detail) {
      setCorrectedContent('')
      setModelAnswer('')
      setTeacherComment('')
      setGrammarScore('')
      setVocabularyScore('')
      setContextScore('')
      return
    }
    const body = detail.submission.bodyText ?? ''
    const polished = detail.correction?.polishedSentence
    setCorrectedContent(polished != null && polished !== '' ? polished : body)
    setModelAnswer(detail.correction?.modelAnswer ?? '')
    setTeacherComment(detail.correction?.teacherComment ?? '')
    const ev = detail.evaluation
    setGrammarScore(ev?.grammarAccuracy != null ? String(ev.grammarAccuracy) : '')
    setVocabularyScore(ev?.vocabularyUsage != null ? String(ev.vocabularyUsage) : '')
    setContextScore(ev?.contextualFluency != null ? String(ev.contextualFluency) : '')
  }, [detail])

  const handleSave = async () => {
    if (!activeRow || !submissionId || saving || isPublishing || saveLockRef.current) return
    saveLockRef.current = true
    setSaving(true)
    try {
      const correctionRes = await fetch(apiUrl(`/api/teacher/writing/submissions/${submissionId}/correction`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          polishedSentence: correctedContent ?? '',
          modelAnswer: modelAnswer ?? '',
          teacherComment: teacherComment ?? '',
        }),
      })
      if (!correctionRes.ok) return

      const g = parseScoreField(grammarScore)
      const v = parseScoreField(vocabularyScore)
      const c = parseScoreField(contextScore)
      const evalPayload: Record<string, number> = {}
      if (g !== null) evalPayload.grammarScore = g
      if (v !== null) evalPayload.vocabularyScore = v
      if (c !== null) evalPayload.contextScore = c

      const evaluationRes = await fetch(apiUrl(`/api/teacher/writing/submissions/${submissionId}/evaluation`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evalPayload),
      })

      await loadDetail()
      if (!evaluationRes.ok) return

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      /* minimal */
    } finally {
      saveLockRef.current = false
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!activeRow || !submissionId || saving || isPublishing || saveLockRef.current) return
    setIsPublishing(true)
    setPublishError(null)
    try {
      const res = await fetch(apiUrl(`/api/teacher/writing/submissions/${submissionId}/publish`), {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        await loadDetail()
        return
      }
      if (res.status === 422) {
        setPublishError('공개 조건이 아직 충족되지 않았습니다.')
      } else if (res.status === 409) {
        setPublishError('이미 공개되었습니다.')
      }
    } catch {
      /* minimal */
    } finally {
      setIsPublishing(false)
    }
  }

  const showPublishButton =
    detail != null &&
    detail.correction != null &&
    (detail.correction.publishedAt == null || String(detail.correction.publishedAt).trim() === '')

  if (!submissionId) {
    return (
      <WritingLayout>
        <div className="correction-page">
          <p>과제를 찾을 수 없습니다.</p>
          <Link to="/">목록으로</Link>
        </div>
      </WritingLayout>
    )
  }

  if (loading) {
    return (
      <WritingLayout>
        <div className="correction-page">
          <p>로딩 중...</p>
          <Link to="/">목록으로</Link>
        </div>
      </WritingLayout>
    )
  }

  if (!detail) {
    return (
      <WritingLayout>
        <div className="correction-page">
          <p>과제를 찾을 수 없습니다.</p>
          <Link to="/">목록으로</Link>
        </div>
      </WritingLayout>
    )
  }

  return (
    <WritingLayout>
      <div className="correction-page">
        <div className="correction-header">
          <Link to="/" className="back-link">
            ← 목록으로
          </Link>
          <h1>첨삭: 세션 {detail.session.index}회</h1>
        </div>

        <div className="correction-layout">
          <aside className="student-list">
            <h3>학생 목록</h3>
            {submissions.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`student-item ${activeRow?.id === s.id ? 'active' : ''}`}
                onClick={() => setSelectedSubmission(s)}
              >
                {s.studentName}
                {detail.correction && <span className="badge">완료</span>}
              </button>
            ))}
          </aside>

          <div className="correction-editor-area">
            {activeRow ? (
              <>
                <p className="instructor-label">↑ 강사 편집</p>
                <div className="editor-section">
                  <label>원문 (학생 제출)</label>
                  <div className="original-text">{activeRow.content}</div>
                </div>
                <div className="editor-section">
                  <label>수정 후</label>
                  <textarea
                    value={correctedContent ?? ''}
                    onChange={(e) => setCorrectedContent(e.target.value)}
                    className="correction-textarea"
                    rows={12}
                    placeholder="수정된 내용을 입력하세요"
                  />
                </div>
                <div className="editor-section">
                  <label>모범답</label>
                  <textarea
                    value={modelAnswer}
                    onChange={(e) => setModelAnswer(e.target.value)}
                    className="correction-textarea"
                    rows={6}
                    placeholder="모범답을 입력하세요"
                  />
                </div>
                <div className="editor-section">
                  <label>강사 코멘트</label>
                  <textarea
                    value={teacherComment}
                    onChange={(e) => setTeacherComment(e.target.value)}
                    className="correction-textarea"
                    rows={6}
                    placeholder="코멘트를 입력하세요"
                  />
                </div>
                <div className="editor-section">
                  <label>평가 점수 (0–100)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <label style={{ fontWeight: 500 }}>문법</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={grammarScore}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === '') {
                            setGrammarScore('')
                            return
                          }
                          const n = parseInt(v, 10)
                          if (!Number.isNaN(n)) setGrammarScore(String(Math.min(100, Math.max(0, n))))
                        }}
                        className="correction-textarea"
                        style={{ width: '100%', maxWidth: '10rem', minHeight: 'auto', padding: '0.5rem 0.75rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontWeight: 500 }}>어휘</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={vocabularyScore}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === '') {
                            setVocabularyScore('')
                            return
                          }
                          const n = parseInt(v, 10)
                          if (!Number.isNaN(n)) setVocabularyScore(String(Math.min(100, Math.max(0, n))))
                        }}
                        className="correction-textarea"
                        style={{ width: '100%', maxWidth: '10rem', minHeight: 'auto', padding: '0.5rem 0.75rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontWeight: 500 }}>맥락</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={contextScore}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === '') {
                            setContextScore('')
                            return
                          }
                          const n = parseInt(v, 10)
                          if (!Number.isNaN(n)) setContextScore(String(Math.min(100, Math.max(0, n))))
                        }}
                        className="correction-textarea"
                        style={{ width: '100%', maxWidth: '10rem', minHeight: 'auto', padding: '0.5rem 0.75rem' }}
                      />
                    </div>
                  </div>
                </div>
                <div className="editor-actions">
                  <button
                    type="button"
                    className="save-btn"
                    onClick={() => void handleSave()}
                    disabled={saving || isPublishing}
                  >
                    {saved ? '저장됨 ✓' : '저장'}
                  </button>
                  {showPublishButton && (
                    <button
                      type="button"
                      className="save-btn"
                      onClick={() => void handlePublish()}
                      disabled={saving || isPublishing}
                    >
                      {isPublishing ? '공개 중…' : '공개'}
                    </button>
                  )}
                  {publishError && <span className="status pending">{publishError}</span>}
                  {/* [FIX] 학생 결과는 published만 — publishedAt 있을 때만 링크 (draft 숨김) */}
                  {detail.correction?.publishedAt != null &&
                    String(detail.correction.publishedAt).trim() !== '' && (
                      <Link to={`/view/${activeRow.id}`} className="view-student-link">
                        학생 보기 →
                      </Link>
                    )}
                </div>
              </>
            ) : (
              <p className="no-submissions">제출된 과제가 없습니다.</p>
            )}
          </div>
        </div>
      </div>
    </WritingLayout>
  )
}
