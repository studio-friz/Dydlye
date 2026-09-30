// ============================================================================
// Dydlye — admin-api  (fixes C-01: the service_role key must never reach a
// browser).
//
// The admin panel used to hold `VITE_SUPABASE_SERVICE_ROLE_KEY` in client
// JavaScript and had no authentication at all, so anybody who loaded the page
// could read the key and bypass every RLS policy in the database.
//
// This function is the only place the service_role key is used. Every call must
// carry the Supabase access token of a signed-in user, and that user id must
// appear in public.admins. Only then is the request executed.
//
// Deploy:  supabase functions deploy admin-api
// Secrets:  SUPABASE_SERVICE_ROLE_KEY (already set), ADMIN_ALLOWED_ORIGINS
// ============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Comma-separated list of origins allowed to call this function.
// Falls back to the mobile app's custom scheme, which cannot be used by a
// web page, so the default is safe for native-only use.
const ALLOWED_ORIGINS = (Deno.env.get("ADMIN_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const JSON_HEADERS = { "Content-Type": "application/json" };

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  if (ALLOWED_ORIGINS.length === 0) return {};
  if (!ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(req) },
  });
}

function fail(req: Request, status: number, error: string, extra: Record<string, unknown> = {}) {
  return json(req, { ok: false, error, ...extra }, status);
}

// ---------------------------------------------------------------------------
// Admin identity
// ---------------------------------------------------------------------------
async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Missing or malformed Authorization header", status: 401 } as const;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return { error: "Missing token", status: 401 } as const;
  }

  // service_role client is only used to *verify* the caller; the caller's own
  // identity comes from the token, never from the request body.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    return { error: "Invalid or expired session", status: 401 } as const;
  }

  const { data: adminRow, error: adminErr } = await admin
    .from("admins")
    .select("user_id, email")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (adminErr) {
    console.error("admins lookup failed", adminErr);
    return { error: "Authorization check failed", status: 500 } as const;
  }

  if (!adminRow) {
    return { error: "Administrator access required", status: 403 } as const;
  }

  return { client: admin, user: data.user, adminRow } as const;
}

// ---------------------------------------------------------------------------
// Input validation helpers
// ---------------------------------------------------------------------------
function str(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length === 0 || t.length > max) return null;
  return t;
}

function uuid(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null;
}

function uuidArray(v: unknown, max = 500): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, max)
    .map(uuid)
    .filter((x): x is string => x !== null);
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Only allow these destination categories (mirrors the CHECK constraint). */
const DESTINATION_CATEGORIES = [
  "مسبح",
  "معلم سياحي",
  "مقهى",
  "مطعم",
  "حفلة",
  "تسوق",
  "طبيعة",
  "ترفيه",
  "شاطئ",
  "رياضة",
  "حمام تقليدي",
  "شلالات",
];

