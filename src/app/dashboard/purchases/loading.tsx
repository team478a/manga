import { MarketplaceLoadingState } from "@/components/marketplace/MarketplaceLoadingState";

export default function PurchasesLoading() {
  return <MarketplaceLoadingState cardCount={4} title="本棚を読み込んでいます" />;
}
