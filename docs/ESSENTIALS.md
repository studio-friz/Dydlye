# Essentials

Everything you need to know before you change anything in this repository.

**Read this before your first commit.** The short version: this project has a
strict security model, and a "harmless" change to a policy or an API layer can
reopen a critical vulnerability.

---

## Table of contents

1. [The two applications](#1-the-two-applications)
2. [Architecture](#2-architecture)
3. [Database](#3-database)
4. [Security rules you must not break](#4-security-rules-you-must-not-break)
5. [Request and data flow](#5-request-and-data-flow)
6. [Routing](#6-routing)
7. [State and data fetching](#7-state-and-data-fetching)
8. [i18n](#8-i18n)
9. [Styling](#9-styling)
10. [Maps and offline mode](#10-maps-and-offline-mode)
11. [Android and in-app purchases](#11-android-and-in-app-purchases)
12. [Conventions](#12-conventions)
13. [Gotchas](#13-gotchas)
14. [Where things are](#14-where-things-are)

---

## 1. The two applications

|            | Customer app                | Admin panel                |
| ---------- | --------------------------- | -------------------------- |
| Path       | `./src`                     | `./admin/src`              |
| Router     | TanStack Router (file-based) | React Router 6 (JSX)      |
| Dev port   | 8080                        | 5173                       |
| Users      | Travellers and hosts        | Administrators            |
| Auth       | Supabase Auth                | Supabase Auth (email/password) |
| Data access| Direct, via RLS             | `admin-api` Edge Function only |
| Built for  | Web + Android (Capacitor)   | Web only                  |

They are separate Vite apps with separate `package.json` files, and they must
stay that way. They share one database, not one codebase.

---

## 2. Architecture

The customer app is a **pure client-side SPA**. There is no Next.js, no SSR, and
no server of its own:

```
src/entry-client.tsx  →  createRoot()  →  <RouterProvider />
src/router.tsx        →  createRouter({ routeTree, context: { queryClient } })
src/routeTree.gen.ts  →  generated; never edit it by hand
```

**"TanStack Start" is a legacy name in this repo.** The dependencies and folder
layout came from a Start-based template, but the build is plain Vite + React
Router. Do not add Start/SSR features expecting them to work.

Everything privileged lives in Supabase:

```
Browser ──publishable key──► Supabase REST/Auth/Storage
                              (every request filtered by RLS)

Browser ──user JWT──► Edge Function ──service_role key──► Postgres
                      (checks public.admins first)
```

---

## 3. Database

Postgres, schema `public`. Tables created by `supabase_setup.sql`; three more
added by the hardening migration.

| Table               | Purpose                                             | Written by                  |
| ------------------- | --------------------------------------------------- | --------------------------- |
| `profiles`          | One row per user; `is_host`, `blocked`, phone       | Trigger on signup + server  |
| `properties`        | Rental listings                                     | Host (own rows only)        |
| `bookings`          | Reservation requests                                 | `create_booking` RPC        |
| `comments`          | Ratings + text on listings                           | Signed-in users             |
| `favorites`         | Schema exists; **the app does not use it yet**      | —                           |
| `property_reports`  | Abuse reports on listings                            | Signed-in users             |
| `destinations`      | Tourist map points                                   | Admin only                  |
| `countries`         | Country grouping for destinations                    | Admin only                  |
| `promo_codes`       | Discount codes                                       | Admin only                  |
| `subscriptions`     | Host subscription state                              | `confirm-play-subscription` |
| `admins`            | **Admin allow-list** (hardening migration)           | You, manually               |
| `promo_redemptions` | One row per code use (hardening migration)           | `redeem_promo_code` RPC     |
| `product_prices`    | **Authoritative prices** (hardening migration)       | Admin only                  |

Storage buckets: `property-images`, `destination-images`, `country-images` —
all public-read, with write policies bounded by size, MIME type and count.

**Never edit a table in the Supabase dashboard UI.** Write a migration in
`supabase/migrations/YYYYMMDDHHMMSS_name.sql` instead, so the change is
reproducible. Migrations must be idempotent (`create table if not exists`,
`drop policy if exists` before `create policy`).

### Key functions

| Function                       | Why you care                                        |
| ------------------------------ | --------------------------------------------------- |
| `handle_new_user` (trigger)    | Creates the `profiles` row; copies name/phone from OAuth metadata |
| `update_updated_at_column`     | Auto-bumps `updated_at`                              |
| `is_admin()`                   | `SECURITY DEFINER`; the only admin authority check   |
| `is_active_host()`             | Used by RLS so blocked users and expired hosts lose write access |
| `create_booking(...)`          | Computes amount server-side; client cannot set price |
| `validate_promo_code(...)`     | Checks limits and expiry                             |
| `redeem_promo_code(...)`       | Validates **and** records the redemption             |
| `get_host_subscription_state()`| Host entitlement, used to gate the UI               |
| `delete_my_account()`          | Account + data deletion                              |

All `SECURITY DEFINER` functions must keep `SET search_path`. Removing it
reintroduces a privilege-escalation path.

---

## 4. Security rules you must not break

The project was audited (38 findings: 4 critical, 9 high, 14 medium, 8 low).
The hardening migration fixed them. **These rules are load-bearing.**

### 4.1 Never put a privileged key in a `VITE_` variable

Anything named `VITE_*` is compiled into the public JavaScript bundle. It is
readable by anyone who loads the page.

- ✅ `VITE_SUPABASE_PUBLISHABLE_KEY` — anon role, filtered by RLS. Fine.
- ❌ `VITE_SERVICE_ROLE_KEY`, `sb_secret_...`, any JWT with `role:
  service_role` — bypasses RLS entirely. **This is how the admin panel was
  originally compromised: it shipped the service-role key in its bundle with no
  login at all.**

The service-role key belongs in Edge Function secrets:

```bash
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<key>
```

`admin/src/lib/supabase.ts` actively rejects a service-role key pasted into the
publishable-key variable, and says so in the UI. Keep that check.

### 4.2 The admin panel must go through `admin-api`

`admin/src/lib/adminApi.ts` POSTs to the `admin-api` Edge Function. Do not
"simplify" it back into direct `supabase.from("...")` calls. The function
verifies the bearer token, then checks `public.admins`, then executes.

Adding a new admin operation means adding a `case` to
`supabase/functions/admin-api/index.ts` — with input validation, because
anything reaching the database has already bypassed RLS.

### 4.3 Never trust a client-supplied price, rating or status

These are computed or verified server-side and must stay that way:

| Field                                 | Authoritative source                    |
| ------------------------------------- | ---------------------------------------- |
| Booking amount                        | `create_booking` (base price) + promo    |
| `properties.rating` / `reviews`       | Recomputed from `comments`                |
| Comment reviewer name                 | From the authenticated user              |
| `product_prices`                      | Server table, read-only to the client    |
| Subscription entitlement             | `confirm-play-subscription` (Google Play) |
| `profiles.is_host`                    | Set by the purchase flow, never by UPDATE |
| `profiles.blocked`                    | Admin only                                |

`profiles.is_host` in particular: if the `profiles` UPDATE policy lets a user
write that column, the paid host subscription becomes free. The hardening
migration restricts it.

### 4.4 Enable RLS on every new table

```sql
alter table public.your_table enable row level security;
```

An RLS-enabled table with no policy denies everything, which is a safe default.
An RLS-**disabled** table is readable and writable by anyone holding the
anon key.

### 4.5 Enforce `blocked` in RLS, not in the UI

Hiding a button in React is not access control. The `blocked` check must appear
in the policies for properties, favorites, bookings and comments.

### 4.6 Bound every upload

Size limit, MIME allow-list, and a maximum count — enforced in the storage
policies, not only in the client. The client compresses images, which is a UX
feature, not a security control.

### 4.7 Don't log or commit secrets

No `.env`, no keystore, no `supabase/.temp/`. `.gitignore` already covers
these; if you add a new secret type, extend it in the same commit.

---

## 5. Request and data flow

### Customer app

Reads go straight to Supabase with the publishable key and land on RLS:

```ts
import { supabase } from "@/integrations/supabase/client";
const { data, error } = await supabase.from("properties").select("*");
```

Writes that need server logic go through an RPC:

```ts
const { data, error } = await supabase.rpc("create_booking", { propertyId });
```

The client is a lazy `Proxy`, so importing it never throws when the env vars are
missing — it returns a dummy client and logs instead. The app degrades rather
than white-screening.

### Admin panel

Everything goes through `adminApi`, never directly:

```ts
import { adminApi } from "@/lib/adminApi";
const { data, reportCounts } = await adminApi.properties.list();
```

Failures throw `AdminApiError` with an HTTP-ish `status` (401 = session expired,
403 = not an admin). The pages already handle that.

To add an operation:

1. Add a `case` in `supabase/functions/admin-api/index.ts` with validation.
2. Add the method to `adminApi` in `admin/src/lib/adminApi.ts`.
3. Use it from the page.

The exported shape of `adminApi` is depended on by 10 page components — keep it
stable.

---

## 6. Routing

TanStack Router, file-based under `src/routes/`.

- `__root.tsx` is the only root layout. Do not add another root.
- `index.tsx` → `/`
- `settings.account.tsx` → `/settings/account` (flat, not nested)
- `edit-property.$id.tsx` → `/edit-property/:id` (`$` = dynamic segment)
- `routeTree.gen.ts` is **generated** — never edit it, and don't commit
  conflicts in it. Regenerate with the router CLI if routes look wrong.

The admin panel is different: it uses React Router 6 and declares routes in JSX
in `admin/src/App.tsx`. New admin pages need a `lazy()` import and a `<Route>`.

---

## 7. State and data fetching

TanStack Query, provided in `src/router.tsx` and reachable from hooks.

Rules of thumb:

- Server state lives in a query hook under `src/hooks/`, not in a component's
  `useState`. Compare `useProperties.ts` and `useFavorites.ts`.
- Auth state is a Zustand-style store: `useAuthStore.ts` + `useAuth.ts`. Don't
  duplicate the session in another store.
- `useFavorites.ts` is **localStorage only** (`dydlye:favorites`). It is not
  synced to an account. Don't assume a `favorites` row exists.
- `useProfile.ts` reads the profile through an RPC; `profiles` has no
  user-readable policy beyond your own row.

---

## 8. i18n

- Translations live in one file: `src/i18n/translations.ts` (~99 KB) with `ar`,
  `fr` and `en` objects.
- Read them through `useTranslation()`. Do not hardcode user-facing strings in
  a component.
- The UI is RTL-first (`<html dir="rtl">`). Use logical CSS properties
  (`ms-`/`me-`, `start`/`end`) instead of `ml-`/`mr-`/`left`/`right`, so
  left-to-right locales also lay out correctly.
- The admin panel is Arabic-only and hardcodes `dir="rtl"` on its root element.

---

## 9. Styling

Tailwind CSS v4 via `@tailwindcss/vite`, with the theme in `src/index.css`
(`oklch` colors). Components are shadcn/ui-style Radix wrappers in
`src/components/ui/` — they are **local copies**, not a package, so edit them
directly.

- Use existing primitives (`Button`, `Card`, `Input`, `Sheet`, `Dialog`) before
  writing a new one.
- `cn()` from `src/lib/utils.ts` merges class names.
- Arabic UI text is common; keep it readable and don't machine-translate the
  domain vocabulary (`مضيف` = host, `وجهة` = destination, and so on).

---

## 10. Maps and offline mode

`src/components/DydlyeMap.tsx` is the core map. It combines:

- Leaflet + `react-leaflet` for the tile layer
- `maplibre-gl-leaflet` / `maplibre-gl` for vector rendering
- `supercluster` for point clustering
- OSRM (`router.project-osrm.org`) for the trip route
- Nominatim / ArcGIS for geocoding

Offline assets are **generated, not committed**:

```bash
npm run generate:offline   # -> public/offline/  (tiles, borders, labels)
npm run generate:borders   # -> public/borders/  (country outlines)
```

`src/lib/offlineMap.ts` decides when to use them. Regenerate after changing
geographic scope or the scripts in `scripts/`.

---

## 11. Android and in-app purchases

- `capacitor.config.ts`: `appId` is `com.dydlye.app`, `webDir` is `dist`,
  cleartext HTTP is disabled (do not re-enable).
- `npx cap sync android` copies `dist/` into
  `android/app/src/main/assets/public/` — that directory is git-ignored build
  output. Never commit it.
- Google sign-in needs the same client id in **three** places:
  `capacitor.config.ts`, `src/routes/auth.tsx`, and the Google Cloud console
  (package `com.dydlye.app` + your signing SHA-1).
- The host subscription is a Google Play purchase verified by the
  `confirm-play-subscription` Edge Function. It needs these secrets:

  ```bash
  npx supabase secrets set GOOGLE_PRIVATE_KEY=... \
    GOOGLE_SERVICE_ACCOUNT_EMAIL=... \
    ANDROID_APP_PACKAGE=com.dydlye.app \
    ALLOWED_PRODUCT_IDS=...
  ```

  Until they are set, the flow cannot succeed. Prices live in
  `product_prices`, not in the client — the constants in
  `useHostSubscription.ts` are display-only.
- Release signing reads `android/keystore.properties` (git-ignored). Generate
  your own keystore; never commit a `.jks`.

---

## 12. Conventions

- TypeScript everywhere. No `any` in new code — the DB types in
  `src/integrations/supabase/types.ts` cover the schema.
- `npm run lint` must pass. Prettier: 100 columns, double quotes, semicolons,
  trailing commas.
- Commit format follows the existing history; keep messages imperative and
  scoped (`feat:`, `fix:`, `docs:`, `chore:`).
- Comment **why**, not **what**. The security-sensitive paths are commented
  because the reason is not obvious from the code.
- Match the surrounding file's style. Several components are Arabic-commented;
  keep that voice.

---

## 13. Gotchas

Things that have already cost time:

1. **Two lockfiles.** `bun.lock` and `package-lock.json` both exist. The project
   is developed with npm; delete the one your team doesn't use so CI and local
   installs agree.
2. **`.env` is read by the Capacitor build.** `npm run build:mobile` runs
   `scripts/generate-capacitor-index.mjs`, which injects your `VITE_*` values
   into `dist/index.html`. If the Android app behaves as if pointed at the wrong
   project, check that file.
3. **`houses.ts` exports an empty seed array.** It is leftover scaffolding; the
   real data is in the database.
4. **`public/manifest.json` has mojibake** in `name`/`description` (double-encoded
   Arabic). Fix it if you care about the installed app name.
5. **`android/allowBackup` is `true`.** Turn it off for production.
6. **`SETUP_ALL.sql` is deprecated** and marked as such. It is kept only at
   `docs/archive/` for history — use `supabase_setup.sql` plus the hardening
   migration.
7. **The booking sheet collects card data** without a payment gateway. It is
   simulated. Do not put real card flows around it.
8. **Third-party geo services have no API keys.** Nominatim and OSRM in
   particular will rate-limit a popular deployment.

---

## 14. Where things are

| I want to change...            | Look here                                              |
| ----------------------------- | ------------------------------------------------------ |
| A screen                      | `src/routes/<page>.tsx`                                |
| Shared UI / primitives        | `src/components/`                                      |
| Listing create/edit form      | `src/features/properties/PropertyForm.tsx`             |
| Image upload                  | `src/features/properties/uploadImages.ts`              |
| A screen's data               | `src/hooks/use<Thing>.ts`                              |
| Sign-in / session             | `src/hooks/useAuth.ts`, `useAuthStore.ts`              |
| Text in three languages       | `src/i18n/translations.ts`                              |
| The map                       | `src/components/DydlyeMap.tsx`                         |
| Trip planner logic            | `src/lib/tripPlanner.ts`, `src/components/TripStrip.tsx` |
| Offline map assets            | `scripts/generate-offline-map.mjs`, `src/lib/offlineMap.ts` |
| DB schema                     | `supabase_setup.sql`, `supabase/migrations/`            |
| RLS / server functions        | `supabase/migrations/20260926000000_security_hardening.sql` |
| Admin API operations          | `supabase/functions/admin-api/index.ts`                |
| Admin panel screens           | `admin/src/pages/`                                     |
| Admin panel API layer         | `admin/src/lib/adminApi.ts`                            |
| Admin sign-in                 | `admin/src/pages/Login.tsx`, `admin/src/lib/supabase.ts` |
| Env var handling              | `.env.example`, `admin/.env.example`                   |

---

## Where to go next

- Setting up a database for the first time → [`SUPABASE.md`](SUPABASE.md)
- Understanding the audit findings → `SECURITY_AUDIT_REPORT.md` in the repository
  root (historical reference; the fixes are already applied)
