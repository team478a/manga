# MANGAI Current Task

## 基本情報

- 更新日: 2026-07-30
- 状態: `READY_FOR_REVIEW`
- リポジトリ: `team478a/manga`
- Base: `codex/cloud-storyboard-generation-v1` (`cf48c4d`)
- Branch: `codex/cloud-storyboard-canvas-materialization-v1`
- Draft PR: [#72](https://github.com/team478a/manga/pull/72)
- Vercel Preview: [Release 5 Preview](https://mangai-hub-staging-git-codex-cloud-st-40d428-team478as-projects.vercel.app)
- 仕様: [`docs/cloud/CLOUD_STORYBOARD_CANVAS_MATERIALIZATION_V1.md`](cloud/CLOUD_STORYBOARD_CANVAS_MATERIALIZATION_V1.md)
- 計画: [`docs/cloud/CLOUD_RELEASE5_IMPLEMENTATION_PLAN.md`](cloud/CLOUD_RELEASE5_IMPLEMENTATION_PLAN.md)

## 現在の目的

Release 4で採用した一般向けAIネームを、既存Cloud Creatorで編集できる非公開Canvas Projectへ変換する。画像生成より前に、ページ・コマ・吹き出し・文字を編集可能な下書きとして固定する。

## 実装済み

- 最新採用ネームだけを入力とするDB側検証
- ネーム1版につきProject 1件の冪等変換とtransaction advisory lock
- 8〜48ページを既存Cloud Project／Episode／Pageへ展開
- 右綴じ2列以下のコマ配置
- セリフ、心の声、ナレーションを吹き出し・縦書き文字へ変換
- 元ネーム、Project、先頭Pageの追跡
- 作成ボタン、作成済みCanvas再表示導線
- Feature Flag、所有者RLS、不正UUID拒否、内部エラー秘匿
- migration、rollback、canonical schema、preflight
- 画像Asset、生成Job、外部Provider呼出を行わない構造検査

## 安全境界

- `CLOUD_STORYBOARD_CANVAS_ENABLED`未設定時はfail closed。
- 一般向けの最新採用ネームだけをDB functionが許可する。
- 所有者はServer側の`current_profile_id()`から決定する。
- 画像生成、Cloud AI Queue、Storage Asset、外部AI、課金処理を呼び出さない。
- Desktop、Stripe、Marketplace、成人向け処理は変更しない。

## 検証結果

- deps:check: PASS
- lint: PASS
- typecheck: PASS（Hub + Desktop）
- research:eval: PASS
- hub:test: PASS（244/244）
- db:migrations:validate: PASS（25/25）
- build: PASS
- git diff --check: PASS
- migration roundtrip: PASS（GitHub CI）
- Windows build: PASS（GitHub CI）
- Vercel Preview: READY
- 実DB変換E2E: 未実施（Preview migrationを適用しない停止条件）

## 責任者が後で行うこと

1. migration `202607300005_cloud_storyboard_canvas_materialization.sql`を対象Preview DBへ適用
2. 対象Preview branchだけで`CLOUD_STORYBOARD_CANVAS_ENABLED=true`
3. 採用ネームからProjectを作成し、ページ数・コマ・吹き出し・文字を実機確認
4. 同じネームの再実行でProjectが増えないことを確認
5. 390px、768px、1280px表示とCanvas編集・保存を確認
6. PRレビュー後に次工程（画像生成）の開始可否を判断

## 注意事項

- Release 4 PR #71が未mergeのため、Release 5 PRのbaseはRelease 4 branchにする。
- migration適用、Feature Flag有効化、PR merge、本番公開は責任者判断まで行わない。
- 本Releaseは画像生成を含まない。
