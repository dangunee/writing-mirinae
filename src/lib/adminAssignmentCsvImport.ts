import Papa from 'papaparse'

import {
  ASSIGNMENT_REQUIREMENT_SLOT_COUNT,
  type AssignmentRequirement,
} from './writingThemeSnapshot'
import { DEFAULT_KOREAN_GRAMMAR_LEVEL_JA } from './koreanGrammarLevel'

/** Expected CSV columns (see writing_1gi_assignments.csv). */
export const ADMIN_ASSIGNMENT_CSV_COLUMNS = [
  'session_index',
  'theme_title',
  'prompt',
  'requirement_1',
  'example_1',
  'requirement_2',
  'example_2',
  'requirement_3',
  'example_3',
  'model_answer',
] as const

export type AdminAssignmentCsvPreviewRow = {
  sessionIndex: number
  themeTitle: string
  promptHead: string
  /** Full payload for POST after confirmation */
  createBody: {
    courseId: string
    sessionIndex: number
    theme: string
    title: string
    prompt: string
    modelAnswer?: string
    requirements: AssignmentRequirement[]
  }
}

export type AdminAssignmentCsvParseResult =
  | { ok: true; rows: AdminAssignmentCsvPreviewRow[]; warnings: string[] }
  | { ok: false; error: string }

function trimCsvToHeaderRow(text: string): string {
  const noBom = text.replace(/^\uFEFF/, '')
  const lines = noBom.split(/\r?\n/)
  const idx = lines.findIndex((l) => {
    const t = l.toLowerCase()
    return t.includes('session_index') && t.includes('theme_title') && t.includes('prompt')
  })
  if (idx < 0) return noBom.trim()
  return lines.slice(idx).join('\n').trim()
}

function cell(raw: unknown): string {
  if (raw == null) return ''
  return String(raw).trim()
}

function splitRequirementCell(requirementCell: string): { expressionLabel: string; translationJa: string } {
  const s = requirementCell.trim()
  if (!s) return { expressionLabel: '', translationJa: '' }
  const fw = '\uFF5E' // fullwidth tilde (CSV uses ～)
  let splitAt = s.indexOf(fw)
  if (splitAt >= 0) {
    const left = s.slice(0, splitAt).trim()
    const right = s.slice(splitAt + fw.length).trim()
    return {
      expressionLabel: left || s,
      translationJa: right || left || s,
    }
  }
  const spacedAscii = s.indexOf(' ~ ')
  if (spacedAscii >= 0) {
    const left = s.slice(0, spacedAscii).trim()
    const right = s.slice(spacedAscii + 3).trim()
    return {
      expressionLabel: left || s,
      translationJa: right || left || s,
    }
  }
  return { expressionLabel: s, translationJa: s }
}

function buildRequirementSlot(
  requirementCell: string,
  exampleCell: string,
  sessionIndex: number,
  slotNumber: number
): AssignmentRequirement | null {
  const exampleKo = exampleCell.trim()
  const { expressionLabel, translationJa } = splitRequirementCell(requirementCell)
  if (!expressionLabel || !exampleKo || !translationJa) return null
  const pattern = expressionLabel
  return {
    grammarLevel: DEFAULT_KOREAN_GRAMMAR_LEVEL_JA,
    expressionKey: `csv-s${sessionIndex}-r${slotNumber}`,
    expressionLabel,
    pattern,
    translationJa,
    exampleKo,
  }
}

/** Slot 3 when CSV omits requirement_3 / example_3 (or either is blank). */
function emptyThirdRequirementSlot(sessionIndex: number): AssignmentRequirement {
  return {
    grammarLevel: DEFAULT_KOREAN_GRAMMAR_LEVEL_JA,
    expressionKey: `csv-s${sessionIndex}-r3-pad`,
    expressionLabel: '',
    pattern: '',
    translationJa: '',
    exampleKo: '',
  }
}

/**
 * Slots 4–5 always duplicate slot 3 (including empty placeholder fields).
 * Distinct expressionKeys satisfy aggregation keys on the client payload.
 */
function extendToFiveRequirementSlots(
  r1: AssignmentRequirement,
  r2: AssignmentRequirement,
  r3: AssignmentRequirement,
  sessionIndex: number
): AssignmentRequirement[] {
  return [
    r1,
    r2,
    r3,
    { ...r3, expressionKey: `csv-s${sessionIndex}-r4-pad` },
    { ...r3, expressionKey: `csv-s${sessionIndex}-r5-pad` },
  ]
}

function buildThirdRequirementSlotFromRow(
  row: Record<string, string>,
  sessionIndex: number
): AssignmentRequirement | 'invalid_filled_pair' {
  const req = cell(row.requirement_3)
  const ex = cell(row.example_3)
  if (!req || !ex) {
    return emptyThirdRequirementSlot(sessionIndex)
  }
  const built = buildRequirementSlot(req, ex, sessionIndex, 3)
  if (!built) return 'invalid_filled_pair'
  return built
}

