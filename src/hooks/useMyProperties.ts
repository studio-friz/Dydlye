import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { House } from "@/data/houses";

/**
 * Fetches properties owned by a specific user.
 * Provides helpers to delete a property and refresh the list.
 */
export function useMyProperties(userId: string | undefined) {
  const [properties, setProperties] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProperties = useCallback(async () => {
    if (!userId) {
      setProperties([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading my properties:", error);
        setProperties([]);
        return;
      }

      if (data && data.length > 0) {
        const mapped: House[] = data.map((item) => ({
          id: String(item.id),
          title: item.title,
          location: item.location,
          city: item.city,
          price: Number(item.price),
          bedrooms: Number(item.bedrooms),
          bathrooms: Number(item.bathrooms),
          area: Number(item.area),
          type: item.type as House["type"],
          description: item.description || "",
          features: item.features || [],
          rating: Number(item.rating || 0),
          reviews: Number(item.reviews || 0),
          lat: Number(item.lat),
          lng: Number(item.lng),
          images: item.images || [],
          phone: item.phone || "",
        }));
        setProperties(mapped);
      } else {
        setProperties([]);
      }
    } catch (err) {
      console.error("Failed to load my properties:", err);
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const deleteProperty = async (propertyId: string) => {
    const { error } = await supabase
      .from("properties")
      .delete()
      .eq("id", propertyId)
      .eq("owner_id", userId!);

    if (error) {
      console.error("Error deleting property:", error);
      throw error;
    }

    // Remove from local state immediately
    setProperties((prev) => prev.filter((p) => p.id !== propertyId));
  };

  return { properties, loading, refresh: fetchProperties, deleteProperty };
}
