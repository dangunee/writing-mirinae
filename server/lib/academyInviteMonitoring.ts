/**
 * Academy invite — structured server logs only (stdout). No raw tokens; token_hash_prefix is first 8 hex chars of SHA-256.
 * In-memory counters are best-effort (e.g. warm serverless instance); not a rate limiter.
 */

const validateFailByHash = new Map<string, number>();
const acceptFailByInviteId = new Map<string, number>();

const THRESHOLD_VALIDATE_REPEATED = 3;
const THRESHOLD_ACCEPT_REPEATED = 2;

function ts(): string {
  return new Date().toISOString();
}

function tokenHashPrefix(tokenHash: string): string {
  return tokenHash.slice(0, 8);
}

/** invite_validate_failed + repeated-validate warning (same token hash). */
export function recordInviteValidateFailed(params: {
  reason: "invalid" | "expired" | "used";
  tokenHash: string;
  inviteId?: string;
  /** e.g. revoked (still API reason invalid) */
  detail?: string;
}): void {
  const { reason, tokenHash, inviteId, detail } = params;
  const n = (validateFailByHash.get(tokenHash) ?? 0) + 1;
  validateFailByHash.set(tokenHash, n);

  console.info("invite_validate_failed", {
    event: "invite_validate_failed",
    ts: ts(),
    reason,
    invite_id: inviteId,
    token_hash_prefix: tokenHashPrefix(tokenHash),
    ...(detail ? { detail } : {}),
  });

  if (n >= THRESHOLD_VALIDATE_REPEATED) {
    console.warn("academy_invite_validate_repeated_failures", {
      event: "invite_validate_repeated_failures",
      ts: ts(),
      count: n,
      reason,
      invite_id: inviteId,
      token_hash_prefix: tokenHashPrefix(tokenHash),
    });
  }
}

export function logInviteCreated(params: { adminUserId: string; inviteId: string; hasInvitedEmail: boolean }): void {
  console.info("invite_created", {
    event: "invite_created",
    ts: ts(),
    user_id: params.adminUserId,
    invite_id: params.inviteId,
    has_invited_email: params.hasInvitedEmail,
  });
}

export type InviteAcceptFailReason =
  | "invalid"
  | "expired"
  | "used"
  | "mismatch"
  | "race"
  | "no_email"
  | "missing_token"
  | "server_error";

export function logInviteAcceptSuccess(params: { userId: string; inviteId: string }): void {
  console.info("invite_accept_success", {
    event: "invite_accept_success",
    ts: ts(),
    user_id: params.userId,
    invite_id: params.inviteId,
  });
}

export function logInviteAcceptFailed(params: {
  userId: string;
  inviteId?: string;
  reason: InviteAcceptFailReason;
}): void {
  console.info("invite_accept_failed", {
    event: "invite_accept_failed",
    ts: ts(),
    user_id: params.userId,
    invite_id: params.inviteId,
    reason: params.reason,
  });

  if (params.inviteId) {
    const id = params.inviteId;
    const n = (acceptFailByInviteId.get(id) ?? 0) + 1;
    acceptFailByInviteId.set(id, n);
    if (n >= THRESHOLD_ACCEPT_REPEATED) {
      console.warn("academy_invite_accept_repeated_failures", {
        event: "invite_accept_repeated_failures",
        ts: ts(),
        invite_id: id,
        count: n,
        reason: params.reason,
      });
    }
  }
}
