import { createHash } from "node:crypto";
import type {
  CloudResearchSourceVerification,
  CloudResearchTopic,
} from "./cloud-research.ts";
import type { CloudResearchSourceSnapshot } from "./cloud-research-source-verification.ts";
import { ValidationError } from "./domain-errors.ts";

const MAX_CANDIDATES = 8;
const MIN_CANDIDATE_LENGTH = 20;
const MAX_CANDIDATE_LENGTH = 500;

const topicKeywords: Record<CloudResearchTopic, readonly string[]> = {
  demand: [
    "市場",
    "需要",
    "売上",
    "利用",
    "成長",
    "規模",
    "購入",
    "読者",
    "market",
    "demand",
    "sales",
    "growth",
  ],
  competition: [
    "競合",
    "ランキング",
    "シェア",
    "作品",
    "出版",
    "competitor",
    "ranking",
    "share",
  ],
  audience: [
    "読者",
    "ユーザー",
    "女性",
    "男性",
    "年代",
    "年齢",
    "audience",
    "user",
    "demographic",
  ],
  theme: [
    "人気",
    "トレンド",
    "ジャンル",
    "テーマ",
    "trend",
    "genre",
    "popular",
  ],
  price: [
    "価格",
    "円",
    "無料",
    "課金",
    "購入",
    "単価",
    "price",
    "yen",
    "cost",
  ],
  channel: [
    "販売",
    "配信",
    "ストア",
    "電子書籍",
    "アプリ",
    "channel",
    "platform",
    "store",
  ],
  risk: [
    "リスク",
    "減少",
    "規制",
    "注意",
    "課題",
    "著作権",
    "risk",
    "decline",
    "regulation",
  ],
};

const boilerplate =
  /(?:cookie|privacy|利用規約|プライバシー|ログイン|会員登録|お問い合わせ|無断転載|all rights reserved|javascriptを有効)/iu;
const quantitativeSignal =
  /(?:\d[\d,.]*\s*(?:%|％|円|万円|億円|人|件|冊|部|倍)|(?:19|20)\d{2}年|\$\s*\d)/u;

export type CloudResearchClaimCandidate = {
  id: string;
  text: string;
  topic: CloudResearchTopic;
  score: number;
  signals: string[];
  textStart: number;
  textEnd: number;
  sourceSha256: string;
  textSha256: string;
};

export type CloudResearchClaimExtractionResult = {
  sourceVerification: CloudResearchSourceVerification;
  extractedAt: string;
  textSha256: string;
  textTruncated: boolean;
  candidates: CloudResearchClaimCandidate[];
};

function sentenceRanges(text: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  const delimiter = /[。！？!?]+|\.(?=\s|$)|\n+/gu;
  let start = 0;
  for (const match of text.matchAll(delimiter)) {
    const delimiterStart = match.index;
    const delimiterEnd = delimiterStart + match[0].length;
    const endsWithNewline = match[0].includes("\n");
    const end = endsWithNewline ? delimiterStart : delimiterEnd;
    if (end > start) ranges.push({ start, end });
    start = delimiterEnd;
  }
  if (start < text.length) ranges.push({ start, end: text.length });
  return ranges;
}

function trimmedRange(text: string, start: number, end: number) {
  while (start < end && /\s/u.test(text[start] ?? "")) start += 1;
  while (end > start && /\s/u.test(text[end - 1] ?? "")) end -= 1;
  return { start, end };
}

export function extractCloudResearchClaimCandidates(
  snapshot: CloudResearchSourceSnapshot,
  topic: CloudResearchTopic,
  extractedAt = new Date().toISOString(),
): CloudResearchClaimExtractionResult {
  if (snapshot.text.length < MIN_CANDIDATE_LENGTH)
    throw new ValidationError(
      "出典から事実候補として確認できる本文を抽出できませんでした。",
    );

  const candidates = sentenceRanges(snapshot.text)
    .map(({ start, end }) => trimmedRange(snapshot.text, start, end))
    .filter(({ start, end }) => {
      const length = end - start;
      return (
        length >= MIN_CANDIDATE_LENGTH && length <= MAX_CANDIDATE_LENGTH
      );
    })
    .map(({ start, end }) => {
      const text = snapshot.text.slice(start, end);
      const normalized = text.toLocaleLowerCase("ja-JP");
      const signals = topicKeywords[topic].filter((keyword) =>
        normalized.includes(keyword.toLocaleLowerCase("ja-JP")),
      );
      const hasQuantitativeSignal = quantitativeSignal.test(text);
      return {
        start,
        end,
        text,
        signals,
        score:
          signals.length * 10 +
          (hasQuantitativeSignal ? 6 : 0) +
          (text.length >= 40 && text.length <= 240 ? 2 : 0),
      };
    })
    .filter(
      ({ text, signals }) => signals.length > 0 && !boilerplate.test(text),
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.start - right.start ||
        left.text.localeCompare(right.text, "ja"),
    )
    .slice(0, MAX_CANDIDATES)
    .map(({ start, end, text, signals, score }) => ({
      id: createHash("sha256")
        .update(
          [
            snapshot.verification.finalUrl,
            snapshot.textSha256,
            topic,
            start,
            end,
          ].join(":"),
        )
        .digest("hex")
        .slice(0, 24),
      text,
      topic,
      score,
      signals,
      textStart: start,
      textEnd: end,
      sourceSha256: snapshot.verification.sha256,
      textSha256: snapshot.textSha256,
    }));

  return {
    sourceVerification: snapshot.verification,
    extractedAt,
    textSha256: snapshot.textSha256,
    textTruncated: snapshot.textTruncated,
    candidates,
  };
}
