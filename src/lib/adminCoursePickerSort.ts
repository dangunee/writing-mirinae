/**
 * Admin course picker ordering for assignments (and default selection).
 * Does not rely on API array order: numbered terms first, then 体験/trial, sandbox last.
 */

import type { AdminOrphanCourse, AdminTermTarget } from './adminCourseTermSelect'

export type CoursePickerRow =
  | { kind: 'term'; term: AdminTermTarget }
  | { kind: 'orphan'; orphan: AdminOrphanCourse }

type Bucket = 'numbered' | 'other' | 'trial' | 'sandbox'

const BUCKET_RANK: Record<Bucket, number> = {
  numbered: 0,
  other: 1,
  trial: 2,
  sandbox: 3,
}

/** Try `N기` or `第N期`-style ordinals (no bare leading digits — avoids years like "2024…"). */
export function extractTermOrdinal(titleOrLabel: string): number | null {
  const s = titleOrLabel.trim()
  const kiAnchored = s.match(/^(\d+)\s*기/)
  if (kiAnchored) return parseInt(kiAnchored[1], 10)
  const ki = s.match(/(\d+)\s*기/)
  if (ki) return parseInt(ki[1], 10)
  const dai = s.match(/第\s*(\d+)\s*期/)
  if (dai) return parseInt(dai[1], 10)
  return null
}

function isTrialLabel(text: string): boolean {
  const t = text.trim()
  if (t.includes('体験')) return true
  if (/\btrial\b/i.test(t)) return true
  return false
}

/** Fallback when API flag is missing but label names the admin sandbox course. */
function isSandboxLabel(text: string): boolean {
  const t = text.trim()
  if (t.includes('管理者テスト')) return true
  if (t.includes('サンドボックス')) return true
  return false
}

function classifyTerm(t: AdminTermTarget): Bucket {
  const title = t.title.trim()
  const label = t.label.trim()
  if (isSandboxLabel(title) || isSandboxLabel(label)) return 'sandbox'
  if (isTrialLabel(title) || isTrialLabel(label)) return 'trial'
  const ordinal = extractTermOrdinal(title) ?? extractTermOrdinal(label)
  if (ordinal != null) return 'numbered'
  return 'other'
}

function classifyOrphan(o: AdminOrphanCourse): Bucket {
  const dn = o.displayName.trim()
  if (o.isAdminSandbox || isSandboxLabel(dn)) return 'sandbox'
  if (isTrialLabel(dn)) return 'trial'
  const ordinal = extractTermOrdinal(dn)
  if (ordinal != null) return 'numbered'
  return 'other'
}

type SortMeta = {
  row: CoursePickerRow
  bucket: Bucket
  ordinal: number | null
  sortOrder: number
  tie: string
}

/** Orphans sort after regular terms in the same bucket when sortOrder ties. */
const ORPHAN_SORT_ORDER_FLOOR = 1_000_000

function metaTerm(t: AdminTermTarget): SortMeta {
  const bucket = classifyTerm(t)
  const ordinal =
    bucket === 'numbered'
      ? extractTermOrdinal(t.title) ?? extractTermOrdinal(t.label)
      : null
  return {
    row: { kind: 'term', term: t },
    bucket,
    ordinal,
    sortOrder: t.sortOrder,
    tie: `${t.title}\0${t.termId}`,
  }
}

function metaOrphan(o: AdminOrphanCourse): SortMeta {
  const bucket = classifyOrphan(o)
  const ordinal = bucket === 'numbered' ? extractTermOrdinal(o.displayName) : null
  return {
    row: { kind: 'orphan', orphan: o },
    bucket,
    ordinal,
    sortOrder: ORPHAN_SORT_ORDER_FLOOR,
    tie: o.displayName,
  }
}

function compareMeta(a: SortMeta, b: SortMeta): number {
  const br = BUCKET_RANK[a.bucket] - BUCKET_RANK[b.bucket]
  if (br !== 0) return br

  if (a.bucket === 'numbered') {
    const na = a.ordinal ?? 9999
    const nb = b.ordinal ?? 9999
    if (na !== nb) return na - nb
  }

  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  return a.tie.localeCompare(b.tie, 'ja')
}

/** Flattened picker rows: 1기…8기 → … → 体験 → … → sandbox last. */
export function buildSortedCoursePickerRows(
  termTargets: AdminTermTarget[],
  orphanCourses: AdminOrphanCourse[]
): CoursePickerRow[] {
  const metas: SortMeta[] = [
    ...termTargets.map(metaTerm),
    ...orphanCourses.map(metaOrphan),
  ]
  metas.sort(compareMeta)
  return metas.map((m) => m.row)
}

export function pickerRowCourseId(row: CoursePickerRow): string | null {
  if (row.kind === 'term') return row.term.courseId
  return row.orphan.courseId
}

/** First row that already has a linked course UUID (ensure-only term rows are skipped). */
export function pickFirstCourseIdInPickerOrder(
  termTargets: AdminTermTarget[],
  orphanCourses: AdminOrphanCourse[]
): string | null {
  for (const row of buildSortedCoursePickerRows(termTargets, orphanCourses)) {
    const id = pickerRowCourseId(row)
    if (id) return id
  }
  return null
}
