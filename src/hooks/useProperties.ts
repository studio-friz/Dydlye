import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { House } from "@/data/houses";

const PAGE_SIZE = 20;

export function useProperties() {
  const [properties, setProperties] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const fetchProperties = useCallback(async (from: number, to: number) => {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    return (data ?? []) as House[];
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchProperties(0, PAGE_SIZE - 1)
      .then((data) => {
        if (cancelled) return;
        setProperties(data);
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch(() => {
        if (!cancelled) setProperties([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchProperties]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const from = properties.length;
      const to = from + PAGE_SIZE - 1;
      const data = await fetchProperties(from, to);
      setProperties((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      // keep existing data
    } finally {
      setLoadingMore(false);
    }
  }, [properties.length, fetchProperties]);

  const updateProperty = useCallback((id: string, patch: Partial<House>) => {
    setProperties((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  return { properties, loading, loadingMore, hasMore, loadMore, updateProperty };
}
