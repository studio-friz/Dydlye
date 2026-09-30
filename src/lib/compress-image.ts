/**
 * Client-side image compression utility.
 *
 * Resizes and re-encodes images using an OffscreenCanvas (or regular canvas)
 * before they are uploaded to Supabase Storage, drastically reducing file size.
 *
 * Default settings target very aggressive compression:
 *   - Max dimension: 1200px (long edge)
 *   - Quality: 0.6 (WebP) — visually decent for property listings
 *   - Output format: WebP (best size-to-quality ratio; JPEG fallback)
 */

interface CompressOptions {
  /** Maximum width or height in pixels. Default 1200. */
  maxDimension?: number;
  /** Output quality 0-1. Default 0.6. */
  quality?: number;
  /** Preferred MIME type. Default "image/webp". */
  type?: "image/webp" | "image/jpeg";
}

/**
 * Compress a single image File and return a new, smaller File.
 */
export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const { maxDimension = 1200, quality = 0.6, type = "image/webp" } = opts;

  // 1. Decode the image into an ImageBitmap (works in Web Workers too)
  const bitmap = await createImageBitmap(file);

  // 2. Calculate new dimensions keeping aspect ratio
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

  // 3. Draw onto a canvas at the target size
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // 4. Export to blob
  const blob: Blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b!), type, quality);
  });

  // 5. Determine the correct file extension
  const ext = type === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "");
  const newName = `${baseName}.${ext}`;

  return new File([blob], newName, { type });
}

/**
 * Compress an array of image Files in parallel.
 */
export async function compressImages(files: File[], opts?: CompressOptions): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, opts)));
}
