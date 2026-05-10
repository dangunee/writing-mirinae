import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { apiUrl } from '../lib/apiUrl'
import { TeacherPageNav } from '../components/teacher/TeacherPageNav'

type QueueTab = 'pending' | 'completed'

/** GET /api/teacher/writing/submissions/queue — 서버 QueueGroupedResponse와 동형 */
type QueueItem = {
  submissionId: string
  status: string
  submittedAt: string | null
  createdAt: string
  sessionIndex: number
  bodyPreview: string | null
  /** Admin Sandbox mirror row — QA test data */
  isSandbox?: boolean
  correction: null | {
    id: string
    teacherId: string
    status: string
    updatedAt: string
    publishedAt: string | null
  }
}

type QueueGroupedResponse = {
  filter: QueueTab
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
    corrected: '첨삭 완료',
    published: '공개됨',
    missed: '미제출(기한)',
  }
  return map[status] ?? status
}

/** 첨삭 레코드 유무·상태 → 표시 문구 */
function correctionStatusLabel(c: QueueItem['correction']): string {
  if (c == null) return '—'
  if (c.status === 'draft') return '작성 중'
  if (c.status === 'published') return '공개됨'
  return c.status
}

export default function TeacherQueuePage() {
  const [queueTab, setQueueTab] = useState<QueueTab>('pending')
  const [data, setData] = useState<QueueGroupedResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const statusParam = queueTab === 'completed' ? 'completed' : 'pending'
    try {
      const res = await fetch(apiUrl(`/api/teacher/writing/submissions/queue?status=${statusParam}`), {
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
  }, [queueTab])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="writing-page">
        <div className="writing-page-top">
          <h1 className="writing-page-title">첨삭 큐</h1>
          <TeacherPageNav />
        </div>
        <TeacherQueueTabBar queueTab={queueTab} onChange={setQueueTab} />
        <p className="status pending">불러오는 중…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="writing-page">
        <div className="writing-page-top">
          <h1 className="writing-page-title">첨삭 큐</h1>
          <TeacherPageNav />
        </div>
        <TeacherQueueTabBar queueTab={queueTab} onChange={setQueueTab} />
        <p className="status pending">{error}</p>
      </div>
    )
  }

  const groups = data?.groups ?? []
  const empty = groups.length === 0 || groups.every((g) => g.items.length === 0)
  const emptyMessageJa =
    queueTab === 'completed' ? '添削完了した提出はありません。' : '待機中の提出はありません。'

  return (
    <div className="writing-page">
      <div className="writing-page-top">
        <h1 className="writing-page-title">첨삭 큐</h1>
        <TeacherPageNav />
      </div>

      <TeacherQueueTabBar queueTab={queueTab} onChange={setQueueTab} />

      {empty ? (
        <p className="no-assignments">{emptyMessageJa}</p>
      ) : queueTab === 'completed' ? (
        <div className="assignment-weeks">
          {groups.map((group) => (
            <section key={group.date} className="week-section">
              <h3 className="week-label">{group.date}</h3>
              <table className="assignment-table">
                <thead>
                  <tr>
                    <th>세션</th>
                    <th>제출</th>
                    <th>제출 상태</th>
                    <th>미리보기</th>
                    <th>첨삭</th>
                    <th>공개일時</th>
                    <th>첨삭 수정</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item) => (
                    <tr key={item.submissionId}>
                      <td>
                        <Link className="view-link" to={`/writing/teacher/correct/${item.submissionId}`}>
                          {item.sessionIndex}
                        </Link>
                        {item.isSandbox ? (
                          <span className="teacher-queue-sandbox-badge" title="Admin sandbox QA">
                            Sandbox (QA)
                          </span>
                        ) : null}
                      </td>
                      <td>{formatDateTime(item.submittedAt)}</td>
                      <td>
                        <span className="status submitted">{submissionStatusLabel(item.status)}</span>
                      </td>
                      <td className="assignment-title">
                        <Link className="view-link" to={`/writing/teacher/correct/${item.submissionId}`}>
                          {(item.bodyPreview ?? '').trim() || '—'}
                        </Link>
                      </td>
                      <td>
                        <span className="status corrected">{correctionStatusLabel(item.correction)}</span>
                      </td>
                      <td>{formatDateTime(item.correction?.publishedAt ?? null)}</td>
                      <td>{formatDateTime(item.correction?.updatedAt ?? null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
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
                      <td>
                        <Link className="view-link" to={`/writing/teacher/correct/${item.submissionId}`}>
                          {item.sessionIndex}
                        </Link>
                        {item.isSandbox ? (
                          <span className="teacher-queue-sandbox-badge" title="Admin sandbox QA">
                            Sandbox (QA)
                          </span>
                        ) : null}
                      </td>
                      <td>{formatDateTime(item.submittedAt)}</td>
                      <td>
                        <span className="status submitted">{submissionStatusLabel(item.status)}</span>
                      </td>
                      <td className="assignment-title">
                        <Link className="view-link" to={`/writing/teacher/correct/${item.submissionId}`}>
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

function TeacherQueueTabBar({
  queueTab,
  onChange,
}: {
  queueTab: QueueTab
  onChange: (t: QueueTab) => void
}) {
  return (
    <div className="teacher-queue-tabs" role="tablist" aria-label="Teacher submission queue">
      <button
        type="button"
        role="tab"
        aria-selected={queueTab === 'pending'}
        className={`teacher-queue-tab ${queueTab === 'pending' ? 'teacher-queue-tab--active' : ''}`}
        onClick={() => onChange('pending')}
      >
        添削待ち · 대기 중
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={queueTab === 'completed'}
        className={`teacher-queue-tab ${queueTab === 'completed' ? 'teacher-queue-tab--active' : ''}`}
        onClick={() => onChange('completed')}
      >
        添削完了 · 완료
      </button>
    </div>
  )
}
