import { useParams, Link } from 'react-router-dom'
import WritingLayout from '../components/WritingLayout'
import { getSubmissions, getCorrectionBySubmissionId } from '../store/writingStore'

export default function ViewCorrectionPage() {
  const { submissionId } = useParams<{ submissionId: string }>()
  const submission = getSubmissions().find((s) => s.id === submissionId)
  const correction = submission ? getCorrectionBySubmissionId(submission.id) : null

  if (!submission) {
    return (
      <WritingLayout>
        <div className="view-correction-page">
          <p>제출 내용을 찾을 수 없습니다.</p>
          <Link to="/">목록으로</Link>
        </div>
      </WritingLayout>
    )
  }

  return (
    <WritingLayout>
    <div className="view-correction-page">
      <div className="view-header">
        <Link to="/" className="back-link">← 목록으로</Link>
        <h1>학생이 볼 수 있음 View</h1>
        <p className="student-name">{submission.studentName}님의 첨삭 결과</p>
      </div>

      <div className="correction-view">
        <div className="view-section">
          <h3>내가 제출한 글</h3>
          <div className="original-content">{submission.content}</div>
        </div>

        <div className="view-section">
          <h3>강사님 첨삭</h3>
          {correction ? (
            <div className="corrected-content">
              {correction.correctedContent}
            </div>
          ) : (
            <p className="pending">아직 첨삭이 완료되지 않았습니다.</p>
          )}
        </div>
      </div>
    </div>
    </WritingLayout>
  )
}
