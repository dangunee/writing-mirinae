import { eq, sql } from "drizzle-orm";

import { writingCourses, writingSessions } from "../../db/schema";
import type { CourseInterval } from "../types/writing";
import type { Db } from "../db/client";
import {
  assertIsoDateOnly,
  courseIntervalToIntervalLiteral,
  DEFAULT_TZ,
  intervalToMs,
} from "../lib/schedule";
import * as masterRepo from "../repositories/writingMasterRepository";
import * as platformRepo from "../repositories/platformWritingRepository";
import { listSessionsForCourseOrdered } from "../repositories/writingStudentRepository";
import { reconcileCourseSessionsInTx } from "./writingSessionReconciliationService";

export type PopulateCourseFromTermInput = {
  courseId: string;
  termId: string;
  startDateIso: string;
  interval: CourseInterval;
};

/**
 * Creates 10 runtime sessions from assignment master snapshots + schedule.
 * Only for pending_setup courses with session_count = 10. Sets strict_session_progression.
 */
export async function populateCourseSessionsFromTerm(
  db: Db,
  params: PopulateCourseFromTermInput
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const startDate = assertIsoDateOnly(params.startDateIso);
  const intervalLiteral = courseIntervalToIntervalLiteral(params.interval);
  const stepMs = intervalToMs(params.interval);

  const masters = await masterRepo.listAssignmentMastersForTerm(db, params.termId);
  if (masters.length !== 10) {
    return { ok: false, reason: "term_requires_10_assignments" };
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM writing.courses WHERE id = ${params.courseId}::uuid FOR UPDATE`);
    const courseRows = await tx.select().from(writingCourses).where(eq(writingCourses.id, params.courseId)).limit(1);
    const course = courseRows[0];
    if (!course) {
      return { ok: false as const, reason: "course_not_found" };
    }
    if (course.status !== "pending_setup") {
      return { ok: false as const, reason: "course_not_pending_setup" };
    }
    if (course.sessionCount !== 10) {
      return { ok: false as const, reason: "course_must_be_10_sessions" };
    }

    await platformRepo.deleteSessionsForCourse(tx, course.id);
    await platformRepo.bulkInsertWritingSessions(tx, {
      courseId: course.id,
      startDate,
      intervalLiteral,
      timeZone: DEFAULT_TZ,
      sessionCount: 10,
    });

    const sessions = await listSessionsForCourseOrdered(tx, course.id);
    if (sessions.length !== 10) {
      throw new Error("session_count_mismatch_after_insert");
    }

    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      const master = masters.find((m) => m.slotIndex === s.index);
      if (!master) {
        return { ok: false as const, reason: "missing_assignment_master_slot" };
      }
      const nextUnlock = sessions[i + 1]?.unlockAt;
      const dueAt = nextUnlock ?? new Date(s.unlockAt.getTime() + stepMs);

      await tx
        .update(writingSessions)
        .set({
          availableFrom: s.unlockAt,
          dueAt,
          themeSnapshot: master.theme,
          requiredExpressionsSnapshot: master.requiredExpressions,
          modelAnswerSnapshot: master.modelAnswer,
          difficultySnapshot: master.difficulty,
          termId: params.termId,
          assignmentMasterId: master.id,
          runtimeStatus: "locked",
          updatedAt: new Date(),
        })
        .where(eq(writingSessions.id, s.id));
    }

    await tx
      .update(writingCourses)
      .set({
        termId: params.termId,
        strictSessionProgression: true,
        startDate,
        interval: params.interval,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(writingCourses.id, course.id));

    await reconcileCourseSessionsInTx(tx, course.id);

    return { ok: true as const };
  });

  if (!result.ok) {
    return result;
  }
  return { ok: true };
}
