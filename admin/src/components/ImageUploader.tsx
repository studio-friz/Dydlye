import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { compressImages } from "@/lib/compress-image";
import { uploadImage } from "@/lib/adminApi";

interface ImageUploaderProps {
  bucket: string;
  images: string[];
  onChange: (images: string[]) => void;
}

export function ImageUploader({ bucket, images, onChange }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const urls: string[] = [];
    try {
      const compressed = await compressImages(Array.from(files));
      for (const file of compressed) {
        try {
          // Uploads go through a short-lived signed token issued by admin-api,
          // so no privileged key is ever present in the browser.
          urls.push(await uploadImage(bucket, file));
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "فشل رفع صورة");
        }
      }
      if (urls.length > 0) onChange([...images, ...urls]);
    } catch (err) {
      console.error("Image processing error:", err);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeImage = (url: string) => {
    onChange(images.filter((u) => u !== url));
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <div className="flex flex-wrap gap-3">
        {images.map((url) => (
          <div
            key={url}
            className="relative h-24 w-24 overflow-hidden rounded-2xl border border-border"
          >
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeImage(url)}
              className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ImagePlus className="h-5 w-5" />
          )}
          <span className="text-[10px] font-bold">{uploading ? "جاري الرفع..." : "إضافة صور"}</span>
        </button>
      </div>
    </div>
  );
}
