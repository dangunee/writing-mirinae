import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import WritingLayout from '../components/WritingLayout'
import StudentAccountPanel from '../components/student/StudentAccountPanel'
import StudentCorrectionResultDetail from '../components/student/StudentCorrectionResultDetail'
import { useWritingSubmissionResult } from '../hooks/useWritingSubmissionResult'

function ViewCorrectionShell({ children }: { children: ReactNode }) {
  return (
    <WritingLayout>
      <div className="view-correction-page">
        <div className="view-account-strip max-w-4xl mx-auto w-full px-4 pt-4">
          <StudentAccountPanel compact />
        </div>
        {children}
      </div>
    </WritingLayout>
  )
}

export default function ViewCorrectionPage() {
  const { submissionId } = useParams<{ submissionId: string }>()
  const { loadState, result } = useWritingSubmissionResult(submissionId)

  if (!submissionId) {
    return (
      <ViewCorrectionShell>
        <p>제출 내용을 찾을 수 없습니다.</p>
        <Link to="/writing/app">목록으로</Link>
      </ViewCorrectionShell>
    )
  }

  if (loadState === 'loading' || loadState === 'idle') {
    return (
      <ViewCorrectionShell>
        <p>로딩 중...</p>
        <Link to="/writing/app">목록으로</Link>
      </ViewCorrectionShell>
    )
  }

  if (loadState === 'not_found') {
    return (
      <ViewCorrectionShell>
        <p>제출 내용을 찾을 수 없습니다.</p>
        <Link to="/writing/app">목록으로</Link>
      </ViewCorrectionShell>
    )
  }

  if (loadState === 'not_published') {
    return (
      <ViewCorrectionShell>
        <p>아직 공개되지 않았습니다.</p>
        <Link to="/writing/app">목록으로</Link>
      </ViewCorrectionShell>
    )
  }

  if (loadState !== 'ok' || result == null) {
    return (
      <ViewCorrectionShell>
        <p>제출 내용을 찾을 수 없습니다.</p>
        <Link to="/writing/app">목록으로</Link>
      </ViewCorrectionShell>
    )
  }

  return (
    <ViewCorrectionShell>
      <div className="view-header">
        <Link to="/writing/app" className="back-link">
          ← 목록으로
        </Link>
        <h1>학생이 볼 수 있음 View</h1>
        <p className="student-name">학생님의 첨삭 결과</p>
      </div>

      <StudentCorrectionResultDetail result={result} />
    </ViewCorrectionShell>
  )
}
