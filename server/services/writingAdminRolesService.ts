import { inArray, sql } from "drizzle-orm";

import { writingUserRoles } from "../../db/schema";
import type { AuthRole } from "../lib/authMe";
import type { Db } from "../db/client";
import {
  resolveWritingRoleFromDbOrEnv,
  resolveWritingRoleFromDbRowAndEnv,
} from "../lib/writingAuthRoles";

const LIST_LIMIT = 500;

export type AdminRoleUserRow = {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: AuthRole;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * auth.users + profile name + effective writing role (writing.user_roles row, else ADMIN_USER_IDS / TEACHER_USER_IDS).
 */
export async function listUsersWithWritingRoles(db: Db): Promise<AdminRoleUserRow[]> {
  const rowList = await db.execute<{
    user_id: string;
    email: string | null;
    display_name: string | null;
  }>(sql`
    SELECT
      u.id::text AS user_id,
      u.email::text AS email,
      p.name::text AS display_name
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    ORDER BY u.created_at DESC
    LIMIT ${LIST_LIMIT}
  `);

  const raw = Array.from(
    rowList as unknown as {
      user_id: string;
      email: string | null;
      display_name: string | null;
    }[]
  );

  if (raw.length === 0) return [];

  const ids = raw.map((r) => r.user_id);
  const roleRows = await db
    .select({ userId: writingUserRoles.userId, role: writingUserRoles.role })
    .from(writingUserRoles)
    .where(inArray(writingUserRoles.userId, ids));

  const roleByUser = new Map(roleRows.map((r) => [r.userId, r.role]));

  return raw.map((r) => ({
    userId: r.user_id,
    email: r.email,
    displayName: r.display_name,
    role: resolveWritingRoleFromDbRowAndEnv(r.user_id, roleByUser.get(r.user_id)),
  }));
}

export type SetTeacherRoleResult =
  | { ok: true }
  | { ok: false; code: "invalid_target" | "cannot_change_admin" | "not_found" };

/**
 * Upsert writing.user_roles to teacher or student only. Rejects if effective role is admin (DB or env).
 */
export async function setTeacherRoleForUser(
  db: Db,
  targetUserId: string,
  makeTeacher: boolean
): Promise<SetTeacherRoleResult> {
  const trimmed = targetUserId.trim();
  if (!UUID_RE.test(trimmed)) {
    return { ok: false, code: "invalid_target" };
  }

  const found = await db.execute<{ id: string }>(sql`
    SELECT u.id::text AS id FROM auth.users u WHERE u.id = ${trimmed}::uuid LIMIT 1
  `);
  const foundRows = Array.from(found as unknown as { id: string }[]);
  if (foundRows.length === 0) {
    return { ok: false, code: "not_found" };
  }

  const current = await resolveWritingRoleFromDbOrEnv(db, trimmed);
  if (current === "admin") {
    return { ok: false, code: "cannot_change_admin" };
  }

  const now = new Date();
  const nextRole = makeTeacher ? ("teacher" as const) : ("student" as const);

  await db
    .insert(writingUserRoles)
    .values({
      userId: trimmed,
      role: nextRole,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: writingUserRoles.userId,
      set: {
        role: nextRole,
        updatedAt: now,
      },
    });

  return { ok: true };
}
