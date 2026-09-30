# Connecting this project to Supabase

A complete, step-by-step guide: from an empty Supabase account to a running
Dydlye app. Follow it in order — later steps depend on earlier ones.

**Time:** about 20 minutes. **Cost:** the free tier is enough for development.

---

## Table of contents

1. [What you need first](#1-what-you-need-first)
2. [Create the project](#2-create-the-project)
3. [Create the database](#3-create-the-database)
4. [Get your keys](#4-get-your-keys)
5. [Configure the app's environment](#5-configure-the-apps-environment)
6. [Configure the admin panel's environment](#6-configure-the-admin-panels-environment)
7. [Deploy the Edge Functions](#7-deploy-the-edge-functions)
8. [Create your first admin](#8-create-your-first-admin)
9. [Configure authentication](#9-configure-authentication)
10. [Set up the admin panel](#10-set-up-the-admin-panel)
11. [Optional: Google sign-in on Android](#11-optional-google-sign-in-on-android)
12. [Optional: Google Play purchases](#12-optional-google-play-purchases)
13. [Using the Supabase CLI instead](#13-using-the-supabase-cli-instead)
14. [Verify everything works](#14-verify-everything-works)
15. [Troubleshooting](#15-troubleshooting)
16. [What to rotate, and when](#16-what-to-rotate-and-when)

---

## 1. What you need first

- A free [Supabase](https://supabase.com) account
- Node.js 20 or newer (`node --version`)
- This repository, cloned locally

You do **not** need to install the Supabase CLI — every step below can be done
in the browser. The CLI is only needed for deploying Edge Functions (step 7).

---

## 2. Create the project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and click
   **New project**.
2. Fill in:
   - **Organization** — your account
   - **Project name** — e.g. `dydlye`
   - **Database password** — generate a strong one and **save it in a password
     manager**. You cannot view it again in the dashboard.
   - **Region** — pick the one closest to your users (e.g. `West EU` for
     Morocco). Regions cannot be changed later.
3. Wait a couple of minutes for provisioning.

Your **project ref** is the 20-character id in the URL and in
`https://<project-ref>.supabase.co`. Note it down — you need it for the CLI and
the `.env` file. It is not a secret.

---

## 3. Create the database

The schema is created by **two** SQL files, applied **in this order**. Skipping
the second one leaves the database insecure.

### 3.1 Apply the base schema

1. Open **SQL Editor** in the dashboard → **New query**.
2. Open `supabase_setup.sql` from this repository, paste the whole file.
3. Click **Run**. It may take a few seconds.

This creates the tables, indexes, RLS policies, triggers, functions, storage
buckets (`property-images`, `destination-images`, `country-images`) and grants.

### 3.2 Apply the security hardening

1. **New query** again.
2. Paste `supabase/migrations/20260926000000_security_hardening.sql`.
3. **Run**.

This drops the permissive policies from step 3.1 and replaces them with
hardened ones. It also creates `admins`, `promo_redemptions` and
`product_prices`.

> **Do not skip this file.** The base schema alone contains several
> vulnerabilities — including one that lets any user make themselves a host for
> free, bypassing the paid subscription.

Both files are idempotent, so re-running them is safe. You can also apply them
with the CLI: `npx supabase db push` (see [step 13](#13-using-the-supabase-cli-instead)).

### 3.3 Confirm the tables exist

**SQL Editor** → run:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

You should see 13 tables: `admins`, `bookings`, `comments`, `countries`,
`destinations`, `favorites`, `product_prices`, `profiles`, `promo_codes`,
`promo_redemptions`, `properties`, `property_reports`, `subscriptions`.

Confirm RLS is on everywhere:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Every row should read `t` (true). If any reads `f`, something went wrong — see
[troubleshooting](#15-troubleshooting).

---

## 4. Get your keys

**Project Settings → API** (or **API Keys** in the current dashboard layout).

Copy these two values:

| Key                | What it is                                     | Secret?                     |
| ------------------ | ---------------------------------------------- | --------------------------- |
| **Project URL**    | `https://<project-ref>.supabase.co`            | No                          |
| **Publishable key**| `sb_publishable_...` (or the legacy `eyJ...` anon JWT) | No — safe to ship to browsers |
| **Secret / service_role key** | `sb_secret_...` (or legacy JWT with `role: service_role`) | **YES — never in a `VITE_` variable or a committed file** |

Which one goes where:

```
                    ┌─────────────────────────────┐
  .env (apps)  <────┤  Project URL                ├────┐
                    │  Publishable key  (anon)    ├────┤
                    └─────────────────────────────┘    │
                                                     │
                    ┌─────────────────────────────┐    │
  supabase secrets  <┤  Secret key (service_role)  ├────┘  (Edge Functions only)
                    └─────────────────────────────┘
```

**Why the publishable key is safe:** it carries the `anon` role, and Postgres
still applies row-level security. An attacker with it can only do what an
anonymous visitor could do. **Why the secret key is not:** it bypasses RLS
entirely, so anyone holding it owns the database.

> If you ever commit the secret key by accident, **rotating it is the only fix**
> ([step 16](#16-what-to-rotate-and-when)). Deleting the commit is not enough.

---

## 5. Configure the app's environment

From the repository root:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `.env`:

```bash
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<your publishable key>"
```

Optional — only for Google sign-in on Android:

```bash
VITE_GOOGLE_CLIENT_ID="<client-id>.apps.googleusercontent.com"
```

Rules:

- `.env` is git-ignored. Never rename it to something that isn't, and never
  commit it.
- Only `VITE_`-prefixed variables reach the browser. If a variable is missing,
  Vite substitutes `undefined` and the app logs a warning and renders a dummy
  client rather than crashing.
- `.env` is read at **build** time, not run time. Change it, then restart
  `npm run dev`, or rebuild.

Verify:

```bash
npm run dev
```

Open `http://localhost:8080`. The app should load with an empty map and no
console errors. If you see "Supabase not configured", `VITE_SUPABASE_URL` or
`VITE_SUPABASE_PUBLISHABLE_KEY` is missing or misspelled.

---

## 6. Configure the admin panel's environment

```bash
cd admin
cp .env.example .env
```

Same two values, same source:

```bash
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<your publishable key>"
```

> The admin panel needs **only** the publishable key. The old version required a
> `VITE_SERVICE_ROLE_KEY` here — that was the critical vulnerability. If you
> find a service-role key in this app's `.env`, delete it and rotate it on
> Supabase immediately.

`admin/src/lib/supabase.ts` refuses to start if the key you pasted has
`role: service_role`, and tells you so instead of silently creating a hole.

---

## 7. Deploy the Edge Functions

The Edge Functions are the only place the secret key is used. Deploying them
requires the Supabase CLI.

```bash
npm install -g supabase     # or: npx supabase <command>
```

Link the CLI to your project (uses your project ref, not a secret):

```bash
supabase login
supabase link --project-ref <project-ref>
```

Set the secret:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your secret key>
```

Confirm it is set (names only, values are never shown):

```bash
supabase secrets list
```

Deploy the three functions:

```bash
supabase functions deploy admin-api
supabase functions deploy confirm-play-subscription
supabase functions deploy delete-account
```

Verify in the dashboard under **Edge Functions** — all three should be listed as
deployed.

### What each function does

| Function                     | Used by                | Required secrets                                                                     |
| ---------------------------- | ---------------------- | ------------------------------------------------------------------------------------ |
| `admin-api`                  | the admin panel        | `SUPABASE_SERVICE_ROLE_KEY`, optionally `ADMIN_ALLOWED_ORIGINS`                       |
| `confirm-play-subscription`  | Android host purchase  | `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `ALLOWED_PRODUCT_IDS` |
| `delete-account`             | account deletion       | `SUPABASE_SERVICE_ROLE_KEY`                                                            |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the
platform — you only set the latter.

### CORS for the admin panel

`admin-api` only returns CORS headers for origins in `ADMIN_ALLOWED_ORIGINS`:

```bash
supabase secrets set ADMIN_ALLOWED_ORIGINS="http://localhost:5173,https://admin.your-domain.com"
```

If the variable is unset, no CORS headers are returned and **browser** calls
fail. The Android app is unaffected (it is not subject to CORS). Always set it
when you host the panel.

---

## 8. Create your first admin

The panel authorises against the `admins` table, not a role flag. Create your
account in the app first (sign up on `http://localhost:8080/register`), then:

**SQL Editor**:

```sql
insert into public.admins (user_id, email)
select id, email from auth.users where email = 'you@example.com';
```

Verify:

```sql
select * from public.admins;
```

To remove someone's access later:

```sql
delete from public.admins where email = 'someone@example.com';
```

---

## 9. Configure authentication

**Authentication → Providers.**

### Email (required)

Enable **Email**. For local development, leave **Confirm email** off so you can
sign up without checking mail. **Turn it on before going to production.**

### Google (optional, needed for Android sign-in)

1. Enable **Google**.
2. In [Google Cloud Console](https://console.cloud.google.com/), create an
   **OAuth 2.0 Client ID** of type **Web application**:
   - Authorized redirect URI:
     `https://<project-ref>.supabase.co/auth/v1/callback`
3. Copy the client id and secret into the Supabase provider settings.
4. For Android, also create an **Android** OAuth client (package
   `com.dydlye.app`, your signing SHA-1) — see
   [step 11](#11-optional-google-sign-in-on-android).

---

## 10. Set up the admin panel

```bash
cd admin
npm install
npm run dev
```

Open `http://localhost:5173`. You should see a **sign-in screen**.

1. Sign in with the Supabase Auth account you promoted to admin in
   [step 8](#8-create-your-first-admin).
2. If you get *"هذا الحساب ليس حساب مشرف"* ("this account is not an
   administrator"), the email in `admins` doesn't match the account you used.
3. If you get a CORS/network error, `ADMIN_ALLOWED_ORIGINS` is not set (step 7).
4. If you get *"اللوحة غير مهيأة"* ("the panel is not configured"), `.env` is
   missing or the variables are wrong.

Once signed in, `whoami` is called before the UI renders, so the dashboard only
appears for a real admin.

---

## 11. Optional: Google sign-in on Android

Only needed for the Android build. The client id must be consistent in **three**
places:

1. `capacitor.config.ts` → `plugins.GoogleAuth.androidClientId`
2. `src/routes/auth.tsx` → the same id
3. The Google Cloud OAuth client (Android type, package `com.dydlye.app`)

Then rebuild and sync:

```bash
npm run build:mobile
```

Find your signing SHA-1:

```bash
keytool -list -v -keystore <your.keystore> -alias <alias>
```

Add that fingerprint to the Google Cloud Android OAuth client.

The app works without Google sign-in on the web — the buttons simply aren't
offered. Everything else (bookings, favourites, maps) works fine.

---

## 12. Optional: Google Play purchases

The host subscription is a Google Play in-app purchase. Verification runs
through `confirm-play-subscription`, which needs a service account that can call
the Google Play Developer API.

1. In [Google Play Console](https://play.google.com/console), create the
   subscription product and note its id.
2. Enable **Google Play Android Developer API** for your Cloud project, and
   create a **service account** with access.
3. Download the service account JSON and extract two values:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY` (keep the `\n` escapes intact)
4. Set the secrets:

```bash
supabase secrets set \
  GOOGLE_SERVICE_ACCOUNT_EMAIL="<service-account-email>" \
  GOOGLE_PRIVATE_KEY="<private-key-with-escaped-newlines>" \
  ANDROID_APP_PACKAGE="com.dydlye.app" \
  ALLOWED_PRODUCT_IDS="<product-id-1>,<product-id-2>"
```

5. Enter the authoritative prices in the admin panel, or in SQL:

```sql
insert into public.product_prices (product_id, price, currency)
values ('<product-id>', 150, 'XOF')
on conflict (product_id) do update set price = excluded.price;
```

Prices live in this table, not in the client. The constants in
`src/hooks/useHostSubscription.ts` are only used for display.

Until these secrets are set, the purchase flow cannot complete.

---

## 13. Using the Supabase CLI instead

If you prefer the CLI for migrations:

```bash
npm install -g supabase
supabase login
supabase link --project-ref <project-ref>
```

Apply the schema (runs `supabase_setup.sql`, then the migrations):

```bash
supabase db push
```

Deploy functions and secrets:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<key>
supabase functions deploy admin-api
supabase functions deploy confirm-play-subscription
supabase functions deploy delete-account
```

Local development against a throwaway database:

```bash
supabase start          # requires Docker
supabase db reset       # reapplies everything, wiping local data
```

The project ref is stored in `supabase/.temp/`, which is git-ignored. That's
why `supabase/config.toml` in this repository contains no project id — a fork
should never point at someone else's project.

---

## 14. Verify everything works

Run through this list after setup:

**Database**

```sql
-- RLS everywhere
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and rowsecurity = false;
```
→ must return **0 rows**.

```sql
-- Admin allow-list populated
select email from public.admins;
```
→ must return your email.

**Customer app** (`http://localhost:8080`)

- Loads with no console errors
- The map renders destinations from your database
- Sign up, then sign in — a `profiles` row appears:

```sql
select full_name, is_host, blocked from public.profiles
order by created_at desc limit 5;
```

**Admin panel** (`http://localhost:5173`)

- Sign-in screen appears
- Signing in with a non-admin account is refused
- Signing in as an admin shows the dashboard with counts
- Uploading a destination image works (exercises signed uploads)

---

## 15. Troubleshooting

**"relation profiles does not exist"** — `supabase_setup.sql` wasn't run, or
you ran the hardening migration first. Run them in order.

**"new row violates row-level security policy"** — either the hardening
migration wasn't applied, or the client is trying to write a column its policy
forbids (price, rating, `is_host`…). Check the SQL editor for the exact
constraint. This is the expected error when someone bypasses the RPCs.

**"Invalid or expired session" (401) / admin panel signs out** — the access
token expired. Sign in again. If it's constant, the system clock is off or
`autoRefreshToken` is disabled.

**"This account is not an administrator" (403)** — no matching row in `admins`.
The `user_id` must match the `auth.users` id, and `email` should match too.

**CORS error in the admin panel** — `ADMIN_ALLOWED_ORIGINS` is unset or doesn't
include `http://localhost:5173`. Browsers enforce CORS; the Android app doesn't,
which is why this only shows up on the web.

**"Missing Supabase environment variable(s)"** — `.env` is missing or the
variable names are wrong. Only `VITE_`-prefixed variables reach the browser, and
Vite reads `.env` from the **project root**, not the parent directory.

**Changes to `.env` have no effect** — Vite reads `.env` at startup. Restart the
dev server or rebuild.

**Edge Function returns 500 immediately** — `SUPABASE_SERVICE_ROLE_KEY` is not
set. `supabase secrets list` will confirm.

**Android app talks to the wrong project** — `npm run build:mobile` injects
`.env` into `dist/index.html` via `scripts/generate-capacitor-index.mjs`. Re-run
the build and `npx cap sync android`; don't hand-edit the copied files under
`android/app/src/main/assets/public/`.

**Uploads rejected** — the storage policies cap file size, MIME type and count.
Check the browser network tab for the exact rejection.

---

## 16. What to rotate, and when

| Situation                                    | Action                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| Secret/service-role key ever committed or pasted in a message | **Rotate immediately.** Supabase → Settings → API → Reset. Then re-run step 7. |
| `.env` committed                             | Remove it, then rotate the key anyway — history keeps it forever.       |
| Admin account compromised or offboarded      | `delete from public.admins where email = '...'`                          |
| Someone needs admin access                    | Sign up, then insert into `admins` — never widen a public policy       |
| Publishable key leaked                        | Low risk (RLS still applies), but rotate it for hygiene                 |
| Fork published publicly                       | Never carry over the original `.env`; fill in your own values           |

After rotating the secret key, redeploy the functions so they pick it up:

```bash
supabase functions deploy admin-api
supabase functions deploy confirm-play-subscription
supabase functions deploy delete-account
```

---

## Related documentation

- [`ESSENTIALS.md`](ESSENTIALS.md) — architecture, data model, and the security
  rules you must not break
- [`../README.md`](../README.md) — project overview and quick start
