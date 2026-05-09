/**
 * Server-only auth snapshot for GET /api/auth/me.
 * Identity = auth.users (Supabase session). No client-supplied user id.
 * Entitlements evaluated from DB (entitlements/products/writing.courses), not hardcoded roles.
 */

import { and, eq } from "drizzle-orm";

import { academyUnlimitedGrants, entitlements, products } from "../../db/schema";
import type { Db } from "../db/client";
import { findActiveWritingCourseForUser } from "../repositories/writingStudentRepository";
import { resolveLinkedTrialApplicationForWritingSession } from "../services/trialLinkedUserWritingSession";

export type AuthRole = "student" | "teacher" | "admin";

export type AuthEntitlements = {
  hasTrial: boolean;
  hasActiveCourse: boolean;
  isAcademyUnlimited: boolean;
};

export type AuthMeUser = {
  id: string;
  email: string | null;
};

export type AuthMePayload = {
  user: AuthMeUser | null;
  role: AuthRole | null;
  entitlements: AuthEntitlements;
};

function parseUuidList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function resolveRoleFromEnv(userId: string): AuthRole {
  if (parseUuidList(process.env.ADMIN_USER_IDS).includes(userId)) {
    return "admin";
  }
  if (parseUuidList(process.env.TEACHER_USER_IDS).includes(userId)) {
    return "teacher";
  }
  return "student";
}

function isAcademyUnlimitedUser(userId: string): boolean {
  return parseUuidList(process.env.ACADEMY_UNLIMITED_USER_IDS).includes(userId);
}

/** DB table: writing.academy_unlimited_grants (Drizzle: academyUnlimitedGrants). */
async function tryHasAcademyUnlimitedGrant(db: Db, userId: string): Promise<boolean> {
  const rows = await db
    .select({ userId: academyUnlimitedGrants.userId })
    .from(academyUnlimitedGrants)
    .where(eq(academyUnlimitedGrants.userId, userId))
    .limit(1);
  return rows.length > 0;
}

function skuImpliesTrial(sku: string): boolean {
  const s = sku.toLowerCase();
  return s.includes("trial") || s === "writing_trial_lesson";
}

/** Internal admin sandbox product — must not grant student app access via entitlements. */
function skuImpliesAdminSandbox(sku: string): boolean {
  return sku === "writing_admin_sandbox_v1";
}

function logOutcome(userId: string, e: AuthEntitlements): void {
  console.info("entitlement_trial_result", { userId, hasTrial: e.hasTrial });
  console.info("entitlement_paid_result", { userId, hasActiveCourse: e.hasActiveCourse });
  console.info("final_entitlements", { userId, ...e });
}

/**
 * Derives entitlements from active writing entitlements + active course (if any).
 * Fault-tolerant: academy / entitlements / course lookups are independent; one failure does not zero the rest.
 */
export async function computeEntitlementsForUser(db: Db, userId: string): Promise<AuthEntitlements> {
  let hasTrial = false;
  let hasActiveCourse = false;
  let isAcademyUnlimited = false;

  if (isAcademyUnlimitedUser(userId)) {
    isAcademyUnlimited = true;
    hasTrial = true;
    hasActiveCourse = true;
    console.info("entitlement_academy_result", { userId, source: "env_allowlist", ok: true });
    logOutcome(userId, { hasTrial, hasActiveCourse, isAcademyUnlimited });
    return { hasTrial, hasActiveCourse, isAcademyUnlimited };
  }

  try {
    const grant = await tryHasAcademyUnlimitedGrant(db, userId);
    if (grant) {
      isAcademyUnlimited = true;
      hasTrial = true;
      hasActiveCourse = true;
      console.info("entitlement_academy_result", {
        userId,
        table: "writing.academy_unlimited_grants",
        ok: true,
        matched: true,
      });
      logOutcome(userId, { hasTrial, hasActiveCourse, isAcademyUnlimited });
      return { hasTrial, hasActiveCourse, isAcademyUnlimited };
    }
    console.info("entitlement_academy_result", {
      userId,
      table: "writing.academy_unlimited_grants",
      ok: true,
      matched: false,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("entitlement_academy_result", {
      userId,
      table: "writing.academy_unlimited_grants",
      ok: false,
      error: msg,
    });
  }

  try {
    const activeSkuRows = await db
      .select({ sku: products.sku })
      .from(entitlements)
      .innerJoin(products, eq(entitlements.productId, products.id))
      .where(
        and(eq(entitlements.userId, userId), eq(entitlements.app, "writing"), eq(entitlements.status, "active"))
      )
      .limit(100);

    for (const r of activeSkuRows) {
      if (skuImpliesAdminSandbox(r.sku)) {
        continue;
      }
      if (skuImpliesTrial(r.sku)) {
        hasTrial = true;
      } else {
        hasActiveCourse = true;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("entitlement_sku_query_failed", { userId, error: msg });
  }

  try {
    const course = await findActiveWritingCourseForUser(db, userId);
    if (course) {
      const rows = await db
        .select({ sku: products.sku })
        .from(entitlements)
        .innerJoin(products, eq(entitlements.productId, products.id))
        .where(eq(entitlements.id, course.entitlementId))
        .limit(1);
      const sku = rows[0]?.sku ?? "";
      if (skuImpliesAdminSandbox(sku)) {
        /* sandbox course excluded from student routing */
      } else if (skuImpliesTrial(sku)) {
        hasTrial = true;
      } else {
        hasActiveCourse = true;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("entitlement_course_query_failed", { userId, error: msg });
  }

  try {
    const linkedTrial = await resolveLinkedTrialApplicationForWritingSession(db, userId);
    if (linkedTrial) {
      hasTrial = true;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("entitlement_linked_trial_failed", { userId, error: msg });
  }

  const out = { hasTrial, hasActiveCourse, isAcademyUnlimited };
  logOutcome(userId, out);
  return out;
}

export function canAccessWritingStudentApp(e: AuthEntitlements): boolean {
  return e.hasTrial || e.hasActiveCourse || e.isAcademyUnlimited;
}

/**
 * Gate for POST /api/writing/sessions/:id/submission when identity is Supabase `userId`.
 * Trial / regular-mail flows do not use this (they use cookie-derived ids only).
 */
export async function requireWritingSubmissionEntitlement(
  db: Db,
  userId: string
): Promise<{ ok: true } | { ok: false }> {
  const ent = await computeEntitlementsForUser(db, userId);
  if (canAccessWritingStudentApp(ent)) {
    return { ok: true };
  }
  return { ok: false };
}
