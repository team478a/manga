export type CloudMarketplaceSalesGuidanceStage =
  | "unavailable"
  | "publication_missing"
  | "work_unpublished"
  | "product_paused"
  | "ready";

export type CloudMarketplaceSalesGuidance = {
  actionTarget: "work" | "product" | null;
  ready: boolean;
  stage: CloudMarketplaceSalesGuidanceStage;
  summary: string;
};

export function buildCloudMarketplaceSalesGuidance(input: {
  currentPublicationId: string | null;
  productAvailable: boolean;
  productStatus: string | null;
  workAvailable: boolean;
  workIsPublic: boolean;
  workStatus: string | null;
}): CloudMarketplaceSalesGuidance {
  if (!input.workAvailable || !input.productAvailable) {
    return {
      actionTarget: null,
      ready: false,
      stage: "unavailable",
      summary: "販売下書きの状態を確認できません。再読み込みしてから確認してください。",
    };
  }

  if (!input.currentPublicationId) {
    return {
      actionTarget: null,
      ready: false,
      stage: "publication_missing",
      summary: "完成版が商品へ固定されていません。販売下書きを再生成してください。",
    };
  }

  if (!input.workIsPublic || input.workStatus !== "published") {
    return {
      actionTarget: "work",
      ready: false,
      stage: "work_unpublished",
      summary: "完成版は固定済みです。次に作品を公開してください。",
    };
  }

  if (input.productStatus !== "active") {
    return {
      actionTarget: "product",
      ready: false,
      stage: "product_paused",
      summary: "作品は公開済みです。商品を確認して販売を開始してください。",
    };
  }

  return {
    actionTarget: "product",
    ready: true,
    stage: "ready",
    summary: "作品公開と商品販売の設定が完了しています。",
  };
}
