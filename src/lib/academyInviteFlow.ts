import { apiUrl } from './apiUrl'

/** Same-origin only; cleared after successful accept (or left for retry on failure). */
export const PENDING_ACADEMY_INVITE_TOKEN_KEY = 'pending_academy_invite_token'

export function stashPendingAcademyInviteTokenFromQuery(token: string | null): void {
  if (typeof sessionStorage === 'undefined') return
  if (!token) {
    sessionStorage.removeItem(PENDING_ACADEMY_INVITE_TOKEN_KEY)
    return
  }
  sessionStorage.setItem(PENDING_ACADEMY_INVITE_TOKEN_KEY, token)
}

export function readPendingAcademyInviteToken(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage.getItem(PENDING_ACADEMY_INVITE_TOKEN_KEY)
}

export function clearPendingAcademyInviteToken(): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(PENDING_ACADEMY_INVITE_TOKEN_KEY)
}

/**
 * After email/password or OAuth session exists: server validates token again; token cleared only on success.
 */
export async function tryAcceptPendingInviteAfterAuth(): Promise<void> {
  const token = readPendingAcademyInviteToken()
  if (!token) return
  try {
    const res = await fetch(apiUrl('/api/academy-invites/accept'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    })
    if (res.ok) {
      clearPendingAcademyInviteToken()
    }
  } catch {
    /* keep token for retry */
  }
}
