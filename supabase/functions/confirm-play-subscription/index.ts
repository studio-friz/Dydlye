import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

/* ── Google OAuth2 JWT (RS256) + Play Developer API ─────────────── */

function strToBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

async function getGoogleAccessToken(): Promise<string> {
  const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  let pem = Deno.env.get("GOOGLE_PRIVATE_KEY") ?? "";

  if (!email || !pem) {
    throw new Error(
      "Missing Google service account env vars (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY)",
    );
  }

  if (pem.includes("\\n")) {
    pem = pem.replace(/\\n/g, "\n");
  }

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const signingInput =
    strToBase64Url(JSON.stringify(header)) + "." + strToBase64Url(JSON.stringify(claims));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );

  const assertion = signingInput + "." + bytesToBase64Url(new Uint8Array(signature));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      "grant_type=" +
      encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") +
      "&assertion=" +
      encodeURIComponent(assertion),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error("Google OAuth failed: " + JSON.stringify(data));
  }
  return data.access_token;
}

interface GoogleSubscription {
  startTimeMillis?: string;
  expiryTimeMillis?: string;
  autoRenewing?: boolean;
  priceCurrencyCode?: string;
  priceAmountMicros?: string;
  paymentState?: number;
  orderId?: string;
  cancelled?: boolean;
}

async function getPlaySubscription(
  accessToken: string,
  purchaseToken: string,
  productId: string,
): Promise<GoogleSubscription> {
  const packageName = Deno.env.get("ANDROID_APP_PACKAGE") ?? "com.dydlye.app";
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}` +
    `/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error("Google Play validation failed: " + JSON.stringify(data));
  }
  return data as GoogleSubscription;
}

/* ── Main server ────────────────────────────────────────────────── */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
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
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "confirm";

    if (action === "status") {
      const { data } = await client.rpc("get_host_subscription_state");
      return json({ success: true, state: data });
    }

    if (action === "confirm") {
      const purchaseToken = String(body.purchaseToken ?? "");
      const productId = String(body.productId ?? "");
      const planId = body.planId ? String(body.planId) : null;

      if (!purchaseToken || !productId) {
        return json({ error: "purchaseToken and productId are required" }, 400);
      }

      // H-05: the product id comes from the client, so it must be checked
      // against the products this app actually sells. Otherwise a caller could
      // point the function at any product id and have Play confirm it.
      const allowedProducts = (Deno.env.get("ALLOWED_PRODUCT_IDS") ?? "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      if (allowedProducts.length > 0 && !allowedProducts.includes(productId)) {
        return json({ error: "Unknown product" }, 400);
      }

      const accessToken = await getGoogleAccessToken();
      const sub = await getPlaySubscription(accessToken, purchaseToken, productId);

      const expiryMs = Number(sub.expiryTimeMillis ?? 0);
      // M-08: fail-CLOSED. Google omits paymentState in some responses, and
      // treating "unknown" as "paid" let a not-yet-settled purchase activate a
      // host account. Only an explicit 1 (paid) or 2 (free trial) is accepted;
      // 0 (pending), null and undefined are all rejected.
      const paymentReceived = sub.paymentState === 1 || sub.paymentState === 2;
      const isActive = expiryMs > Date.now() && paymentReceived && sub.cancelled !== true;

      if (!isActive) {
        return json(
          {
            success: false,
            error: "Subscription is not active on Google Play",
            paymentState: sub.paymentState,
            expiryMs,
          },
          400,
        );
      }

      const start = sub.startTimeMillis
        ? new Date(Number(sub.startTimeMillis)).toISOString()
        : null;
      const end = new Date(expiryMs).toISOString();

      // H-04: a purchase token is a bearer credential for Play. Before writing,
      // make sure it is not already bound to a different account, otherwise a
      // leaked token could be redeemed by anyone. The subscriptions_purchase_token_uniq
      // index is the backstop; this check turns the conflict into a clear error.
      const { data: existing, error: lookupError } = await client
        .from("subscriptions")
        .select("id, user_id")
        .eq("purchase_token", purchaseToken)
        .maybeSingle();

      if (lookupError) {
        console.error("purchase_token lookup failed", lookupError);
        return json({ error: "Could not verify the purchase" }, 500);
      }

      if (existing && existing.user_id !== user.id) {
        console.warn(`purchase_token already bound to another account (${existing.user_id})`);
        return json({ error: "This purchase is linked to another account" }, 409);
      }

      const { error: upsertError } = await client.from("subscriptions").upsert(
        {
          user_id: user.id,
          product_id: productId,
          platform: "google_play",
          purchase_token: purchaseToken,
          order_id: sub.orderId ?? null,
          plan_id: planId,
          status: "active",
          current_period_start: start,
          current_period_end: end,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,product_id" },
      );

      if (upsertError) {
        console.error("subscription upsert failed", upsertError);
        return json({ error: "Could not store the purchase" }, 500);
      }

      const { error: profileError } = await client
        .from("profiles")
        .update({ is_host: true, host_active_until: end })
        .eq("id", user.id);

      if (profileError) {
        console.error("profile update failed", profileError);
        return json({ error: "Could not activate the host account" }, 500);
      }

      return json({ success: true, is_active: true, expires_at: end });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    // Never leak Google/Supabase internals to the client.
    console.error("confirm-play-subscription failed", err);
    const message = err instanceof Error ? err.message : String(err);
    const clientSafe =
      /Google Play validation failed|Google OAuth failed|Missing Google service account/.test(
        message,
      )
        ? "Purchase verification is temporarily unavailable"
        : "Could not verify the purchase";
    return json({ error: clientSafe }, 500);
  }
});
