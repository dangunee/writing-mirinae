import { and, asc, eq } from "drizzle-orm";

import { writingAssignmentMasters, writingTerms } from "../../db/schema";
import type { Db } from "../db/client";

export async function listTermsOrdered(db: Db) {
  return db.select().from(writingTerms).orderBy(asc(writingTerms.sortOrder), asc(writingTerms.createdAt));
}

export async function getTermById(db: Db, termId: string) {
  const rows = await db.select().from(writingTerms).where(eq(writingTerms.id, termId)).limit(1);
  return rows[0] ?? null;
}

export async function insertTerm(
  db: Db,
  row: typeof writingTerms.$inferInsert
): Promise<typeof writingTerms.$inferSelect> {
  const [created] = await db.insert(writingTerms).values(row).returning();
  return created;
}

export async function updateTerm(
  db: Db,
  termId: string,
  patch: Partial<Pick<typeof writingTerms.$inferInsert, "sortOrder" | "title" | "isActive">>
) {
  const [updated] = await db
    .update(writingTerms)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(writingTerms.id, termId))
    .returning();
  return updated ?? null;
}

export async function deleteTermById(db: Db, termId: string): Promise<boolean> {
  const deleted = await db.delete(writingTerms).where(eq(writingTerms.id, termId)).returning({ id: writingTerms.id });
  return deleted.length > 0;
}

export async function listAssignmentMastersForTerm(db: Db, termId: string) {
  return db
    .select()
    .from(writingAssignmentMasters)
    .where(eq(writingAssignmentMasters.termId, termId))
    .orderBy(asc(writingAssignmentMasters.slotIndex));
}

export async function getAssignmentMasterById(db: Db, id: string) {
  const rows = await db
    .select()
    .from(writingAssignmentMasters)
    .where(eq(writingAssignmentMasters.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertAssignmentMaster(
  db: Db,
  row: typeof writingAssignmentMasters.$inferInsert
): Promise<typeof writingAssignmentMasters.$inferSelect> {
  const [created] = await db.insert(writingAssignmentMasters).values(row).returning();
  return created;
}

export async function updateAssignmentMaster(
  db: Db,
  id: string,
  patch: Partial<
    Pick<
      typeof writingAssignmentMasters.$inferInsert,
      "slotIndex" | "theme" | "requiredExpressions" | "modelAnswer" | "difficulty"
    >
  >
) {
  const [updated] = await db
    .update(writingAssignmentMasters)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(writingAssignmentMasters.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteAssignmentMaster(db: Db, id: string): Promise<boolean> {
  const deleted = await db
    .delete(writingAssignmentMasters)
    .where(eq(writingAssignmentMasters.id, id))
    .returning({ id: writingAssignmentMasters.id });
  return deleted.length > 0;
}

export async function countAssignmentMastersForTerm(db: Db, termId: string): Promise<number> {
  const rows = await db
    .select({ id: writingAssignmentMasters.id })
    .from(writingAssignmentMasters)
    .where(eq(writingAssignmentMasters.termId, termId));
  return rows.length;
}

export async function getAssignmentMasterByTermAndSlot(db: Db, termId: string, slotIndex: number) {
  const rows = await db
    .select()
    .from(writingAssignmentMasters)
    .where(and(eq(writingAssignmentMasters.termId, termId), eq(writingAssignmentMasters.slotIndex, slotIndex)))
    .limit(1);
  return rows[0] ?? null;
}
