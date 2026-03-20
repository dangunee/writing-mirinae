import { Routes, Route } from 'react-router-dom'
import './App.css'
import Layout from './components/Layout'
import WritingPage from './pages/WritingPage'
import CorrectionPage from './pages/CorrectionPage'
import ViewCorrectionPage from './pages/ViewCorrectionPage'
import TestPage from './pages/TestPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<WritingPage />} />
        <Route path="/test" element={<TestPage />} />
        <Route path="/correct/:assignmentId" element={<CorrectionPage />} />
        <Route path="/view/:submissionId" element={<ViewCorrectionPage />} />
      </Routes>
    </Layout>
  )
}

export default App
