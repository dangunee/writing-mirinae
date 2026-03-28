-- Delta: newsletter / mail magazine (schema `newsletter`)
-- Shared mirinae.jp DB: uses Supabase Auth only — FK to auth.users(id), no public.users.
-- Coexists with quiz, writing commerce, customer_profiles, etc. No changes to existing tables.

CREATE SCHEMA IF NOT EXISTS newsletter;

CREATE EXTENSION IF NOT EXISTS citext;

-- -----------------------------------------------------------------------------
-- Enums in public schema (prefixed names avoid collisions; Drizzle-friendly)
-- -----------------------------------------------------------------------------
CREATE TYPE newsletter_subscriber_status AS ENUM (
  'subscribed',
  'unsubscribed',
  'bounced',
  'complained'
);

CREATE TYPE newsletter_list_membership_status AS ENUM (
  'active',
  'removed'
);

CREATE TYPE newsletter_campaign_status AS ENUM (
  'draft',
  'scheduled',
  'sending',
  'sent',
  'cancelled'
);

CREATE TYPE newsletter_delivery_status AS ENUM (
  'pending',
  'queued',
  'sent',
  'delivered',
  'bounced',
  'failed',
  'complained'
);

CREATE TYPE newsletter_preference_event_type AS ENUM (
  'subscribe',
  'unsubscribe',
  'resubscribe',
  'bounce',
  'complaint',
  'preference_update',
  'list_join',
  'list_leave'
);

-- -----------------------------------------------------------------------------
-- subscribers — email is canonical; auth link optional (nullable user_id)
-- -----------------------------------------------------------------------------
CREATE TABLE newsletter.subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  status newsletter_subscriber_status NOT NULL DEFAULT 'subscribed',
  subscription_source text NOT NULL DEFAULT 'unknown',
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscribers_email_unique UNIQUE (email)
);

COMMENT ON TABLE newsletter.subscribers IS 'Newsletter identity separate from commerce. email required even when user_id links to auth.users.';
COMMENT ON COLUMN newsletter.subscribers.user_id IS 'Optional link to Supabase auth.users; NULL for email-only subscribers.';
COMMENT ON COLUMN newsletter.subscribers.subscription_source IS 'Origin: website_form, import, admin, api, etc. — not payment entitlement.';

CREATE INDEX idx_newsletter_subscribers_user_id ON newsletter.subscribers (user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX idx_newsletter_subscribers_status ON newsletter.subscribers (status);
CREATE INDEX idx_newsletter_subscribers_created ON newsletter.subscribers (created_at DESC);

-- -----------------------------------------------------------------------------
-- lists — segments / mailing lists (future rules in metadata; not entitlements)
-- -----------------------------------------------------------------------------
CREATE TABLE newsletter.lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  segmentation_hint text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lists_slug_unique UNIQUE (slug)
);

COMMENT ON TABLE newsletter.lists IS 'Mailing lists / segments. segmentation_hint is documentation only (e.g. writing_purchasers); enforce in app or future jobs, not FK to products.';
CREATE INDEX idx_newsletter_lists_slug ON newsletter.lists (slug);

-- -----------------------------------------------------------------------------
-- list_memberships — subscriber ↔ list
-- -----------------------------------------------------------------------------
CREATE TABLE newsletter.list_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES newsletter.subscribers (id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES newsletter.lists (id) ON DELETE CASCADE,
  status newsletter_list_membership_status NOT NULL DEFAULT 'active',
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT list_memberships_unique UNIQUE (subscriber_id, list_id)
);

CREATE INDEX idx_newsletter_list_memberships_list ON newsletter.list_memberships (list_id);
CREATE INDEX idx_newsletter_list_memberships_subscriber ON newsletter.list_memberships (subscriber_id);

-- -----------------------------------------------------------------------------
-- campaigns
-- -----------------------------------------------------------------------------
CREATE TABLE newsletter.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid REFERENCES newsletter.lists (id) ON DELETE SET NULL,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text,
  body_text text,
  status newsletter_campaign_status NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN newsletter.campaigns.list_id IS 'NULL allowed for ad-hoc / multi-list sends defined in metadata later.';
CREATE INDEX idx_newsletter_campaigns_list ON newsletter.campaigns (list_id);
CREATE INDEX idx_newsletter_campaigns_status ON newsletter.campaigns (status);

-- -----------------------------------------------------------------------------
-- campaign_deliveries — per-recipient send record
-- -----------------------------------------------------------------------------
CREATE TABLE newsletter.campaign_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES newsletter.campaigns (id) ON DELETE CASCADE,
  subscriber_id uuid NOT NULL REFERENCES newsletter.subscribers (id) ON DELETE CASCADE,
  status newsletter_delivery_status NOT NULL DEFAULT 'pending',
  provider_message_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  error_detail text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_deliveries_unique UNIQUE (campaign_id, subscriber_id)
);

CREATE INDEX idx_newsletter_deliveries_campaign ON newsletter.campaign_deliveries (campaign_id);
CREATE INDEX idx_newsletter_deliveries_subscriber ON newsletter.campaign_deliveries (subscriber_id);
CREATE INDEX idx_newsletter_deliveries_status ON newsletter.campaign_deliveries (status);

-- -----------------------------------------------------------------------------
-- preference_events — unsubscribe history, complaints, preference changes
-- -----------------------------------------------------------------------------
CREATE TABLE newsletter.preference_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES newsletter.subscribers (id) ON DELETE CASCADE,
  list_id uuid REFERENCES newsletter.lists (id) ON DELETE SET NULL,
  event_type newsletter_preference_event_type NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE newsletter.preference_events IS 'Audit log for compliance; not payment data.';

CREATE INDEX idx_newsletter_pref_events_subscriber ON newsletter.preference_events (subscriber_id, created_at DESC);
CREATE INDEX idx_newsletter_pref_events_type ON newsletter.preference_events (event_type, created_at DESC);

-- -----------------------------------------------------------------------------
-- subscriber_tags — optional segmentation labels (no FK to products)
-- -----------------------------------------------------------------------------
CREATE TABLE newsletter.subscriber_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES newsletter.subscribers (id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriber_tags_unique UNIQUE (subscriber_id, tag)
);

CREATE INDEX idx_newsletter_subscriber_tags_tag ON newsletter.subscriber_tags (tag);

-- -----------------------------------------------------------------------------
-- RLS: backend/service only by default (extend policies when subscribe UI uses client)
-- -----------------------------------------------------------------------------
ALTER TABLE newsletter.subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter.list_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter.campaign_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter.preference_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter.subscriber_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY newsletter_subscribers_service ON newsletter.subscribers
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY newsletter_lists_service ON newsletter.lists
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY newsletter_list_memberships_service ON newsletter.list_memberships
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY newsletter_campaigns_service ON newsletter.campaigns
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY newsletter_campaign_deliveries_service ON newsletter.campaign_deliveries
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY newsletter_preference_events_service ON newsletter.preference_events
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY newsletter_subscriber_tags_service ON newsletter.subscriber_tags
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON SCHEMA newsletter IS 'Mail magazine / newsletter. Not entitlements; optional auth.users link on subscribers only.';
