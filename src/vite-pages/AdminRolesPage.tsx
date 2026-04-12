import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiUrl } from '../lib/apiUrl'

type AuthRole = 'student' | 'teacher' | 'admin'

type RoleUser = {
  userId: string
  email: string | null
  displayName: string | null
  role: AuthRole
}

function roleLabel(role: AuthRole): string {
  if (role === 'admin') return '管理者'
  if (role === 'teacher') return '講師'
  return '受講生'
}

export default function AdminRolesPage() {
  const [users, setUsers] = useState<RoleUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(apiUrl('/api/writing/admin/roles/users'), { credentials: 'include' })
      const data = (await res.json()) as { ok?: boolean; users?: RoleUser[]; error?: string }
      if (!res.ok || !data.ok || !Array.isArray(data.users)) {
        setError(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`)
        setUsers([])
        return
      }
      setUsers(data.users)
    } catch {
      setError('load_failed')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function setTeacher(userId: string, makeTeacher: boolean) {
    setMessage(null)
    setBusyId(userId)
    try {
      const res = await fetch(apiUrl('/api/writing/admin/roles/set-teacher'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, makeTeacher }),
      })
      const data = (await res.json()) as { ok?: boolean; code?: string }
      if (!res.ok || !data.ok) {
        setMessage(data.code ?? `HTTP ${res.status}`)
        return
      }
      await load()
    } catch {
      setMessage('request_failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa] px-4 py-8 font-['Be_Vietnam_Pro',sans-serif] text-[#2c2f32]">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-widest text-[#595c5e]">Admin</p>
        <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-[#2c2f32]">権限管理</h1>
        <p className="mt-2 text-sm text-[#595c5e]">
          管理者アカウントは表示のみ（変更不可）。講師・受講生の切り替えのみ操作できます。
        </p>

        {loading ? (
          <p className="mt-6 text-sm text-[#595c5e]" role="status">
            読み込み中…
          </p>
        ) : null}
        {error ? (
          <p className="mt-6 text-sm text-[#ba1a1a]" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-4 text-sm text-[#ba1a1a]" role="alert">
            {message}
          </p>
        ) : null}

        {!loading && !error ? (
          <div className="mt-8 overflow-x-auto rounded border border-[#c5c8cc] bg-white">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#c5c8cc] bg-[#f5f7fa] text-left">
                  <th className="px-3 py-2 font-semibold text-[#2c2f32]">メール</th>
                  <th className="px-3 py-2 font-semibold text-[#2c2f32]">表示名</th>
                  <th className="px-3 py-2 font-semibold text-[#2c2f32]">権限</th>
                  <th className="px-3 py-2 font-semibold text-[#2c2f32]">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isAdmin = u.role === 'admin'
                  const isTeacher = u.role === 'teacher'
                  return (
                    <tr key={u.userId} className="border-b border-[#c5c8cc]/80">
                      <td className="px-3 py-2 text-[#2c2f32]">{u.email ?? '—'}</td>
                      <td className="px-3 py-2 text-[#2c2f32]">{u.displayName?.trim() || '—'}</td>
                      <td className="px-3 py-2 text-[#2c2f32]">{roleLabel(u.role)}</td>
                      <td className="px-3 py-2">
                        {isAdmin ? (
                          <span className="text-xs font-semibold text-[#595c5e]">変更不可</span>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === u.userId}
                            onClick={() => void setTeacher(u.userId, !isTeacher)}
                            className="rounded bg-[#4052b6] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {busyId === u.userId ? '処理中…' : isTeacher ? '受講生に戻す' : '講師に設定'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        <p className="mt-8">
          <Link to="/writing/admin" className="text-sm text-[#595c5e] underline">
            管理コンソールへ戻る
          </Link>
        </p>
      </div>
    </div>
  )
}
