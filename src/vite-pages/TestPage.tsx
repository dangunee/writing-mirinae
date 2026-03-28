/**
 * 테스트 페이지 - apps.mirinae.jp/writing UI 검증용
 * 로컬 개발: npm run dev → http://localhost:5173/test
 */
import WritingLayout from '../components/WritingLayout'

export default function TestPage() {
  return (
    <WritingLayout onOpenSubmitModal={() => alert('과제 제출 모달 (테스트)')}>
      <div className="writing-page">
        <h1 className="writing-page-title">테스트 페이지</h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
          writing 앱 UI 검증용. 로컬에서 <code>npm run dev</code> 후 /test 로 접속.
        </p>

        <section className="week-section">
          <h3 className="week-label">1주차 (모의 데이터)</h3>
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
              <tr>
                <td className="assignment-title">성형수술에 대해 어떻게 생각하는지 쓰시오</td>
                <td><span className="status submitted">1건 제출<br /><small>3/15</small></span></td>
                <td><span className="status corrected">완료</span></td>
                <td><span className="status pending">-</span></td>
              </tr>
              <tr>
                <td className="assignment-title">옷과 패션</td>
                <td><span className="status pending">미제출</span></td>
                <td><span className="status pending">-</span></td>
                <td><span className="status pending">-</span></td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </WritingLayout>
  )
}
