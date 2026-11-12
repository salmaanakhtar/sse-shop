import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env } from "@/lib/env";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 1600;

export type StoredImage = {
  storageKey: string;
  width: number;
  height: number;
};

export function uploadsRoot(): string {
  // The ignore comment keeps Turbopack from tracing the whole project into the
  // server bundle: the directory is data, not code.
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), env.UPLOADS_DIR);
}

export function isStorageKey(value: string): boolean {
  return /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/.test(value);
}

/**
 * Validate by decoding, not by the client-supplied name or MIME header: sharp
 * refuses anything it cannot read as an image. EXIF orientation is applied and
 * then stripped by re-encoding.
 */
export async function storeProductImage(file: File): Promise<StoredImage> {
  if (file.size === 0) throw new Error("Choose an image file.");
  if (file.size > MAX_BYTES) throw new Error("Images must be 10 MB or smaller.");

  const input = Buffer.from(await file.arrayBuffer());

  const metadata = await sharp(input).metadata().catch(() => null);
  if (!metadata?.format || !["jpeg", "png", "webp", "avif"].includes(metadata.format)) {
    throw new Error("Use a JPEG, PNG, WebP, or AVIF image.");
  }

  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const storageKey = `${year}/${month}/${randomUUID()}.webp`;

  const encoded = await sharp(input)
    .rotate()
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true })
    .catch(() => {
      // Never pass a decoder's internal message to the storefront admin.
      throw new Error("That image could not be read. Try exporting it again.");
    });

  const target = path.join(uploadsRoot(), storageKey);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, encoded.data);

  return {
    storageKey,
    width: encoded.info.width,
    height: encoded.info.height,
  };
}
