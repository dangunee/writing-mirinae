import { Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import Layout from './components/Layout'
import { StudentRouteGuard, TeacherRouteGuard } from './routeGuards'
import LandingPage from './vite-pages/LandingPage'
import WritingPage from './vite-pages/WritingPage'
import CorrectionPage from './vite-pages/CorrectionPage'
import ViewCorrectionPage from './vite-pages/ViewCorrectionPage'
import TestPage from './vite-pages/TestPage'
import MypagePage from './vite-pages/MypagePage'
import TeacherQueuePage from './vite-pages/TeacherQueuePage'
import WritingCompletePage from './vite-pages/WritingCompletePage'
import CorrectionSystemDetailPage from './vite-pages/CorrectionSystemDetailPage'
import TrialCheckoutPage from './vite-pages/TrialCheckoutPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/writing/trial-checkout" element={<TrialCheckoutPage />} />
        <Route path="/writing/correction-detail" element={<CorrectionSystemDetailPage />} />
        <Route path="/writing/app/complete" element={<WritingCompletePage />} />
        <Route element={<StudentRouteGuard />}>
          <Route path="/writing/app/mypage" element={<MypagePage />} />
          <Route path="/writing/app/view/:submissionId" element={<ViewCorrectionPage />} />
          <Route path="/writing/app" element={<WritingPage />} />
        </Route>
        <Route path="/writing" element={<LandingPage />} />
        <Route path="/test" element={<TestPage />} />
        <Route element={<TeacherRouteGuard />}>
          <Route path="/writing/teacher/correct/:submissionId" element={<CorrectionPage />} />
          <Route path="/writing/teacher" element={<TeacherQueuePage />} />
        </Route>
        <Route path="/" element={<Navigate to="/writing" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
