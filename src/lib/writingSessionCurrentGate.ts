/**
 * Mirrors EntitlementRouteGuard session gate (GET /api/writing/sessions/current).
 * Used after login so learners with trial shell / active session reach /writing/app without trusting client ids.
 */
export function writingSessionCurrentAllowsStudentApp(payload: unknown): boolean {
  if (payload == null || typeof payload !== 'object') return false
  const o = payload as Record<string, unknown>
  const bodyOk = o.ok === true
  const trialShellOk =
    o.accessKind === 'trial' &&
    typeof o.applicationId === 'string' &&
    o.applicationId.length > 0
  return bodyOk || trialShellOk
}
