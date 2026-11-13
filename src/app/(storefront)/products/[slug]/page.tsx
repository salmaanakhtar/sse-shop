import Image from "next/image";
import { notFound } from "next/navigation";
import { ProductOptions } from "@/components/storefront/product-options";
import { getProductDetail } from "@/server/services/catalog";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductDetail(slug);

  if (!product) notFound();

  const hero = product.media[0];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="grid gap-10 md:grid-cols-2">
        <div className="space-y-4">
          <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-surface">
            {hero ? (
              <Image
                src={`/media/${hero.storageKey}`}
                alt={hero.alt || product.title}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted">
                No image yet
              </div>
            )}
          </div>

          {product.media.length > 1 ? (
            <div className="grid grid-cols-4 gap-3">
              {product.media.slice(1, 5).map((media) => (
                <div
                  key={media.storageKey}
                  className="relative aspect-square overflow-hidden rounded-lg border border-line bg-surface"
                >
                  <Image
                    src={`/media/${media.storageKey}`}
                    alt={media.alt || product.title}
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{product.title}</h1>
          {product.description ? (
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted">
              {product.description}
            </p>
          ) : null}

          <div className="mt-8">
            <ProductOptions options={product.options} nodes={product.nodes} />
          </div>
        </div>
      </div>
    </div>
  );
}
