import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const MISSING_URL =
  "VITE_SUPABASE_URL is missing from .env.\n\n" +
  "Copy admin/.env.example to admin/.env and paste your project URL\n" +
  "(Dashboard > Project Settings > API).";

const MISSING_KEY =
  "VITE_SUPABASE_PUBLISHABLE_KEY is missing from .env.\n\n" +
  "Copy admin/.env.example to admin/.env and paste the publishable key\n" +
  "(Dashboard > Project Settings > API Keys).\n\n" +
  "The panel only ever uses the publishable key. It never needs the\n" +
  'service_role key: that one lives in the "admin-api" Edge Function.';

/**
 * Rejects the service_role key if somebody pastes it here by mistake.
 *
 * Anything prefixed with VITE_ is inlined into the public JavaScript bundle, so
 * a service_role key in this file would hand every visitor full read/write
 * access to the database. The check turns that mistake into a readable message
 * instead of a silent security hole.
 */
function keyProblem(key: string): string | null {
  if (!key.startsWith("eyJ")) return null; // new-style sb_publishable_... key
  const payload = key.split(".")[1];
  if (!payload) return `${MISSING_KEY}\n\n(The key looks truncated.)`;
  try {
    const role = (
      JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
        role?: string;
      }
    ).role;
    if (role !== "service_role") return null;
    return (
      'VITE_SUPABASE_PUBLISHABLE_KEY has role "service_role".\n\n' +
      "Never put that key in this file: VITE_ variables are shipped to every\n" +
      "browser, and the service_role key bypasses all row-level security.\n\n" +
      'Use the publishable key ("anon" role) instead. The privileged work is\n' +
      "done server-side by the admin-api Edge Function."
    );
  } catch {
    return `${MISSING_KEY}\n\n(The key could not be decoded — check for copy/paste errors.)`;
  }
}

/** Non-null when the panel is not configured; App shows it instead of the UI. */
export const configError: string | null = !url
  ? MISSING_URL
  : !publishableKey
    ? MISSING_KEY
    : keyProblem(publishableKey);

/**
 * Ordinary user client: publishable/anon key, so every read and write is
 * filtered by the RLS policies in the database.
 *
 * The panel holds no privileged key. It signs the admin in with Supabase Auth
 * and then talks exclusively to the `admin-api` Edge Function, which keeps the
 * service_role key on the server and re-checks that the caller is listed in
 * `public.admins` before touching anything.
 *
 * See ./adminApi.ts for the request layer and ../../docs/SUPABASE.md for setup.
 */
export const supabase: SupabaseClient = createClient(
  url ?? "http://localhost:54321",
  publishableKey ?? "unconfigured",
  {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);

export async function currentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
