# Dydlye

**Discover your destination, live your experience.**

Dydlye is a mobile-first, Arabic/RTL travel and accommodation app. It combines two
things in one product:

- **Places to stay** — a rental marketplace where hosts publish listings and
  travellers book them.
- **Places to go** — an interactive map of tourist destinations with categories,
  photos, opening hours, and an offline trip planner.

The interface is Arabic-first (RTL) with French and English translations, and the
whole product targets Morocco and the wider Maghreb region.

This repository is a **monorepo** containing two applications and the Supabase
backend that both of them talk to:

| Path                | What it is                                                    |
| ------------------- | ------------------------------------------------------------- |
| `src/`              | The customer app (React + Vite, also runs as an Android app)   |
| `admin/`            | The administration panel (React + Vite, separate app)          |
| `supabase/`         | SQL migrations and Edge Functions for the backend              |
| `docs/`             | Developer documentation (see below)                            |

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Database setup](#database-setup)
- [Running the apps](#running-the-apps)
- [Android build](#android-build)
- [Documentation](#documentation)
- [Security model](#security-model)
- [Known limitations](#known-limitations)
- [License](#license)

---

## Features

### For travellers

- Map-based browsing of tourist destinations, filterable by category (beach,
  hammam, restaurant, nature, landmark, and more)
- Nearby accommodation listings with photos, prices, features and ratings
- Property detail sheet with image gallery, amenities, host contact and
  WhatsApp hand-off
- Booking flow with promo-code redemption
- Comments and ratings on listings
- Reporting abusive listings
- Offline map: pre-generated vector tiles, borders, roads, rivers, lakes and
  place labels for use without a connection
- Trip planner — pick several places, get an ordered route, drawn on the map
  with OSRM driving directions, plus a progress strip and completion screen
- Favourites (stored locally on the device)
- Full i18n: Arabic, French, English
- Light/dark theme, RTL layout, Android back-button handling

### For hosts

- Host onboarding through a Google Play in-app purchase (a paid subscription)
- Create, edit and delete listings
- Upload listing photos (client-side compression before upload)
- Track booking requests
- Redeem promo codes against the host subscription

### For administrators (`admin/`)

- Dashboard with counts and per-city / per-category breakdowns
- Manage destinations: create, edit, delete, reorder, group by country
- Manage countries and their cover images
- Manage listings, including bulk delete with cascade
- Manage users: block, or block and permanently remove all their content
- Moderate abuse reports (`new` / `reviewed` / `resolved`)
- Manage promo codes and the authoritative product prices
- Sign-in required; every privileged operation is authorised server-side

---

## Tech stack

### Customer app

| Concern            | Choice                                                    |
| ------------------ | --------------------------------------------------------- |
| Framework          | React 19 + TypeScript                                    |
| Build tool         | Vite 7                                                    |
| Routing            | TanStack Router (file-based, `src/routes/`)               |
| Server state       | TanStack Query                                             |
| Styling            | Tailwind CSS v4 + Radix UI primitives                     |
| Maps               | Leaflet + `maplibre-gl-leaflet` + `supercluster`           |
| Geodata            | `shpjs`, `topojson-client`, `world-atlas`                 |
| Routing/geo        | OSRM, Nominatim, ArcGIS / Carto / OSM tiles               |
| Backend            | Supabase (Postgres, Auth, Storage, Realtime, Edge Functions) |
| Mobile shell       | Capacitor 8 (Android)                                     |
| In-app purchases   | `@capgo/native-purchases` (Google Play Billing)           |
| Sign-in            | Supabase Auth (email/password + Google OAuth)             |

### Admin panel

React 19 + Vite 7 + React Router 6 + Tailwind v4 + Recharts + Leaflet,
talking to Supabase through the `admin-api` Edge Function.

---

## Repository layout

```
.
├── src/                     # Customer app
│   ├── routes/              # File-based routes (TanStack Router)
│   ├── components/          # App components + shadcn/ui primitives
│   ├── features/properties/# Listing form, types, image upload
│   ├── hooks/               # useAuth, useProperties, useFavorites, ...
│   ├── integrations/supabase/ # Supabase client and generated DB types
│   ├── i18n/                # ar / fr / en translations
│   ├── lib/                 # Trip planner, offline map, image compression
│   └── data/                # Static seed data and icon maps
├── admin/                   # Admin panel (separate Vite app)
│   └── src/
│       ├── pages/           # Dashboard, Destinations, Properties, Users, ...
│       ├── components/      # Layout, MapPicker, ImageUploader, ui.tsx
│       └── lib/             # supabase.ts (auth client), adminApi.ts (API layer)
├── supabase/
│   ├── migrations/          # SQL migrations, including the security hardening
│   └── functions/           # admin-api, confirm-play-subscription, delete-account
├── scripts/                 # Build/codegen helpers (borders, offline map, Capacitor)
├── android/                 # Capacitor Android project
├── docs/
│   ├── ESSENTIALS.md        # What you must know before changing anything
│   └── SUPABASE.md          # How to connect this project to Supabase
├── supabase_setup.sql       # Base schema (idempotent)
└── .env.example             # Copy to .env and fill in
```

---

## Quick start

Requirements: **Node.js 20+** and a free Supabase project.

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env        # Windows: copy .env.example .env
#    then edit .env with your project URL and publishable key

# 3. Create the database (SQL Editor -> paste -> Run, once)
#    - supabase_setup.sql
#    - supabase/migrations/20260926000000_security_hardening.sql

# 4. Deploy the Edge Functions
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-secret-key>
npx supabase functions deploy admin-api
npx supabase functions deploy confirm-play-subscription
npx supabase functions deploy delete-account

# 5. Run it
npm run dev                 # customer app  -> http://localhost:8080
```

For the admin panel, in a second terminal:

```bash
cd admin
npm install
cp .env.example .env        # same project URL + publishable key
npm run dev                 # admin panel -> http://localhost:5173
```

**Full walkthrough: [`docs/SUPABASE.md`](docs/SUPABASE.md).**

---

## Environment variables

Both apps read the same two variables. Copy the example file and fill them in;
never commit the resulting `.env`.

```bash
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<publishable key>"
```

Get both from **Supabase Dashboard → Project Settings → API**.

| Variable                             | Where it is used                                          |
| ------------------------------------ | --------------------------------------------------------- |
| `VITE_SUPABASE_URL`                  | Supabase client, host-subscription verification           |
| `VITE_SUPABASE_PUBLISHABLE_KEY`      | Supabase client (anon/publishable — safe to expose)       |
| `SUPABASE_SERVICE_ROLE_KEY`          | **Edge Functions only.** Set with `supabase secrets set`. Never in `.env` for the apps, never in a `VITE_` variable. |

> The publishable key is designed to be public — every read and write is still
> filtered by the database's row-level security. The service-role key is not: it
> bypasses all of it.

---

## Database setup

Two SQL files must be applied, **in this order**:

1. **`supabase_setup.sql`** — creates the tables, indexes, RLS policies,
   triggers, functions, storage buckets and grants.
2. **`supabase/migrations/20260926000000_security_hardening.sql`** — revokes the
   insecure policies from step 1 and replaces them with hardened ones. It also
   creates `public.admins`, `public.promo_redemptions` and
   `public.product_prices`. **Skipping this file leaves the database
   exploitable.**

Both files are idempotent, so re-running them is safe.

Main tables: `profiles`, `properties`, `bookings`, `comments`, `favorites`,
`property_reports`, `destinations`, `countries`, `promo_codes`,
`subscriptions`, plus `admins`, `promo_redemptions`, `product_prices`.

Then create your first admin (one-time, after running both files):

```sql
INSERT INTO public.admins (user_id, email)
SELECT id, email FROM auth.users WHERE email = 'you@example.com';
```

---

## Running the apps

### Customer app

| Command                  | What it does                                        |
| ------------------------ | --------------------------------------------------- |
| `npm run dev`            | Dev server on port 8080                             |
| `npm run build`          | Production build into `dist/`                       |
| `npm run preview`        | Serve the production build locally                  |
| `npm run lint`           | ESLint                                              |
| `npm run format`         | Prettier                                            |
| `npm run generate:offline` | Regenerate the offline map bundle in `public/offline/` |
| `npm run generate:borders` | Regenerate country border GeoJSON                  |

### Admin panel

| Command           | What it does                    |
| ----------------- | ------------------------------- |
| `npm run dev`     | Dev server on port 5173         |
| `npm run build`   | Production build into `dist/`   |
| `npm run lint`    | ESLint                          |

---

## Android build

The app ships as an Android app through Capacitor.

```bash
npm run build:mobile   # vite build + inject env + npx cap sync android
npm run build:android  # the above, then open Android Studio
```

Requirements: Android Studio, Android SDK, and a JDK 17+. On Windows,
`scripts/build-android.ps1` locates the JDK from Android Studio automatically.

Requirements for Google sign-in: set your own OAuth client id in
`capacitor.config.ts` (`plugins.GoogleAuth.androidClientId`), in
`src/routes/auth.tsx`, and in the Google Cloud console with the package name
`com.dydlye.app` and your signing certificate's SHA-1 fingerprint.

Release signing uses `android/keystore.properties`, which is git-ignored — you
must create your own keystore. Never commit a `.jks` file.

---

## Documentation

| File                                    | What it covers                                                            |
| --------------------------------------- | ------------------------------------------------------------------------- |
| [`docs/ESSENTIALS.md`](docs/ESSENTIALS.md) | Architecture, data model, security rules, conventions, and the things that will bite you. **Read this first.** |
| [`docs/SUPABASE.md`](docs/SUPABASE.md)     | Step-by-step Supabase setup, keys, auth providers, storage, functions, and troubleshooting. |

---

## Security model

The project was hardened after a security audit (38 findings). The rules the
codebase now follows:

- **No privileged key ever reaches a browser.** The `service_role` key lives only
  in Edge Function secrets.
- **Row-level security is enabled on every table**, and the hardening migration
  replaces the permissive policies that shipped in the base schema.
- **The admin panel requires sign-in.** It uses the publishable key and calls the
  `admin-api` Edge Function, which re-checks that the caller is listed in
  `public.admins` before executing anything.
- **Price, rating and status fields are server-authoritative.** The client can
  never set them directly.
- **Image uploads are bounded** (size, MIME type, count) and go through
  short-lived signed upload URLs.

See `docs/ESSENTIALS.md#security-rules-you-must-not-break` for the full list.

---

## Known limitations

Be aware of these before using the project in production:

- **Payments are simulated.** The booking sheet collects card details in-app
  without a real payment gateway. Replace it with a compliant provider (Stripe,
  PayPal, or in-app billing) before handling any real money.
- **Favourites are device-local** (`localStorage`), not synced to an account.
  There is a `favorites` table in the schema, but the app does not use it yet.
- **Google Play purchase verification** requires a service account key and an
  `ANDROID_APP_PACKAGE` secret on the `confirm-play-subscription` function. It
  will not work until those are configured.
- **Third-party map services** (Nominatim, OSRM, ArcGIS, OSM, Carto) are used
  without API keys and have their own usage policies and rate limits.
- **Test coverage is minimal.** `testsprite_tests/` contains a single smoke test.
- **`allowBackup` is enabled** in the Android manifest. Disable it if you handle
  sensitive data on device.

---

## License

Released under the [MIT License](LICENSE). Use it, modify it, ship it
commercially — attribution is all that's required.
