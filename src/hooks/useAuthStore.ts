import { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { GoogleAuth } from "@southdevs/capacitor-google-auth";
import { supabase } from "@/integrations/supabase/client";

/**
 * The Supabase client already persists the session (see client.ts, pkce flow),
 * so this module used to keep a SECOND plaintext copy under a custom
 * localStorage key and, worse, treated that unverified copy as a valid session
 * before the library had confirmed it. Any script able to run in the WebView
 * could therefore read a refresh token straight out of localStorage, and a
 * stale copy could keep the UI in a signed-in state after a server-side
 * revocation.
 *
 * The cached-token path is gone: the session state now comes only from the
 * library, after it has validated the stored session.
 */

let session: Session | null = null;
let loading = false;
let initialized = false;
const listeners = new Set<(state: { session: Session | null; loading: boolean }) => void>();

export function getAuthState() {
  if (!initialized && typeof window !== "undefined") {
    initialized = true;
    loading = true;

    try {
      supabase.auth.onAuthStateChange((event: AuthChangeEvent, s: Session | null) => {
        if (event === "SIGNED_OUT") {
          session = null;
        } else {
          session = s;
        }
        loading = false;
        broadcast();
      });

      // The library restores and validates its own persisted session here.
      supabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (error) {
            console.warn("[auth] session could not be restored:", error.message);
            session = null;
          } else {
            session = data?.session ?? null;
          }
        })
        .catch((e: unknown) => {
          console.warn("[auth] session restore failed:", e);
          session = null;
        })
        .finally(() => {
          loading = false;
          broadcast();
        });
    } catch {
      session = null;
      loading = false;
      broadcast();
    }
  }
  return { session, loading };
}

function broadcast() {
  listeners.forEach((l) => {
    try {
      l({ session, loading });
    } catch {
      /* ignore */
    }
  });
}

export function subscribeAuth(
  callback: (state: { session: Session | null; loading: boolean }) => void,
) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export const signOut = async () => {
  session = null;
  broadcast();
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignore */
  }
  try {
    // Reset the native Google session so the account chooser shows again next login.
    await GoogleAuth.signOut();
  } catch {
    /* ignore */
  }
};
