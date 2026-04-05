/**
 * Drizzle ORM — mirrors supabase/migrations/20260327120000_platform_and_writing_schema.sql
 * - public.* : platform identity + catalog + commerce + entitlements
 * - writing.* : writing app domain only (quiz/ondoku will use other schemas)
 * Use from backend/API only; do not import into browser bundles.
 */

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSchema,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { authUsers } from "./auth-users";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const platformAppEnum = pgEnum("platform_app", ["writing", "quiz", "ondoku"]);

export const entitlementStatusEnum = pgEnum("entitlement_status", [
  "active",
  "revoked",
  "expired",
  "pending",
]);

export const courseIntervalEnum = pgEnum("course_interval", [
  "interval_1d",
  "interval_2d",
  "interval_3d",
  "interval_1w",
  "interval_10d",
  "interval_2w",
]);

export const courseStatusEnum = pgEnum("course_status", [
  "pending_setup",
  "active",
  "completed",
  "cancelled",
]);

export const sessionStatusEnum = pgEnum("session_status", ["locked", "unlocked", "completed"]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "draft",
  "submitted",
  "in_review",
  "corrected",
  "published",
]);

export const correctionStatusEnum = pgEnum("correction_status", ["draft", "published"]);

export const errorCategoryEnum = pgEnum("error_category", [
  "grammar",
  "expression",
  "vocabulary",
  "particle",
  "spelling",
  "honorifics",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
]);

// -----------------------------------------------------------------------------
// Platform: catalog + commerce + entitlements (identity = auth.users only)
// -----------------------------------------------------------------------------

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    app: platformAppEnum("app").notNull(),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("jpy"),
    unitPriceJpy: integer("unit_price_jpy").notNull(),
    quantity: integer("quantity").notNull().default(1),
    subtotalJpy: integer("subtotal_jpy").notNull(),
    taxRate: numeric("tax_rate", { precision: 5, scale: 4 }).notNull(),
    totalJpy: integer("total_jpy").notNull(),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "products_writing_totals_valid",
      sql`app <> 'writing' OR (
        unit_price_jpy > 0
        AND quantity >= 1
        AND subtotal_jpy > 0
        AND total_jpy > 0
        AND tax_rate >= 0
      )`
    ),
    index("idx_products_app").on(t.app),
    index("idx_products_active").on(t.app).where(sql`active`),
  ]
);

export const paymentOrders = pgTable(
  "payment_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    status: paymentStatusEnum("status").notNull().default("pending"),
    currency: char("currency", { length: 3 }).notNull().default("jpy"),
    unitPriceJpy: integer("unit_price_jpy").notNull(),
    quantity: integer("quantity").notNull(),
    subtotalJpy: integer("subtotal_jpy").notNull(),
    taxRate: numeric("tax_rate", { precision: 5, scale: 4 }).notNull(),
    totalJpy: integer("total_jpy").notNull(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
    stripeEventId: text("stripe_event_id").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [index("idx_payment_orders_user_created").on(t.userId, t.createdAt)]
);

export const entitlements = pgTable(
  "entitlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    paymentOrderId: uuid("payment_order_id")
      .notNull()
      .unique()
      .references(() => paymentOrders.id, { onDelete: "restrict" }),
    app: platformAppEnum("app").notNull(),
    status: entitlementStatusEnum("status").notNull().default("pending"),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_entitlements_user").on(t.userId),
    index("idx_entitlements_app_status").on(t.app, t.status),
  ]
);

export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  stripeEventId: text("stripe_event_id").notNull().unique(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  payloadHash: text("payload_hash"),
});

/** One-time password reset tokens (server-issued; 15-minute TTL). */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("password_reset_tokens_token_hash_uq").on(t.tokenHash),
    index("password_reset_tokens_user_id_idx").on(t.userId),
  ]
);

// -----------------------------------------------------------------------------
// Writing app schema
// -----------------------------------------------------------------------------

const writing = pgSchema("writing");

