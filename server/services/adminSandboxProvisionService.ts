import { and, eq } from "drizzle-orm";
import { PostgresError } from "postgres";

import { products, writingCourses } from "../../db/schema";
import type { Db } from "../db/client";
import { resolveWritingRoleFromDbOrEnv } from "../lib/writingAuthRoles";
import { assertIsoDateOnly, DEFAULT_TZ } from "../lib/schedule";
import type { CourseInterval } from "../types/writing";
import * as repo from "../repositories/platformWritingRepository";
import * as studentRepo from "../repositories/writingStudentRepository";
import { provisionWritingSessions } from "./writingSchedule";

const ADMIN_SANDBOX_SKU = "writing_admin_sandbox_v1";

function calendarIsoInTokyo(): string {
  const s = new Date().toLocaleDateString("en-CA", { timeZone: DEFAULT_TZ });
  return assertIsoDateOnly(s);
}

/**
 * Ensures writing.sessions rows exist for the admin sandbox course. Idempotent.
 * - pending_setup + 0 sessions: provisionWritingSessions
 * - active + 0 sessions (bad data): temporarily pending_setup, then provision (provision rejects "active")
 * Unique-index race (23505): insert skipped; this repair path still runs on next call via findAnyStatus.
 */
async function ensureAdminSandboxSessionsExist(
  db: Db,
  userId: string,
  course: typeof writingCourses.$inferSelect
): Promise<void> {
  const sessions = await studentRepo.listSessionsForCourseOrdered(db, course.id);
  if (sessions.length > 0) {
    return;
  }

  if (course.status === "active") {
    await db
      .update(writingCourses)
      .set({ status: "pending_setup", updatedAt: new Date() })
      .where(and(eq(writingCourses.id, course.id), eq(writingCourses.userId, userId)));
  }

  const interval: CourseInterval = "interval_1d";
  const startDateIso = calendarIsoInTokyo();
  const provision = await provisionWritingSessions(db, {
    courseId: course.id,
    actorUserId: userId,
    startDateIso,
    interval,
  });
  if (!provision.ok) {
    console.error("admin_sandbox_provision_failed", {
      userId,
      courseId: course.id,
      reason: provision.reason,
      httpStatus: provision.httpStatus,
    });
  }
}

/**
 * Idempotent: creates one active admin sandbox course + single session for UX testing.
 * Only for admin role (DB or env); never for real students.
 */
export async function ensureAdminSandboxCourse(db: Db, userId: string): Promise<void> {
  const role = await resolveWritingRoleFromDbOrEnv(db, userId);
  if (role !== "admin") {
    return;
  }

  const real = await studentRepo.findActiveWritingCourseForUser(db, userId);
  if (real) {
    return;
  }

  const stuck = await studentRepo.findAdminSandboxCourseForUserAnyStatus(db, userId);
  if (stuck) {
    await ensureAdminSandboxSessionsExist(db, userId, stuck);
    return;
  }

  const [product] = await db.select().from(products).where(eq(products.sku, ADMIN_SANDBOX_SKU)).limit(1);
  if (!product) {
    console.error("admin_sandbox_product_missing", { sku: ADMIN_SANDBOX_SKU });
    return;
  }

  try {
    const order = await repo.insertPaymentOrder(db, {
      userId,
      productId: product.id,
      status: "succeeded",
      currency: product.currency,
      unitPriceJpy: product.unitPriceJpy,
      quantity: product.quantity,
      subtotalJpy: product.subtotalJpy,
      taxRate: product.taxRate,
      totalJpy: product.totalJpy,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      stripeEventId: null,
      paidAt: new Date(),
    });

    const entitlement = await repo.insertEntitlement(db, {
      userId,
      productId: product.id,
      paymentOrderId: order.id,
      app: "writing",
      status: "active",
      validFrom: new Date(),
      validUntil: null,
      metadata: { kind: "admin_sandbox" },
    });

    const course = await repo.insertWritingCourse(db, {
      userId,
      entitlementId: entitlement.id,
      status: "pending_setup",
      startDate: null,
      interval: null,
      sessionCount: 1,
      isAdminSandbox: true,
    });

    await ensureAdminSandboxSessionsExist(db, userId, course);
  } catch (e) {
    if (e instanceof PostgresError && e.code === "23505") {
      const row = await studentRepo.findAdminSandboxCourseForUserAnyStatus(db, userId);
      if (row) {
        await ensureAdminSandboxSessionsExist(db, userId, row);
      }
      return;
    }
    throw e;
  }
}
