# MANGAI Current Task

## 基本情報

- 更新日: 2026-07-30
- 状態: `READY_FOR_DRAFT_PR`
- リポジトリ: `team478a/manga`
- Base: `codex/cloud-proposal-generation-v1` (`f5b176a`)
- Branch: `codex/cloud-scenario-generation-v1`
- 仕様: [`docs/cloud/CLOUD_SCENARIO_GENERATION_V1.md`](cloud/CLOUD_SCENARIO_GENERATION_V1.md)
- 計画: [`docs/cloud/CLOUD_RELEASE3_IMPLEMENTATION_PLAN.md`](cloud/CLOUD_RELEASE3_IMPLEMENTATION_PLAN.md)

## 現在の目的

Release 2で採用した一般向け漫画企画を、登場人物・三幕構成・ページ範囲付きシーンへ変換し、版履歴と採用版を保存してRelease 4へ引き継げる状態にする。

## 実装済み

- 採用企画からのOpenAI Structured Outputsによる初稿生成
- 初稿・修正版を上書きしない追記型版管理
- 修正指示と親版の関連付け
- シナリオ履歴、詳細、人物、三幕、シーン、商品整合表示
- 採用eventとRelease 4準備完了表示
- Feature Flag、rate limit、所有者RLS、不正UUID拒否
- 成人向けデータのProvider送信前拒否
- timeout、429、不正・過大応答、内部エラーの安全な処理
- migration、rollback、canonical schema、preflight
- loading、empty、error、not found、pending状態

## 安全境界

- `CLOUD_SCENARIO_GENERATION_ENABLED`未設定時はfail closed。
- 一般向けの採用企画だけをOpenAIへ送信し、`store: false`を指定する。
- APIキー、Provider内部応答、DB内部エラーをClient、URL、ログへ表示しない。
- 市場分析にない販売数、成長率、順位を生成せず、売上を保証しない。
- Desktop、Canvas、Stripe、Marketplaceは変更しない。

## 検証結果

- Release 3集中テスト: PASS（9/9）
- deps:check: PASS
- lint: PASS
- typecheck: PASS（Hub + Desktop）
- research:eval: PASS
- hub:test: PASS（223/223）
- db:migrations:validate: PASS（23/23）
- build: PASS
- git diff --check: PASS
- 実OpenAI生成: 未実施（有料実行を避ける）
- migration roundtrip: CI実行待ち
- Vercel Preview: Draft PR作成後に確認

## 責任者が後で行うこと

1. migration `202607300003_cloud_story_scenarios.sql`を対象Preview DBへ適用
2. 対象Preview branchだけで`CLOUD_SCENARIO_GENERATION_ENABLED=true`
3. 採用企画から初稿、修正版、履歴、採用を実機確認
4. OpenAI利用料金、rate limit、プライバシー告知を承認
5. PRレビューと公開判断
