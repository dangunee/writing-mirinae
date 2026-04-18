import { and, asc, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";

import { writingCourses, writingSessions, writingTerms } from "../../db/schema";
import type { Db } from "../db/client";

/**
 * Admin assignment / 対象コース dropdown: courses that can receive session assignment edits.
 * Includes active and pending_setup (student courses often stay pending until schedule is finalized).
 * If linked to a term, the term must be is_active (inactive terms are excluded).
 */
export async function listActiveWritingCoursesWithTerm(db: Db) {
  return db
    .select({
      id: writingCourses.id,
      termId: writingCourses.termId,
      status: writingCourses.status,
      sessionCount: writingCourses.sessionCount,
      isAdminSandbox: writingCourses.isAdminSandbox,
      termTitle: writingTerms.title,
    })
    .from(writingCourses)
    .leftJoin(writingTerms, eq(writingCourses.termId, writingTerms.id))
    .where(
      and(
        inArray(writingCourses.status, ["active", "pending_setup"]),
        or(isNull(writingCourses.termId), eq(writingTerms.isActive, true))
      )
    )
    .orderBy(desc(writingCourses.createdAt));
}

/** Sessions 1–10 for admin assignment list (theme_snapshot for read-only UI). */
export async function listWritingSessionsForAdminAssignmentList(db: Db, courseId: string) {
  return db
    .select({
      id: writingSessions.id,
      index: writingSessions.index,
      themeSnapshot: writingSessions.themeSnapshot,
    })
    .from(writingSessions)
    .where(
      and(eq(writingSessions.courseId, courseId), gte(writingSessions.index, 1), lte(writingSessions.index, 10))
    )
    .orderBy(asc(writingSessions.index));
}
