/**
 * Drizzle ORM — mirrors supabase/migrations/*.sql (platform + writing + auth helpers)
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

export const sessionStatusEnum = pgEnum("session_status", ["locked", "unlocked", "completed", "missed"]);

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

export const emailVerificationPurposeEnum = pgEnum("email_verification_purpose", [
  "line_onboarding",
  "email_link",
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

/** App profile (LINE onboarding, email display); id = auth.users.id */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    email: text("email"),
    name: text("name"),
    koreanLevel: text("korean_level"),
    emailVerified: boolean("email_verified").notNull().default(false),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => []
);

/** One-time email verification (15 min TTL in app). */
export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    purpose: emailVerificationPurposeEnum("purpose").notNull(),
    pendingEmail: text("pending_email").notNull(),
    passwordEncrypted: text("password_encrypted"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("email_verification_tokens_token_hash_uq").on(t.tokenHash),
    index("email_verification_tokens_user_id_idx").on(t.userId),
  ]
);

// -----------------------------------------------------------------------------
// Writing app schema
// -----------------------------------------------------------------------------

const writing = pgSchema("writing");

export const writingAppRoleEnum = writing.enum("app_role", ["student", "teacher", "admin"]);

export const writingSessionRuntimeEnum = writing.enum("session_runtime", [
  "locked",
  "available",
  "submitted",
  "corrected",
  "missed",
]);

export const writingAnnotationTargetEnum = writing.enum("annotation_target", ["original", "corrected", "improved"]);

export const writingTerms = writing.table(
  "terms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sortOrder: integer("sort_order").notNull().default(0),
    title: text("title").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_writing_terms_sort").on(t.sortOrder)]
);

export const writingAssignmentMasters = writing.table(
  "assignment_masters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    termId: uuid("term_id")
      .notNull()
      .references(() => writingTerms.id, { onDelete: "cascade" }),
    slotIndex: smallint("slot_index").notNull(),
    theme: text("theme").notNull(),
    requiredExpressions: jsonb("required_expressions").notNull().default(sql`'[]'::jsonb`),
    modelAnswer: text("model_answer").notNull(),
    difficulty: smallint("difficulty").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("writing_assignment_masters_slot_range", sql`slot_index >= 1 AND slot_index <= 10`),
    check("writing_assignment_masters_difficulty_range", sql`difficulty >= 1 AND difficulty <= 5`),
    unique("writing_assignment_masters_term_slot_unique").on(t.termId, t.slotIndex),
    index("idx_writing_assignment_masters_term_id").on(t.termId),
  ]
);

export const writingUserRoles = writing.table(
  "user_roles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    role: writingAppRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_writing_user_roles_role").on(t.role)]
);

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
    /** Internal admin test course; excluded from student entitlement resolution. */
    isAdminSandbox: boolean("is_admin_sandbox").notNull().default(false),
    /** Optional link to assignment master term (course generator snapshots assignments). */
    termId: uuid("term_id").references(() => writingTerms.id, { onDelete: "set null" }),
    /** When true, sequential unlock + missed rules apply in reconciliation. */
    strictSessionProgression: boolean("strict_session_progression").notNull().default(false),
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
    index("idx_writing_courses_term_id").on(t.termId),
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

