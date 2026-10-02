import { MarketplaceLoadingState } from "@/components/marketplace/MarketplaceLoadingState";

export default function WorkDetailLoading() {
  return (
    <MarketplaceLoadingState cardCount={3} title="作品情報を読み込んでいます" />
  );
}
