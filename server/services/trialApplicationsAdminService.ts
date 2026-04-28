import { and, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import {
  trialApplicationAdminAudit,
  trialApplications,
  trialReminderLogs,
  writingSubmissions,
} from "../../db/schema";
import type { Db } from "../db/client";

/** Must match cron / mirinae-api reminder_type for 24h-before-deadline emails. */
export const TRIAL_REMINDER_TYPE_24H = "submission_deadline_24h";

/**
 * Block resend-access when trial window has ended (access_expires_at in the past).
 * Null expiry: do not block on date alone (legacy / unset).
 */
export async function assertTrialResendAllowed(
  db: Db,
  applicationId: string
): Promise<{ ok: true } | { ok: false; code: "not_found" | "expired_access" }> {
  const id = applicationId.trim();
  if (!id) return { ok: false, code: "not_found" };

  const [row] = await db
    .select({ accessExpiresAt: trialApplications.accessExpiresAt })
    .from(trialApplications)
    .where(eq(trialApplications.id, id))
    .limit(1);

  if (!row) return { ok: false, code: "not_found" };

  const exp = row.accessExpiresAt;
  if (exp != null && exp.getTime() < Date.now()) {
    return { ok: false, code: "expired_access" };
  }

  return { ok: true };
}

export type TrialAdminListItem = {
  id: string;
  applicantName: string;
  applicantEmail: string;
  koreanLevel: string | null;
  createdAt: string;
  paymentMethod?: string;
  paymentStatus: string;
  accessStatus: string;
  accessExpiresAt?: string | null;
  lastExtendedAt?: string | null;
  extendCount?: number;
  submissionStatus: "not_submitted" | "submitted" | "correcting" | "completed";
  submittedAt?: string | null;
  submissionId?: string | null;
  reminderBefore24hSent?: boolean;
  reminderBefore24hSentAt?: string | null;
  reminderBefore24hStatus?: "not_sent" | "sent" | "failed";
  trashedAt?: string | null;
  trashedBy?: string | null;
  trashReason?: string | null;
};

export type TrialAdminListPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

function iso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString();
}

function deriveSubmissionStatus(
  sub: Pick<typeof writingSubmissions.$inferSelect, "status" | "submittedAt"> | null
): TrialAdminListItem["submissionStatus"] {
  if (!sub || !sub.submittedAt) return "not_submitted";
  switch (sub.status) {
    case "published":
      return "completed";
    case "in_review":
    case "corrected":
      return "correcting";
    case "submitted":
      return "submitted";
    default:
      return "submitted";
  }
}

function reminderFromLog(
  log: (typeof trialReminderLogs.$inferSelect) | undefined
): Pick<TrialAdminListItem, "reminderBefore24hSent" | "reminderBefore24hSentAt" | "reminderBefore24hStatus"> {
  if (!log) {
    return {
      reminderBefore24hSent: false,
      reminderBefore24hSentAt: null,
      reminderBefore24hStatus: "not_sent",
    };
  }
  const st = log.status;
  if (st === "sent") {
    return {
      reminderBefore24hSent: true,
      reminderBefore24hSentAt: iso(log.sentAt),
      reminderBefore24hStatus: "sent",
    };
  }
  if (st === "failed") {
    return {
      reminderBefore24hSent: false,
      reminderBefore24hSentAt: null,
      reminderBefore24hStatus: "failed",
    };
  }
  return {
    reminderBefore24hSent: false,
    reminderBefore24hSentAt: null,
    reminderBefore24hStatus: "not_sent",
  };
}

function parseTrashMode(searchParams: URLSearchParams): boolean {
  if (searchParams.get("trash") === "1") return true;
  const st = searchParams.get("status")?.trim().toLowerCase() ?? "";
  return st === "trash";
}

