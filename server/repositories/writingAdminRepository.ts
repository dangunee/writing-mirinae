import { and, asc, desc, eq, gte, lte } from "drizzle-orm";

import { writingCourses, writingSessions, writingTerms } from "../../db/schema";
import type { Db } from "../db/client";

/** Active writing courses for admin assignment dropdown (term title when linked). */
export async function listActiveWritingCoursesWithTerm(db: Db) {
  return db
    .select({
      id: writingCourses.id,
      status: writingCourses.status,
      sessionCount: writingCourses.sessionCount,
      isAdminSandbox: writingCourses.isAdminSandbox,
      termTitle: writingTerms.title,
    })
    .from(writingCourses)
    .leftJoin(writingTerms, eq(writingCourses.termId, writingTerms.id))
    .where(eq(writingCourses.status, "active"))
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
