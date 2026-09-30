import { useEffect, useState } from "react";
import { getAuthState, subscribeAuth, signOut as storeSignOut } from "./useAuthStore";

export function useAuth() {
  const [state, setState] = useState(() => getAuthState());

  useEffect(() => {
    // Sync state immediately in case it changed between render and effect
    setState(getAuthState());
    const unsubscribe = subscribeAuth((next) => setState(next));
    return () => unsubscribe();
  }, []);

  return {
    session: state.session,
    user: state.session?.user ?? null,
    loading: state.loading,
    signOut: storeSignOut,
  };
}
