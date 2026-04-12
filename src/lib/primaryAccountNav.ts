import type { AuthRole } from '../types/authMe'

export type PrimaryAccountNav = { label: string; to: string }

/**
 * Top landing header primary link for logged-in users — driven by GET /api/auth/me `role` only.
 */
export function primaryAccountNav(role: AuthRole | null | undefined): PrimaryAccountNav {
  if (role === 'admin') return { label: '管理コンソール', to: '/writing/admin' }
  if (role === 'teacher') return { label: '添削キュー', to: '/writing/teacher' }
  return { label: 'マイページ', to: '/writing/app/mypage' }
}
