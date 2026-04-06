import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

/**
 * Browser Supabase client — session cookies align with Next `app/api/auth/*` (same origin).
 * Used for PKCE / email-confirmation `code` exchange on `/writing/login` only.
 */
export function getSupabaseBrowserClient() {
  const url = import.meta.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anon = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !anon) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required')
  }
  if (!client) {
    client = createBrowserClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  }
  return client
}
