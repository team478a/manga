export type CloudMarketplaceProductEditInput = {
  sourceProjectId: string | null | undefined;
  current: {
    workId: string;
    price: number;
    status: string;
  };
  proposed: {
    workId: string;
    price: number;
    replacesFile: boolean;
    status: string;
  };
};

export type CloudMarketplaceProductEditAssessment = {
  allowed: boolean;
  cloudLinked: boolean;
  reason: string | null;
};

const creatorControlMessage =
  "Cloud連携商品の作品・販売ファイル・販売状態はCreator作品画面から変更してください。";

export function assessCloudMarketplaceProductEdit(
  input: CloudMarketplaceProductEditInput,
): CloudMarketplaceProductEditAssessment {
  if (!input.sourceProjectId) {
    return { allowed: true, cloudLinked: false, reason: null };
  }

  if (
    input.proposed.workId !== input.current.workId ||
    input.proposed.replacesFile ||
    input.proposed.status !== input.current.status
  ) {
    return {
      allowed: false,
      cloudLinked: true,
      reason: creatorControlMessage,
    };
  }

  if (
    input.current.status === "active" &&
    input.proposed.price !== input.current.price
  ) {
    return {
      allowed: false,
      cloudLinked: true,
      reason:
        "販売中の価格は直接変更できません。Creator作品画面で販売を停止してから変更してください。",
    };
  }

  return { allowed: true, cloudLinked: true, reason: null };
}