/** Trial applications (mirrors mirinae-api / sql/writing_trial_entitlements.sql + extensions). */
export const trialApplications = writing.table(
  "trial_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicantName: text("applicant_name").notNull(),
    applicantEmail: text("applicant_email").notNull(),
    koreanLevel: text("korean_level"),
    inquiry: text("inquiry"),
    paymentMethod: text("payment_method").notNull(),
    paymentStatus: text("payment_status").notNull().default("pending"),
    accessStatus: text("access_status").notNull().default("pending"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeCustomerEmail: text("stripe_customer_email"),
    amountJpy: integer("amount_jpy").notNull(),
    currency: text("currency").notNull().default("jpy"),
    bankTransferConfirmedAt: timestamp("bank_transfer_confirmed_at", { withTimezone: true }),
    bankTransferConfirmedBy: uuid("bank_transfer_confirmed_by"),
    accessReadyAt: timestamp("access_ready_at", { withTimezone: true }),
    accessUsedAt: timestamp("access_used_at", { withTimezone: true }),
    accessExpiresAt: timestamp("access_expires_at", { withTimezone: true }),
    lastExtendedAt: timestamp("last_extended_at", { withTimezone: true }),
    extendCount: integer("extend_count").notNull().default(0),
    accessEmailSentAt: timestamp("access_email_sent_at", { withTimezone: true }),
    adminNote: text("admin_note"),
    userId: uuid("user_id").references(() => authUsers.id, { onDelete: "set null" }),
    /** Admin trash (soft-delete). Null = active list; non-null = trash view only until restored or permanently deleted. */
    trashedAt: timestamp("trashed_at", { withTimezone: true }),
    trashedBy: uuid("trashed_by").references(() => authUsers.id, { onDelete: "set null" }),
    trashReason: text("trash_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("trial_applications_stripe_checkout_session_id_unique").on(t.stripeCheckoutSessionId),
    index("trial_applications_applicant_email_idx").on(t.applicantEmail),
    index("trial_applications_stripe_checkout_session_id_idx").on(t.stripeCheckoutSessionId),
    index("trial_applications_user_id_idx").on(t.userId),
  ]
);

/** Reminder emails (e.g. 24h before deadline); aligned with trial_reminder_logs migration. */
export const trialReminderLogs = writing.table(
  "trial_reminder_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => trialApplications.id, { onDelete: "cascade" }),
    reminderType: text("reminder_type").notNull(),
    targetAt: timestamp("target_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    status: text("status").notNull(),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("trial_reminder_logs_application_id_reminder_type_unique").on(t.applicationId, t.reminderType),
    index("trial_reminder_logs_application_id_idx").on(t.applicationId),
  ]
);

/** Admin trash / restore / permanent_delete audit (application_id survives hard delete). */
export const trialApplicationAdminAudit = writing.table(
  "trial_application_admin_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id").notNull(),
    action: text("action").notNull(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    trashReason: text("trash_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("trial_application_admin_audit_app_idx").on(t.applicationId),
    index("trial_application_admin_audit_created_idx").on(t.createdAt),
  ]
);

/** Missed trial runtime sessions reopened after admin extend-access (see trialExtendSessionReopenService). */
export const trialExtendSessionReopenLog = writing.table(
  "trial_extend_session_reopen_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id").notNull(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    sessionId: uuid("session_id").notNull(),
    previousStatus: text("previous_status").notNull(),
    previousRuntimeStatus: text("previous_runtime_status"),
    newDueAt: timestamp("new_due_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("trial_extend_session_reopen_log_app_idx").on(t.applicationId),
    index("trial_extend_session_reopen_log_created_idx").on(t.createdAt),
  ]
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
    runtimeStatus: writingSessionRuntimeEnum("runtime_status"),
    availableFrom: timestamp("available_from", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    missedAt: timestamp("missed_at", { withTimezone: true }),
    themeSnapshot: text("theme_snapshot"),
    requiredExpressionsSnapshot: jsonb("required_expressions_snapshot"),
    modelAnswerSnapshot: text("model_answer_snapshot"),
    difficultySnapshot: smallint("difficulty_snapshot"),
    termId: uuid("term_id").references(() => writingTerms.id, { onDelete: "set null" }),
    assignmentMasterId: uuid("assignment_master_id").references(() => writingAssignmentMasters.id, {
      onDelete: "set null",
    }),
    /** Mail-link trial: runtime session rows are per application; NULL = shared course template / student courses. */
    trialApplicationId: uuid("trial_application_id").references(() => trialApplications.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("writing_sessions_index_range", sql`index >= 1 AND index <= 10`),
    uniqueIndex("writing_sessions_course_index_unique_non_trial")
      .on(t.courseId, t.index)
      .where(sql`trial_application_id IS NULL`),
    uniqueIndex("writing_sessions_trial_app_index_unique")
      .on(t.trialApplicationId, t.index)
      .where(sql`trial_application_id IS NOT NULL`),
    index("idx_writing_sessions_course_id").on(t.courseId),
    index("idx_writing_sessions_course_unlock").on(t.courseId, t.unlockAt),
    index("idx_writing_sessions_status").on(t.courseId, t.status),
    index("idx_writing_sessions_course_runtime").on(t.courseId, t.runtimeStatus),
    index("idx_writing_sessions_due_at").on(t.courseId, t.dueAt),
    index("idx_writing_sessions_trial_application_id").on(t.trialApplicationId),
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
    submissionMode: text("submission_mode"),
    bodyText: text("body_text"),
    imageStorageKey: text("image_storage_key"),
    imageMimeType: text("image_mime_type"),
    /** Server-computed: required expression pattern matches at submit time. */
    grammarCheckResult: jsonb("grammar_check_result"),
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

export const writingSubmissionAttachments = writing.table(
  "submission_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => writingSubmissions.id, { onDelete: "cascade" }),
    storageBucket: text("storage_bucket").notNull().default("writing-submissions"),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    originalFilename: text("original_filename"),
    pageCount: integer("page_count"),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("writing_submission_attachments_size_nonneg", sql`byte_size >= 0`),
    index("idx_writing_submission_attachments_submission_id").on(t.submissionId),
  ]
);

/** Admin QA: one row per admin; cookie references id. Server-validated only. */
export const adminSandboxContexts = writing.table(
  "admin_sandbox_contexts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" })
      .unique(),
    mode: text("mode").notNull(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => writingCourses.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => writingSessions.id, { onDelete: "cascade" }),
    termId: uuid("term_id").references(() => writingTerms.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    check(
      "admin_sandbox_contexts_mode_chk",
      sql`mode IN ('trial', 'regular', 'academy')`
    ),
    index("idx_admin_sandbox_ctx_expires").on(t.expiresAt),
  ]
);

export const adminSandboxAudit = writing.table(
  "admin_sandbox_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    mode: text("mode"),
    courseId: uuid("course_id"),
    sessionId: uuid("session_id"),
    success: boolean("success").notNull().default(true),
    detail: jsonb("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_admin_sandbox_audit_admin_created").on(t.adminUserId, t.createdAt)]
);

