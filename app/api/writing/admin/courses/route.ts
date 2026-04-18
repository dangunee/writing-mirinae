import { NextResponse } from "next/server";

import { getDb } from "../../../../../server/db/client";
import { requireAdminSessionUserId } from "../../../../../server/lib/requireAdminSession";
import { listActiveWritingCoursesWithTerm } from "../../../../../server/repositories/writingAdminRepository";
import { listActiveTermsForAssignment } from "../../../../../server/services/writingAdminAssignmentCatalogService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CourseRow = Awaited<ReturnType<typeof listActiveWritingCoursesWithTerm>>[number];

function buildDisplayName(row: CourseRow, trialCourseId: string | undefined): string {
  if (row.isAdminSandbox) {
    return "管理者テスト（sandbox）";
  }
  if (trialCourseId && row.id === trialCourseId) {
    const t = row.termTitle?.trim();
    return t ? `体験コース — ${t}` : "体験コース";
  }
  const t = row.termTitle?.trim();
  const statusLabel = row.status === "pending_setup" ? "準備中" : "active";
  if (t) {
    return `${t} · ${statusLabel}`;
  }
  return `コース ${row.id.slice(0, 8)}… · ${statusLabel}`;
}

/**
 * GET /api/writing/admin/courses — admin-only.
 * - `courses`: 既存（後方互換）
 * - `termTargets`: アクティブな期ごとにコースが無い場合も行を返す（選択時に ensure-for-term 可）
 * - `orphanCourses`: 期に紐づかない / 重複で拾われなかったコース（sandbox 等）
 */
export async function GET() {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  const trialId = process.env.WRITING_TRIAL_COURSE_ID?.trim();
  const db = getDb();
  const [terms, rows] = await Promise.all([
    listActiveTermsForAssignment(db),
    listActiveWritingCoursesWithTerm(db),
  ]);

  const termTargets = terms.map((t) => {
    const row = rows.find((r) => r.termId != null && r.termId === t.termId);
    const label = row
      ? buildDisplayName(row, trialId)
      : `${t.title.trim()} · コース未作成（選択で作成）`;
    return {
      termId: t.termId,
      title: t.title,
      sortOrder: t.sortOrder,
      courseId: row?.id ?? null,
      label,
    };
  });

  const usedCourseIds = new Set(termTargets.map((x) => x.courseId).filter((id): id is string => Boolean(id)));

  const orphanCourses = rows
    .filter((r) => !usedCourseIds.has(r.id))
    .map((r) => ({
      courseId: r.id,
      displayName: buildDisplayName(r, trialId),
      status: r.status,
      isAdminSandbox: r.isAdminSandbox,
      sessionCount: r.sessionCount,
    }));

  const courses = rows.map((r) => ({
    courseId: r.id,
    displayName: buildDisplayName(r, trialId),
    status: r.status,
    isAdminSandbox: r.isAdminSandbox,
    sessionCount: r.sessionCount,
  }));

  return NextResponse.json({ ok: true, courses, termTargets, orphanCourses });
}
