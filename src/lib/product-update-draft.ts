export type ProductUpdateCategory = "release" | "improvement" | "fix" | "maintenance";

const suffixes: Record<ProductUpdateCategory, string> = {
  release: "を追加しました",
  improvement: "を使いやすくしました",
  fix: "の不具合を修正しました",
  maintenance: "のメンテナンスを実施しました",
};

const summaries: Record<ProductUpdateCategory, string> = {
  release: "新しい機能を利用できるようになりました。",
  improvement: "操作をより分かりやすく、使いやすく改善しました。",
  fix: "ご不便をおかけしていた問題を修正しました。",
  maintenance: "安定して利用できるように保守対応を行いました。",
};

function cleanMemo(value: string) {
  return value
    .replace(/^(feat|fix|chore|docs|refactor)(\([^)]*\))?[!:：\s-]*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildProductUpdateDraft(memo: string, category: ProductUpdateCategory) {
  const cleaned = cleanMemo(memo);
  const topic = (cleaned.split(/[。\n]/)[0] || cleaned).replace(/[。.!！]+$/, "").slice(0, 80);
  const title = `${topic}${suffixes[category]}`.slice(0, 120);
  return {
    title,
    summary: `${topic}について、${summaries[category]}`.slice(0, 500),
    details: cleaned.slice(0, 5000),
  };
}
