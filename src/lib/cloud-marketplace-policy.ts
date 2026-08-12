import { ValidationError } from "./domain-errors.ts";

export type CloudMarketplaceDraftState = {
  workStatus?: string | null;
  workIsPublic?: boolean | null;
  productStatus?: string | null;
};

export type CloudMarketplaceManuscriptReadiness = {
  ready: boolean;
  errorCount: number;
};

export function assertCloudMarketplaceManuscriptReady(
  readiness: CloudMarketplaceManuscriptReadiness,
) {
  if (!readiness.ready)
    throw new ValidationError(
      readiness.errorCount > 0
        ? `原稿チェックの要修正${readiness.errorCount}件を解消し、すべてのページを確定してください。`
        : "原稿チェックを完了し、すべてのページを確定してください。",
    );
  return readiness;
}

export function assertCloudMarketplaceDraftMutable(
  state: CloudMarketplaceDraftState,
) {
  if (state.workIsPublic || state.workStatus === "published")
    throw new Error(
      "公開中の作品は自動更新できません。作品管理で非公開にしてから再実行してください。",
    );
  if (state.productStatus === "active")
    throw new Error(
      "販売中の商品は自動更新できません。商品管理で販売を停止してから再実行してください。",
    );
  return state;
}
