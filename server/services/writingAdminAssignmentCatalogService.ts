import { and, asc, eq, inArray } from "drizzle-orm";

import { products, writingCourses, writingTerms } from "../../db/schema";
import type { Db } from "../db/client";
import { isPostgresUniqueViolation } from "../lib/postgresErrorGuards";
import { getTermById } from "../repositories/writingMasterRepository";
import * as repo from "../repositories/platformWritingRepository";

const CATALOG_SKU = "writing_assignment_catalog_v1";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function listActiveTermsForAssignment(db: Db) {
  return db
    .select({
      termId: writingTerms.id,
      title: writingTerms.title,
      sortOrder: writingTerms.sortOrder,
    })
    .from(writingTerms)
    .where(eq(writingTerms.isActive, true))
    .orderBy(asc(writingTerms.sortOrder), asc(writingTerms.createdAt));
}

export type EnsureCourseForTermResult =
  | { ok: true; courseId: string; created: boolean }
  | { ok: false; code: "invalid_term" | "term_inactive" | "product_missing" | "provision_failed" };

/**
 * Idempotent: if any course already exists for this term (active/pending_setup), return it.
 * Otherwise create entitlement + writing.courses row for assignment authoring (pending_setup).
 */
export async function ensureCourseForAssignmentTerm(
  db: Db,
  ownerUserId: string,
  termIdRaw: string
): Promise<EnsureCourseForTermResult> {
  const termId = termIdRaw.trim();
  if (!UUID_RE.test(termId)) {
    return { ok: false, code: "invalid_term" };
  }

  const term = await getTermById(db, termId);
  if (!term) {
    return { ok: false, code: "invalid_term" };
  }
  if (!term.isActive) {
    return { ok: false, code: "term_inactive" };
  }

  const existing = await db
    .select({ id: writingCourses.id })
    .from(writingCourses)
    .where(
      and(
        eq(writingCourses.termId, term.id),
        inArray(writingCourses.status, ["active", "pending_setup"])
      )
    )
    .limit(1);
  if (existing[0]) {
    return { ok: true, courseId: existing[0].id, created: false };
  }

  const [product] = await db.select().from(products).where(eq(products.sku, CATALOG_SKU)).limit(1);
  if (!product) {
    return { ok: false, code: "product_missing" };
  }

  try {
    const order = await repo.insertPaymentOrder(db, {
      userId: ownerUserId,
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
      userId: ownerUserId,
      productId: product.id,
      paymentOrderId: order.id,
      app: "writing",
      status: "active",
      validFrom: new Date(),
      validUntil: null,
      metadata: { kind: "assignment_catalog", termId: term.id },
    });

    const course = await repo.insertWritingCourse(db, {
      userId: ownerUserId,
      entitlementId: entitlement.id,
      status: "pending_setup",
      startDate: null,
      interval: null,
      sessionCount: 10,
      isAdminSandbox: false,
      termId: term.id,
      strictSessionProgression: false,
    });

    if (!course) {
      return { ok: false, code: "provision_failed" };
    }
    return { ok: true, courseId: course.id, created: true };
  } catch (e) {
    if (isPostgresUniqueViolation(e)) {
      const retry = await db
        .select({ id: writingCourses.id })
        .from(writingCourses)
        .where(
          and(
            eq(writingCourses.termId, term.id),
            inArray(writingCourses.status, ["active", "pending_setup"])
          )
        )
        .limit(1);
      if (retry[0]) {
        return { ok: true, courseId: retry[0].id, created: false };
      }
    }
    console.error("ensure_course_for_term_failed", e);
    return { ok: false, code: "provision_failed" };
  }
}