/** QA test text; teacher queue uses a mirror row in writing.submissions (submission_mode admin_sandbox). */
export const adminSandboxTestSubmissions = writing.table(
  "admin_sandbox_test_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => writingCourses.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => writingSessions.id, { onDelete: "cascade" }),
    sandboxMode: text("sandbox_mode").notNull(),
    bodyText: text("body_text"),
    status: text("status").notNull().default("draft"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "admin_sandbox_test_submissions_mode_chk",
      sql`sandbox_mode IN ('trial', 'regular', 'academy')`
    ),
    unique("admin_sandbox_test_submissions_one_per_admin_session").on(t.adminUserId, t.sessionId),
    index("idx_admin_sandbox_test_admin").on(t.adminUserId),
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
    richDocumentJson: jsonb("rich_document_json"),
    improvedText: text("improved_text"),
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

export const writingCorrectionFeedbackItems = writing.table(
  "correction_feedback_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    correctionId: uuid("correction_id")
      .notNull()
      .references(() => writingCorrections.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    category: text("category").notNull(),
    subcategory: text("subcategory"),
    originalText: text("original_text").notNull(),
    correctedText: text("corrected_text").notNull(),
    explanation: text("explanation"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("writing_correction_feedback_items_order_unique").on(t.correctionId, t.sortOrder),
    index("idx_writing_correction_feedback_items_correction_id").on(t.correctionId),
    index("idx_writing_correction_feedback_items_category").on(t.category),
  ]
);

export const writingCorrectionAnnotations = writing.table(
  "correction_annotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    correctionId: uuid("correction_id")
      .notNull()
      .references(() => writingCorrections.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    targetType: writingAnnotationTargetEnum("target_type").notNull(),
    anchorText: text("anchor_text"),
    startOffset: integer("start_offset"),
    endOffset: integer("end_offset"),
    commentText: text("comment_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "writing_correction_annotations_offset_sanity",
      sql`end_offset IS NULL OR start_offset IS NULL OR end_offset >= start_offset`
    ),
    index("idx_writing_correction_annotations_correction_id").on(t.correctionId),
    index("idx_writing_correction_annotations_correction_sort").on(t.correctionId, t.sortOrder),
  ]
);

export const writingCorrectionEvaluations = writing.table(
  "correction_evaluations",
  {
    correctionId: uuid("correction_id")
      .primaryKey()
      .references(() => writingCorrections.id, { onDelete: "cascade" }),
    grammar: smallint("grammar"),
    vocabulary: smallint("vocabulary"),
    flow: smallint("flow"),
    coherence: smallint("coherence"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    check("writing_correction_evaluations_grammar_range", sql`grammar IS NULL OR (grammar >= 0 AND grammar <= 100)`),
    check("writing_correction_evaluations_vocab_range", sql`vocabulary IS NULL OR (vocabulary >= 0 AND vocabulary <= 100)`),
    check("writing_correction_evaluations_flow_range", sql`flow IS NULL OR (flow >= 0 AND flow <= 100)`),
    check("writing_correction_evaluations_coh_range", sql`coherence IS NULL OR (coherence >= 0 AND coherence <= 100)`),
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

export const writingTermsRelations = relations(writingTerms, ({ many }) => ({
  assignmentMasters: many(writingAssignmentMasters),
  courses: many(writingCourses),
}));

export const writingAssignmentMastersRelations = relations(writingAssignmentMasters, ({ one, many }) => ({
  term: one(writingTerms, {
    fields: [writingAssignmentMasters.termId],
    references: [writingTerms.id],
  }),
  sessions: many(writingSessions),
}));

export const writingCoursesRelations = relations(writingCourses, ({ one, many }) => ({
  user: one(authUsers, { fields: [writingCourses.userId], references: [authUsers.id] }),
  entitlement: one(entitlements, {
    fields: [writingCourses.entitlementId],
    references: [entitlements.id],
  }),
  term: one(writingTerms, {
    fields: [writingCourses.termId],
    references: [writingTerms.id],
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
  trialApplication: one(trialApplications, {
    fields: [writingSessions.trialApplicationId],
    references: [trialApplications.id],
  }),
  term: one(writingTerms, {
    fields: [writingSessions.termId],
    references: [writingTerms.id],
  }),
  assignmentMaster: one(writingAssignmentMasters, {
    fields: [writingSessions.assignmentMasterId],
    references: [writingAssignmentMasters.id],
  }),
  submissions: many(writingSubmissions),
}));

export const writingSubmissionsRelations = relations(writingSubmissions, ({ one, many }) => ({
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
  attachments: many(writingSubmissionAttachments),
}));

export const writingSubmissionAttachmentsRelations = relations(writingSubmissionAttachments, ({ one }) => ({
  submission: one(writingSubmissions, {
    fields: [writingSubmissionAttachments.submissionId],
    references: [writingSubmissions.id],
  }),
}));

export const writingCorrectionsRelations = relations(writingCorrections, ({ one, many }) => ({
  submission: one(writingSubmissions, {
    fields: [writingCorrections.submissionId],
    references: [writingSubmissions.id],
  }),
  teacher: one(authUsers, { fields: [writingCorrections.teacherId], references: [authUsers.id] }),
  fragments: many(writingFragments),
  feedbackItems: many(writingCorrectionFeedbackItems),
  annotations: many(writingCorrectionAnnotations),
  correctionEvaluation: one(writingCorrectionEvaluations),
}));

export const writingFragmentsRelations = relations(writingFragments, ({ one }) => ({
  correction: one(writingCorrections, {
    fields: [writingFragments.correctionId],
    references: [writingCorrections.id],
  }),
}));

export const writingCorrectionFeedbackItemsRelations = relations(writingCorrectionFeedbackItems, ({ one }) => ({
  correction: one(writingCorrections, {
    fields: [writingCorrectionFeedbackItems.correctionId],
    references: [writingCorrections.id],
  }),
}));

export const writingCorrectionAnnotationsRelations = relations(writingCorrectionAnnotations, ({ one }) => ({
  correction: one(writingCorrections, {
    fields: [writingCorrectionAnnotations.correctionId],
    references: [writingCorrections.id],
  }),
}));

export const writingCorrectionEvaluationsRelations = relations(writingCorrectionEvaluations, ({ one }) => ({
  correction: one(writingCorrections, {
    fields: [writingCorrectionEvaluations.correctionId],
    references: [writingCorrections.id],
  }),
}));

export const writingEvaluationsRelations = relations(writingEvaluations, ({ one }) => ({
  submission: one(writingSubmissions, {
    fields: [writingEvaluations.submissionId],
    references: [writingSubmissions.id],
  }),
}));
