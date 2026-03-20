// 作文トレーニング - データ型定義

export interface Assignment {
  id: string
  title: string
  content: string
  weekStart: string // YYYY-MM-DD
  weekEnd: string
  createdAt: string
}

export interface Student {
  id: string
  name: string
}

export interface Submission {
  id: string
  assignmentId: string
  studentId: string
  studentName: string
  content: string
  submittedAt: string
}

// インライン修正（例: マ시ダ → マシェッタ）
export interface CorrectionSegment {
  from: string
  to: string
}

export interface Correction {
  id: string
  submissionId: string
  assignmentId: string
  studentId: string
  originalContent: string
  correctedContent: string
  correctionSegments: CorrectionSegment[] // 修正箇所の詳細（学生ビュー用）
  correctedAt: string
}

export type UserRole = 'student' | 'instructor'
