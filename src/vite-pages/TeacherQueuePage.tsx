import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

function apiUrl(path: string) {
  return `${API_BASE}${path}`
}

/** GET /api/teacher/writing/submissions/queue — 서버 QueueGroupedResponse와 동형 */
type QueueItem = {
  submissionId: string
  status: string
  submittedAt: string | null
  createdAt: string
  sessionIndex: number
  bodyPreview: string | null
  correction: null | {
    id: string
    teacherId: string
    status: string
    updatedAt: string
  }
}

type QueueGroupedResponse = {
  groups: Array<{ date: string; items: QueueItem[] }>
}

function formatDateTime(iso: string | null): string {
  if (iso == null || iso === '') return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

/** 제출 상태 API 값 → 표시 문구 */
function submissionStatusLabel(status: string): string {
  const map: Record<string, string> = {
    submitted: '제출됨',
    in_progress: '진행 중',
    draft: '작성 중',
    in_review: '검토 중',
  }
  return map[status] ?? status
}

/** 첨삭 레코드 유무·상태 → 표시 문구 */
function correctionStatusLabel(c: QueueItem['correction']): string {
  if (c == null) return '미첨삭'
  if (c.status === 'draft') return '작성 중'
  if (c.status === 'published') return '완료'
  return c.status
}

export default function TeacherQueuePage() {
  const [data, setData] = useState<QueueGroupedResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(apiUrl('/api/teacher/writing/submissions/queue'), {
        credentials: 'include',
      })
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setError('강사 권한이 필요합니다.')
        } else {
          setError('목록을 불러오지 못했습니다.')
        }
        setData(null)
        return
      }
      const json = (await res.json()) as QueueGroupedResponse
      setData(json)
    } catch {
      setError('목록을 불러오지 못했습니다.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="writing-page">
        <p className="status pending">불러오는 중…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="writing-page">
        <p className="status pending">{error}</p>
      </div>
    )
  }

  const groups = data?.groups ?? []
  const empty = groups.length === 0 || groups.every((g) => g.items.length === 0)

  return (
    <div className="writing-page">
      <h1 className="writing-page-title">첨삭 대기 목록</h1>
      {empty ? (
        <p className="no-assignments">대기 중인 제출이 없습니다.</p>
      ) : (
        <div className="assignment-weeks">
          {groups.map((group) => (
            <section key={group.date} className="week-section">
              <h3 className="week-label">{group.date}</h3>
              <table className="assignment-table">
                <thead>
                  <tr>
                    <th>세션</th>
                    <th>제출</th>
                    <th>상태</th>
                    <th>미리보기</th>
                    <th>첨삭</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item) => (
                    <tr key={item.submissionId}>
                      {/* 상세 이동: 세션 셀만 클릭 영역 */}
                      <td>
                        <Link className="view-link" to={`/correct/${item.submissionId}`}>
                          {item.sessionIndex}
                        </Link>
                      </td>
                      <td>{formatDateTime(item.submittedAt)}</td>
                      <td>
                        <span className="status submitted">{submissionStatusLabel(item.status)}</span>
                      </td>
                      {/* 상세 이동: 미리보기 셀만 클릭 영역 */}
                      <td className="assignment-title">
                        <Link className="view-link" to={`/correct/${item.submissionId}`}>
                          {(item.bodyPreview ?? '').trim() || '—'}
                        </Link>
                      </td>
                      <td>
                        <span className="status corrected">{correctionStatusLabel(item.correction)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
