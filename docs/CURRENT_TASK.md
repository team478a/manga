# MANGAI Current Task

## 2026-07-30 Cloud成人向けAIネーム v1

- Branch: `codex/cloud-adult-storyboard-v1`
- Base: `codex/cloud-adult-scenario-v1` (`bfde09a`)
- 目的: 成人向けシナリオから、許可制のAIネーム初稿・修正・履歴・採用を提供する。
- 実装範囲: 専用Feature Flag、DB Kill Switch、個別許可、専用同意、前後安全検査、`content_class`保存、一般向けCanvasへの混入拒否。
- 対象外: 成人向けCanvas、画像生成、公開、販売、migration適用、本番有効化、有料API実行。
- 状態: `READY_FOR_DRAFT_PR`。実装・ローカル品質ゲート完了、Draft PR・Preview確認中。
- 正本: `docs/cloud/CLOUD_ADULT_STORYBOARD_IMPLEMENTATION_PLAN.md`、`docs/cloud/CLOUD_ADULT_STORYBOARD_V1.md`
- 検証: deps:check PASS、lint PASS、typecheck PASS、research:eval PASS、hub:test 269/269 PASS、migration静的検証 28件 PASS、build PASS、git diff --check PASS。
- preflight: 想定どおりFAIL。ローカルに限定公開用環境変数を設定していない。秘密値は表示していない。
- ローカルmigration roundtrip: PostgreSQL未導入かつDocker daemon停止のため未実施。GitHub Actionsで確認する。

## 2026-07-30 Cloud成人向けAIシナリオ v1

