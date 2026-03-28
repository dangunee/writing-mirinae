import { and, eq, sql } from "drizzle-orm";

import {
  entitlements,
  paymentOrders,
  products,
  stripeWebhookEvents,
  writingCourses,
  writingSessions,
} from "../../db/schema";
import type { Db } from "../db/client";

export async function findActiveProductBySku(db: Db, sku: string) {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.sku, sku), eq(products.active, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertPaymentOrder(
  db: Db,
  row: typeof paymentOrders.$inferInsert
) {
  const [created] = await db.insert(paymentOrders).values(row).returning();
  return created;
}

export async function updatePaymentOrderById(
  db: Db,
  id: string,
  patch: Partial<typeof paymentOrders.$inferInsert>
) {
  const [updated] = await db
    .update(paymentOrders)
    .set(patch)
    .where(eq(paymentOrders.id, id))
    .returning();
  return updated ?? null;
}

/** Idempotency: returns true if this Stripe event was already recorded. */
export async function hasStripeWebhookEvent(db: Db, stripeEventId: string) {
  const rows = await db
    .select({ id: stripeWebhookEvents.id })
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.stripeEventId, stripeEventId))
    .limit(1);
  return rows.length > 0;
}

export async function insertStripeWebhookEvent(
  db: Db,
  row: typeof stripeWebhookEvents.$inferInsert
) {
  const inserted = await db
    .insert(stripeWebhookEvents)
    .values(row)
    .onConflictDoNothing({ target: stripeWebhookEvents.stripeEventId })
    .returning({ id: stripeWebhookEvents.id });
  return inserted.length > 0;
}

export async function lockPaymentOrderById(db: Db, paymentOrderId: string) {
  const rows = await db
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.id, paymentOrderId))
    .for("update")
    .limit(1);
  return rows[0] ?? null;
}

export async function insertEntitlement(
  db: Db,
  row: typeof entitlements.$inferInsert
) {
  const [created] = await db.insert(entitlements).values(row).returning();
  return created;
}

export async function insertWritingCourse(
  db: Db,
  row: typeof writingCourses.$inferInsert
) {
  const [created] = await db.insert(writingCourses).values(row).returning();
  return created;
}

export async function getWritingCourseByIdForUser(
  db: Db,
  courseId: string,
  userId: string
) {
  const rows = await db
    .select()
    .from(writingCourses)
    .where(and(eq(writingCourses.id, courseId), eq(writingCourses.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteSessionsForCourse(db: Db, courseId: string) {
  await db.delete(writingSessions).where(eq(writingSessions.courseId, courseId));
}

/**
 * unlock_at = start-of-day(calendar date in TZ) + (index-1) * step interval (computed in Postgres).
 * intervalLiteral is allowlisted (e.g. "1 day") — never from raw client input.
 */
export async function bulkInsertWritingSessions(
  db: Db,
  params: {
    courseId: string;
    startDate: string;
    intervalLiteral: string;
    timeZone: string;
  }
) {
  const { courseId, startDate, intervalLiteral, timeZone } = params;
  const intervalSql = sql.raw(`'${intervalLiteral}'::interval`);
  const dateSql = sql.raw(`'${startDate}'::date`);
  await db.execute(sql`
    INSERT INTO writing.sessions (id, course_id, "index", unlock_at, status, created_at, updated_at)
    SELECT
      gen_random_uuid(),
      ${courseId}::uuid,
      g.i::smallint,
      ((${dateSql} + time '00:00:00') AT TIME ZONE ${timeZone}) + ((g.i - 1) * ${intervalSql}),
      'locked',
      now(),
      now()
    FROM generate_series(1, 10) AS g(i)
  `);
}
