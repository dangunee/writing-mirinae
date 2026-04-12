import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiUrl } from '../lib/apiUrl'

export default function AdminAssignmentNewPage() {
  const [courseId, setCourseId] = useState('')
  const [sessionIndex, setSessionIndex] = useState('1')
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [requirements, setRequirements] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)
    setError(null)
    try {
      const idx = parseInt(sessionIndex, 10)
      const res = await fetch(apiUrl('/api/writing/admin/assignments/create'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: courseId.trim(),
          sessionIndex: Number.isFinite(idx) ? idx : 1,
          title: title.trim(),
          prompt: prompt.trim(),
          requirements: requirements.trim() || null,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; code?: string; sessionId?: string }
      if (!res.ok || !data.ok) {
        setError(data.code ?? `HTTP ${res.status}`)
        return
      }
      setMessage(`保存しました（session: ${data.sessionId ?? '—'}）`)
    } catch {
      setError('request_failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa] px-4 py-8 font-['Be_Vietnam_Pro',sans-serif] text-[#2c2f32]">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-bold uppercase tracking-widest text-[#595c5e]">Admin</p>
        <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-[#2c2f32]">課題登録</h1>
        <p className="mt-2 text-sm text-[#595c5e]">
          体験コースなど、対象コースの <code className="text-xs">writing.sessions</code>{' '}
          に課題文を保存します（既存の1行を更新するか、指定 index で新規作成）。
        </p>

        <form className="mt-8 space-y-4 text-sm" onSubmit={onSubmit}>
          <label className="block">
            <span className="font-semibold text-[#2c2f32]">コース ID（UUID）</span>
            <input
              className="mt-1 w-full rounded border border-[#c5c8cc] bg-white px-3 py-2 text-[#2c2f32]"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              placeholder="WRITING_TRIAL_COURSE_ID と同じ UUID"
              required
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="font-semibold text-[#2c2f32]">セッション index（1–10）</span>
            <input
              className="mt-1 w-full rounded border border-[#c5c8cc] bg-white px-3 py-2 text-[#2c2f32]"
              type="number"
              min={1}
              max={10}
              value={sessionIndex}
              onChange={(e) => setSessionIndex(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="font-semibold text-[#2c2f32]">タイトル</span>
            <input
              className="mt-1 w-full rounded border border-[#c5c8cc] bg-white px-3 py-2 text-[#2c2f32]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="font-semibold text-[#2c2f32]">課題文・指示</span>
            <textarea
              className="mt-1 min-h-[120px] w-full rounded border border-[#c5c8cc] bg-white px-3 py-2 text-[#2c2f32]"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="font-semibold text-[#2c2f32]">要件（任意）</span>
            <textarea
              className="mt-1 min-h-[72px] w-full rounded border border-[#c5c8cc] bg-white px-3 py-2 text-[#2c2f32]"
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
            />
          </label>

          {error ? (
            <p className="text-sm text-[#ba1a1a]" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="text-sm text-[#1b5e20]" role="status">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-[#4052b6] px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {submitting ? '保存中…' : '保存'}
          </button>
        </form>

        <p className="mt-8">
          <Link to="/writing/admin" className="text-sm text-[#595c5e] underline">
            管理コンソールへ戻る
          </Link>
        </p>
      </div>
    </div>
  )
}