- Branch: `codex/cloud-adult-scenario-v1`
- Base: `codex/cloud-adult-ai-planning-v1` (`5f5ba8a`)
- 目的: 一般向けと成人向けを区別し、許可利用者へ成人向けAIシナリオの初稿・修正・履歴・採用を提供する。
- 実装範囲: 専用Feature Flag、DB Kill Switch、個別許可、専用同意、前後安全検査、`content_class`保存、一般向けネーム工程の拒否。
- 対象外: 成人向けネーム、Canvas、画像生成、公開、販売、migration適用、本番有効化、有料API実行。
- Draft PR: [#75](https://github.com/team478a/manga/pull/75)
- Preview: `https://mangai-hub-staging-git-codex-cloud-ad-d9d7dd-team478as-projects.vercel.app`
- 状態: `READY_FOR_REVIEW`。実装・ローカル品質ゲート・GitHub CI・Vercel Preview完了。
- 正本: `docs/cloud/CLOUD_ADULT_SCENARIO_IMPLEMENTATION_PLAN.md`、`docs/cloud/CLOUD_ADULT_SCENARIO_V1.md`
- 検証: deps:check PASS、lint PASS、typecheck PASS、research:eval PASS、hub:test 264/264 PASS、migration静的検証 27件 PASS、build PASS、git diff --check PASS。
- ローカルmigration roundtrip: PostgreSQL未導入かつDocker daemon停止のため未実施。GitHub Actionsで確認する。
- GitHub CI: Core quality PASS、Migration roundtrip PASS、Windows build PASS、Vercel PASS。

## 基本情報

- 更新日: 2026-07-30
- 状態: `READY_FOR_REVIEW`
- リポジトリ: `team478a/manga`
- Base: `codex/cloud-storyboard-canvas-materialization-v1` (`80b71f6`, Draft PR #72)
- Branch: `codex/cloud-panel-image-generation-v1`
- Draft PR: [#73](https://github.com/team478a/manga/pull/73)
- Vercel Preview: [Release 6 Preview](https://mangai-hub-staging-git-codex-cloud-pa-e0d887-team478as-projects.vercel.app)
- 仕様: [`docs/cloud/CLOUD_PANEL_IMAGE_GENERATION_V1.md`](cloud/CLOUD_PANEL_IMAGE_GENERATION_V1.md)
- 計画: [`docs/cloud/CLOUD_RELEASE6_IMPLEMENTATION_PLAN.md`](cloud/CLOUD_RELEASE6_IMPLEMENTATION_PLAN.md)

## 現在の目的

Release 5で作成したCanvas下書きのコマを選ぶだけで、採用ネームから一般向け漫画画像の生成条件をServer側で組み立て、既存Cloud AI Queueへ安全に登録する。利用者にはPrompt、Provider、モデル、解像度の知識を要求しない。

## 実装済み

- 選択コマと元ネームのページ・コマ対応解決
- ネームの画角、構図、人物、背景、動作、感情からServer側Promptを作成
- セリフ、吹き出し、文字を画像へ描かない生成指示
- コマ縦横比に応じた生成寸法の自動決定
- 既存moderation、quota、Provider Registry、Queueを通る専用API
- Jobへ対象panel IDを非公開入力として保存し、PromptをClientへ返さない履歴契約
- 完了Assetを生成対象コマへ配置するCanvas導線
- loading、disabled、error状態
- Feature Flag、UUID、所有者、Release 5由来Project、一般向け境界
- Release 6 preflightとモックProvider自動テスト

## 安全境界

- `CLOUD_PANEL_IMAGE_GENERATION_ENABLED`未設定時は認証・DB・Providerアクセス前にfail closed。
- Release 5の一般向けProjectと所有者本人だけを許可する。
- 既存moderation、quota、料金予約、Provider停止判定を迂回しない。
- PromptをClient response、URL、画面、ログへ返さない。
- 本番Provider、Worker、Feature Flag、有料生成は責任者が明示的に有効化する。
- Desktop、Stripe、Marketplace、成人向け画像生成は変更しない。

## 検証結果

- Release 6集中テスト: PASS（10/10）
- deps:check: PASS
- lint: PASS
- typecheck: PASS（Hub + Desktop）
- research:eval: PASS
- hub:test: PASS（254/254）
- canvas:test: PASS（26/26）
- ai:test: PASS（44/44）
- desktop:test: PASS（182/182）
- desktop:test:a11y: PASS（違反0、既存color contrast要手動確認）
- db:migrations:validate: PASS（25/25、Release 6追加migrationなし）
- Hub production build: PASS
- Desktop build: PASS
- git diff --check: PASS
- GitHub Core quality: PASS
- GitHub migration roundtrip: PASS
- GitHub Windows build: PASS
- Vercel Preview: READY
- rc:preflight: STRUCTURE READY、外部設定と手動E2Eは未実施
- Release 6 preflight: 想定どおりFAIL（ローカルに限定公開用環境変数を設定していない）
- 実Provider有料生成E2E: 未実施（停止条件）

## 責任者が後で行うこと

1. Release 2〜5のstacked migrationとFeature Flagを対象Preview環境で確認
2. Release 6 Preview branchだけで`CLOUD_PANEL_IMAGE_GENERATION_ENABLED=true`
3. 既存Cloud画像Provider、pricing、quota、Workerが検証用設定で動作することを確認
4. Release 5由来Canvasでコマを選び、AIおまかせ生成を1件実行
5. 完了Assetが元の対象コマへ配置され、保存・再表示できることを確認
6. Promptや内部Provider情報が画面・Network response・ログへ露出しないことを確認
7. 390px、768px、1280pxで横overflowと操作不能がないことを確認

## 注意事項

- Release 5 PR #72が未mergeのため、Release 6 PRのbaseはRelease 5 branchにする。
- migration適用、Feature Flag有効化、有料API実行、PR merge、本番公開は行わない。
- Release 6は一般向けコマ画像生成だけを対象とし、成人向け画像生成は含まない。
# 2026-07-30 追記: Cloud成人向けAI企画 v1

- 作業ブランチ: `codex/cloud-adult-ai-planning-v1`
- 一般向け企画を維持し、成人向けAI企画を専用権限・同意・Kill Switchで分離
- 成人向けは企画3案の生成・保存・比較・選択まで。シナリオ以降は停止
- migration、本番Flag、外部API実行は未実施
