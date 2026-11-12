import { readFile } from "node:fs/promises";
import path from "node:path";
import { isStorageKey, uploadsRoot } from "@/server/media/storage";

/**
 * Product images are public by design, so this route only has to prevent path
 * traversal and serve with an immutable cache.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  const storageKey = key.join("/");

  if (!isStorageKey(storageKey)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const file = await readFile(path.join(uploadsRoot(), storageKey));
    return new Response(new Uint8Array(file), {
      headers: {
        "content-type": "image/webp",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
