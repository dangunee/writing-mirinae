interface WritingLayoutProps {
  children: React.ReactNode
  onOpenSubmitModal?: () => void
}

export default function WritingLayout({ children, onOpenSubmitModal }: WritingLayoutProps) {
  return (
    <div className={`writing-layout ${onOpenSubmitModal ? '' : 'writing-layout--no-sidebar'}`}>
      {onOpenSubmitModal ? (
        <aside className="writing-sidebar">
          <h2 className="sidebar-title">제출</h2>
          <button type="button" className="submit-btn" onClick={onOpenSubmitModal}>
            과제 제출하기
          </button>
        </aside>
      ) : null}
      <main className="writing-main">{children}</main>
    </div>
  )
}