export async function listTrialApplicationsForAdmin(
  db: Db,
  reqUrl: string
): Promise<{ ok: true; items: TrialAdminListItem[]; pagination: TrialAdminListPagination; sort: string } | null> {
  let u: URL;
  try {
    u = new URL(reqUrl);
  } catch {
    return null;
  }
  const sp = u.searchParams;
  const showTrash = parseTrashMode(sp);

  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") ?? "10", 10) || 10));
  const sort = (sp.get("sort") ?? "created_desc").trim();
  const queryRaw = (sp.get("query") ?? "").trim();
  const paymentMethod = (sp.get("paymentMethod") ?? "all").trim().toLowerCase();

  const conditions = [showTrash ? isNotNull(trialApplications.trashedAt) : isNull(trialApplications.trashedAt)];

  if (paymentMethod === "card") {
    conditions.push(eq(trialApplications.paymentMethod, "card"));
  } else if (paymentMethod === "bank_transfer") {
    conditions.push(
      or(
        eq(trialApplications.paymentMethod, "bank_transfer"),
        eq(trialApplications.paymentMethod, "bank")
      )!
    );
  }

  if (queryRaw.length > 0) {
    const pattern = `%${queryRaw}%`;
    conditions.push(
      or(ilike(trialApplications.applicantEmail, pattern), ilike(trialApplications.applicantName, pattern))!
    );
  }

  const whereClause = and(...conditions);

  const [countRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(trialApplications)
    .where(whereClause);
  const totalItems = countRow?.n ?? 0;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
  const offset = (page - 1) * pageSize;

  const trialRows = await db
    .select()
    .from(trialApplications)
    .where(whereClause)
    .orderBy(
      ...(sort === "expires_asc"
        ? [sql`${trialApplications.accessExpiresAt} ASC NULLS LAST`, desc(trialApplications.createdAt)]
        : sort === "extended_desc"
          ? [sql`${trialApplications.lastExtendedAt} DESC NULLS LAST`, desc(trialApplications.createdAt)]
          : [desc(trialApplications.createdAt)])
    )
    .limit(pageSize)
    .offset(offset);

  const trialIds = trialRows.map((r) => r.id);
  if (trialIds.length === 0) {
    return {
      ok: true,
      items: [],
      pagination: { page, pageSize, totalItems, totalPages },
      sort,
    };
  }

  /** Omit optional columns some prod DBs lack (e.g. grammar_check_result). */
  const allSubs = await db
    .select({
      id: writingSubmissions.id,
      trialApplicationId: writingSubmissions.trialApplicationId,
      status: writingSubmissions.status,
      submittedAt: writingSubmissions.submittedAt,
      createdAt: writingSubmissions.createdAt,
    })
    .from(writingSubmissions)
    .where(inArray(writingSubmissions.trialApplicationId, trialIds));

  type SubRow = (typeof allSubs)[number];
  const subByTrial = new Map<string, SubRow[]>();
  for (const s of allSubs) {
    const tid = s.trialApplicationId;
    if (!tid) continue;
    const arr = subByTrial.get(tid) ?? [];
    arr.push(s);
    subByTrial.set(tid, arr);
  }

  function pickLatestSubmission(trialId: string): SubRow | null {
    const arr = subByTrial.get(trialId);
    if (!arr?.length) return null;
    return arr.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b));
  }

  const reminders = await db
    .select()
    .from(trialReminderLogs)
    .where(
      and(
        inArray(trialReminderLogs.applicationId, trialIds),
        eq(trialReminderLogs.reminderType, TRIAL_REMINDER_TYPE_24H)
      )
    );
  const reminderByApp = new Map(reminders.map((r) => [r.applicationId, r]));

  const items: TrialAdminListItem[] = trialRows.map((ta) => {
    const sub = pickLatestSubmission(ta.id);
    const rem = reminderFromLog(reminderByApp.get(ta.id));
    return {
      id: ta.id,
      applicantName: ta.applicantName,
      applicantEmail: ta.applicantEmail,
      koreanLevel: ta.koreanLevel ?? null,
      createdAt: ta.createdAt.toISOString(),
      paymentMethod: ta.paymentMethod,
      paymentStatus: ta.paymentStatus,
      accessStatus: ta.accessStatus,
      accessExpiresAt: iso(ta.accessExpiresAt),
      lastExtendedAt: iso(ta.lastExtendedAt),
      extendCount: ta.extendCount,
      submissionStatus: deriveSubmissionStatus(sub),
      submittedAt: iso(sub?.submittedAt ?? null),
      submissionId: sub?.id ?? null,
      ...rem,
      trashedAt: iso(ta.trashedAt),
      trashedBy: ta.trashedBy ?? null,
      trashReason: ta.trashReason ?? null,
    };
  });

  return {
    ok: true,
    items,
    pagination: { page, pageSize, totalItems, totalPages },
    sort,
  };
}

