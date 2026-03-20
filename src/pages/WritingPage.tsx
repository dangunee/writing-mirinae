import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import WritingLayout from '../components/WritingLayout'
import SubmissionModal from '../components/SubmissionModal'
import {
  getAssignmentsByWeek,
  getSubmissionsByAssignment,
  getCorrectionBySubmissionId,
  ensureDemoData,
} from '../store/writingStore'
import type { Assignment } from '../types/writing'

export default function WritingPage() {
  const [weeks, setWeeks] = useState<{ weekLabel: string; assignments: Assignment[] }[]>([])
  const [submitModalOpen, setSubmitModalOpen] = useState(false)

  useEffect(() => {
    ensureDemoData()
    setWeeks(getAssignmentsByWeek())
  }, [submitModalOpen])

  const handleSubmitSuccess = () => {
    setSubmitModalOpen(false)
    setWeeks(getAssignmentsByWeek())
  }

  return (
    <WritingLayout onOpenSubmitModal={() => setSubmitModalOpen(true)}>
      <div className="writing-page">
        <h1 className="writing-page-title">게시글 리스트</h1>

        <div className="assignment-weeks">
          {weeks.map(({ weekLabel, assignments }) => (
            <section key={weekLabel} className="week-section">
              <h3 className="week-label">{weekLabel}</h3>
              <table className="assignment-table">
                <thead>
                  <tr>
                    <th>과제</th>
                    <th>과제 제출</th>
                    <th>첨삭</th>
                    <th>학생 보기</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <AssignmentRow key={a.id} assignment={a} />
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>

        {weeks.length === 0 && (
          <p className="no-assignments">아직 과제가 없습니다.</p>
        )}
      </div>

      <SubmissionModal
        isOpen={submitModalOpen}
        onClose={() => setSubmitModalOpen(false)}
        onSuccess={handleSubmitSuccess}
      />
    </WritingLayout>
  )
}

function AssignmentRow({ assignment }: { assignment: Assignment }) {
  const submissions = getSubmissionsByAssignment(assignment.id)
  const hasSubmission = submissions.length > 0
  const corrected = submissions.filter((s) => getCorrectionBySubmissionId(s.id))
  const allCorrected = hasSubmission && corrected.length === submissions.length

  return (
    <tr>
      <td className="assignment-title">{assignment.title}</td>
      <td>
        {hasSubmission ? (
          <span className="status submitted">
            {submissions.length}건 제출
            <br />
            <small>{formatDate(submissions[0].submittedAt)}</small>
          </span>
        ) : (
          <span className="status pending">미제출</span>
        )}
      </td>
      <td>
        {allCorrected ? (
          <Link to={`/correct/${assignment.id}`} className="status corrected">
            완료
            <br />
            <small>클릭</small>
          </Link>
        ) : hasSubmission ? (
          <Link to={`/correct/${assignment.id}`} className="status partial">
            {corrected.length}/{submissions.length}
            <br />
            <small>클릭</small>
          </Link>
        ) : (
          <span className="status pending">-</span>
        )}
      </td>
      <td>
        {corrected.length > 0 ? (
          <div className="view-links">
            {corrected.map((s) => (
              <Link key={s.id} to={`/view/${s.id}`} className="view-link">
                {s.studentName} View
              </Link>
            ))}
          </div>
        ) : (
          <span className="status pending">-</span>
        )}
      </td>
    </tr>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