export const writingCourses = writing.table(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    entitlementId: uuid("entitlement_id")
      .notNull()
      .unique()
      .references(() => entitlements.id, { onDelete: "cascade" }),
    status: courseStatusEnum("status").notNull().default("pending_setup"),
    startDate: date("start_date"),
    interval: courseIntervalEnum("interval"),
    sessionCount: smallint("session_count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "writing_courses_session_count_range",
      sql`session_count >= 1 AND session_count <= 24`
    ),
    check(
      "writing_courses_schedule_when_active",
      sql`status IN ('pending_setup', 'cancelled') OR (start_date IS NOT NULL AND interval IS NOT NULL)`
    ),
    index("idx_writing_courses_user_id").on(t.userId),
    index("idx_writing_courses_status").on(t.status),
  ]
);

/** Mail-link regular access: one grant ↔ one course; submissions may use regular_access_grant_id instead of user_id. */
export const regularAccessGrants = writing.table(
  "regular_access_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentName: text("student_name").notNull(),
    studentEmail: text("student_email").notNull(),
    note: text("note"),
    accessEnabled: boolean("access_enabled").notNull().default(true),
    accessReadyAt: timestamp("access_ready_at", { withTimezone: true }),
    accessExpiresAt: timestamp("access_expires_at", { withTimezone: true }),
    lastAccessAt: timestamp("last_access_at", { withTimezone: true }),
    courseId: uuid("course_id").references(() => writingCourses.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("regular_access_grants_student_email_idx").on(t.studentEmail),
    index("regular_access_grants_course_id_idx").on(t.courseId),
  ]
);

export const regularAccessTokens = writing.table(
  "regular_access_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    regularAccessGrantId: uuid("regular_access_grant_id")
      .notNull()
      .references(() => regularAccessGrants.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("regular_access_tokens_token_hash_unique").on(t.tokenHash),
    index("regular_access_tokens_grant_id_idx").on(t.regularAccessGrantId),
  ]
);