function promptHead(prompt: string, max = 72): string {
  const oneLine = prompt.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= max) return oneLine
  return `${oneLine.slice(0, max)}…`
}

/**
 * Parse admin bulk-assignment CSV (client-side). Does not hit the network.
 */
export function parseAdminAssignmentsCsvText(csvText: string): AdminAssignmentCsvParseResult {
  const trimmed = trimCsvToHeaderRow(csvText)
  if (!trimmed) return { ok: false, error: 'ファイルが空です。' }

  const parsed = Papa.parse<Record<string, string>>(trimmed, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  })

  if (parsed.errors?.length) {
    const msg = parsed.errors.map((e) => e.message || String(e.type)).join('; ')
    return { ok: false, error: `CSV の読み取りに失敗しました: ${msg}` }
  }

  const warnings: string[] = []
  const rowMap = new Map<number, AdminAssignmentCsvPreviewRow>()

  const records = parsed.data.filter((row) =>
    ADMIN_ASSIGNMENT_CSV_COLUMNS.some((k) => cell(row[k]))
  )

  if (records.length === 0) {
    return { ok: false, error: 'データ行がありません（ヘッダーのみ、または列が空です）。' }
  }

  for (let i = 0; i < records.length; i++) {
    const row = records[i]!
    const sessionRaw = cell(row.session_index)
    const sessionIndex = Number.parseInt(sessionRaw, 10)
    if (!Number.isFinite(sessionIndex) || sessionIndex < 1 || sessionIndex > 10) {
      return {
        ok: false,
        error: `${i + 1} 行目: session_index は 1〜10 の整数にしてください（現在: ${sessionRaw || '（空）'}）。`,
      }
    }

    if (rowMap.has(sessionIndex)) {
      warnings.push(`第${sessionIndex}回の行が重複しています（データ行 ${i + 1}）。後の行を使います。`)
    }

    const themeTitle = cell(row.theme_title)
    const prompt = cell(row.prompt)
    const modelAnswerRaw = cell(row.model_answer)
    const modelAnswer = modelAnswerRaw ? modelAnswerRaw : undefined

    if (!themeTitle) {
      return { ok: false, error: `${i + 1} 行目: theme_title が空です。` }
    }
    if (!prompt) {
      return { ok: false, error: `${i + 1} 行目: prompt が空です。` }
    }

    const r1 = buildRequirementSlot(cell(row.requirement_1), cell(row.example_1), sessionIndex, 1)
    if (!r1) {
      return {
        ok: false,
        error: `${i + 1} 行目（session_index=${sessionIndex}）: スロット 1 が不正です。requirement_1 と example_1 は両方必須です。requirement は「〜」（全角）または「 ~ 」で韓国語ラベルと日本語訳を分けてください（区切りがない場合はセル全体がラベル・訳の両方として使われます）。`,
      }
    }
    const r2 = buildRequirementSlot(cell(row.requirement_2), cell(row.example_2), sessionIndex, 2)
    if (!r2) {
      return {
        ok: false,
        error: `${i + 1} 行目（session_index=${sessionIndex}）: スロット 2 が不正です。requirement_2 と example_2 は両方必須です（ルールはスロット 1 と同じ）。requirement_3 / example_3 が空でもインポートできます。`,
      }
    }

    const r3OrErr = buildThirdRequirementSlotFromRow(row, sessionIndex)
    if (r3OrErr === 'invalid_filled_pair') {
      return {
        ok: false,
        error: `${i + 1} 行目: requirement_3 と example_3 に値がある場合は、有効な文型・例文の組み合わせにしてください（〜 区切りなど）。`,
      }
    }

    const requirements = extendToFiveRequirementSlots(r1, r2, r3OrErr, sessionIndex)
    if (requirements.length !== ASSIGNMENT_REQUIREMENT_SLOT_COUNT) {
      return { ok: false, error: `${i + 1} 行目: 要件の組み立てに失敗しました。` }
    }

    rowMap.set(sessionIndex, {
      sessionIndex,
      themeTitle,
      promptHead: promptHead(prompt),
      createBody: {
        courseId: '',
        sessionIndex,
        theme: themeTitle,
        title: themeTitle,
        prompt,
        modelAnswer,
        requirements,
      },
    })
  }

  const previewRows = [...rowMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, row]) => row)

  return { ok: true, rows: previewRows, warnings }
}

export function attachCourseIdToPreviewRows(
  rows: AdminAssignmentCsvPreviewRow[],
  courseId: string
): AdminAssignmentCsvPreviewRow[] {
  const cid = courseId.trim()
  return rows.map((r) => ({
    ...r,
    createBody: { ...r.createBody, courseId: cid },
  }))
}
