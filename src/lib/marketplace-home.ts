import { hasActiveMarketplaceCatalogProduct } from "./marketplace-catalog.ts";
import type { MarketplaceCatalogProduct } from "./marketplace-catalog.ts";
import type { Work } from "./types.ts";

export type MarketplaceHomeWork = Work & {
  digital_products: MarketplaceCatalogProduct[] | null;
};

export type MarketplaceHomeSections = {
  featured: MarketplaceHomeWork | null;
  highlighted: MarketplaceHomeWork[];
  newest: MarketplaceHomeWork[];
  previewable: MarketplaceHomeWork[];
  tags: string[];
};

export function hasMarketplacePreview(work: Work) {
  return Boolean(
    work.current_publication_id || work.sample_image_urls?.length,
  );
}

export function selectMarketplaceHomeSections(
  works: MarketplaceHomeWork[],
  limit = 5,
): MarketplaceHomeSections {
  const byNewest = (left: Work, right: Work) =>
    Date.parse(right.created_at) - Date.parse(left.created_at);
  const newest = [...works].sort(byNewest).slice(0, limit);
  const highlighted = works
    .filter((work) =>
      hasActiveMarketplaceCatalogProduct(work.digital_products),
    )
    .sort(byNewest)
    .slice(0, limit);
  const previewable = works
    .filter(hasMarketplacePreview)
    .sort(byNewest)
    .slice(0, limit);
  const tags = Array.from(
    new Set(
      works.flatMap((work) =>
        (work.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
      ),
    ),
  )
    .sort((left, right) => left.localeCompare(right, "ja"))
    .slice(0, 10);

  return {
    featured: highlighted[0] ?? newest[0] ?? null,
    highlighted,
    newest,
    previewable,
    tags,
  };
}
