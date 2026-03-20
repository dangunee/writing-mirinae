import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// iframe 안에서 열렸을 때 부모 페이지에 현재 높이를 알려주는 함수
function setupIframeHeightMessaging() {
  if (window === window.parent) return

  const sendHeight = () => {
    const height = document.documentElement.scrollHeight
    window.parent.postMessage(
      {
        type: 'mirinae-writing-height',
        height,
      },
      '*',
    )
  }

  // 처음 로드 및 리사이즈 시
  window.addEventListener('load', sendHeight)
  window.addEventListener('resize', sendHeight)

  // 내용 변경 시(학생의 목소리 더 보기 등) 높이 갱신
  const observer = new MutationObserver(() => {
    // 여러 변화가 한 번에 일어날 수 있으니 약간 지연 후 한 번만 전송
    window.setTimeout(sendHeight, 50)
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
  })

  // 초기에 한 번 보내기
  sendHeight()
}

setupIframeHeightMessaging()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
