/**
 * writing.sessions.theme_snapshot:
 * - New: JSON string ThemeSnapshotV1
 * - Legacy: plain text "title\\n\\nprompt" or with 要件 block
 */

import {
  DEFAULT_KOREAN_GRAMMAR_LEVEL_JA,
  isKoreanGrammarLevelJa,
  type KoreanGrammarLevelJa,
} from './koreanGrammarLevel'

/** Must match server/lib/writingAssignmentSnapshot.ts ASSIGNMENT_REQUIREMENT_SLOT_COUNT */
export const ASSIGNMENT_REQUIREMENT_SLOT_COUNT = 5

export type { KoreanGrammarLevelJa }

export type AssignmentRequirement = {
  /** 일본어 난이도 태그 (初級 … 上級). 구 스냅샷은 파싱 시 기본값으로 보정. */
  grammarLevel: KoreanGrammarLevelJa
  expressionKey: string
  expressionLabel: string
  pattern: string
  translationJa: string
  exampleKo: string
}

/**
 * JSON / API 한 줄을 요건으로 파싱. `grammarLevel` 없거나 잘못된 값이면 `DEFAULT_KOREAN_GRAMMAR_LEVEL_JA`.
 * 서버 `theme_snapshot` 파싱과 동일 규칙을 쓰려면 이 함수만 사용.
 */
export function tryParseAssignmentRequirement(r: unknown): AssignmentRequirement | null {
  if (!isRecord(r)) return null
  const expressionKey = typeof r.expressionKey === 'string' ? r.expressionKey.trim() : ''
  const expressionLabel = typeof r.expressionLabel === 'string' ? r.expressionLabel.trim() : ''
  const pattern = typeof r.pattern === 'string' ? r.pattern.trim() : ''
  const translationJa = typeof r.translationJa === 'string' ? r.translationJa.trim() : ''
  const exampleKo = typeof r.exampleKo === 'string' ? r.exampleKo.trim() : ''
  if (!expressionKey || !expressionLabel || !pattern || !translationJa || !exampleKo) return null
  const glRaw = typeof r.grammarLevel === 'string' ? r.grammarLevel.trim() : ''
  const grammarLevel = isKoreanGrammarLevelJa(glRaw) ? glRaw : DEFAULT_KOREAN_GRAMMAR_LEVEL_JA
  return {
    grammarLevel,
    expressionKey,
    expressionLabel,
    pattern,
    translationJa,
    exampleKo,
  }
}

/** Empty slot for forms (admin 課題登録). */
export function emptyAssignmentRequirement(): AssignmentRequirement {
  return {
    grammarLevel: DEFAULT_KOREAN_GRAMMAR_LEVEL_JA,
    expressionKey: '',
    expressionLabel: '',
    pattern: '',
    translationJa: '',
    exampleKo: '',
  }
}

/** Pad or trim so length is exactly `slotCount` (for admin save validation). */
export function padAssignmentRequirementsToSlotCount(
  requirements: AssignmentRequirement[],
  slotCount = ASSIGNMENT_REQUIREMENT_SLOT_COUNT
): AssignmentRequirement[] {
  const out = requirements.slice(0, slotCount).map((r) => ({ ...r }))
  while (out.length < slotCount) {
    out.push(emptyAssignmentRequirement())
  }
  return out
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
          const row = tryParseAssignmentRequirement(r)
          if (row) requirements.push(row)
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
