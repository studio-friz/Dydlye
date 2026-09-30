import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  is_host: boolean;
  host_active_until: string | null;
}

const localHostKey = (userId: string) => `Dydlye_is_host_${userId}`;

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const isHostLocal =
      typeof window !== "undefined" ? localStorage.getItem(localHostKey(userId)) === "true" : false;

    // Fresh host status from the server (RPC reads profiles + subscriptions).
    // Falls back to the local flag when offline / not configured.
    let isHost = isHostLocal;
    let hostActiveUntil: string | null = null;
    try {
      const { data, error } = await supabase.rpc("get_host_subscription_state");
      if (!error && data) {
        const parsed = typeof data === "string" ? JSON.parse(data) : data;
        isHost = parsed.is_host === true;
        hostActiveUntil = parsed.host_active_until ?? null;
      }
    } catch {
      // keep local value
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(localHostKey(userId), String(isHost));
    }

    setProfile({
      id: userId,
      full_name: null,
      avatar_url: null,
      phone: null,
      is_host: isHost,
      host_active_until: hostActiveUntil,
    });
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  /** Mark the user as host locally after a successful purchase. */
  const markHost = useCallback(
    (activeUntil: string | null): void => {
      if (!userId) return;
      if (typeof window !== "undefined") {
        localStorage.setItem(localHostKey(userId), "true");
      }
      setProfile((prev) =>
        prev
          ? { ...prev, is_host: true, host_active_until: activeUntil }
          : {
              id: userId,
              full_name: null,
              avatar_url: null,
              phone: null,
              is_host: true,
              host_active_until: activeUntil,
            },
      );
    },
    [userId],
  );

  const upgradeToHost = async (): Promise<void> => {
    if (!userId) throw new Error("Not authenticated");
    markHost(null);
  };

  return { profile, loading, refresh: fetchProfile, upgradeToHost, markHost };
}
