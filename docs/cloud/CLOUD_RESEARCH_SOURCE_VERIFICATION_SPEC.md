# MANGAI Cloud 出典検証基盤 仕様

## Feature Flag

```text
CLOUD_RESEARCH_SOURCE_VERIFICATION_ENABLED=true
```

未設定または`false`の場合は外部取得を行わず、既存の手入力済み出典として保存する。

## 許可ドメイン

```text
CLOUD_RESEARCH_SOURCE_ALLOWED_HOSTS=example.go.jp,official-platform.example
```

- comma区切りの完全一致host
- wildcardと任意subdomainは使用しない
- IP literal、userinfo、443以外のportは禁止
- redirect先も同じ許可listへ含める

## 取得制限

- protocol: HTTPS
- redirect: 最大3回、manual追跡
- timeout: 7秒
- 本文: 最大1,000,000 bytes
- MIME: `text/html`、`text/plain`、`application/json`
- cache: `no-store`

DNS結果にloopback、private、link-local、carrier-grade NAT、benchmark、multicast等が1件でも含まれる場合は取得しない。
文書用予約アドレスもpublic扱いにしない。URL fragmentは取得前に除去する。

## 運用上の境界

- 許可listには、公的機関や販売プラットフォームなど管理主体を確認できるhostだけを登録する。
- DNS確認後にHTTP clientが再解決するため、一般的なHTTP fetchだけではDNS rebindingを完全にはpinできない。任意hostを許可せず、将来の検索Provider連携では固定egress gatewayまたは解決先IPをpinできるclientを使用する。
- この検証はURLの実在性と取得時本文の同一性を記録するものであり、本文中の主張が正しいことや、事実メモが本文に含意されることは保証しない。

## 保存metadata

```ts
type SourceVerification = {
  status: "verified";
  checkedAt: string;
  finalUrl: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  documentTitle?: string;
};
```

取得本文そのものはReportへ保存しない。本文変更の検出にはSHA-256を用いる。

## エラー

- 許可外host／private IP／危険URL: `VALIDATION_ERROR`
- 容量超過: `PAYLOAD_TOO_LARGE`
- timeout: `PROVIDER_TIMEOUT`
- DNS／network取得不能: `PROVIDER_UNAVAILABLE`

内部例外、DNS詳細、response本文は利用者や通常ログへ公開しない。
