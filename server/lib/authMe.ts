/**
 * Server-only auth snapshot for GET /api/auth/me.
 * Identity = auth.users (Supabase session). No client-supplied user id.
 * Entitlements evaluated from DB (entitlements/products/writing.courses), not hardcoded roles.
 */

import { and, eq } from "drizzle-orm";

import { academyUnlimitedGrants, entitlements, products } from "../../db/schema";
import type { Db } from "../db/client";
import { findActiveWritingCourseForUser } from "../repositories/writingStudentRepository";

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

async function hasAcademyUnlimitedGrant(db: Db, userId: string): Promise<boolean> {
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

/**
 * Derives entitlements from active writing entitlements + active course (if any).
 */
export async function computeEntitlementsForUser(db: Db, userId: string): Promise<AuthEntitlements> {
  if (isAcademyUnlimitedUser(userId)) {
    return {
      hasTrial: true,
      hasActiveCourse: true,
      isAcademyUnlimited: true,
    };
  }

  if (await hasAcademyUnlimitedGrant(db, userId)) {
    return {
      hasTrial: true,
      hasActiveCourse: true,
      isAcademyUnlimited: true,
    };
  }

  let hasTrial = false;
  let hasActiveCourse = false;

  const activeSkuRows = await db
    .select({ sku: products.sku })
    .from(entitlements)
    .innerJoin(products, eq(entitlements.productId, products.id))
    .where(
      and(eq(entitlements.userId, userId), eq(entitlements.app, "writing"), eq(entitlements.status, "active"))
    )
    .limit(100);

  for (const r of activeSkuRows) {
    if (skuImpliesTrial(r.sku)) {
      hasTrial = true;
    } else {
      hasActiveCourse = true;
    }
  }

  const course = await findActiveWritingCourseForUser(db, userId);
  if (course) {
    const rows = await db
      .select({ sku: products.sku })
      .from(entitlements)
      .innerJoin(products, eq(entitlements.productId, products.id))
      .where(eq(entitlements.id, course.entitlementId))
      .limit(1);
    const sku = rows[0]?.sku ?? "";
    if (skuImpliesTrial(sku)) {
      hasTrial = true;
    } else {
      hasActiveCourse = true;
    }
  }

  return {
    hasTrial,
    hasActiveCourse,
    isAcademyUnlimited: false,
  };
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
