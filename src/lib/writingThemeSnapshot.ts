/**
 * writing.sessions.theme_snapshot:
 * - New: JSON string ThemeSnapshotV1
 * - Legacy: plain text "title\\n\\nprompt" or with 要件 block
 */

export type AssignmentRequirement = {
  expressionKey: string
  expressionLabel: string
  pattern: string
  translationJa: string
  exampleKo: string
}

export type ThemeSnapshotV1 = {
  theme: string
  title: string
  prompt: string
  requirements: AssignmentRequirement[]
  modelAnswer?: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function isRequirement(v: unknown): v is AssignmentRequirement {
  if (!isRecord(v)) return false
  return (
    typeof v.expressionKey === 'string' &&
    typeof v.expressionLabel === 'string' &&
    typeof v.pattern === 'string' &&
    typeof v.translationJa === 'string' &&
    typeof v.exampleKo === 'string'
  )
}

/** @deprecated use parseAssignmentSnapshotForUi */
export function parseThemeSnapshotForUi(raw: string | null | undefined): {
  title: string | null
  instruction: string
} {
  const full = parseAssignmentSnapshotForUi(raw)
  return {
    title: full.displayTitle,
    instruction: full.prompt || full.legacyInstruction || '',
  }
}

export type AssignmentUiModel = {
  kind: 'structured' | 'legacy'
  theme: string
  displayTitle: string
  prompt: string
  legacyInstruction: string
  requirements: AssignmentRequirement[]
  /** Never expose to student UI before submission */
  modelAnswer?: string
}

/** True when theme_snapshot exists and is non-empty after trim (登録済み). */
export function hasRegisteredThemeSnapshot(raw: string | null | undefined): boolean {
  return raw != null && String(raw).trim().length > 0
}

/**
 * One-line preview for admin session rows (title/theme), truncated.
 * Uses {@link parseAssignmentSnapshotForUi} only — no duplicate parsing rules.
 */
export function assignmentListPreviewLine(raw: string | null | undefined, maxLen = 48): string {
  if (!hasRegisteredThemeSnapshot(raw)) return ''
  const u = parseAssignmentSnapshotForUi(raw)
  const short = (u.displayTitle || u.theme || '').trim()
  if (!short) return ''
  return short.length > maxLen ? `${short.slice(0, maxLen)}…` : short
}

/**
 * Safe parse for WritingPage: structured snapshot or legacy plain text.
 */
export function parseAssignmentSnapshotForUi(raw: string | null | undefined): AssignmentUiModel {
  if (raw == null || !String(raw).trim()) {
    return {
      kind: 'legacy',
      theme: '',
      displayTitle: '',
      prompt: '',
      legacyInstruction: '',
      requirements: [],
    }
  }
  const trimmed = String(raw).trim()
  if (trimmed.startsWith('{')) {
    try {
      const j = JSON.parse(trimmed) as unknown
      if (!isRecord(j)) return legacyOnly(trimmed)
      const theme = typeof j.theme === 'string' ? j.theme : ''
      const title = typeof j.title === 'string' ? j.title : ''
      const prompt = typeof j.prompt === 'string' ? j.prompt : ''
      const modelAnswer = typeof j.modelAnswer === 'string' ? j.modelAnswer : undefined
      const reqRaw = j.requirements
      const requirements: AssignmentRequirement[] = []
      if (Array.isArray(reqRaw)) {
        for (const r of reqRaw) {
          if (isRequirement(r)) requirements.push(r)
        }
      }
      if (!title && !prompt && requirements.length === 0) {
        return legacyOnly(trimmed)
      }
      return {
        kind: 'structured',
        theme: theme || title,
        displayTitle: title || theme || '',
        prompt,
        legacyInstruction: '',
        requirements,
        modelAnswer,
      }
    } catch {
      return legacyOnly(trimmed)
    }
  }
  return legacyOnly(trimmed)
}

function legacyOnly(trimmed: string): AssignmentUiModel {
  const parts = trimmed.split(/\n\n/)
  const t = parts[0]?.trim() || ''
  const rest = parts.length > 1 ? parts.slice(1).join('\n\n').trim() : ''
  return {
    kind: 'legacy',
    theme: t,
    displayTitle: t,
    prompt: rest,
    legacyInstruction: rest || trimmed,
    requirements: [],
  }
}
