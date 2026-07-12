export function yen(amount: number | null | undefined) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0
  }).format(amount ?? 0);
}

export function dateJa(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(value));
}

export function splitTags(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "下書き",
    published: "公開中",
    archived: "非表示",
    active: "販売中",
    paused: "停止中",
    pending: "受付済み",
    in_progress: "対応中",
    approved: "承認",
    rejected: "見送り",
    completed: "対応完了",
    paid: "支払い済み",
    failed: "失敗",
    refunded: "返金済み"
    ,
    canceled: "キャンセル",
    admin: "管理者",
    creator: "クリエイター",
    buyer: "購入者"
  };

  return labels[status] ?? status;
}
