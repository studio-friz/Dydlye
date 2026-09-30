import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: CORS_HEADERS,
      });
    }

    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: CORS_HEADERS,
      });
    }

    const userId = user.id;

    // 1. Delete storage files across all user-owned buckets
    try {
      const buckets = ["property-images", "destination-images", "country-images"];
      for (const bucket of buckets) {
        try {
          const { data: files } = await client.storage.from(bucket).list(userId, { limit: 1000 });
          if (files && files.length > 0) {
            const paths = files.map((f) => `${userId}/${f.name}`);
            await client.storage.from(bucket).remove(paths);
          }
        } catch (e) {
          console.warn(`Storage cleanup error (${bucket}):`, e);
        }
      }
    } catch (e) {
      console.warn("Storage cleanup error:", e);
    }

    // 2. Delete comments (table may not exist)
    try {
      await client.from("comments").delete().eq("user_id", userId);
    } catch (e) {
      console.warn("Comments delete error:", e);
    }

    // 3. Delete favorites
    try {
      await client.from("favorites").delete().eq("user_id", userId);
    } catch (e) {
      console.warn("Favorites delete error:", e);
    }

    // 4. Delete bookings
    try {
      await client.from("bookings").delete().eq("user_id", userId);
    } catch (e) {
      console.warn("Bookings delete error:", e);
    }

    // 5. Delete profile — CASCADES to properties, favorites, bookings
    try {
      await client.from("profiles").delete().eq("id", userId);
    } catch (e) {
      console.warn("Profile delete error:", e);
    }

    // 6. Delete auth user (hard delete). If this fails, we report a generic
    // error so we never leak internal details about the auth subsystem.
    const { error: deleteError } = await client.auth.admin.deleteUser(userId, false);
    if (deleteError) {
      console.error("auth.admin.deleteUser failed", deleteError);
      return new Response(JSON.stringify({ error: "Could not delete the account" }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error("delete-account failed", err);
    return new Response(JSON.stringify({ error: "Could not delete the account" }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
});
