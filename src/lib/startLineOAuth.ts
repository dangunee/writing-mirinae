import { getSupabaseBrowserClient } from './supabaseBrowser'

const ALLOWED_NEXT_PREFIXES = ['/writing/app', '/writing/teacher'] as const

function normalizeNextForClient(nextPath: string): string {
  const n = nextPath.trim()
  if (!n.startsWith('/')) return '/writing/app'
  for (const prefix of ALLOWED_NEXT_PREFIXES) {
    if (n === prefix || n.startsWith(`${prefix}/`)) return n
  }
  return '/writing/app'
}

/**
 * LINE OAuth (browser) — must return to this origin’s `/auth/callback` so Next can run
 * `exchangeCodeForSession` and set cookies (not the SPA).
 *
 * Supabase Dashboard → Authentication → URL configuration:
 * - Add exact redirect: `https://<your-production-domain>/auth/callback`
 * - (and `http://localhost:5173/auth/callback` for local if testing with a server that serves this route)
 *
 * `redirectTo` must match an allowed Redirect URL; Site URL alone is not enough.
 * Google uses `/api/auth/callback` (see oauth/google route); LINE intentionally uses `/auth/callback`.
 */
export async function startLineOAuth(nextPath: string = '/writing/app'): Promise<void> {
  if (typeof window === 'undefined') return
  const next = normalizeNextForClient(nextPath)
  const supabase = getSupabaseBrowserClient()
  const origin = window.location.origin
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'custom:line',
    options: {
      redirectTo,
    },
  })
  if (error) throw error
  if (data.url) {
    window.location.assign(data.url)
  }
}
