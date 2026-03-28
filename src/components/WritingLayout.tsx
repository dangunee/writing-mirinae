interface WritingLayoutProps {
  children: React.ReactNode
  onOpenSubmitModal?: () => void
}

export default function WritingLayout({ children, onOpenSubmitModal }: WritingLayoutProps) {
  return (
    <div className="writing-layout">
      <aside className="writing-sidebar">
        <h2 className="sidebar-title">제출</h2>
        <button
          type="button"
          className="submit-btn"
          onClick={onOpenSubmitModal}
        >
          과제 제출하기
        </button>
      </aside>
      <main className="writing-main">{children}</main>
    </div>
  )
}
