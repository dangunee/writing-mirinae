import { Routes, Route } from 'react-router-dom'
import './App.css'
import Layout from './components/Layout'
import { StudentRouteGuard, TeacherRouteGuard } from './routeGuards'
import WritingPage from './vite-pages/WritingPage'
import CorrectionPage from './vite-pages/CorrectionPage'
import ViewCorrectionPage from './vite-pages/ViewCorrectionPage'
import TestPage from './vite-pages/TestPage'
import MypagePage from './vite-pages/MypagePage'
import TeacherQueuePage from './vite-pages/TeacherQueuePage'
import WritingCompletePage from './vite-pages/WritingCompletePage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/writing/complete" element={<WritingCompletePage />} />
        <Route element={<StudentRouteGuard />}>
          <Route path="/" element={<WritingPage />} />
          <Route path="/mypage" element={<MypagePage />} />
          <Route path="/view/:submissionId" element={<ViewCorrectionPage />} />
        </Route>
        <Route path="/test" element={<TestPage />} />
        <Route element={<TeacherRouteGuard />}>
          <Route path="/teacher/writing" element={<TeacherQueuePage />} />
          <Route path="/correct/:assignmentId" element={<CorrectionPage />} />
        </Route>
      </Routes>
    </Layout>
  )
}

export default App