export const academyInvites = writing.table(
  "academy_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    invitedEmail: text("invited_email"),
    invitedName: text("invited_name"),
    academyLabel: text("academy_label"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedByUserId: uuid("used_by_user_id").references(() => authUsers.id, { onDelete: "set null" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("academy_invites_token_hash_unique").on(t.tokenHash),
    index("idx_academy_invites_expires_at").on(t.expiresAt),
    index("idx_academy_invites_invited_email").on(t.invitedEmail),
    index("idx_academy_invites_used_at").on(t.usedAt),
  ]
);

export const academyUnlimitedGrants = writing.table(
  "academy_unlimited_grants",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    inviteId: uuid("invite_id")
      .notNull()
      .references(() => academyInvites.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_academy_unlimited_grants_invite_id").on(t.inviteId)]
);

export const writingSessions = writing.table(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => writingCourses.id, { onDelete: "cascade" }),
    index: smallint("index").notNull(),
    unlockAt: timestamp("unlock_at", { withTimezone: true }).notNull(),
    status: sessionStatusEnum("status").notNull().default("locked"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("writing_sessions_index_range", sql`index >= 1 AND index <= 10`),
    unique("writing_sessions_course_index_unique").on(t.courseId, t.index),
    index("idx_writing_sessions_course_id").on(t.courseId),
    index("idx_writing_sessions_course_unlock").on(t.courseId, t.unlockAt),
    index("idx_writing_sessions_status").on(t.courseId, t.status),
  ]
);

export const writingSubmissions = writing.table(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => writingSessions.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => writingCourses.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => authUsers.id, { onDelete: "cascade" }),
    regularAccessGrantId: uuid("regular_access_grant_id").references(() => regularAccessGrants.id, {
      onDelete: "cascade",
    }),
    /** 体験申込 (writing.trial_applications)。提出の source of truth は本行の status / submitted_at（trial_applications に複製しない） */
    trialApplicationId: uuid("trial_application_id"),
    status: submissionStatusEnum("status").notNull().default("draft"),
    bodyText: text("body_text"),
    imageStorageKey: text("image_storage_key"),
    imageMimeType: text("image_mime_type"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("writing_submissions_one_per_session").on(t.sessionId),
    index("idx_writing_submissions_user_status").on(t.userId, t.status),
    index("idx_writing_submissions_course_status").on(t.courseId, t.status),
    check(
      "writing_submissions_access_xor",
      sql`(user_id IS NOT NULL AND regular_access_grant_id IS NULL AND trial_application_id IS NULL) OR (user_id IS NULL AND regular_access_grant_id IS NOT NULL AND trial_application_id IS NULL) OR (user_id IS NULL AND regular_access_grant_id IS NULL AND trial_application_id IS NOT NULL)`
    ),
    uniqueIndex("writing_submissions_one_active_pipeline_per_user")
      .on(t.userId)
      .where(
        sql`user_id IS NOT NULL AND status IN ('draft', 'submitted', 'in_review', 'corrected')`
      ),
    uniqueIndex("writing_submissions_one_active_pipeline_per_grant")
      .on(t.regularAccessGrantId)
      .where(
        sql`regular_access_grant_id IS NOT NULL AND status IN ('draft', 'submitted', 'in_review', 'corrected')`
      ),
    uniqueIndex("writing_submissions_one_active_pipeline_per_trial")
      .on(t.trialApplicationId)
      .where(
        sql`trial_application_id IS NOT NULL AND status IN ('draft', 'submitted', 'in_review', 'corrected')`
      ),
    index("idx_writing_submissions_trial_application_id").on(t.trialApplicationId),
  ]
);

export const writingCorrections = writing.table(
  "corrections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .unique()
      .references(() => writingSubmissions.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    status: correctionStatusEnum("status").notNull().default("draft"),
    polishedSentence: text("polished_sentence"),
    modelAnswer: text("model_answer"),
    teacherComment: text("teacher_comment"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "writing_corrections_status_published_at",
      sql`(status = 'draft' AND published_at IS NULL) OR (status = 'published' AND published_at IS NOT NULL)`
    ),
    index("idx_writing_corrections_teacher_id").on(t.teacherId),
    index("idx_writing_corrections_status").on(t.status),
    index("idx_writing_corrections_published_at").on(t.publishedAt).where(sql`published_at IS NOT NULL`),
  ]
);

export const writingFragments = writing.table(
  "fragments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    correctionId: uuid("correction_id")
      .notNull()
      .references(() => writingCorrections.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    originalText: text("original_text").notNull(),
    correctedText: text("corrected_text").notNull(),
    category: errorCategoryEnum("category").notNull(),
    startOffset: integer("start_offset"),
    endOffset: integer("end_offset"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("writing_fragments_order_unique").on(t.correctionId, t.orderIndex),
    check(
      "writing_fragments_offset_sanity",
      sql`end_offset IS NULL OR start_offset IS NULL OR end_offset >= start_offset`
    ),
    index("idx_writing_fragments_correction_id").on(t.correctionId),
    index("idx_writing_fragments_category").on(t.category),
  ]
);

export const writingEvaluations = writing.table(
  "evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .unique()
      .references(() => writingSubmissions.id, { onDelete: "cascade" }),
    grammarAccuracy: smallint("grammar_accuracy"),
    vocabularyUsage: smallint("vocabulary_usage"),
    contextualFluency: smallint("contextual_fluency"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    check(
      "writing_evaluations_grammar_range",
      sql`grammar_accuracy IS NULL OR (grammar_accuracy >= 0 AND grammar_accuracy <= 100)`
    ),
    check(
      "writing_evaluations_vocab_range",
      sql`vocabulary_usage IS NULL OR (vocabulary_usage >= 0 AND vocabulary_usage <= 100)`
    ),
    check(
      "writing_evaluations_fluency_range",
      sql`contextual_fluency IS NULL OR (contextual_fluency >= 0 AND contextual_fluency <= 100)`
    ),
  ]
);

// -----------------------------------------------------------------------------
// Relations
// -----------------------------------------------------------------------------

export const productsRelations = relations(products, ({ many }) => ({
  paymentOrders: many(paymentOrders),
  entitlements: many(entitlements),
}));

export const paymentOrdersRelations = relations(paymentOrders, ({ one }) => ({
  user: one(authUsers, { fields: [paymentOrders.userId], references: [authUsers.id] }),
  product: one(products, { fields: [paymentOrders.productId], references: [products.id] }),
  entitlement: one(entitlements, {
    fields: [paymentOrders.id],
    references: [entitlements.paymentOrderId],
  }),
}));

export const entitlementsRelations = relations(entitlements, ({ one }) => ({
  user: one(authUsers, { fields: [entitlements.userId], references: [authUsers.id] }),
  product: one(products, { fields: [entitlements.productId], references: [products.id] }),
  paymentOrder: one(paymentOrders, {
    fields: [entitlements.paymentOrderId],
    references: [paymentOrders.id],
  }),
  writingCourse: one(writingCourses, {
    fields: [entitlements.id],
    references: [writingCourses.entitlementId],
  }),
}));

export const writingCoursesRelations = relations(writingCourses, ({ one, many }) => ({
  user: one(authUsers, { fields: [writingCourses.userId], references: [authUsers.id] }),
  entitlement: one(entitlements, {
    fields: [writingCourses.entitlementId],
    references: [entitlements.id],
  }),
  sessions: many(writingSessions),
  submissions: many(writingSubmissions),
  regularAccessGrants: many(regularAccessGrants),
}));

export const regularAccessGrantsRelations = relations(regularAccessGrants, ({ one, many }) => ({
  course: one(writingCourses, {
    fields: [regularAccessGrants.courseId],
    references: [writingCourses.id],
  }),
  submissions: many(writingSubmissions),
}));

export const regularAccessTokensRelations = relations(regularAccessTokens, ({ one }) => ({
  grant: one(regularAccessGrants, {
    fields: [regularAccessTokens.regularAccessGrantId],
    references: [regularAccessGrants.id],
  }),
}));

export const writingSessionsRelations = relations(writingSessions, ({ one, many }) => ({
  course: one(writingCourses, {
    fields: [writingSessions.courseId],
    references: [writingCourses.id],
  }),
  submissions: many(writingSubmissions),
}));

export const writingSubmissionsRelations = relations(writingSubmissions, ({ one }) => ({
  session: one(writingSessions, {
    fields: [writingSubmissions.sessionId],
    references: [writingSessions.id],
  }),
  course: one(writingCourses, {
    fields: [writingSubmissions.courseId],
    references: [writingCourses.id],
  }),
  user: one(authUsers, { fields: [writingSubmissions.userId], references: [authUsers.id] }),
  regularAccessGrant: one(regularAccessGrants, {
    fields: [writingSubmissions.regularAccessGrantId],
    references: [regularAccessGrants.id],
  }),
  correction: one(writingCorrections, {
    fields: [writingSubmissions.id],
    references: [writingCorrections.submissionId],
  }),
  evaluation: one(writingEvaluations, {
    fields: [writingSubmissions.id],
    references: [writingEvaluations.submissionId],
  }),
}));

export const writingCorrectionsRelations = relations(writingCorrections, ({ one, many }) => ({
  submission: one(writingSubmissions, {
    fields: [writingCorrections.submissionId],
    references: [writingSubmissions.id],
  }),
  teacher: one(authUsers, { fields: [writingCorrections.teacherId], references: [authUsers.id] }),
  fragments: many(writingFragments),
}));

export const writingFragmentsRelations = relations(writingFragments, ({ one }) => ({
  correction: one(writingCorrections, {
    fields: [writingFragments.correctionId],
    references: [writingCorrections.id],
  }),
}));

export const writingEvaluationsRelations = relations(writingEvaluations, ({ one }) => ({
  submission: one(writingSubmissions, {
    fields: [writingEvaluations.submissionId],
    references: [writingSubmissions.id],
  }),
}));
