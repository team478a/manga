import { MarketplaceLoadingState } from "@/components/marketplace/MarketplaceLoadingState";

export default function FavoritesLoading() {
  return (
    <MarketplaceLoadingState cardCount={5} title="あとで読むを読み込んでいます" />
  );
}
