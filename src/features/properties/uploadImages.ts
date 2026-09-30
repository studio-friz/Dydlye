import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/compress-image";

const MAX_DIMENSION = 1200;
const QUALITY = 0.6;

export async function uploadPropertyImages(files: File[], userId: string): Promise<string[]> {
  const uploadedUrls: string[] = [];

  for (const file of files) {
    try {
      const compressed = await compressImage(file, {
        maxDimension: MAX_DIMENSION,
        quality: QUALITY,
        type: "image/webp",
      });

      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.webp`;

      const { error } = await supabase.storage
        .from("property-images")
        .upload(fileName, compressed, {
          contentType: "image/webp",
        });

      if (error) {
        console.error("Error uploading image:", error);
        continue;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("property-images").getPublicUrl(fileName);

      uploadedUrls.push(publicUrl);
    } catch (err) {
      console.error("Error processing image:", err);
    }
  }

  return uploadedUrls;
}
