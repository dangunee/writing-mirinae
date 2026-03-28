import { eq } from "drizzle-orm";

import { writingCourses } from "../../db/schema";
import type { CourseInterval } from "../design/payment-to-course-flow";
import type { Db } from "../db/client";
import {
  assertIsoDateOnly,
  courseIntervalToIntervalLiteral,
  DEFAULT_TZ,
} from "../lib/schedule";
import * as repo from "../repositories/platformWritingRepository";

export type ProvisionWritingSessionsInput = {
  courseId: string;
  actorUserId: string;
  startDateIso: string;
  interval: CourseInterval;
};

/**
 * Schedule API: owner-only; fixed 10 sessions; unlock_at computed server-side in Postgres.
 */
export async function provisionWritingSessions(
  db: Db,
  input: ProvisionWritingSessionsInput
): Promise<{ ok: true } | { ok: false; reason: string; httpStatus: number }> {
  const startDate = assertIsoDateOnly(input.startDateIso);
  const intervalLiteral = courseIntervalToIntervalLiteral(input.interval);

  return db.transaction(async (tx) => {
    const course = await repo.getWritingCourseByIdForUser(
      tx,
      input.courseId,
      input.actorUserId
    );
    if (!course) {
      return { ok: false, reason: "not_found", httpStatus: 404 };
    }

    // Authorization is enforced by lookup on (courseId, actorUserId); only the owner row is returned.
    if (course.status === "active") {
      return { ok: false, reason: "already_active", httpStatus: 409 };
    }
    if (course.status !== "pending_setup") {
      return { ok: false, reason: "invalid_status", httpStatus: 409 };
    }

    await repo.deleteSessionsForCourse(tx, course.id);

    await repo.bulkInsertWritingSessions(tx, {
      courseId: course.id,
      startDate,
      intervalLiteral,
      timeZone: DEFAULT_TZ,
    });

    await tx
      .update(writingCourses)
      .set({
        startDate,
        interval: input.interval,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(writingCourses.id, course.id));

    return { ok: true };
  });
}
