import { useState } from 'react'
import { getStudents, getAssignments, addSubmission } from '../store/writingStore'

interface SubmissionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function SubmissionModal({ isOpen, onClose, onSuccess }: SubmissionModalProps) {
  const [selectedStudent, setSelectedStudent] = useState('')
  const [selectedAssignment, setSelectedAssignment] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const students = getStudents()
  const assignments = getAssignments()

  const handleSubmit = () => {
    if (!selectedStudent || !selectedAssignment || !content.trim()) return
    setSaving(true)
    const student = students.find((s) => s.id === selectedStudent)
    if (!student) return
    addSubmission({
      assignmentId: selectedAssignment,
      studentId: selectedStudent,
      studentName: student.name,
      content: content.trim(),
    })
    setSaving(false)
    setContent('')
    setSelectedAssignment('')
    onSuccess()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content submission-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>새로운 스레드</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            취소
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>학생 선택</label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
            >
              <option value="">선택하세요</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>과제 선택</label>
            <select
              value={selectedAssignment}
              onChange={(e) => setSelectedAssignment(e.target.value)}
            >
              <option value="">선택하세요</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>과제 내용</label>
            <textarea
              placeholder="새로운 소식이 있나요?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="submission-textarea"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="submit-button"
            onClick={handleSubmit}
            disabled={saving || !content.trim() || !selectedStudent || !selectedAssignment}
          >
            게시
          </button>
        </div>
      </div>
    </div>
  )
}
