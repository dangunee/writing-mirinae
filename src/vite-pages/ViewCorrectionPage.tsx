import { useState, useEffect, type ReactNode } from 'react'
import { useParams, Link } from 'react-router-dom'
import WritingLayout from '../components/WritingLayout'
import StudentAccountPanel from '../components/student/StudentAccountPanel'
import { apiUrl } from '../lib/apiUrl'
import { isHtmlVisiblyNonEmpty, parseTeacherHtmlV1 } from '../lib/teacherRichDocument'
import { sanitizeTeacherCorrectionHtml } from '../lib/teacherCorrectionSanitize'

function ViewCorrectionShell({ children }: { children: ReactNode }) {
  return (
    <WritingLayout>
      <div className="view-correction-page">
        <div className="view-account-strip max-w-4xl mx-auto w-full px-4 pt-4">
          <StudentAccountPanel compact />
        </div>
        {children}
      </div>
    </WritingLayout>
  )
}

type ResultSessionCommon = {
  id: string
  index: number
  status: string
  runtimeStatus: string | null
  unlockAt: string
  availableFrom: string | null
  dueAt: string | null
  missedAt: string | null
}

type ResultAttachment = {
  id: string
  mimeType: string
  downloadUrl: string | null
  originalFilename: string | null
}

/** GET /api/writing/results/:id — published-only correction or missed-safe payload (correction may be null). */
type StudentResultResponse =
  | {
      outcome: 'published'
      submissionId: string
      session: ResultSessionCommon
      submission: {
        bodyText: string | null
        submittedAt: string | null
      }
      attachments?: ResultAttachment[] | null
      correction: {
        polishedSentence: string | null
        modelAnswer: string | null
        teacherComment: string | null
        improvedText: string | null
        richDocumentJson: unknown | null
        publishedAt: string | null
      } | null
      fragments?: unknown[]
      feedbackItems?: unknown[]
      annotations?: unknown[]
      evaluation?: unknown | null
    }
  | {
      outcome: 'missed'
      submissionId: string
      session: ResultSessionCommon & { modelAnswerSnapshot?: string | null }
      submission: {
        bodyText: string | null
        submittedAt: string | null
      }
      attachments?: ResultAttachment[] | null
      correction: null
      fragments?: unknown[]
      feedbackItems?: unknown[]
      annotations?: unknown[]
      evaluation?: null
    }

type LoadState = 'loading' | 'ok' | 'not_found' | 'not_published'

/** Older API may omit `outcome`; infer from correction presence. */
function normalizeResultPayload(raw: Record<string, unknown>): Record<string, unknown> {
  if (raw.outcome === 'missed' || raw.outcome === 'published') return raw
  if (raw.correction === null) return { ...raw, outcome: 'missed' }
  return { ...raw, outcome: 'published' }
}

type PublishedCorrection = NonNullable<
  Extract<StudentResultResponse, { outcome: 'published' }>['correction']
>

function textNonEmpty(s: string | null | undefined): boolean {
  return s != null && String(s).trim() !== ''
}

/** Any block we can show in the published correction panel. */
function hasPublishedCorrectionContent(correction: PublishedCorrection | null): boolean {
  if (!correction) return false
  const rawHtml = parseTeacherHtmlV1(correction.richDocumentJson)
  const safeHtml = rawHtml != null ? sanitizeTeacherCorrectionHtml(rawHtml) : ''
  if (safeHtml !== '' && isHtmlVisiblyNonEmpty(safeHtml)) return true
  if (textNonEmpty(correction.polishedSentence)) return true
  if (textNonEmpty(correction.improvedText)) return true
  if (textNonEmpty(correction.teacherComment)) return true
  if (textNonEmpty(correction.modelAnswer)) return true
  return false
}

