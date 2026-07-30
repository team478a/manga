# MANGAI Current Task

## 基本情報

- 更新日: 2026-07-30
- 状態: `READY_FOR_REVIEW`
- リポジトリ: `team478a/manga`
- Base: `codex/cloud-scenario-generation-v1` (`44cd0c7`)
- Branch: `codex/cloud-storyboard-generation-v1`
- Draft PR: [#71](https://github.com/team478a/manga/pull/71)
- Vercel Preview: [Release 4 Preview](https://mangai-hub-staging-git-codex-cloud-st-3a713a-team478as-projects.vercel.app)
- 仕様: [`docs/cloud/CLOUD_STORYBOARD_GENERATION_V1.md`](cloud/CLOUD_STORYBOARD_GENERATION_V1.md)
- 計画: [`docs/cloud/CLOUD_RELEASE4_IMPLEMENTATION_PLAN.md`](cloud/CLOUD_RELEASE4_IMPLEMENTATION_PLAN.md)

## 現在の目的

Release 3で採用した一般向けシナリオを、ページ・コマ単位のAIネームへ変換し、修正履歴と採用版を保存する。画像生成を始める前に、人が構成を確認できる固定入力を作る。

## 実装済み

- 最新の採用シナリオだけを固定入力とするネーム生成
- 8〜48ページ、各ページ1〜6コマの構造化出力
- ページ目的、ページ送り、構図、カメラ、人物、背景、動作、感情、セリフ、演出指示
- 初稿・修正版を上書きしない追記型版管理
- ネーム履歴、詳細再表示、修正、採用
- 同時採用時の一意制約競合を既存eventへ収束
- Feature Flag、rate limit、所有者RLS、不正UUID拒否
- 成人向けデータのProvider送信前拒否
- Provider保存無効化、timeout、429、不正・過大応答、内部エラー秘匿
- migration、rollback、canonical schema、preflight
- loading、empty、error、not found、pending状態

## 安全境界

- `CLOUD_STORYBOARD_GENERATION_ENABLED`未設定時はfail closed。
- 一般向けの最新採用シナリオだけをOpenAIへ送信し、`store: false`を指定する。
- APIキー、Provider内部応答、DB内部エラーをClient、URL、ログへ表示しない。
- 画像生成、Cloud Canvas Project作成、Desktop、Stripe、Marketplaceは変更しない。

## 検証結果

- deps:check: PASS
- lint: PASS
- typecheck: PASS（Hub + Desktop）
- research:eval: PASS
- hub:test: PASS（235/235）
- db:migrations:validate: PASS（24/24）
- build: PASS
- git diff --check: PASS
- 実OpenAI生成: 未実施（有料実行を避ける）
- migration roundtrip: PASS（GitHub CI）
- Windows build: PASS（GitHub CI）
- Vercel Preview: READY

## 責任者が後で行うこと

1. migration `202607300004_cloud_story_storyboards.sql`を対象Preview DBへ適用
2. 対象Preview branchだけで`CLOUD_STORYBOARD_GENERATION_ENABLED=true`
3. 採用シナリオから初稿、修正版、履歴、採用を実機確認
4. OpenAI利用料金、rate limit、プライバシー告知を承認
5. PRレビューと次工程（Canvas Project化または画像生成）の公開判断
