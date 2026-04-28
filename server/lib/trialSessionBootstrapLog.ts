/**
 * Safe diagnostics for trial session bootstrap (no cookies, tokens, or PII).
 * Verbose: set WRITING_TRIAL_BOOTSTRAP_LOG=1 or =true on the server.
 */
const verboseEnabled = (): boolean => {
  const v = process.env.WRITING_TRIAL_BOOTSTRAP_LOG?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
};

export function trialBootstrapVerbose(event: string, fields: Record<string, unknown>): void {
  if (!verboseEnabled()) return;
  console.log(`[trial_bootstrap] ${event}`, fields);
}

/** One-line warning when trial UX is blocked (always on; no secrets). */
export function trialBootstrapBlocked(reason: string, fields: Record<string, unknown>): void {
  console.warn(`[trial_bootstrap] blocked:${reason}`, fields);
}
