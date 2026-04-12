import { Link } from 'react-router-dom'

/**
 * Minimal admin hub — links only (Stitch トーンは各リンク先に任せる).
 */
export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-[#f5f7fa] px-4 py-8 font-['Be_Vietnam_Pro',sans-serif] text-[#2c2f32]">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-bold uppercase tracking-widest text-[#595c5e]">Admin</p>
        <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-[#2c2f32]">관리 콘솔</h1>
        <p className="mt-2 text-sm text-[#595c5e]">運用メニュー</p>
        <ul className="mt-6 list-inside list-disc space-y-3 text-sm">
          <li>
            <Link to="/writing/admin/roles" className="font-semibold text-[#4052b6] underline">
              権限管理
            </Link>
          </li>
          <li>
            <Link to="/writing/admin/trial-applications" className="font-semibold text-[#4052b6] underline">
              体験申込管理
            </Link>
          </li>
          <li>
            <Link to="/writing/teacher" className="font-semibold text-[#4052b6] underline">
              添削キュー（講師）
            </Link>
          </li>
          <li>
            <Link to="/writing/app" className="font-semibold text-[#4052b6] underline">
              作文アプリ（管理者テスト）
            </Link>
          </li>
          <li>
            <Link to="/writing/admin/assignments" className="font-semibold text-[#4052b6] underline">
              課題管理（一覧）
            </Link>
          </li>
          <li>
            <Link
              to="/writing/admin/assignments/new"
              className="font-semibold text-[#4052b6] underline"
            >
              課題登録（新規）
            </Link>
          </li>
        </ul>
        <p className="mt-8">
          <Link to="/writing" className="text-sm text-[#595c5e] underline">
            サイトへ戻る
          </Link>
        </p>
      </div>
    </div>
  )
}
