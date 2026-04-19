import type { writingSessions } from "../../db/schema";

/**
 * After reconciliation; blocks stale client UI from submitting to locked/missed/expired sessions.
 */
export function checkSessionEligibleForWriting(
  session: typeof writingSessions.$inferSelect,
  now: Date
): { ok: true } | { ok: false; code: string } {
  if (session.runtimeStatus === "missed" || session.status === "missed") {
    return { ok: false, code: "session_missed" };
  }
  if (session.runtimeStatus === "corrected" || session.status === "completed") {
    return { ok: false, code: "session_completed" };
  }
  if (session.runtimeStatus === "submitted") {
    return { ok: false, code: "session_already_submitted" };
  }
  if (session.runtimeStatus === "locked" || session.status === "locked") {
    return { ok: false, code: "session_locked" };
  }
  if (session.unlockAt > now) {
    return { ok: false, code: "session_locked" };
  }
  if (session.dueAt && session.dueAt < now) {
    return { ok: false, code: "session_expired" };
  }
  return { ok: true };
}

/**
 * Admin QA sandbox (`writing.admin_sandbox_test_submissions` only).
 * Must not reuse {@link checkSessionEligibleForWriting}: the shared `writing.sessions` row’s
 * `runtimeStatus` / `status` can reflect non–sandbox state and would spuriously block POST/GET.
 */
export function checkSessionEligibleForAdminSandboxTest(
  session: typeof writingSessions.$inferSelect,
  now: Date
): { ok: true } | { ok: false; code: string } {
  if (session.runtimeStatus === "missed" || session.status === "missed") {
    return { ok: false, code: "session_missed" };
  }
  if (session.unlockAt > now) {
    return { ok: false, code: "session_locked" };
  }
  if (session.dueAt && session.dueAt < now) {
    return { ok: false, code: "session_expired" };
  }
  return { ok: true };
}
