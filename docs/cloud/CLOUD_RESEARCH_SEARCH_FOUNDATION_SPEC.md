# MANGAI Cloud 検索候補収集基盤 仕様

## Feature Flagと秘密値

```text
CLOUD_RESEARCH_SEARCH_ENABLED=true
BRAVE_SEARCH_API_KEY=<server only>
CLOUD_RESEARCH_SEARCH_RATE_LIMIT_SECRET=<32 bytes or longer>
```

両方が揃った場合だけ検索する。API keyをClient、URL、エラー、通常ログ、Reportへ出さない。

rate-limit秘密値は`CLOUD_AI_RATE_LIMIT_SECRET`、`SUPABASE_SERVICE_ROLE_KEY`の順でもfallback可能とする。既存`consume_cloud_ai_rate_limit` RPCを用い、全体300回/分、Profileごと10回/分をProvider呼出前に消費する。rate-limit確認に失敗した場合も外部検索しない。

## 外部契約

Brave公式の2026-07-29確認時点のSearch料金は1,000 requestあたり5 USDで、毎月5 USD分のcreditを含む。料金・保存権・利用規約は変更され得るため、本番有効化前に責任者が最新条件を再確認し、課金を承認する。

- 料金: <https://brave.com/search/api/>
- Web Search API: <https://api-dashboard.search.brave.com/api-reference/web/search/get>

## Provider要求

- endpoint: `https://api.search.brave.com/res/v1/web/search`
- method: `GET`（ServerからProviderへ送信）
- authorization: `X-Subscription-Token`
- country: `JP`
- search language: `ja`
- UI language: `ja-JP`
- safe search: `strict`
- result filter: `web`
- text decorations: `false`
- count: 最大10
- timeout: 7秒
- response: 最大512 KiB

利用者の検索FormはPOST Server Actionとし、検索語をMANGAIのページURLへ含めない。

## 検索入力

- query: 1〜400文字、最大50語
- 根拠分野: 市場需要、競合、読者、テーマ、価格、販売チャネル、リスク
- 鮮度: 全期間、31日以内、365日以内

## 候補

```ts
type CloudResearchSearchCandidate = {
  title: string;
  url: string;
  description?: string;
  publishedAt?: string;
  verificationEligible: boolean;
};
```

- HTTPS URLだけを残す。
- userinfo、443以外のport、IP literalを除外する。
- fragmentを削除し、同一URLを重複排除する。
- descriptionは検索候補の説明であり、確認済み事実ではない。
- `verificationEligible`は出典検証allowlistとの完全一致で判定する。

## 採用

候補採用時に市場分析Formへ引き継ぐのは、タイトル、URL、選択した根拠分野だけとする。descriptionは事実メモへ転記しない。利用者は原文を開いて、出典種別、公開日時、確認した事実を入力する。

## Error分類

- 不正入力／不正Provider schema: `VALIDATION_ERROR`
- 401／403／5xx／network: `PROVIDER_UNAVAILABLE`
- 429: `RATE_LIMITED`
- timeout: `PROVIDER_TIMEOUT`
- 512 KiB超: `PAYLOAD_TOO_LARGE`

未知のProvider本文や内部例外は利用者へ公開しない。
