/**
 * Shared types + helpers for GET /api/writing/results/:submissionId (student / teacher preview).
 */

export type ResultSessionCommon = {
  id: string
  index: number
  status: string
  runtimeStatus: string | null
  unlockAt: string
  availableFrom: string | null
  dueAt: string | null
  missedAt: string | null
}

export type StudentCorrectionAttachment = {
  id: string
  mimeType: string
  downloadUrl: string | null
  originalFilename: string | null
}

export type PublishedCorrection = {
  polishedSentence: string | null
  modelAnswer: string | null
  teacherComment: string | null
  improvedText: string | null
  richDocumentJson: unknown | null
  publishedAt?: string | null
}

/** GET /api/writing/results/:id — published-only or missed-safe payload. */
export type StudentWritingResultPayload =
  | {
      outcome: 'published'
      submissionId: string
      session: ResultSessionCommon
      submission: {
        bodyText: string | null
        submittedAt: string | null
      }
      attachments?: StudentCorrectionAttachment[] | null
      correction: PublishedCorrection | null
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
      attachments?: StudentCorrectionAttachment[] | null
      correction: null
      fragments?: unknown[]
      feedbackItems?: unknown[]
      annotations?: unknown[]
      evaluation?: null
    }

/** Older API may omit `outcome`; infer from correction presence. */
export function normalizeStudentWritingResultPayload(raw: Record<string, unknown>): Record<string, unknown> {
  if (raw.outcome === 'missed' || raw.outcome === 'published') return raw
  if (raw.correction === null) return { ...raw, outcome: 'missed' }
  return { ...raw, outcome: 'published' }
}

export function textNonEmpty(s: string | null | undefined): boolean {
  return s != null && String(s).trim() !== ''
}

export function formatIsoDate(iso: string | null | undefined): string {
  if (iso == null || iso === '') return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export function formatSessionMetaLine(session: ResultSessionCommon & { modelAnswerSnapshot?: string | null }): string {
  const idx = Number.isFinite(session.index) ? `第${session.index}回` : '—'
  const unlock = formatIsoDate(session.unlockAt)
  const avail = session.availableFrom ? formatIsoDate(session.availableFrom) : '—'
  const due = session.dueAt ? formatIsoDate(session.dueAt) : '—'
  return `${idx} · 解放 ${unlock} · 受付開始 ${avail} · 締切 ${due}`
}
