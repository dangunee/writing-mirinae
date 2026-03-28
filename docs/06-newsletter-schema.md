# Newsletter schema (`newsletter`)

**Migration:** `supabase/migrations/20260328120000_newsletter_schema.sql`  
**Drizzle:** `db/newsletter-schema.ts` (see `drizzle.config.ts` multi-schema entry)

## Purpose

Mail magazine / newsletter storage isolated in schema **`newsletter`**, separate from **`products` / `payment_orders` / `entitlements`** and from **`customer_profiles`**. Optional link from **`newsletter.subscribers.user_id`** to **`auth.users(id)`**; **`email`** is always stored on the subscriber row for non-registered recipients.

## Tables

| Table | Role |
|-------|------|
| **`newsletter.subscribers`** | Canonical subscriber; nullable `user_id` → `auth.users`; `subscription_source` text; `subscribed_at` / `unsubscribed_at`; status enum. |
| **`newsletter.lists`** | Mailing lists / segments; `slug`, `segmentation_hint` (documentation for future jobs, not FKs). |
| **`newsletter.list_memberships`** | Many-to-many subscriber ↔ list; `joined_at` / `left_at`. |
| **`newsletter.campaigns`** | Campaign content + `newsletter_campaign_status`; optional `list_id`. |
| **`newsletter.campaign_deliveries`** | Per (campaign, subscriber) send row; provider ids + delivery status. |
| **`newsletter.preference_events`** | Compliance / audit: subscribe, unsubscribe, bounce, complaint, list join/leave, etc. |
| **`newsletter.subscriber_tags`** | Optional labels for segmentation (e.g. future sync from platform data). |

## Enums (public schema)

Types are named **`newsletter_*`** (e.g. `newsletter_subscriber_status`) to avoid collisions and to align with Drizzle `pgEnum` names.

## RLS

All tables: **service_role** full access only. Add `anon`/`authenticated` policies when public subscribe/unsubscribe APIs are implemented.

## Assumptions / open points

- **Idempotency:** `CREATE TYPE` / `CREATE TABLE` are not wrapped in `IF NOT EXISTS` for types; re-running the same migration on success will fail — normal for Supabase migrations.
- **Pre-flight:** On a busy DB, confirm no existing type names `newsletter_subscriber_status`, etc.
- **Double opt-in / legal:** Schema supports logging via `preference_events`; workflow not implemented here.
- **Sending:** No ESP columns beyond `provider_message_id` / `metadata`; extend as needed.
