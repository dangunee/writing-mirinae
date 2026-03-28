/**
 * Newsletter / mail magazine — mirrors supabase/migrations/20260328120000_newsletter_schema.sql
 * Schema: newsletter.* ; FK to auth.users only (no public.users).
 * Backend/API only.
 */

import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgSchema,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { authUsers } from "./auth-users";

export { authUsers };

export const newsletterSubscriberStatusEnum = pgEnum("newsletter_subscriber_status", [
  "subscribed",
  "unsubscribed",
  "bounced",
  "complained",
]);

export const newsletterListMembershipStatusEnum = pgEnum("newsletter_list_membership_status", [
  "active",
  "removed",
]);

export const newsletterCampaignStatusEnum = pgEnum("newsletter_campaign_status", [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "cancelled",
]);

export const newsletterDeliveryStatusEnum = pgEnum("newsletter_delivery_status", [
  "pending",
  "queued",
  "sent",
  "delivered",
  "bounced",
  "failed",
  "complained",
]);

export const newsletterPreferenceEventTypeEnum = pgEnum("newsletter_preference_event_type", [
  "subscribe",
  "unsubscribe",
  "resubscribe",
  "bounce",
  "complaint",
  "preference_update",
  "list_join",
  "list_leave",
]);

const newsletter = pgSchema("newsletter");

export const newsletterSubscribers = newsletter.table(
  "subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    userId: uuid("user_id").references(() => authUsers.id, { onDelete: "set null" }),
    status: newsletterSubscriberStatusEnum("status").notNull().default("subscribed"),
    subscriptionSource: text("subscription_source").notNull().default("unknown"),
    subscribedAt: timestamp("subscribed_at", { withTimezone: true }).notNull().defaultNow(),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_newsletter_subscribers_user_id").on(t.userId),
    index("idx_newsletter_subscribers_status").on(t.status),
    index("idx_newsletter_subscribers_created").on(t.createdAt),
  ]
);

export const newsletterLists = newsletter.table(
  "lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    segmentationHint: text("segmentation_hint"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_newsletter_lists_slug").on(t.slug)]
);

export const newsletterListMemberships = newsletter.table(
  "list_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriberId: uuid("subscriber_id")
      .notNull()
      .references(() => newsletterSubscribers.id, { onDelete: "cascade" }),
    listId: uuid("list_id")
      .notNull()
      .references(() => newsletterLists.id, { onDelete: "cascade" }),
    status: newsletterListMembershipStatusEnum("status").notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [
    unique("list_memberships_unique").on(t.subscriberId, t.listId),
    index("idx_newsletter_list_memberships_list").on(t.listId),
    index("idx_newsletter_list_memberships_subscriber").on(t.subscriberId),
  ]
);

export const newsletterCampaigns = newsletter.table(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id").references(() => newsletterLists.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    subject: text("subject").notNull(),
    bodyHtml: text("body_html"),
    bodyText: text("body_text"),
    status: newsletterCampaignStatusEnum("status").notNull().default("draft"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_newsletter_campaigns_list").on(t.listId),
    index("idx_newsletter_campaigns_status").on(t.status),
  ]
);

export const newsletterCampaignDeliveries = newsletter.table(
  "campaign_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => newsletterCampaigns.id, { onDelete: "cascade" }),
    subscriberId: uuid("subscriber_id")
      .notNull()
      .references(() => newsletterSubscribers.id, { onDelete: "cascade" }),
    status: newsletterDeliveryStatusEnum("status").notNull().default("pending"),
    providerMessageId: text("provider_message_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    errorDetail: text("error_detail"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("campaign_deliveries_unique").on(t.campaignId, t.subscriberId),
    index("idx_newsletter_deliveries_campaign").on(t.campaignId),
    index("idx_newsletter_deliveries_subscriber").on(t.subscriberId),
    index("idx_newsletter_deliveries_status").on(t.status),
  ]
);

export const newsletterPreferenceEvents = newsletter.table(
  "preference_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriberId: uuid("subscriber_id")
      .notNull()
      .references(() => newsletterSubscribers.id, { onDelete: "cascade" }),
    listId: uuid("list_id").references(() => newsletterLists.id, { onDelete: "set null" }),
    eventType: newsletterPreferenceEventTypeEnum("event_type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_newsletter_pref_events_subscriber").on(t.subscriberId, t.createdAt),
    index("idx_newsletter_pref_events_type").on(t.eventType, t.createdAt),
  ]
);

export const newsletterSubscriberTags = newsletter.table(
  "subscriber_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriberId: uuid("subscriber_id")
      .notNull()
      .references(() => newsletterSubscribers.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("subscriber_tags_unique").on(t.subscriberId, t.tag),
    index("idx_newsletter_subscriber_tags_tag").on(t.tag),
  ]
);

export const newsletterSubscribersRelations = relations(newsletterSubscribers, ({ one, many }) => ({
  authUser: one(authUsers, { fields: [newsletterSubscribers.userId], references: [authUsers.id] }),
  listMemberships: many(newsletterListMemberships),
  campaignDeliveries: many(newsletterCampaignDeliveries),
  preferenceEvents: many(newsletterPreferenceEvents),
  tags: many(newsletterSubscriberTags),
}));

export const newsletterListsRelations = relations(newsletterLists, ({ many }) => ({
  memberships: many(newsletterListMemberships),
  campaigns: many(newsletterCampaigns),
}));

export const newsletterListMembershipsRelations = relations(newsletterListMemberships, ({ one }) => ({
  subscriber: one(newsletterSubscribers, {
    fields: [newsletterListMemberships.subscriberId],
    references: [newsletterSubscribers.id],
  }),
  list: one(newsletterLists, {
    fields: [newsletterListMemberships.listId],
    references: [newsletterLists.id],
  }),
}));

export const newsletterCampaignsRelations = relations(newsletterCampaigns, ({ one, many }) => ({
  list: one(newsletterLists, {
    fields: [newsletterCampaigns.listId],
    references: [newsletterLists.id],
  }),
  deliveries: many(newsletterCampaignDeliveries),
}));

export const newsletterCampaignDeliveriesRelations = relations(newsletterCampaignDeliveries, ({ one }) => ({
  campaign: one(newsletterCampaigns, {
    fields: [newsletterCampaignDeliveries.campaignId],
    references: [newsletterCampaigns.id],
  }),
  subscriber: one(newsletterSubscribers, {
    fields: [newsletterCampaignDeliveries.subscriberId],
    references: [newsletterSubscribers.id],
  }),
}));

export const newsletterPreferenceEventsRelations = relations(newsletterPreferenceEvents, ({ one }) => ({
  subscriber: one(newsletterSubscribers, {
    fields: [newsletterPreferenceEvents.subscriberId],
    references: [newsletterSubscribers.id],
  }),
  list: one(newsletterLists, {
    fields: [newsletterPreferenceEvents.listId],
    references: [newsletterLists.id],
  }),
}));

export const newsletterSubscriberTagsRelations = relations(newsletterSubscriberTags, ({ one }) => ({
  subscriber: one(newsletterSubscribers, {
    fields: [newsletterSubscriberTags.subscriberId],
    references: [newsletterSubscribers.id],
  }),
}));
