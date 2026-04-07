import { eq } from "drizzle-orm";
import { PostgresError } from "postgres";

import { products } from "../../db/schema";
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

  const existing = await studentRepo.findAdminSandboxCourseForUser(db, userId);
  if (existing) {
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

    const interval: CourseInterval = "interval_1d";
    const startDateIso = calendarIsoInTokyo();
    const provision = await provisionWritingSessions(db, {
      courseId: course.id,
      actorUserId: userId,
      startDateIso,
      interval,
    });
    if (!provision.ok) {
      console.error("admin_sandbox_provision_failed", { userId, reason: provision.reason });
    }
  } catch (e) {
    if (e instanceof PostgresError && e.code === "23505") {
      return;
    }
    throw e;
  }
}
