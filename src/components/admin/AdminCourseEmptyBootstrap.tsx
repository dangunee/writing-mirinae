import { useCallback, useEffect, useState } from 'react'
import { apiUrl } from '../../lib/apiUrl'

type Term = { termId: string; title: string; sortOrder: number }

type Props = {
  onProvisioned: () => void | Promise<void>
}

/**
 * When writing.courses is empty: pick writing.terms and POST ensure-for-term (admin-only).
 */
export default function AdminCourseEmptyBootstrap({ onProvisioned }: Props) {
  const [terms, setTerms] = useState<Term[]>([])
  const [termsLoading, setTermsLoading] = useState(true)
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const loadTerms = useCallback(async () => {
    setTermsLoading(true)
    try {
      const res = await fetch(apiUrl('/api/writing/admin/assignment-terms'), { credentials: 'include' })
      const data = (await res.json()) as { ok?: boolean; terms?: Term[] }
      if (res.ok && data.ok && Array.isArray(data.terms)) {
        setTerms(data.terms)
      }
    } catch {
      /* ignore */
    } finally {
      setTermsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTerms()
  }, [loadTerms])

  async function ensure() {
    if (!pick) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(apiUrl('/api/writing/admin/courses/ensure-for-term'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termId: pick }),
      })
      const data = (await res.json()) as { ok?: boolean; code?: string }
      if (!res.ok || !data.ok) {
        setMsg(data.code ?? `HTTP ${res.status}`)
        return
      }
      await onProvisioned()
    } catch {
      setMsg('request_failed')
    } finally {
      setBusy(false)
    }
  }

  if (termsLoading) {
    return (
      <p className="text-xs text-[#595c5e]" role="status">
        期一覧を読み込み中…
      </p>
    )
  }

  if (terms.length === 0) {
    return (
      <p className="text-xs text-[#595c5e]">
        writing.terms に期がありません。Supabase マイグレーション（体験・1기–8기 シード）を実行してください。
      </p>
    )
  }

  return (
    <div className="space-y-2 rounded border border-[#c5c8cc] bg-white/80 p-3">
      <p className="text-xs font-semibold text-[#2c2f32]">コースがまだありません。期を選んでサーバーに作成します。</p>
      <select
        className="block w-full rounded border border-[#c5c8cc] bg-white px-3 py-2 text-sm text-[#2c2f32]"
        value={pick}
        onChange={(e) => setPick(e.target.value)}
      >
        <option value="">期を選択</option>
        {terms.map((t) => (
          <option key={t.termId} value={t.termId}>
            {t.title}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!pick || busy}
        onClick={() => void ensure()}
        className="rounded bg-[#4052b6] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        {busy ? '作成中…' : 'この期のコースを作成して読み込む'}
      </button>
      {msg ? (
        <p className="text-xs text-[#ba1a1a]" role="alert">
          {msg}
        </p>
      ) : null}
    </div>
  )
}