/** Buckets the admin panel may write to. */
const ADMIN_BUCKETS = ["destination-images", "country-images", "property-images"] as const;

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return fail(req, 405, "Method not allowed");
  }

  const auth = await requireAdmin(req);
  if ("error" in auth) return fail(req, auth.status, auth.error);
  const db = auth.client;

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 2_000_000) return fail(req, 413, "Payload too large");
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return fail(req, 400, "Invalid JSON body");
  }

  const action = str(body.action, 64);
  if (!action) return fail(req, 400, "Missing action");

  try {
    switch (action) {
      // ---------------------------------------------------------------------
      case "whoami":
        return json(req, {
          ok: true,
          user: { id: auth.user.id, email: auth.adminRow.email ?? auth.user.email },
        });

      // ---------------------------------------------------------------------
      case "stats": {
        const [properties, destinations, profiles, comments, bookings, favorites] =
          await Promise.all([
            db.from("properties").select("id", { count: "exact", head: true }),
            db.from("destinations").select("id", { count: "exact", head: true }),
            db.from("profiles").select("id", { count: "exact", head: true }),
            db.from("comments").select("id", { count: "exact", head: true }),
            db.from("bookings").select("id", { count: "exact", head: true }),
            db.from("favorites").select("user_id", { count: "exact", head: true }),
          ]);

        const [propCities, destMeta, profileFlags, commentUsers, propOwners] = await Promise.all([
          db.from("properties").select("city"),
          db.from("destinations").select("category, city"),
          db.from("profiles").select("id, is_host, blocked"),
          db.from("comments").select("user_id"),
          db.from("properties").select("owner_id"),
        ]);

        const tally = <T extends Record<string, unknown>>(
          rows: T[] | null,
          key: keyof T,
        ): Record<string, number> => {
          const out: Record<string, number> = {};
          for (const r of rows ?? []) {
            const v = r[key];
            if (typeof v !== "string" || !v) continue;
            out[v] = (out[v] ?? 0) + 1;
          }
          return out;
        };

        const hosts = (profileFlags.data ?? []).filter((p) => p.is_host).length;
        const blocked = (profileFlags.data ?? []).filter((p) => p.blocked).length;
        const activeOwners = new Set(
          (propOwners.data ?? [])
            .map((p) => p.owner_id)
            .filter((x): x is string => typeof x === "string"),
        );
        const commenters = new Set(
          (commentUsers.data ?? [])
            .map((c) => c.user_id)
            .filter((x): x is string => typeof x === "string"),
        );
        // "Active" = anyone who has listed a property or left a comment.
        const activeUsers = new Set([...activeOwners, ...commenters]);

        const propertiesByCity = tally(propCities.data, "city");
        const destinationsByCategory = tally(destMeta.data, "category");
        const destinationsByCity = tally(destMeta.data, "city");
        const cities = new Set([
          ...Object.keys(propertiesByCity),
          ...Object.keys(destinationsByCity),
        ]).size;

        return json(req, {
          ok: true,
          counts: {
            properties: properties.count ?? 0,
            destinations: destinations.count ?? 0,
            profiles: profiles.count ?? 0,
            comments: comments.count ?? 0,
            bookings: bookings.count ?? 0,
            favorites: favorites.count ?? 0,
            hosts,
            blocked,
            cities,
            owners: activeOwners.size,
            activeUsers: activeUsers.size,
          },
          propertiesByCity,
          destinationsByCategory,
          destinationsByCity,
        });
      }

      // ---------------------------------------------------------------------
      case "users.list": {
        const { data, error } = await db
          .from("profiles")
          .select("id, full_name, avatar_url, phone, is_host, blocked, updated_at")
          .order("updated_at", { ascending: false })
          .limit(2000);
        if (error) throw error;
        return json(req, { ok: true, data });
      }

      case "users.setBlocked": {
        const userId = uuid(body.userId);
        if (!userId) return fail(req, 400, "Invalid userId");
        const blocked = body.blocked === true;
        const { error } = await db.from("profiles").update({ blocked }).eq("id", userId);
        if (error) throw error;
        return json(req, { ok: true, blocked });
      }

      // Cascades the deletion of every property owned by a user, together with
      // their reports, comments and stored images. Runs server-side so a
      // partially-completed cleanup can never be triggered from the browser.
      case "users.blockDeep": {
        const userId = uuid(body.userId);
        if (!userId) return fail(req, 400, "Invalid userId");

        const { data: props, error: pErr } = await db
          .from("properties")
          .select("id, images")
          .eq("owner_id", userId);
        if (pErr) throw pErr;

        const ids = (props ?? []).map((p) => p.id as string);
        if (ids.length > 0) {
          const r1 = await db.from("property_reports").delete().in("property_id", ids);
          if (r1.error) throw r1.error;
          const r2 = await db.from("comments").delete().in("property_id", ids);
          if (r2.error) throw r2.error;
          const r3 = await db.from("properties").delete().in("id", ids);
          if (r3.error) throw r3.error;
        }

        const paths: string[] = [];
        for (const p of props ?? []) {
          for (const url of (p.images as string[] | null) ?? []) {
            if (typeof url !== "string") continue;
            const marker = "/property-images/";
            const i = url.indexOf(marker);
            if (i >= 0) paths.push(url.slice(i + marker.length));
          }
        }
        if (paths.length > 0) {
          const rm = await db.storage.from("property-images").remove(paths.slice(0, 1000));
          if (rm.error) console.warn("storage cleanup", rm.error.message);
        }

        const { error: bErr } = await db
          .from("profiles")
          .update({ blocked: true })
          .eq("id", userId);
        if (bErr) throw bErr;

        return json(req, { ok: true, blocked: true, deleted: ids.length });
      }

      // ---------------------------------------------------------------------
      case "properties.list": {
        const [props, reports] = await Promise.all([
          db
            .from("properties")
            .select(
              "id, title, city, location, price, type, images, owner_id, created_at, owner:profiles!properties_owner_id_fkey(full_name, avatar_url, phone)",
            )
            .order("created_at", { ascending: false })
            .limit(2000),
          db.from("property_reports").select("property_id"),
        ]);
        if (props.error) throw props.error;
        const reportCounts: Record<string, number> = {};
        for (const r of reports.data ?? []) {
          if (typeof r.property_id === "string") {
            reportCounts[r.property_id] = (reportCounts[r.property_id] ?? 0) + 1;
          }
        }
        return json(req, { ok: true, data: props.data, reportCounts });
      }

      case "properties.get": {
        const id = uuid(body.id);
        if (!id) return fail(req, 400, "Invalid id");
        const { data, error } = await db.from("properties").select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        return json(req, { ok: true, data });
      }

      case "properties.save": {
        const id = uuid(body.id);
        const title = str(body.title, 300);
        const price = num(body.price);
        const city = str(body.city, 200);
        const location = str(body.location, 300);
        if (!title || price === null || price < 0 || !city || !location) {
          return fail(req, 400, "title, price (>=0), city and location are required");
        }

        // Whitelisted columns only: rating, reviews, owner_id and created_at
        // are never accepted from a client.
        const payload: Record<string, unknown> = {
          title,
          price,
          city,
          location,
          description: str(body.description, 8000),
          type: str(body.type, 40),
          bedrooms: num(body.bedrooms) ?? 1,
          bathrooms: num(body.bathrooms) ?? 1,
          area: num(body.area),
          images: Array.isArray(body.images)
            ? body.images.filter((x) => typeof x === "string").slice(0, 30)
            : [],
          features: Array.isArray(body.features)
            ? body.features.filter((x) => typeof x === "string").slice(0, 60)
            : [],
          lat: num(body.lat),
          lng: num(body.lng),
          phone: str(body.phone, 60),
        };

        if (id) {
          const { data, error } = await db
            .from("properties")
            .update(payload)
            .eq("id", id)
            .select()
            .maybeSingle();
          if (error) throw error;
          return json(req, { ok: true, data });
        }
        const { data, error } = await db.from("properties").insert(payload).select().maybeSingle();
        if (error) throw error;
        return json(req, { ok: true, data });
      }

      case "properties.delete": {
        const ids = uuidArray(body.ids ?? (body.id ? [body.id] : []));
        if (ids.length === 0) return fail(req, 400, "No valid ids supplied");
        const { data, error } = await db
          .from("properties")
          .delete()
          .in("id", ids)
          .select("id, images");
        if (error) throw error;

        // Remove the orphaned images from storage, best effort.
        const paths: string[] = [];
        for (const p of data ?? []) {
          for (const url of (p.images as string[] | null) ?? []) {
            if (typeof url !== "string") continue;
            const marker = "/property-images/";
            const i = url.indexOf(marker);
            if (i >= 0) paths.push(url.slice(i + marker.length));
          }
        }
        if (paths.length > 0) {
          const r = await db.storage.from("property-images").remove(paths.slice(0, 1000));
          if (r.error) console.warn("storage cleanup", r.error.message);
        }
        return json(req, { ok: true, deleted: (data ?? []).length });
      }

      // Same cascade as above but explicit, so the panel never deletes rows in
      // an order that would leave orphaned reports or comments behind.
      case "properties.deleteDeep": {
        const ids = uuidArray(body.ids ?? (body.id ? [body.id] : []));
        if (ids.length === 0) return fail(req, 400, "No valid ids supplied");

        const { data: props, error: pErr } = await db
          .from("properties")
          .select("id, images")
          .in("id", ids);
        if (pErr) throw pErr;

        const r1 = await db.from("property_reports").delete().in("property_id", ids);
        if (r1.error) throw r1.error;
        const r2 = await db.from("comments").delete().in("property_id", ids);
        if (r2.error) throw r2.error;
        const r3 = await db.from("properties").delete().in("id", ids);
        if (r3.error) throw r3.error;

        const paths: string[] = [];
        for (const p of props ?? []) {
          for (const url of (p.images as string[] | null) ?? []) {
            if (typeof url !== "string") continue;
            const marker = "/property-images/";
            const i = url.indexOf(marker);
            if (i >= 0) paths.push(url.slice(i + marker.length));
          }
        }
        if (paths.length > 0) {
          const rm = await db.storage.from("property-images").remove(paths.slice(0, 1000));
          if (rm.error) console.warn("storage cleanup", rm.error.message);
        }

        return json(req, { ok: true, deleted: (props ?? []).length });
      }

      // ---------------------------------------------------------------------
      case "destinations.list": {
        const [dest, countries] = await Promise.all([
          db.from("destinations").select("*").order("sort_order", { ascending: true }),
          db.from("countries").select("*").order("name", { ascending: true }),
        ]);
        if (dest.error) throw dest.error;
        if (countries.error) throw countries.error;
        return json(req, { ok: true, destinations: dest.data, countries: countries.data });
      }

      case "destinations.get": {
        const id = uuid(body.id);
        if (!id) return fail(req, 400, "Invalid id");
        const { data, error } = await db
          .from("destinations")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return json(req, { ok: true, data });
      }

      case "destinations.save": {
        const id = uuid(body.id);
        const name = str(body.name, 300);
        const category = str(body.category, 60);
        const city = str(body.city, 200);
        const lat = num(body.lat);
        const lng = num(body.lng);

        if (!name || !category || !city || lat === null || lng === null) {
          return fail(req, 400, "name, category, city, lat and lng are required");
        }
        if (!DESTINATION_CATEGORIES.includes(category)) {
          return fail(req, 400, "Unknown category");
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return fail(req, 400, "Coordinates out of range");
        }

        const payload: Record<string, unknown> = {
          name,
          category,
          city,
          lat,
          lng,
          description: str(body.description, 8000),
          location: str(body.location, 300),
          images: Array.isArray(body.images)
            ? body.images.filter((x) => typeof x === "string").slice(0, 30)
            : [],
          phone: str(body.phone, 60),
          opening_hours: str(body.opening_hours, 300),
          country: str(body.country, 120),
          // destinations have no comment-driven aggregate, so the panel may
          // set the display rating directly.
          rating: num(body.rating),
          sort_order: num(body.sort_order) ?? 0,
        };

        if (id) {
          const { data, error } = await db
            .from("destinations")
            .update(payload)
            .eq("id", id)
            .select()
            .maybeSingle();
          if (error) throw error;
          return json(req, { ok: true, data });
        }
        const { data, error } = await db
          .from("destinations")
          .insert(payload)
          .select()
          .maybeSingle();
        if (error) throw error;
        return json(req, { ok: true, data });
      }

      case "destinations.delete": {
        const id = uuid(body.id);
        if (!id) return fail(req, 400, "Invalid id");
        const { error } = await db.from("destinations").delete().eq("id", id);
        if (error) throw error;
        return json(req, { ok: true });
      }

      case "destinations.reorder": {
        const order = Array.isArray(body.order) ? body.order : [];
        const cleaned = order
          .map((o) => ({
            id: uuid((o as Record<string, unknown>)?.id),
            sort: num((o as Record<string, unknown>)?.sort),
          }))
          .filter((o): o is { id: string; sort: number } => o.id !== null && o.sort !== null)
          .slice(0, 1000);
        if (cleaned.length === 0) return fail(req, 400, "Empty order");

        const results = await Promise.all(
          cleaned.map((o) => db.from("destinations").update({ sort_order: o.sort }).eq("id", o.id)),
        );
        const bad = results.find((r) => r.error);
        if (bad?.error) throw bad.error;
        return json(req, { ok: true, updated: cleaned.length });
      }

      case "destinations.assignCountry": {
        const id = uuid(body.id);
        if (!id) return fail(req, 400, "Invalid id");
        const country = str(body.country, 120);
        const sortOrder = num(body.sortOrder) ?? 0;
        const { error } = await db
          .from("destinations")
          .update({ country, sort_order: sortOrder })
          .eq("id", id);
        if (error) throw error;
        return json(req, { ok: true });
      }

      case "destinations.detachCountry": {
        const id = uuid(body.id);
        if (!id) return fail(req, 400, "Invalid id");
        const { error } = await db
          .from("destinations")
          .update({ country: null, sort_order: 0 })
          .eq("id", id);
        if (error) throw error;
        return json(req, { ok: true });
      }

      case "countries.save": {
        const name = str(body.name, 120);
        if (!name) return fail(req, 400, "Invalid country name");
        const image = str(body.image, 1000);
        const { error } = await db
          .from("countries")
          .upsert({ name, image }, { onConflict: "name" });
        if (error) throw error;
        return json(req, { ok: true });
      }

      case "countries.delete": {
        const name = str(body.name, 120);
        if (!name) return fail(req, 400, "Invalid country name");
        const { error: e1 } = await db
          .from("destinations")
          .update({ country: null, sort_order: 0 })
          .eq("country", name);
        if (e1) throw e1;
        const { error: e2 } = await db.from("countries").delete().eq("name", name);
        if (e2) throw e2;
        return json(req, { ok: true });
      }

      // ---------------------------------------------------------------------
      case "reports.list": {
        const { data, error } = await db
          .from("property_reports")
          .select(
            "id, property_id, reporter_id, reason, details, status, created_at, " +
              "property:properties!property_reports_property_id_fkey(title, owner_id, owner:profiles!properties_owner_id_fkey(full_name)), " +
              "reporter:profiles!property_reports_reporter_id_fkey(full_name, avatar_url, phone)",
          )
          .order("created_at", { ascending: false })
          .limit(2000);
        if (error) throw error;
        return json(req, { ok: true, data });
      }

      case "reports.setStatus": {
        const id = uuid(body.id);
        const status = str(body.status, 20);
        if (!id || !status || !["new", "reviewed", "resolved"].includes(status)) {
          return fail(req, 400, "Invalid id or status");
        }
        const { error } = await db.from("property_reports").update({ status }).eq("id", id);
        if (error) throw error;
        return json(req, { ok: true, status });
      }

      case "reports.delete": {
        const id = uuid(body.id);
        if (!id) return fail(req, 400, "Invalid id");
        const { error } = await db.from("property_reports").delete().eq("id", id);
        if (error) throw error;
        return json(req, { ok: true });
      }

      // ---------------------------------------------------------------------
      case "promo.list": {
        const { data, error } = await db
          .from("promo_codes")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json(req, { ok: true, data });
      }

      case "promo.get": {
        const id = uuid(body.id);
        if (!id) return fail(req, 400, "Invalid id");
        const { data, error } = await db.from("promo_codes").select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        if (!data) return fail(req, 404, "Not found");
        return json(req, { ok: true, data });
      }

      case "promo.save": {
        const id = uuid(body.id);
        const code = str(body.code, 64)?.toUpperCase();
        const discount = num(body.discount_percent);
        if (!code || !/^[A-Z0-9_-]{3,64}$/.test(code)) {
          return fail(req, 400, "Code must be 3-64 chars of A-Z, 0-9, _ or -");
        }
        if (discount === null || discount < 0 || discount > 100) {
          return fail(req, 400, "discount_percent must be between 0 and 100");
        }
        const maxUses =
          body.max_uses === null || body.max_uses === undefined ? null : num(body.max_uses);
        if (maxUses !== null && (maxUses < 1 || !Number.isInteger(maxUses))) {
          return fail(req, 400, "max_uses must be a positive integer or null");
        }

        const payload: Record<string, unknown> = {
          code,
          discount_percent: Math.round(discount),
          description: str(body.description, 500),
          is_active: body.is_active !== false,
          max_uses: maxUses,
          expires_at: typeof body.expires_at === "string" ? body.expires_at : null,
        };

        if (id) {
          const { data, error } = await db
            .from("promo_codes")
            .update(payload)
            .eq("id", id)
            .select()
            .maybeSingle();
          if (error) throw error;
          return json(req, { ok: true, data });
        }
        const { data, error } = await db.from("promo_codes").insert(payload).select().maybeSingle();
        if (error) throw error;
        return json(req, { ok: true, data });
      }

      case "promo.setActive": {
        const id = uuid(body.id);
        if (!id) return fail(req, 400, "Invalid id");
        const { error } = await db
          .from("promo_codes")
          .update({ is_active: body.is_active === true })
          .eq("id", id);
        if (error) throw error;
        return json(req, { ok: true });
      }

      case "promo.delete": {
        const id = uuid(body.id);
        if (!id) return fail(req, 400, "Invalid id");
        const { error } = await db.from("promo_codes").delete().eq("id", id);
        if (error) throw error;
        return json(req, { ok: true });
      }

      // ---------------------------------------------------------------------
      // Product prices (M-06). These are the authoritative prices used by
      // redeem_promo_code(); the client only ever sends a product id. Writes
      // therefore have to go through the service role here, which is why the
      // table's own RLS deliberately grants SELECT only.
      case "prices.list": {
        const { data, error } = await db
          .from("product_prices")
          .select("product_id, price, currency, is_active, updated_at")
          .order("product_id", { ascending: true });
        if (error) throw error;
        return json(req, { ok: true, data });
      }

      case "prices.save": {
        const productId = str(body.product_id, 64);
        if (!productId) return fail(req, 400, "Invalid product_id");
        const price = Number(body.price);
        if (!Number.isFinite(price) || price < 0 || price > 10_000_000) {
          return fail(req, 400, "Invalid price");
        }
        const currency = (str(body.currency, 8) || "XOF").toUpperCase();
        const row = {
          product_id: productId,
          price,
          currency,
          is_active: body.is_active !== false,
          updated_at: new Date().toISOString(),
        };
        const { data, error } = await db
          .from("product_prices")
          .upsert(row, { onConflict: "product_id" })
          .select("product_id, price, currency, is_active, updated_at")
          .single();
        if (error) throw error;
        return json(req, { ok: true, data });
      }

      // ---------------------------------------------------------------------
      // Storage: the panel uploads through short-lived signed tokens issued
      // here, so the service_role key itself is never involved client-side.
      case "storage.signedUpload": {
        const bucket = str(body.bucket, 64);
        if (!bucket || !(ADMIN_BUCKETS as readonly string[]).includes(bucket)) {
          return fail(req, 400, "Unsupported bucket");
        }
        const name = str(body.name, 200);
        if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
          return fail(req, 400, "Invalid object name");
        }
        const { data, error } = await db.storage.from(bucket).createSignedUploadUrl(name);
        if (error) throw error;
        return json(req, { ok: true, token: data.token, path: data.path });
      }

      case "storage.remove": {
        const bucket = str(body.bucket, 64);
        if (!bucket || !(ADMIN_BUCKETS as readonly string[]).includes(bucket)) {
          return fail(req, 400, "Unsupported bucket");
        }
        const paths = Array.isArray(body.paths)
          ? body.paths
              .filter((p): p is string => typeof p === "string" && !p.includes(".."))
              .slice(0, 1000)
          : [];
        if (paths.length === 0) return fail(req, 400, "No paths supplied");
        const { error } = await db.storage.from(bucket).remove(paths);
        if (error) throw error;
        return json(req, { ok: true, removed: paths.length });
      }

      default:
        return fail(req, 400, `Unknown action: ${action}`);
    }
  } catch (err) {
    // Do not leak raw Postgres / storage internals to the browser.
    console.error(`admin-api ${action} failed`, err);
    return fail(req, 500, "The operation could not be completed");
  }
});
