import { and, desc, eq, isNull } from "drizzle-orm";

import {
  trialApplications,
  writingCorrections,
  writingSubmissions,
} from "../../db/schema";
import type { Db } from "../db/client";

const COMMENT_PREVIEW_MAX = 240;

export type TrialHistoryMypageItem = {
  trialApplicationId: string;
  appliedAt: string;
  paymentMethod: string;
  currentStatus: "pending" | "ready" | "submitted" | "completed" | "expired";
  submittedAt: string | null;
  submissionId: string | null;
  resultId: string | null;
  accessExpiredAt: string | null;
  linkedToAccount: true;
  teacherCommentPreview: string | null;
};

export type TrialHistoryMypageResponse = {
  items: TrialHistoryMypageItem[];
};

function iso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString();
}

function deriveMypageStatus(args: {
  paymentStatus: string;
  accessStatus: string;
  accessExpiresAt: Date | null;
  submissionStatus: string | null;
  submittedAt: Date | null;
}): TrialHistoryMypageItem["currentStatus"] {
  const now = Date.now();
  if (args.accessStatus === "expired") return "expired";
  if (args.accessExpiresAt && args.accessExpiresAt.getTime() < now) return "expired";
  if (args.submissionStatus === "published") return "completed";
  if (args.submittedAt) return "submitted";
  if (args.paymentStatus === "pending" || args.paymentStatus === "failed") return "pending";
  if (args.accessStatus === "ready" || args.accessStatus === "used") return "ready";
  return "pending";
}

function previewComment(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();
  if (s.length <= COMMENT_PREVIEW_MAX) return s;
  return `${s.slice(0, COMMENT_PREVIEW_MAX)}…`;
}

export async function getLinkedTrialHistoryForMypage(
  db: Db,
  userId: string
): Promise<TrialHistoryMypageResponse> {
  const rows = await db
    .select({
      ta: trialApplications,
      submissionId: writingSubmissions.id,
      submissionStatus: writingSubmissions.status,
      submittedAt: writingSubmissions.submittedAt,
      correctionId: writingCorrections.id,
      teacherComment: writingCorrections.teacherComment,
    })
    .from(trialApplications)
    .leftJoin(writingSubmissions, eq(writingSubmissions.trialApplicationId, trialApplications.id))
    .leftJoin(
      writingCorrections,
      and(
        eq(writingCorrections.submissionId, writingSubmissions.id),
        eq(writingCorrections.status, "published")
      )
    )
    .where(and(eq(trialApplications.userId, userId), isNull(trialApplications.trashedAt)))
    .orderBy(desc(trialApplications.createdAt));

  const items: TrialHistoryMypageItem[] = rows.map((r) => {
    const subStatus = r.submissionStatus ?? null;
    const submittedAt = r.submittedAt ?? null;
    const currentStatus = deriveMypageStatus({
      paymentStatus: r.ta.paymentStatus,
      accessStatus: r.ta.accessStatus,
      accessExpiresAt: r.ta.accessExpiresAt,
      submissionStatus: subStatus,
      submittedAt,
    });

    const submissionId = r.submissionId ?? null;
    const correctionId = r.correctionId ?? null;
    const resultId = subStatus === "published" && correctionId ? correctionId : null;

    return {
      trialApplicationId: r.ta.id,
      appliedAt: r.ta.createdAt.toISOString(),
      paymentMethod: r.ta.paymentMethod,
      currentStatus,
      submittedAt: iso(submittedAt),
      submissionId,
      resultId,
      accessExpiredAt: iso(r.ta.accessExpiresAt),
      linkedToAccount: true,
      teacherCommentPreview: previewComment(r.teacherComment),
    };
  });

  return { items };
}
