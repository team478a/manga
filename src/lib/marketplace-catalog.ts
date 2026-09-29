import type { MarketplaceCheckoutAvailability } from "./checkout-mode.ts";

export type MarketplaceCatalogProduct = {
  price: number;
  status: string;
};

export type MarketplaceCatalogSale = {
  label: "テスト販売中" | "限定販売中" | "商品あり";
  lowestPrice: number;
  productCount: number;
};

export function summarizeMarketplaceCatalogSale(
  products: MarketplaceCatalogProduct[] | null | undefined,
  checkout: Pick<MarketplaceCheckoutAvailability, "enabled" | "paymentMode">,
): MarketplaceCatalogSale | null {
  const activeProducts = (products ?? []).filter(
    (product) =>
      product.status === "active" &&
      Number.isFinite(product.price) &&
      product.price >= 0,
  );
  if (!activeProducts.length) return null;

  const label =
    checkout.enabled && checkout.paymentMode === "test"
      ? "テスト販売中"
      : checkout.enabled && checkout.paymentMode === "live"
        ? "限定販売中"
        : "商品あり";

  return {
    label,
    lowestPrice: Math.min(...activeProducts.map((product) => product.price)),
    productCount: activeProducts.length,
  };
}
