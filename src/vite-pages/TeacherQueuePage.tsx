import { useCallback, useEffect, useMemo, useState } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiUrl } from '../lib/apiUrl'
import { TeacherPageNav } from '../components/teacher/TeacherPageNav'

type QueueTab = 'pending' | 'completed'

/** GET /api/teacher/writing/submissions/queue — 서버 QueueGroupedResponse와 동형 */
type QueueItem = {
  submissionId: string
  /** 서버가 추가하기 전 응답과의 호환 */
  studentName?: string | null
  studentEmail?: string | null
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
  if (iso == null || iso === '') return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

function dashCell(value: string | null | undefined): string {
  const t = value?.trim()
  return t ? t : '-'
}

/** 제출 상태 API 값 → 표시 (作文トレーニング UI) */
function submissionStatusLabel(status: string): string {
  const map: Record<string, string> = {
    submitted: '提出済み',
    in_progress: '作成中',
    draft: '下書き',
    in_review: '確認中',
    corrected: '添削済み',
    published: '公開済み',
    missed: '未提出',
  }
  return map[status] ?? status
}

/** 첨삭 레코드 유무·상태 → 표시 */
function correctionStatusLabel(c: QueueItem['correction']): string {
  if (c == null) return '-'
  if (c.status === 'draft') return '下書き'
  if (c.status === 'published') return '公開済み'
  return c.status
}

function TeacherQueueRow({ item, navigate }: { item: QueueItem; navigate: NavigateFunction }) {
  const to = `/writing/teacher/correct/${item.submissionId}`
  const open = () => navigate(to)
  const previewText = (item.bodyPreview ?? '').trim() || '-'

  return (
    <tr
      className="teacher-queue-row"
      tabIndex={0}
      role="button"
      aria-label={`セッション ${item.sessionIndex} の提出を開く`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
    >
      <td>
        <span className="teacher-queue-session-cell">
          <span className="teacher-queue-session-index">{item.sessionIndex}</span>
          {item.isSandbox ? (
            <span className="teacher-queue-sandbox-badge" title="Admin sandbox QA">
              Sandbox (QA)
            </span>
          ) : null}
        </span>
      </td>
      <td>{dashCell(item.studentName ?? null)}</td>
      <td
        className="teacher-queue-email-cell"
        title={item.studentEmail?.trim() ? item.studentEmail.trim() : undefined}
      >
        {dashCell(item.studentEmail ?? null)}
      </td>
      <td>{formatDateTime(item.submittedAt)}</td>
      <td>
        <span className="status submitted">{submissionStatusLabel(item.status)}</span>
      </td>
      <td className="teacher-queue-preview-cell" title={previewText === '-' ? undefined : previewText}>
        {previewText}
      </td>
      <td>
        <span className="status corrected">{correctionStatusLabel(item.correction)}</span>
      </td>
      <td>{formatDateTime(item.correction?.publishedAt ?? null)}</td>
      <td>{formatDateTime(item.correction?.updatedAt ?? null)}</td>
    </tr>
  )
}

function TeacherQueueTableBody({
  groups,
  navigate,
}: {
  groups: QueueGroupedResponse['groups']
  navigate: NavigateFunction
}) {
  return (
    <>
      {groups.map((group) => (
        <tbody key={group.date}>
          <tr className="teacher-queue-date-row">
            <td colSpan={9} className="teacher-queue-date-cell">
              {group.date}
            </td>
          </tr>
          {group.items.map((item) => (
            <TeacherQueueRow key={item.submissionId} item={item} navigate={navigate} />
          ))}
        </tbody>
      ))}
    </>
  )
}

const QUEUE_TABLE_HEAD = (
  <thead>
    <tr>
      <th>セッション</th>
      <th>受講者</th>
      <th>メール</th>
      <th>提出日時</th>
      <th>状態</th>
      <th>作文プレビュー</th>
      <th>添削</th>
      <th>公開日時</th>
      <th>添削修正</th>
    </tr>
  </thead>
)

export default function TeacherQueuePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const queueTab: QueueTab = useMemo(() => {
    return searchParams.get('status') === 'completed' ? 'completed' : 'pending'
  }, [searchParams])

  const setQueueTab = useCallback(
    (t: QueueTab) => {
      setSearchParams({ status: t }, { replace: true })
    },
    [setSearchParams]
  )

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
          setError('perm')
        } else {
          setError('load')
        }
        setData(null)
        return
      }
      const json = (await res.json()) as QueueGroupedResponse
      setData(json)
    } catch {
      setError('load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [queueTab])

  useEffect(() => {
    void load()
  }, [load])

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

      {loading ? (
        <p className="status pending">불러오는 중…</p>
      ) : error === 'perm' ? (
        <p className="status pending">강사 권한이 필요합니다.</p>
      ) : error ? (
        <p className="status pending">목록을 불러오지 못했습니다.</p>
      ) : empty ? (
        <p className="no-assignments">{emptyMessageJa}</p>
      ) : (
        <div className="assignment-weeks teacher-queue-weeks">
          <table className="assignment-table teacher-queue-compact">
            {QUEUE_TABLE_HEAD}
            <TeacherQueueTableBody groups={groups} navigate={navigate} />
          </table>
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
