# MANGAI Module Boundary Policy

最終更新: 2026-08-04  
対象: PR-R1「モジュール境界の固定」

## 目的

機能追加のたびにNext.js、React、Supabase、Provider、成人向け経路が相互に密結合することを防ぎます。PR-R1では既存コードを一括移動せず、新規・段階移行のための境界をCIで固定します。

## 正本となるモジュール構成

```text
src/modules/<module>/
├── domain/
├── application/
├── infrastructure/
├── presentation/
└── contracts/
```

対象moduleは `research`、`proposal`、`scenario`、`storyboard`、`manga`、`creator`、`cloud-ai`、`monitoring`、`billing`、`marketplace`、`shared` です。既存の `src/modules/cloud-creator` は後続PRで段階的に分割します。

## 依存方向

- `domain`: 業務ルールと値。Next.js、React、Supabase、Stripe、Storageへ依存しない。
- `application`: use caseとport。Reactへ依存しない。domainとcontractsを利用できる。
- `infrastructure`: Supabase、Stripe、Storage、外部Providerのadapter。domain/applicationのportを実装する。
- `presentation`: React、Next.js、route、Server Action。service roleを直接利用せずapplication経由で処理する。
- `contracts`: module外へ公開する型・DTO・port。秘密値やProvider固有応答を含めない。

module間は公開contractsを介し、循環依存を作りません。`src/app` はcomposition rootと表示層に限定します。

## セキュリティ境界

- Client Componentはserver環境変数、API key、service role、署名鍵を参照しない。
- Prompt、Provider生応答、成人向け本文・画像を `console.log` へ出さない。
- Providerの生エラーを `throw new Error(providerMessage)` の形で表示層へ渡さない。
- 成人向けデータを一般Cloud Provider routeへ接続しない。明示同意、許可、専用経路、費用上限の既存条件を維持する。
- `src/app/**` のSupabase admin client直接利用は警告対象。既存33箇所は後続PRでinfrastructure層へ移す。

## CIの判定

`npm run deps:check` は次を順に実行します。

1. package公開API・package循環依存
2. module層・秘密情報・Provider経路・Feature Flag
3. 新規source fileのサイズと明示的`any`

ErrorはCIを失敗させます。Warningは移行残件を表示しますが、既存機能を突然停止させません。

- 新規source fileが800行超: Error
- 新規source fileが500行超: Warning
- 新規source fileの明示的`any`: Warning
- 未使用Feature Flag: Warning
- `src/app/**` のadmin client直接利用: Warning

サイズ検査はPRのmerge baseから「追加されたsource file」のみを対象にします。GitHub Actionsでは履歴を取得し、`GITHUB_BASE_REF`を基点にします。

## 例外

検査の無効化コメントや恒久allowlistを追加して回避しません。正当な例外が必要な場合は、責任者承認、期限、所有者、解消条件を設計文書へ記録した独立PRで検査ロジックを変更します。
