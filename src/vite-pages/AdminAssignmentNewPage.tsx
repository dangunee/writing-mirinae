import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiUrl } from '../lib/apiUrl'
import type { AssignmentRequirement } from '../lib/writingThemeSnapshot'

const emptyReq = (): AssignmentRequirement => ({
  expressionKey: '',
  expressionLabel: '',
  pattern: '',
  translationJa: '',
  exampleKo: '',
})

export default function AdminAssignmentNewPage() {
  const [courseId, setCourseId] = useState('')
  const [sessionIndex, setSessionIndex] = useState('1')
  const [theme, setTheme] = useState('')
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [modelAnswer, setModelAnswer] = useState('')
  const [req, setReq] = useState<[AssignmentRequirement, AssignmentRequirement, AssignmentRequirement]>([
    emptyReq(),
    emptyReq(),
    emptyReq(),
  ])
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function patchReq(i: 0 | 1 | 2, field: keyof AssignmentRequirement, value: string) {
    setReq((prev) => {
      const next = [...prev] as [AssignmentRequirement, AssignmentRequirement, AssignmentRequirement]
      next[i] = { ...next[i], [field]: value }
      return next
    })
  }

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
          theme: theme.trim(),
          title: title.trim(),
          prompt: prompt.trim(),
          modelAnswer: modelAnswer.trim() || undefined,
          requirements: req,
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
            <span className="font-semibold text-[#2c2f32]">テーマ（theme）</span>
            <input
              className="mt-1 w-full rounded border border-[#c5c8cc] bg-white px-3 py-2 text-[#2c2f32]"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="font-semibold text-[#2c2f32]">タイトル（title）</span>
            <input
              className="mt-1 w-full rounded border border-[#c5c8cc] bg-white px-3 py-2 text-[#2c2f32]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="font-semibold text-[#2c2f32]">課題文・指示（prompt）</span>
            <textarea
              className="mt-1 min-h-[120px] w-full rounded border border-[#c5c8cc] bg-white px-3 py-2 text-[#2c2f32]"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
            />
          </label>

          <p className="font-semibold text-[#2c2f32] pt-2">必須文法・表現（3件）</p>
          {([0, 1, 2] as const).map((slot) => (
            <div key={slot} className="space-y-2 rounded border border-[#c5c8cc] bg-white/80 p-3">
              <p className="text-xs font-bold text-[#595c5e]">スロット {slot + 1}</p>
              <input
                className="w-full rounded border border-[#c5c8cc] bg-white px-2 py-1.5 text-xs"
                placeholder="expressionKey（集計用）"
                value={req[slot].expressionKey}
                onChange={(e) => patchReq(slot, 'expressionKey', e.target.value)}
                required
              />
              <input
                className="w-full rounded border border-[#c5c8cc] bg-white px-2 py-1.5 text-xs"
                placeholder="expressionLabel（韓国語ラベル）"
                value={req[slot].expressionLabel}
                onChange={(e) => patchReq(slot, 'expressionLabel', e.target.value)}
                required
              />
              <input
                className="w-full rounded border border-[#c5c8cc] bg-white px-2 py-1.5 text-xs"
                placeholder="pattern（本文照合用部分文字列）"
                value={req[slot].pattern}
                onChange={(e) => patchReq(slot, 'pattern', e.target.value)}
                required
              />
              <input
                className="w-full rounded border border-[#c5c8cc] bg-white px-2 py-1.5 text-xs"
                placeholder="translationJa"
                value={req[slot].translationJa}
                onChange={(e) => patchReq(slot, 'translationJa', e.target.value)}
                required
              />
              <textarea
                className="min-h-[48px] w-full rounded border border-[#c5c8cc] bg-white px-2 py-1.5 text-xs"
                placeholder="exampleKo"
                value={req[slot].exampleKo}
                onChange={(e) => patchReq(slot, 'exampleKo', e.target.value)}
                required
              />
            </div>
          ))}

          <label className="block">
            <span className="font-semibold text-[#2c2f32]">模範解答（modelAnswer・任意）</span>
            <textarea
              className="mt-1 min-h-[80px] w-full rounded border border-[#c5c8cc] bg-white px-3 py-2 text-[#2c2f32]"
              value={modelAnswer}
              onChange={(e) => setModelAnswer(e.target.value)}
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
