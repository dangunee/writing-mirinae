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
 * LINE via Supabase custom provider — OAuth completes at `/auth/callback` (server code exchange only).
 */
export async function startLineOAuth(nextPath: string = '/writing/app'): Promise<void> {
  if (typeof window === 'undefined') return
  const next = normalizeNextForClient(nextPath)
  const supabase = getSupabaseBrowserClient()
  const origin = window.location.origin
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'custom:line',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  })
  if (error) throw error
  if (data.url) {
    window.location.assign(data.url)
  }
}
