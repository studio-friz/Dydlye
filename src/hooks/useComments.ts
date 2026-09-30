import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export interface Comment {
  id: string;
  property_id: string;
  user_id: string;
  user_name: string;
  text: string;
  rating: number;
  created_at: string;
}

type CommentInsert = Database["public"]["Tables"]["comments"]["Insert"];

export interface CommentResult {
  ok: boolean;
  rating: number | null;
  reviews: number | null;
}

export function useComments(propertyId: string | null) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (!error && data) {
        setComments(data.map(toComment));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const addComment = useCallback(
    async (text: string, rating: number = 0): Promise<CommentResult> => {
      if (!propertyId || !text.trim()) return { ok: false, rating: null, reviews: null };
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return { ok: false, rating: null, reviews: null };

      // user_name is derived server-side from the profile row by the
      // comments_set_author trigger, and the column grant does not even allow
      // the client to write it (M-03).
      const payload: CommentInsert = {
        property_id: propertyId,
        user_id: user.user.id,
        text: text.trim(),
      };
      if (rating > 0) payload.rating = rating;

      const { data, error } = await supabase.from("comments").insert(payload).select().single();
      if (error) {
        console.error("Error adding comment:", error);
        return { ok: false, rating: null, reviews: null };
      }
      setComments((prev) => [toComment(data), ...prev]);

      // The aggregate is maintained by the comments_rating_trg trigger. The
      // client only reads the result back; it can no longer push its own
      // running average (M-02).
      const stats = rating > 0 ? await readPropertyRating(propertyId) : null;
      return stats
        ? { ok: true, rating: stats.rating, reviews: stats.reviews }
        : { ok: true, rating: null, reviews: null };
    },
    [propertyId],
  );

  async function readPropertyRating(propertyId: string) {
    try {
      const { data: prop } = await supabase
        .from("properties")
        .select("rating, reviews")
        .eq("id", propertyId)
        .single();
      if (prop) {
        return {
          rating: Number(prop.rating || 0),
          reviews: Number(prop.reviews || 0),
        };
      }
    } catch (e) {
      console.error("Failed to read property rating:", e);
    }
    return null;
  }

  const deleteComment = useCallback(
    async (commentId: string): Promise<CommentResult> => {
      if (!propertyId) return { ok: false, rating: null, reviews: null };
      const { error } = await supabase.from("comments").delete().eq("id", commentId);
      if (error) {
        console.error("Error deleting comment:", error);
        return { ok: false, rating: null, reviews: null };
      }
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      // Recalculation happens in the trigger, not here.
      const stats = await readPropertyRating(propertyId);
      return stats
        ? { ok: true, rating: stats.rating, reviews: stats.reviews }
        : { ok: true, rating: null, reviews: null };
    },
    [propertyId],
  );

  return { comments, loading, addComment, deleteComment };
}

function toComment(row: Database["public"]["Tables"]["comments"]["Row"]): Comment {
  return { ...row, rating: row.rating ?? 0 };
}
