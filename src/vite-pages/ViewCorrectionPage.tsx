import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import WritingLayout from '../components/WritingLayout'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

function apiUrl(path: string) {
  return `${API_BASE}${path}`
}

/** GET /api/writing/results/:id 성공 시 (getPublishedStudentResult) */
type PublishedResultResponse = {
  submissionId: string
  submission: {
    bodyText: string | null
    submittedAt: string | null
  }
  correction: {
    polishedSentence: string | null
    modelAnswer: string | null
    teacherComment: string | null
    publishedAt: string | null
  }
}

type LoadState = 'loading' | 'ok' | 'not_found' | 'not_published'

// [API] published 첨삭 필드를 기존 단일 블록으로 합침 (초안 필드 미사용)
function correctionDisplayText(correction: PublishedResultResponse['correction']): string {
  const parts = [correction.polishedSentence, correction.modelAnswer, correction.teacherComment].filter(
    (x): x is string => x != null && String(x).trim() !== '',
  )
  return parts.join('\n\n')
}

export default function ViewCorrectionPage() {
  const { submissionId } = useParams<{ submissionId: string }>()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [result, setResult] = useState<PublishedResultResponse | null>(null)

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
          const data = (await res.json()) as PublishedResultResponse
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
      <WritingLayout>
        <div className="view-correction-page">
          <p>로딩 중...</p>
          <Link to="/writing/app">목록으로</Link>
        </div>
      </WritingLayout>
    )
  }

  if (loadState === 'not_found') {
    return (
      <WritingLayout>
        <div className="view-correction-page">
          <p>제출 내용을 찾을 수 없습니다.</p>
          <Link to="/writing/app">목록으로</Link>
        </div>
      </WritingLayout>
    )
  }

  if (loadState === 'not_published') {
    return (
      <WritingLayout>
        <div className="view-correction-page">
          <p>아직 공개되지 않았습니다.</p>
          <Link to="/writing/app">목록으로</Link>
        </div>
      </WritingLayout>
    )
  }

  if (loadState !== 'ok' || !result) {
    return (
      <WritingLayout>
        <div className="view-correction-page">
          <p>제출 내용을 찾을 수 없습니다.</p>
          <Link to="/writing/app">목록으로</Link>
        </div>
      </WritingLayout>
    )
  }

  const originalText = result.submission.bodyText ?? ''
  const correctedText = correctionDisplayText(result.correction)
  const originalDisplay = originalText.trim() === '' ? '내용이 없습니다.' : originalText
  const hasCorrectedBody = (correctedText ?? '').trim() !== ''

  return (
    <WritingLayout>
      <div className="view-correction-page">
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
          </div>

          <div className="view-section">
            <h3>강사님 첨삭</h3>
            {hasCorrectedBody ? (
              <div className="corrected-content">{correctedText}</div>
            ) : (
              <p className="pending">아직 첨삭이 완료되지 않았습니다.</p>
            )}
          </div>
        </div>
      </div>
    </WritingLayout>
  )
}
