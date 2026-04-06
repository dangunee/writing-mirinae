import type { NavigateFunction } from 'react-router-dom'

import type { AuthMePayload } from '../types/authMe'

import { tryAcceptPendingInviteAfterAuth } from './academyInviteFlow'
import { apiUrl } from './apiUrl'
import { postLoginRedirect } from './postLoginRedirect'
import { readJsonBody } from './readJsonBody'

/**
 * After Supabase session exists (password login or exchangeCodeForSession):
 * academy invite (if any) → GET /api/auth/me (server truth) → role/entitlement redirect.
 * Never trusts client user id.
 */
export async function completeSessionLoginFlow(navigate: NavigateFunction): Promise<{ ok: true } | { ok: false }> {
  await tryAcceptPendingInviteAfterAuth()
  const meRes = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
  if (meRes.status === 401 || !meRes.ok) {
    return { ok: false }
  }
  const me = await readJsonBody<AuthMePayload>(meRes)
  if (!me?.ok || !me.user || !me.entitlements) {
    return { ok: false }
  }
  postLoginRedirect(navigate, me)
  return { ok: true }
}
