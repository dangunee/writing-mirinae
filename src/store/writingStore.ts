import type { Assignment, Submission, Correction, Student } from '../types/writing'

const STORAGE_KEYS = {
  assignments: 'writing-mirinae-assignments',
  submissions: 'writing-mirinae-submissions',
  corrections: 'writing-mirinae-corrections',
  students: 'writing-mirinae-students',
} as const

function load<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return defaultValue
    return JSON.parse(raw) as T
  } catch {
    return defaultValue
  }
}

function save<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

// Assignments
export function getAssignments(): Assignment[] {
  return load(STORAGE_KEYS.assignments, [])
}

export function saveAssignments(assignments: Assignment[]): void {
  save(STORAGE_KEYS.assignments, assignments)
}

export function addAssignment(assignment: Omit<Assignment, 'id' | 'createdAt'>): Assignment {
  const assignments = getAssignments()
  const newOne: Assignment = {
    ...assignment,
    id: `a-${Date.now()}`,
    createdAt: new Date().toISOString(),
  }
  assignments.push(newOne)
  saveAssignments(assignments)
  return newOne
}

// Submissions
export function getSubmissions(): Submission[] {
  return load(STORAGE_KEYS.submissions, [])
}

export function saveSubmissions(submissions: Submission[]): void {
  save(STORAGE_KEYS.submissions, submissions)
}

export function addSubmission(sub: Omit<Submission, 'id' | 'submittedAt'>): Submission {
  const submissions = getSubmissions()
  const newOne: Submission = {
    ...sub,
    id: `s-${Date.now()}`,
    submittedAt: new Date().toISOString(),
  }
  submissions.push(newOne)
  saveSubmissions(submissions)
  return newOne
}

export function getSubmissionsByAssignment(assignmentId: string): Submission[] {
  return getSubmissions().filter((s) => s.assignmentId === assignmentId)
}

export function getSubmissionByStudentAndAssignment(
  studentId: string,
  assignmentId: string
): Submission | undefined {
  return getSubmissions().find(
    (s) => s.studentId === studentId && s.assignmentId === assignmentId
  )
}

// Corrections
export function getCorrections(): Correction[] {
  return load(STORAGE_KEYS.corrections, [])
}

export function saveCorrections(corrections: Correction[]): void {
  save(STORAGE_KEYS.corrections, corrections)
}

export function getCorrectionBySubmissionId(submissionId: string): Correction | undefined {
  return getCorrections().find((c) => c.submissionId === submissionId)
}

export function saveCorrection(correction: Omit<Correction, 'id' | 'correctedAt'>): Correction {
  const corrections = getCorrections()
  const existing = corrections.findIndex((c) => c.submissionId === correction.submissionId)
  const newOne: Correction = {
    ...correction,
    id: `c-${Date.now()}`,
    correctedAt: new Date().toISOString(),
  }
  if (existing >= 0) {
    corrections[existing] = newOne
  } else {
    corrections.push(newOne)
  }
  saveCorrections(corrections)
  return newOne
}

// Students (for demo - 学生リスト)
export function getStudents(): Student[] {
  const defaultStudents: Student[] = [
    { id: 'stu-1', name: '佐藤さん' },
    { id: 'stu-2', name: 'ヒナさん' },
    { id: 'stu-3', name: '田中さん' },
  ]
  return load(STORAGE_KEYS.students, defaultStudents)
}

export function saveStudents(students: Student[]): void {
  save(STORAGE_KEYS.students, students)
}

// 週ごとの課題を取得
export function getAssignmentsByWeek(): { weekLabel: string; assignments: Assignment[] }[] {
  const assignments = getAssignments()
  const byWeek = new Map<string, Assignment[]>()
  for (const a of assignments) {
    const key = `${a.weekStart}`
    if (!byWeek.has(key)) byWeek.set(key, [])
    byWeek.get(key)!.push(a)
  }
  return Array.from(byWeek.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([weekStart, list]) => {
      const first = list[0]
      const weekLabel = `${formatDate(weekStart)} ～ ${formatDate(first.weekEnd)}`
      return { weekLabel, assignments: list.sort((x, y) => x.title.localeCompare(y.title)) }
    })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// デモ用: 初期データがなければサンプル課題を追加
export function ensureDemoData(): void {
  const assignments = getAssignments()
  if (assignments.length > 0) return

  const now = new Date()
  const getWeek = (offset: number) => {
    const d = new Date(now)
    d.setDate(d.getDate() + offset * 7)
    const start = new Date(d)
    start.setDate(start.getDate() - start.getDay())
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    return {
      weekStart: start.toISOString().slice(0, 10),
      weekEnd: end.toISOString().slice(0, 10),
    }
  }

  addAssignment({
    title: '과제 1',
    content: '지난 주말에 무엇을 했는지 한국어로 써 보세요.',
    ...getWeek(0),
  })
  addAssignment({
    title: '과제 2',
    content: '가장 좋아하는 음식을 소개해 보세요.',
    ...getWeek(-1),
  })
}
