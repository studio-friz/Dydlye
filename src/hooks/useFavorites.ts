import { useCallback, useEffect, useState } from "react";

const KEY = "dydlye:favorites";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

const listeners = new Set<(ids: string[]) => void>();

function broadcast(ids: string[]) {
  listeners.forEach((l) => l(ids));
}

export function useFavorites() {
  const [ids, setIds] = useState<string[]>(() => read());

  useEffect(() => {
    const l = (next: string[]) => setIds(next);
    listeners.add(l);
    setIds(read());
    return () => {
      listeners.delete(l);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const cur = read();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    window.localStorage.setItem(KEY, JSON.stringify(next));
    broadcast(next);
  }, []);

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, has, toggle };
}