function formatSessionMetaLine(session: ResultSessionCommon & { modelAnswerSnapshot?: string | null }): string {
  const idx = Number.isFinite(session.index) ? `第${session.index}回` : '—'
  const unlock = formatIsoDate(session.unlockAt)
  const avail = session.availableFrom ? formatIsoDate(session.availableFrom) : '—'
  const due = session.dueAt ? formatIsoDate(session.dueAt) : '—'
  return `${idx} · 解放 ${unlock} · 受付開始 ${avail} · 締切 ${due}`
}

function formatIsoDate(iso: string | null | undefined): string {
  if (iso == null || iso === '') return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function ViewCorrectionPage() {
  const { submissionId } = useParams<{ submissionId: string }>()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [result, setResult] = useState<StudentResultResponse | null>(null)

  useEffect(() => {
    if (!submissionId) {
      setLoadState('not_found')
      return
    }
    let cancelled = false

    async function load() {
      setLoadState('loading')
      try {
        const res = await fetch(apiUrl(`/api/writing/results/${submissionId}`), {
          credentials: 'include',
        })
        if (cancelled) return

        if (res.ok) {
          const raw = (await res.json()) as Record<string, unknown>
          const data = normalizeResultPayload(raw) as StudentResultResponse
          setResult(data)
          setLoadState('ok')
          return
        }

        // [API] results 404 → 보조로 submissions만 소유/존재 여부 확인 (draft 내용은 사용하지 않음)
        if (res.status === 404) {
          const subRes = await fetch(apiUrl(`/api/writing/submissions/${submissionId}`), {
            credentials: 'include',
          })
          if (cancelled) return
          if (subRes.ok) {
            setResult(null)
            setLoadState('not_published')
          } else {
            setResult(null)
            setLoadState('not_found')
          }
          return
        }

        setResult(null)
        setLoadState('not_found')
      } catch {
        if (!cancelled) {
          setResult(null)
          setLoadState('not_found')
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [submissionId])

  if (loadState === 'loading') {
    return (
      <ViewCorrectionShell>
        <p>로딩 중...</p>
        <Link to="/writing/app">목록으로</Link>
      </ViewCorrectionShell>
    )
  }

  if (loadState === 'not_found') {
    return (
      <ViewCorrectionShell>
        <p>제출 내용을 찾을 수 없습니다.</p>
        <Link to="/writing/app">목록으로</Link>
      </ViewCorrectionShell>
    )
  }

  if (loadState === 'not_published') {
    return (
      <ViewCorrectionShell>
        <p>아직 공개되지 않았습니다.</p>
        <Link to="/writing/app">목록으로</Link>
      </ViewCorrectionShell>
    )
  }

  if (loadState !== 'ok' || !result) {
    return (
      <ViewCorrectionShell>
        <p>제출 내용을 찾을 수 없습니다.</p>
        <Link to="/writing/app">목록으로</Link>
      </ViewCorrectionShell>
    )
  }

  const originalText = result.submission?.bodyText ?? ''
  const originalDisplay = originalText.trim() === '' ? '내용이 없습니다.' : originalText
  const attachments = Array.isArray(result.attachments) ? result.attachments : []

  if (result.outcome === 'missed') {
    const snap = result.session.modelAnswerSnapshot
    const snapText =
      snap != null && String(snap).trim() !== '' ? String(snap) : null

    return (
      <ViewCorrectionShell>
        <div className="view-header">
          <Link to="/writing/app" className="back-link">
            ← 목록으로
          </Link>
          <h1>학생이 볼 수 있음 View</h1>
          <p className="student-name">학생님의 첨삭 결과</p>
        </div>

        <div className="correction-view">
          <div className="view-section">
            <h3>내가 제출한 글</h3>
            <div className="original-content">{originalDisplay}</div>
            {attachments.length > 0 ? (
              <div className="original-content" style={{ marginTop: '0.75rem' }}>
                {attachments.map((a) =>
                  a.downloadUrl && a.mimeType?.startsWith('image/') ? (
                    <p key={a.id}>
                      <img src={a.downloadUrl} alt="" style={{ maxWidth: '100%', height: 'auto' }} />
                    </p>
                  ) : a.downloadUrl ? (
                    <p key={a.id}>
                      <a href={a.downloadUrl} target="_blank" rel="noreferrer">
                        {a.originalFilename ?? '첨부 파일 (PDF 등)'}
                      </a>
                    </p>
                  ) : null,
                )}
              </div>
            ) : null}
          </div>

          <div className="view-section">
            <h3>강사님 첨삭</h3>
            <p className="pending">提出期限を過ぎたため、添削は提供されません</p>
            {snapText ? <div className="corrected-content">{snapText}</div> : null}
            <p className="pending" style={{ marginTop: '0.75rem' }}>
              {formatSessionMetaLine(result.session)}
            </p>
          </div>
        </div>
      </ViewCorrectionShell>
    )
  }

  const correction = result.correction
  const hasCorrectedBody = hasPublishedCorrectionContent(correction)

  return (
    <ViewCorrectionShell>
      <div className="view-header">
        <Link to="/writing/app" className="back-link">
          ← 목록으로
        </Link>
        <h1>학생이 볼 수 있음 View</h1>
        <p className="student-name">학생님의 첨삭 결과</p>
      </div>

      <div className="correction-view">
        <div className="view-section">
          <h3>내가 제출한 글</h3>
          <div className="original-content">{originalDisplay}</div>
          {attachments.length > 0 ? (
            <div className="original-content" style={{ marginTop: '0.75rem' }}>
              {attachments.map((a) =>
                a.downloadUrl && a.mimeType?.startsWith('image/') ? (
                  <p key={a.id}>
                    <img src={a.downloadUrl} alt="" style={{ maxWidth: '100%', height: 'auto' }} />
                  </p>
                ) : a.downloadUrl ? (
                  <p key={a.id}>
                    <a href={a.downloadUrl} target="_blank" rel="noreferrer">
                      {a.originalFilename ?? '첨부 파일 (PDF 등)'}
                    </a>
                  </p>
                ) : null,
              )}
            </div>
          ) : null}
        </div>

        <div className="view-section">
          <h3>강사님 첨삭</h3>
          {correction != null && hasCorrectedBody ? (
            <div className="published-correction-blocks">
              {(() => {
                const rawHtml = parseTeacherHtmlV1(correction.richDocumentJson)
                const safeHtml = rawHtml != null ? sanitizeTeacherCorrectionHtml(rawHtml) : ''
                const hasRich = safeHtml !== '' && isHtmlVisiblyNonEmpty(safeHtml)
                return (
                  <>
                    {hasRich && (
                      <div
                        className="corrected-content teacher-rich-content"
                        dangerouslySetInnerHTML={{ __html: safeHtml }}
                      />
                    )}
                    {!hasRich && textNonEmpty(correction.polishedSentence) && (
                      <div className="corrected-content whitespace-pre-wrap">{correction.polishedSentence}</div>
                    )}
                    {textNonEmpty(correction.improvedText) && (
                      <div className="improved-block" style={{ marginTop: '1rem' }}>
                        <h4 className="improved-block-title">整理した比較文</h4>
                        <div className="corrected-content whitespace-pre-wrap">{correction.improvedText}</div>
                      </div>
                    )}
                    {textNonEmpty(correction.teacherComment) && (
                      <div style={{ marginTop: '1rem' }}>
                        <strong>강사 코멘트</strong>
                        <div className="corrected-content whitespace-pre-wrap">{correction.teacherComment}</div>
                      </div>
                    )}
                    {textNonEmpty(correction.modelAnswer) && (
                      <div style={{ marginTop: '1rem' }}>
                        <strong>模範文（参考）</strong>
                        <div className="corrected-content whitespace-pre-wrap">{correction.modelAnswer}</div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          ) : (
            <p className="pending">아직 첨삭이 완료되지 않았습니다.</p>
          )}
        </div>
      </div>
    </ViewCorrectionShell>
  )
}