async function insertTrialAdminAudit(
  db: Db,
  args: {
    applicationId: string;
    action: "trash" | "restore" | "permanent_delete";
    actorUserId: string;
    trashReason: string | null;
  }
) {
  await db.insert(trialApplicationAdminAudit).values({
    applicationId: args.applicationId,
    action: args.action,
    actorUserId: args.actorUserId,
    trashReason: args.trashReason,
  });
}

export type TrialTrashMutationResult =
  | { ok: true }
  | { ok: false; code: string; status: number };

export async function trashTrialApplication(
  db: Db,
  applicationId: string,
  actorUserId: string,
  trashReason: string | null
): Promise<TrialTrashMutationResult> {
  const id = applicationId.trim();
  if (!id) return { ok: false, code: "invalid_request", status: 400 };

  const [row] = await db.select().from(trialApplications).where(eq(trialApplications.id, id)).limit(1);
  if (!row) return { ok: false, code: "not_found", status: 404 };
  if (row.trashedAt != null) return { ok: false, code: "already_trashed", status: 409 };

  const now = new Date();
  await db
    .update(trialApplications)
    .set({
      trashedAt: now,
      trashedBy: actorUserId,
      trashReason: trashReason?.trim() ? trashReason.trim() : null,
      updatedAt: now,
    })
    .where(and(eq(trialApplications.id, id), isNull(trialApplications.trashedAt)));

  await insertTrialAdminAudit(db, {
    applicationId: id,
    action: "trash",
    actorUserId,
    trashReason: trashReason?.trim() ? trashReason.trim() : null,
  });

  return { ok: true };
}

export async function restoreTrialApplication(
  db: Db,
  applicationId: string,
  actorUserId: string
): Promise<TrialTrashMutationResult> {
  const id = applicationId.trim();
  if (!id) return { ok: false, code: "invalid_request", status: 400 };

  const [row] = await db.select().from(trialApplications).where(eq(trialApplications.id, id)).limit(1);
  if (!row) return { ok: false, code: "not_found", status: 404 };
  if (row.trashedAt == null) return { ok: false, code: "not_trashed", status: 409 };

  const now = new Date();
  await db
    .update(trialApplications)
    .set({
      trashedAt: null,
      trashedBy: null,
      trashReason: null,
      updatedAt: now,
    })
    .where(and(eq(trialApplications.id, id), isNotNull(trialApplications.trashedAt)));

  await insertTrialAdminAudit(db, {
    applicationId: id,
    action: "restore",
    actorUserId,
    trashReason: null,
  });

  return { ok: true };
}

export async function permanentlyDeleteTrashedTrialApplication(
  db: Db,
  applicationId: string,
  actorUserId: string
): Promise<TrialTrashMutationResult> {
  const id = applicationId.trim();
  if (!id) return { ok: false, code: "invalid_request", status: 400 };

  const [row] = await db.select().from(trialApplications).where(eq(trialApplications.id, id)).limit(1);
  if (!row) return { ok: false, code: "not_found", status: 404 };
  if (row.trashedAt == null) return { ok: false, code: "not_trashed", status: 409 };

  await insertTrialAdminAudit(db, {
    applicationId: id,
    action: "permanent_delete",
    actorUserId,
    trashReason: null,
  });

  await db.delete(trialApplications).where(eq(trialApplications.id, id));

  return { ok: true };
}
