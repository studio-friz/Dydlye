import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Destination, DestinationCategory } from "@/data/destinations";

type DestinationRow = Database["public"]["Tables"]["destinations"]["Row"];

function toDestination(row: DestinationRow): Destination {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    category: row.category as DestinationCategory,
    city: row.city,
    location: row.location ?? "",
    lat: Number(row.lat),
    lng: Number(row.lng),
    images: row.images ?? [],
    phone: row.phone ?? "",
    opening_hours: row.opening_hours ?? "",
    rating: Number(row.rating ?? 0),
    reviews: Number(row.reviews ?? 0),
  };
}

export function useDestinations() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("destinations")
        .select("*")
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (!error && data) {
        setDestinations((data as DestinationRow[]).map(toDestination));
      }
      setLoading(false);
    })();

    const channel = supabase
      .channel("destinations-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "destinations" },
        (payload) => {
          if (cancelled) return;
          setDestinations((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as DestinationRow;
              if (prev.some((d) => d.id === row.id)) return prev;
              return [...prev, toDestination(row)];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as DestinationRow;
              return prev.map((d) => (d.id === row.id ? toDestination(row) : d));
            }
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as DestinationRow;
              return prev.filter((d) => d.id !== oldRow.id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { destinations, loading };
}
