/**
 * Client-side image compression utility (same as the Dydlye app).
 * Resizes and re-encodes images to WebP before uploading to Supabase Storage.
 */

interface CompressOptions {
  maxDimension?: number;
  quality?: number;
  type?: "image/webp" | "image/jpeg";
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const { maxDimension = 1200, quality = 0.6, type = "image/webp" } = opts;

  const bitmap = await createImageBitmap(file);

  let { width, height } = bitmap;
  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      height = Math.round((height / width) * maxDimension);
      width = maxDimension;
    } else {
      width = Math.round((width / height) * maxDimension);
      height = maxDimension;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob: Blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b!), type, quality);
  });

  const ext = type === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.${ext}`, { type });
}

export async function compressImages(files: File[], opts?: CompressOptions): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, opts)));
}
