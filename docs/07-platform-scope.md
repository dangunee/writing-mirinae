# Platform scope: paid foundations vs public content apps

This document fixes **scope** for mirinae.jp platform work in this repo and related shared-DB design. It avoids folding unrelated surfaces into the paid platform model prematurely.

---

## What the shared platform foundations target (now)

- **Writing** (paid correction / course flow) and **future paid apps** that need:
  - **`auth.users`**-centric identity on the shared Supabase project
  - **Catalog + payments + entitlements** (or equivalent) separate from newsletter and separate from legacy profile fields where we explicitly integrate
  - **App-specific schemas** (e.g. **`writing`**) that do not block other products

Engineering focus: **these foundations first**, implemented safely against the **existing shared database** (see [`05-integration-assessment.md`](./05-integration-assessment.md)).

---

## Public content apps — out of scope for the paid model (for now)

- **Q&A**, **dailylife** (and similar **public-read** surfaces) may **keep their current structure** (e.g. `qna_posts`, `seikatsu_items`, public RLS patterns).
- They are **not** required to move into **`products` / `payment_orders` / `entitlements`** at this stage.
- No need to “fold” them into the paid platform schema until a product decision says otherwise.

---

## Quiz — intentional future alignment

- **Quiz** may **later** adopt the **shared auth + payment + entitlement** model when a **paid subscription (or similar) version** is built.
- Until then, quiz-specific tables and flows can remain as they are today; migration into the shared paid model is a **later phase**, not a blocker for writing foundations.

---

## Summary

| Area | Stance |
|------|--------|
| **Writing + future paid apps** | **In scope** — shared platform foundations (`auth`, commerce, entitlements, app schemas). |
| **Q&A / dailylife / public-read** | **Leave as-is** for now; not merged into paid platform model. |
| **Quiz** | **Future** alignment when paid quiz product exists; not required now. |

This scope should guide migrations, APIs, and docs: **do not** conflate public content catalog tables with **entitlements**, and **do not** delay writing work waiting for quiz to migrate.
