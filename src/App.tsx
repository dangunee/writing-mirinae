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
import CoursePage from './vite-pages/CoursePage'
import TrialLandingPage from './vite-pages/TrialLandingPage'
import PaymentPage from './vite-pages/PaymentPage'
import TrialPaymentCheckoutPage from './vite-pages/TrialPaymentCheckoutPage'
import BankTransferCompletePage from './vite-pages/BankTransferCompletePage'
import TrialStartPage from './vite-pages/TrialStartPage'
import TrialAccessPage from './vite-pages/TrialAccessPage'
import TrialReissuePage from './vite-pages/TrialReissuePage'
import RegularAccessPage from './vite-pages/RegularAccessPage'
import TrialApplicationsAdminPage from './vite-pages/TrialApplicationsAdminPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/writing/intro" element={<TrialLandingPage />} />
        <Route path="/writing/trial-payment/checkout" element={<TrialPaymentCheckoutPage />} />
        <Route path="/writing/bank-complete" element={<BankTransferCompletePage />} />
        <Route path="/writing/trial/start" element={<TrialStartPage />} />
        <Route path="/writing/trial/access" element={<TrialAccessPage />} />
        <Route path="/writing/trial/reissue" element={<TrialReissuePage />} />
        <Route path="/writing/regular/access" element={<RegularAccessPage />} />
        <Route path="/writing/trial/submit" element={<Navigate to="/writing/app" replace />} />
        <Route path="/writing/trial-payment" element={<PaymentPage />} />
        <Route path="/writing/course" element={<CoursePage />} />
        <Route path="/writing/correction-detail" element={<CorrectionSystemDetailPage />} />
        <Route path="/writing/app/complete" element={<WritingCompletePage />} />
        <Route path="/writing/admin/trial-applications" element={<TrialApplicationsAdminPage />} />
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
