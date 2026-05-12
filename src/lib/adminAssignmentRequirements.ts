/**
 * Admin assignment requirement slots: validation for POST /api/writing/admin/assignments/create
 * and the register/edit form. Slots 1–2 required; 3–5 optional (all empty or fully filled).
 */

import {
  DEFAULT_KOREAN_GRAMMAR_LEVEL_JA,
  isKoreanGrammarLevelJa,
  type KoreanGrammarLevelJa,
} from './koreanGrammarLevel'
import {
  ASSIGNMENT_REQUIREMENT_SLOT_COUNT,
  emptyAssignmentRequirement,
  type AssignmentRequirement,
} from './writingThemeSnapshot'

/** Slots 1–2 (0-based indices 0–1) must always be fully populated. */
export const ADMIN_ASSIGNMENT_REQUIRED_SLOT_COUNT = 2

export function requirementSlotHasAnyContent(r: AssignmentRequirement): boolean {
  return (
    r.expressionKey.trim() !== '' ||
    r.expressionLabel.trim() !== '' ||
    r.pattern.trim() !== '' ||
    r.translationJa.trim() !== '' ||
    r.exampleKo.trim() !== ''
  )
}

export function isCompleteRequirement(r: AssignmentRequirement): boolean {
  const gl = r.grammarLevel.trim()
  if (!isKoreanGrammarLevelJa(gl)) return false
  const ek = r.expressionKey.trim()
  const el = r.expressionLabel.trim()
  const pat = r.pattern.trim()
  const tj = r.translationJa.trim()
  const ex = r.exampleKo.trim()
  return Boolean(ek && el && pat && tj && ex)
}

/** Normalize one JSON array element from the client/API body. */
export function coerceAssignmentRequirementSlot(raw: unknown): AssignmentRequirement {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyAssignmentRequirement()
  }
  const o = raw as Record<string, unknown>
  const grammarLevelRaw = typeof o.grammarLevel === 'string' ? o.grammarLevel.trim() : ''
  const grammarLevel: KoreanGrammarLevelJa = isKoreanGrammarLevelJa(grammarLevelRaw)
    ? grammarLevelRaw
    : DEFAULT_KOREAN_GRAMMAR_LEVEL_JA
  return {
    grammarLevel,
    expressionKey: typeof o.expressionKey === 'string' ? o.expressionKey : '',
    expressionLabel: typeof o.expressionLabel === 'string' ? o.expressionLabel : '',
    pattern: typeof o.pattern === 'string' ? o.pattern : '',
    translationJa: typeof o.translationJa === 'string' ? o.translationJa : '',
    exampleKo: typeof o.exampleKo === 'string' ? o.exampleKo : '',
  }
}

function trimRequirement(r: AssignmentRequirement): AssignmentRequirement {
  const glRaw = r.grammarLevel.trim()
  const grammarLevel: KoreanGrammarLevelJa = isKoreanGrammarLevelJa(glRaw)
    ? glRaw
    : DEFAULT_KOREAN_GRAMMAR_LEVEL_JA
  return {
    grammarLevel,
    expressionKey: r.expressionKey.trim(),
    expressionLabel: r.expressionLabel.trim(),
    pattern: r.pattern.trim(),
    translationJa: r.translationJa.trim(),
    exampleKo: r.exampleKo.trim(),
  }
}

/**
 * Exactly {@link ASSIGNMENT_REQUIREMENT_SLOT_COUNT} slots.
 * Indices 0–1: must be complete.
 * Indices 2–4: if no content in any of the five text fields → empty slot; otherwise must be complete (no partial slots).
 */
export function normalizeAdminAssignmentRequirementsPayload(
  reqArr: unknown
): { ok: true; requirements: AssignmentRequirement[] } | { ok: false; code: string } {
  if (!Array.isArray(reqArr) || reqArr.length !== ASSIGNMENT_REQUIREMENT_SLOT_COUNT) {
    return { ok: false, code: 'requirements_slot_count' }
  }

  const out: AssignmentRequirement[] = []

  for (let i = 0; i < ASSIGNMENT_REQUIREMENT_SLOT_COUNT; i++) {
    const r = coerceAssignmentRequirementSlot(reqArr[i])
    if (i < ADMIN_ASSIGNMENT_REQUIRED_SLOT_COUNT) {
      if (!isCompleteRequirement(r)) {
        return { ok: false, code: 'invalid_requirements' }
      }
      out.push(trimRequirement(r))
    } else {
      if (!requirementSlotHasAnyContent(r)) {
        out.push(emptyAssignmentRequirement())
      } else if (!isCompleteRequirement(r)) {
        return { ok: false, code: 'invalid_requirements' }
      } else {
        out.push(trimRequirement(r))
      }
    }
  }

  return { ok: true, requirements: out }
}

/** Stable fingerprint for duplicate-slot detection (content fields only). */
export function requirementSlotContentSignature(r: AssignmentRequirement): string {
  const t = trimRequirement(r)
  return [t.expressionKey, t.expressionLabel, t.pattern, t.translationJa, t.exampleKo].join('\u0000')
}

/** True when this slot duplicates the previous slot’s content (both non-empty). */
export function isRequirementSlotDuplicateOfPrevious(
  slotIndex: number,
  slots: readonly AssignmentRequirement[]
): boolean {
  if (slotIndex <= 0 || slotIndex >= slots.length) return false
  const prev = slots[slotIndex - 1]
  const cur = slots[slotIndex]
  if (!requirementSlotHasAnyContent(prev) || !requirementSlotHasAnyContent(cur)) return false
  return requirementSlotContentSignature(prev) === requirementSlotContentSignature(cur)
}
