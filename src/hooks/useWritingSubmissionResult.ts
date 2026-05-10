import { useEffect, useState } from 'react'

import { apiUrl } from '../lib/apiUrl'
import type { StudentWritingResultPayload } from '../lib/studentWritingResult'
import { normalizeStudentWritingResultPayload } from '../lib/studentWritingResult'

export type WritingSubmissionResultLoadState =
  | 'idle'
  | 'loading'
  | 'ok'
  | 'not_found'
  | 'not_published'
  /** Submission row is already `published` but published correction payload missing (sync/repair). */
  | 'result_pending_sync'

/** Fetch GET /api/writing/results/:submissionId — same loader as ViewCorrectionPage (published correction only). */
export function useWritingSubmissionResult(submissionId: string | undefined | null): {
  loadState: WritingSubmissionResultLoadState
  result: StudentWritingResultPayload | null
} {
  const [loadState, setLoadState] = useState<WritingSubmissionResultLoadState>(() =>
    submissionId ? 'loading' : 'idle'
  )
  const [result, setResult] = useState<StudentWritingResultPayload | null>(null)

  useEffect(() => {
    if (!submissionId) {
      setLoadState('idle')
      setResult(null)
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
          const data = normalizeStudentWritingResultPayload(raw) as StudentWritingResultPayload
          setResult(data)
          setLoadState('ok')
          return
        }

        if (res.status === 404) {
          const subRes = await fetch(apiUrl(`/api/writing/submissions/${submissionId}`), {
            credentials: 'include',
          })
          if (cancelled) return
          if (subRes.ok) {
            let st: string | undefined
            try {
              const body = (await subRes.json()) as { status?: string }
              st = typeof body.status === 'string' ? body.status : undefined
            } catch {
              st = undefined
            }
            setResult(null)
            if (st === 'published') {
              setLoadState('result_pending_sync')
            } else {
              setLoadState('not_published')
            }
            return
          }
          setResult(null)
          setLoadState('not_found')
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

  return { loadState, result }
}
