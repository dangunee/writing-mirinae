/**
 * EntitlementRouteGuard fetches GET /api/writing/sessions/current before WritingPage mounts.
 * One-shot bootstrap lets WritingPage reuse the same JSON and skip a duplicate network round-trip.
 * Does not change API contracts — only avoids redundant identical GET on first paint.
 */

type Bootstrap = { savedAt: number; payload: unknown }

let bootstrap: Bootstrap | null = null

const MAX_AGE_MS = 12_000

export function setWritingSessionCurrentBootstrap(payload: unknown): void {
  bootstrap = { savedAt: Date.now(), payload }
}

/** Returns cached JSON once if fresh; clears slot so subsequent loads (submit, sandbox change) always refetch. */
export function takeWritingSessionCurrentBootstrap(): unknown | null {
  if (!bootstrap) return null
  const age = Date.now() - bootstrap.savedAt
  const payload = bootstrap.payload
  bootstrap = null
  if (age > MAX_AGE_MS) return null
  return payload
}

export function clearWritingSessionCurrentBootstrap(): void {
  bootstrap = null
}
