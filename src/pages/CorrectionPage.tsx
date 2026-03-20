import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import WritingLayout from '../components/WritingLayout'
import {
  getAssignments,
  getSubmissionsByAssignment,
  getCorrectionBySubmissionId,
  saveCorrection,
} from '../store/writingStore'
import type { Submission } from '../types/writing'

export default function CorrectionPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [correctedContent, setCorrectedContent] = useState('')
  const [saved, setSaved] = useState(false)

  const assignment = getAssignments().find((a) => a.id === assignmentId)

  useEffect(() => {
    if (!assignmentId) return
    const subs = getSubmissionsByAssignment(assignmentId)
    setSubmissions(subs)
    if (subs.length > 0 && !selectedSubmission) {
      setSelectedSubmission(subs[0])
    }
  }, [assignmentId])

  useEffect(() => {
    if (selectedSubmission) {
      const existing = getCorrectionBySubmissionId(selectedSubmission.id)
      setCorrectedContent(existing?.correctedContent ?? selectedSubmission.content)
    }
  }, [selectedSubmission])

  const handleSave = () => {
    if (!selectedSubmission || !assignmentId) return
    saveCorrection({
      submissionId: selectedSubmission.id,
      assignmentId,
      studentId: selectedSubmission.studentId,
      originalContent: selectedSubmission.content,
      correctedContent,
      correctionSegments: [], // 簡易版: 後でdiffから生成可能
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!assignment) {
    return (
      <WritingLayout>
        <div className="correction-page">
          <p>과제를 찾을 수 없습니다.</p>
          <Link to="/">목록으로</Link>
        </div>
      </WritingLayout>
    )
  }

  return (
    <WritingLayout>
    <div className="correction-page">
      <div className="correction-header">
        <Link to="/" className="back-link">← 목록으로</Link>
        <h1>첨삭: {assignment.title}</h1>
      </div>

      <div className="correction-layout">
        <aside className="student-list">
          <h3>학생 목록</h3>
          {submissions.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`student-item ${selectedSubmission?.id === s.id ? 'active' : ''}`}
              onClick={() => setSelectedSubmission(s)}
            >
              {s.studentName}
              {getCorrectionBySubmissionId(s.id) && (
                <span className="badge">완료</span>
              )}
            </button>
          ))}
        </aside>

        <div className="correction-editor-area">
          {selectedSubmission ? (
            <>
              <p className="instructor-label">↑ 강사 편집</p>
              <div className="editor-section">
                <label>원문 (학생 제출)</label>
                <div className="original-text">{selectedSubmission.content}</div>
              </div>
              <div className="editor-section">
                <label>수정 후</label>
                <textarea
                  value={correctedContent}
                  onChange={(e) => setCorrectedContent(e.target.value)}
                  className="correction-textarea"
                  rows={12}
                  placeholder="수정된 내용을 입력하세요"
                />
              </div>
              <div className="editor-actions">
                <button type="button" className="save-btn" onClick={handleSave}>
                  {saved ? '저장됨 ✓' : '저장'}
                </button>
                {getCorrectionBySubmissionId(selectedSubmission.id) && (
                  <Link
                    to={`/view/${selectedSubmission.id}`}
                    className="view-student-link"
                  >
                    학생 보기 →
                  </Link>
                )}
              </div>
            </>
          ) : (
            <p className="no-submissions">제출된 과제가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
    </WritingLayout>
  )
}
