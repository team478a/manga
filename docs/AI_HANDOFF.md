# MANGAI Codex ⇄ Claude Code 引継ぎ台帳

## 0. 現在の優先タスク（M5-6 作品別リソース予算、2026-08-01）

- Branch: `codex/manga-cost-budget-v1`
- Base: `agent/manga-chapter-production-plans-v1`（Draft PR #114）
- 実装: 作品別月間クレジット・概算費用・容量上限、警告割合、生成停止、コックピット集計
- DB: owner/admin保存RPC、owner read RLS、JobとAssetへの強制上限trigger
- migration: `202608010010_cloud_project_resource_budgets.sql`（Supabase staging未適用）
- 表示境界: 利用者には合計だけを表示し、Provider／モデル／料金計算ロジックを公開しない
- 詳細: `docs/cloud/MANGA_PROJECT_RESOURCE_BUDGET_V1.md`

---

## 0. 現在の優先タスク（M5-5 章単位の制作計画、2026-08-01）

- Branch: `agent/manga-chapter-production-plans-v1`
- Base: `agent/manga-cockpit-navigation-v1`（Draft PR #113）
- Draft PR: [#114](https://github.com/team478a/manga/pull/114)
- Preview: `https://mangai-hub-staging-git-agent-manga-ch-9a2d97-team478as-projects.vercel.app`
- 実装: 章ごとの優先度・担当名・期限・メモ、期限超過、優先章数、次着手章
- migration: `202608010009_cloud_chapter_production_plans.sql`（Supabase staging適用・構造確認済み）
- DB適用: 長編制作関連の未適用10項目を一括監査し、すべて正常。`202608010002`は既適用
- 利用者マニュアル: `/dashboard/monitor/guide`とMarkdown版へ、短編試作から100ページ制作・PDF出力までの実操作手順を反映
- 状態: 実装、DB適用、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。実ブラウザ・Worker実行・責任者承認待ち

---

## 0. 現在の優先タスク（M5-4 100ページナビゲーション、2026-08-01）

- Branch: `agent/manga-cockpit-navigation-v1`
- Base: `agent/manga-longform-cockpit-v1`（Draft PR #112）
- Draft PR: [#113](https://github.com/team478a/manga/pull/113)
- Preview: `https://mangai-hub-staging-git-agent-manga-co-4977d4-team478as-projects.vercel.app`
- 目的: 長編コックピットのDOMと認知負荷を100ページ規模で抑える
- 実装: 章／状態絞り込み、未割当抽出、折りたたみ、24ページ段階表示
- migration／環境変数／外部Provider: 追加なし
- 詳細: `docs/cloud/MANGA_COCKPIT_NAVIGATION_V1.md`
- 状態: 実装、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。100ページ実データ確認と責任者承認待ち

---


## 0. 現在の優先タスク（M5-3 長編作品コックピット、2026-08-01）

- Branch: `agent/manga-longform-cockpit-v1`
- Base: `agent/manga-continuity-suggestions-v1`（Draft PR #111）
- Draft PR: [#112](https://github.com/team478a/manga/pull/112)
- Preview: `https://mangai-hub-staging-git-agent-manga-lo-7b90ee-team478as-projects.vercel.app`
- 目的: 32〜100ページ作品の構成、進捗、伏線、人物関係を横断確認する
- 実装: `/creator/[projectId]/cockpit` と決定的な集計helper
- 安全境界: 既存の保存済み情報だけを集計し、Providerや外部AIは利用しない
- migration／環境変数: 追加なし
- 詳細: `docs/cloud/MANGA_LONGFORM_COCKPIT_V1.md`
- 状態: 実装、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。実作品確認と責任者承認待ち

---


## 0. 現在の優先タスク（M5-2 連続性設定候補、2026-08-01）

- Branch: `agent/manga-continuity-suggestions-v1`
- Base: `agent/manga-continuity-foundation-v1`（Draft PR #110）
- Draft PR: [#111](https://github.com/team478a/manga/pull/111)
- Preview: `https://mangai-hub-staging-git-agent-manga-co-2eb954-team478as-projects.vercel.app`
- 目的: 確定済みの構造化設定を候補化し、利用者が確認した項目だけM5-1台帳へ保存する
- 実装: キャラクター／場所／小物／ページ割当済みシーン候補、登録済み除外、確認登録UI
- 安全境界: Promptや画像を解析せず、外部AIを呼ばず、候補は未確認のまま保存しない
- migration／環境変数: 追加なし
- 詳細: `docs/cloud/MANGA_CONTINUITY_SUGGESTIONS_V1.md`
- 状態: 実装、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。実作品確認と責任者承認待ち

---

## 0. 現在の優先タスク（M5-1 物語の連続性台帳、2026-08-01）

- Branch: `agent/manga-continuity-foundation-v1`
- Base: `agent/manga-storage-lifecycle-v1`（Draft PR #109）
- Draft PR: [#110](https://github.com/team478a/manga/pull/110)
- Preview: `https://mangai-hub-staging-git-agent-manga-co-654703-team478as-projects.vercel.app`
- 目的: 長編の事実と伏線をページ範囲付きで管理し、決定的に検出できる矛盾を表示する
- 実装: `cloud_continuity_facts`、`cloud_plot_threads`、owner-only RPC、事実・伏線UI、矛盾・回収漏れ評価
- migration: `202608010008_cloud_narrative_continuity.sql`、rollback、canonical schema同期
- 詳細: `docs/cloud/MANGA_NARRATIVE_CONTINUITY_V1.md`
- 状態: 実装、migration実DB往復、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。外部環境適用と責任者承認待ち

---


## 0. 現在の優先タスク（M4 Storageライフサイクル、2026-08-01）

- Branch: `agent/manga-storage-lifecycle-v1`
- Base: `agent/manga-durable-export-v1`（Draft PR #108）
- Draft PR: [#109](https://github.com/team478a/manga/pull/109)
- Preview: `https://mangai-hub-staging-git-agent-manga-st-723bbf-team478as-projects.vercel.app`
- 目的: 長編作品のページサムネイル生成と不要な派生ファイルの安全な整理を追加する
- 実装: `cloud-cache`、ページrevision別WebP、署名URL、thumbnail／cleanup Queue、lease Worker
- 保護対象: 採用済み生成画像、Canvas保存データ、完成`manuscript.pdf`はcleanup対象外
- migration: `202608010007_cloud_storage_lifecycle.sql`、rollback、canonical schema同期
- 詳細: `docs/cloud/MANGA_STORAGE_LIFECYCLE_V1.md`
- 状態: 実装、ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。外部環境適用と責任者承認待ち

---


## 0. 現在の優先タスク（M4 永続PDFエクスポート、2026-08-01）

- Branch: `agent/manga-durable-export-v1`
- Base: `agent/manga-production-status-v1`（Draft PR #107）
- Draft PR: [#108](https://github.com/team478a/manga/pull/108)
- Preview: `https://mangai-hub-staging-git-agent-manga-du-4a6dbe-team478as-projects.vercel.app`
- 目的: 32〜100ページ原稿を4ページsegmentで永続処理し、完成PDFへ安全に結合する
- 実装: Export Job／segment、停止・再開・中止・retry、private Storage、署名download、厳格preflight
- migration: `202608010006_cloud_durable_export.sql`、rollback、canonical schema同期
- 詳細: `docs/cloud/MANGA_DURABLE_EXPORT_V1.md`
- 状態: 実装、ローカル検証、Draft PR、Preview完了。GitHub CI確認中

---


## 0. 現在の優先タスク（M4制作管理 ページ状態・確定ロック、2026-08-01）

- Branch: `agent/manga-production-status-v1`
- Base: `agent/manga-batch-production-v1`（Draft PR #106）
- Draft PR: [#107](https://github.com/team478a/manga/pull/107)
- Preview: `https://mangai-hub-staging-git-agent-manga-pr-7ff6fc-team478as-projects.vercel.app`
- 目的: 長編制作のページ状態、全体進捗、確認・修正・確定を制作ボードで管理する
- 実装: 5状態、Job連動、確定編集ロック、設定変更revision、絞り込み、migration未適用fallback
- migration: `202608010005_cloud_production_status.sql`、rollback、canonical schema同期
- 詳細: `docs/cloud/CLOUD_PRODUCTION_STATUS_V1.md`
- 検証: deps、lint、Hub 363/363、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y、migration forward／rollback／reapply／canonical、build成功
- 状態: 実装・Draft PR・Preview完了。Supabase staging適用、実ブラウザ確認、責任者承認待ち

---


## 0. 現在の優先タスク（M4後半 一括生成・編集ロック、2026-08-01）

- Branch: `agent/manga-batch-production-v1`
- Base: `agent/manga-32page-foundation-v1`（Draft PR #105）
- Draft PR: [#106](https://github.com/team478a/manga/pull/106)
- Preview: `https://mangai-hub-staging-git-agent-manga-ba-fd5369-team478as-projects.vercel.app`
- 目的: 4〜8ページ単位の永続生成Queueと、Canvas同時編集の安全境界を追加する
- 実装: Batch永続化、Job紐付け、進捗集計、停止／再開／中止、失敗分retry、120秒の編集lease
- migration: `202608010004_cloud_batch_production.sql`、rollback、canonical schema同期済み
- 詳細: `docs/cloud/MANGA_BATCH_PRODUCTION_V1.md`
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 状態: コード、DB往復、Draft PR、Preview完了。Supabase staging適用、実Provider、実ブラウザ、責任者承認待ち

---

## 0. 現在の優先タスク（M4前半 32ページ制作基盤、2026-08-01）

- Branch: `agent/manga-32page-foundation-v1`
- Base: `agent/manga-transparent-layers-v1`（Draft PR #104）
- Draft PR: [#105](https://github.com/team478a/manga/pull/105)
- Preview: `https://mangai-hub-staging-git-agent-manga-32-fc91ac-team478as-projects.vercel.app`
- 目的: 32ページ読切を章・話・シーン単位で整理し、ページ一覧のDOM負荷を制限する
- 実装: Chapter／Scene schemaとRLS、既存作品backfill、階層追加、同一話内drag reorder、単ページ／見開き、12ページずつ追加表示
- fallback: migration未適用時は旧画面を継続し、構造編集だけ停止
- migration: `202608010003_cloud_longform_structure.sql`、rollbackとcanonical schema同期済み
- 詳細: `docs/cloud/MANGA_32_PAGE_FOUNDATION_V1.md`
- 検証: deps、lint、Hub/Desktop typecheck、Hub 354/354、Canvas 26/26、AI 48/48、Desktop 182/182、migration往復、production build成功
- CI: Core quality、Migration roundtrip、Windows accessibility/build、Vercel成功
- 状態: 実装・全自動検証・Preview完了。Supabase staging適用、実ブラウザ確認、責任者承認待ち

---

## 0. 現在の優先タスク（M3-8 人物・効果レイヤー白背景透明化、2026-08-01）

- Branch: `agent/manga-transparent-layers-v1`
- Base: `agent/manga-layered-generation-v1`（Draft PR #103）
- Draft PR: [#104](https://github.com/team478a/manga/pull/104)
- Preview: `https://mangai-hub-staging-git-agent-manga-tr-46b68e-team478as-projects.vercel.app`
- 目的: 分離生成した人物・効果を白い矩形ではなく透明PNGレイヤーとして保存する
- 実装: `outputAlphaMode`の許可値検証、人物・効果Jobへの固定、Sharpによる白地除去、Worker保存前変換
- 互換性: 既定値は`preserve`。完成コマ、背景、修正、既存Jobは変更しない
- migration / Feature Flag / Provider / 料金: 追加なし
- 詳細: `docs/cloud/MANGA_TRANSPARENT_LAYER_OUTPUT_V1.md`
- 検証: deps、lint、Hub/Desktop typecheck、Hub 350/350、Canvas 26/26、AI 48/48、Desktop 182/182、migration 34/34、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 状態: 実装・全自動検証・Preview完了。実Provider、実ブラウザ確認、責任者承認待ち

---

## 0. 現在の優先タスク（M3-7 背景・人物・効果の分離生成、2026-08-01）

- Branch: `agent/manga-layered-generation-v1`
- Base: `agent/manga-composition-control-v1`（Draft PR #102）
- Draft PR: [#103](https://github.com/team478a/manga/pull/103)
- Preview: `https://mangai-hub-staging-git-agent-manga-la-a0ee14-team478as-projects.vercel.app`
- 目的: 通常のコマ生成を完成コマ、背景、人物、効果へ分け、非破壊レイヤーとして採用する
- 実装: 対象選択UI、対象別Job・Prompt・参照分離、背景の下層配置、人物・効果の乗算合成
- 互換性: `generationTarget`未指定時は完成コマ。既存の修正生成は変更しない
- migration / Feature Flag / Provider / 料金: 追加なし
- 詳細: `docs/cloud/MANGA_LAYERED_GENERATION_V1.md`
- 検証: deps、lint、Hub/Desktop typecheck、Hub 348/348、Canvas 26/26、AI 47/47、Desktop 182/182、migration 34/34、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 状態: 実装・全自動検証・Preview完了。実Provider、実ブラウザ確認、責任者承認待ち

---

## 0. 現在の優先タスク（M3-6 ポーズ・構図制御、2026-08-01）

- Branch: `agent/manga-composition-control-v1`
- Base: `agent/manga-smart-mask-v1`（Draft PR #101）
- Draft PR: [#102](https://github.com/team478a/manga/pull/102)
- Preview: `https://mangai-hub-staging-git-agent-manga-co-048dc2-team478as-projects.vercel.app`
- 目的: 通常のコマ画像生成で、画角・カメラ位置・人物配置・視線方向を選択可能にする
- 実装: 4項目の選択UI、500文字以内の追加指定、API enum検証、生成Promptへの構図調整追加
- 互換性: すべて「ネームどおり」が初期値。修正生成には自動適用しない
- migration / Feature Flag / Provider / 料金: 追加なし
- 詳細: `docs/cloud/MANGA_COMPOSITION_CONTROL_V1.md`
- 検証: deps、lint、Hub/Desktop typecheck、Hub 345/345、Canvas 26/26、AI 47/47、Desktop 182/182、migration 34/34、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 状態: 実装・自動検証完了。実ブラウザ確認と責任者承認待ち

---

## 0. 現在の優先タスク（M3-5 修正領域おすすめ、2026-08-01）

- Branch: `agent/manga-smart-mask-v1`
- Base: `agent/manga-revision-comparison-v1`（Draft PR #100）
- Draft PR: [#101](https://github.com/team478a/manga/pull/101)
- 目的: Inpaintingの修正範囲を修正内容からワンタップ提案し、手描き調整を残す
- 実装: 顔・表情・手・衣装・背景・全体の比率ベース初期マスク、候補切替、手動補正
- 境界: v1は画像認識ではなく目安。外部Vision API、DB、Provider、料金の変更なし
- 詳細: `docs/cloud/MANGA_SMART_MASK_V1.md`
- 状態: ローカル全品質ゲート成功。Draft PR、GitHub CI、Vercel、責任者確認待ち
- 未実施: 実ブラウザのマウス・タッチ確認、責任者承認、親PR #100後のマージ

---

## 0. 現在の優先タスク（M3-4 修正前後の比較表示、2026-08-01）

- Branch: `agent/manga-revision-comparison-v1`
- Base: `agent/manga-panel-outpainting-v1`（Draft PR #99）
- Draft PR: [#100](https://github.com/team478a/manga/pull/100)
- 目的: 修正候補を採用する前に元画像との差分を視覚的に確認する
- 実装: range比較スライダー、Outpainting方向・寸法に応じた元画像位置補正、比較からの非破壊採用
- API: private inputは返さず、本人所有Jobの比較用Asset IDと拡張方向だけを安全に公開
- migration / Feature Flag: 追加なし
- 詳細: `docs/cloud/MANGA_REVISION_COMPARISON_V1.md`
- 注意: 一般向けCloudの表示機能のみ。成人向け、Desktop、生成Providerは対象外
- 状態: ローカル全品質ゲート成功。GitHub CI、Vercel、責任者確認待ち
- 未実施: 実ブラウザ確認、責任者承認、親PR #99後のマージ

---

## 0. 現在の優先タスク（M3-3 コマ画角拡張、2026-08-01）

- Branch: `agent/manga-panel-outpainting-v1`
- Base: `agent/manga-panel-inpainting-v1`（Draft PR #98）
- Draft PR: [#99](https://github.com/team478a/manga/pull/99)
- Preview: `https://mangai-hub-staging-git-agent-manga-pa-f7bc01-team478as-projects.vercel.app`
- 目的: 採用済みコマを非破壊で左・右・上・下・全方向へ延長する
- 実装: 方向UI、Outpainting operation、Worker内余白・白黒マスク生成、BFL Fill、correction layer採用
- Feature Flag: `CLOUD_PANEL_OUTPAINTING_ENABLED`。未設定時は認証・DB・Providerより前に停止
- migration: なし。既存Fill Providerと価格設定を再利用
- 詳細: `docs/cloud/MANGA_PANEL_OUTPAINTING_V1.md`
- 注意: 一般向けCloudのみ。成人向け、Desktop、自動マスクは対象外
- 状態: ローカル全品質ゲート、GitHub全CI、Vercel成功。責任者確認待ち
- 未実施: 実Provider有料生成、実ブラウザ確認、責任者承認、親PR #98後のマージ

---

## 0. 現在の優先タスク（M3-2 マスク付きコマ部分修正、2026-08-01）

- Branch: `agent/manga-panel-inpainting-v1`
- Base: `agent/manga-panel-revision-v1`（Draft PR #97）
- Draft PR: [#98](https://github.com/team478a/manga/pull/98)
- Preview: `https://mangai-hub-staging-jnew2urfq-team478as-projects.vercel.app`
- 目的: 採用画像の利用者が塗った範囲だけを修正候補として生成する
- 実装: タッチ対応マスク、専用inpainting operation、BFL Fill、private Asset再検証、correction layer採用
- Feature Flag: `CLOUD_PANEL_INPAINTING_ENABLED`。未設定時はUI・サーバー・Provider registryで停止
- migration: `202608010002_cloud_panel_inpainting.sql`
- 詳細: `docs/cloud/MANGA_PANEL_INPAINTING_V1.md`
- 注意: 一般向けCloudのみ。Outpainting、自動マスク、成人向け、Desktopは対象外
- 状態: ローカル全品質ゲート、GitHub全CI、Vercel成功。責任者確認待ち
- 未実施: staging migration、実Provider有料生成、実ブラウザ確認、責任者承認、親PR #97後のマージ

---

## 0. 現在の優先タスク（M3-1 コマ修正候補生成、2026-08-01）

- Branch: `agent/manga-panel-revision-v1`
- Base: `agent/manga-continuity-review-v1`（Draft PR #96）
- Draft PR: [#97](https://github.com/team478a/manga/pull/97)
- Preview: `https://mangai-hub-staging-git-agent-manga-pa-2b4a4e-team478as-projects.vercel.app`
- 目的: 採用済みコマ画像を残したまま、気になる部分の修正候補を生成する
- 実装: 6修正preset、任意追加要望、元画像先頭参照、設定version継承、2〜4候補、非破壊レイヤー採用
- DB: 新規migrationなし
- 詳細: `docs/cloud/MANGA_PANEL_REVISION_V1.md`
- 注意: マスク付きInpaintingではなく、参照画像を使うガイド付きImage-to-Image
- 未実施: 実Provider生成、実ブラウザ確認、責任者承認、親PR #96後のマージ

---

## 0. 現在の優先タスク（M2-4 生成履歴の一貫性チェック、2026-08-01）

- Branch: `agent/manga-continuity-review-v1`
- Base: `agent/manga-reference-assets-v1`（Draft PR #95）
- Draft PR: [#96](https://github.com/team478a/manga/pull/96)
- Preview: `https://mangai-hub-staging-git-agent-manga-co-df707f-team478as-projects.vercel.app`
- 目的: 採用済み生成画像が人物・衣装・場所・小物・画風の現在設定と参照画像を継続使用しているか確認する
- 実装: 設定版・参照asset・Job追跡の照合、混在警告、ページ／設定修正導線
- DB: 新規migrationなし
- 詳細: `docs/cloud/MANGA_CONTINUITY_REVIEW_V1.md`
- 注意: v1は画像ピクセルを解析せず、見た目の一致を保証しない
- 状態: ローカル全品質ゲート、GitHub全CI、Vercel成功。責任者確認待ち
- 変更しない範囲: 成人向け、Desktop、Provider、Worker、Stripe、Marketplace

---

## 0. 現在の優先タスク（M2-3 参照画像・コマ明示割当、2026-08-01）

- Branch: `agent/manga-reference-assets-v1`
- Base: `agent/manga-generation-integration-v1`（Draft PR #94）
- 目的: 人物・画風・場所・小物の参照画像と明示割当を一般向けコマ生成へ安全に反映する
- 実装: 非公開asset関連付け、コマ割当、Job監査入力、短時間署名URL、BFL FLUX.2 multi-reference
- migration: `202608010001_cloud_visual_references.sql`
- 詳細: `docs/cloud/MANGA_VISUAL_REFERENCES_V1.md`
- 変更しない範囲: 成人向け、Desktop、Stripe、Marketplace、自動参照昇格

---

## 0. 現在の優先タスク（一般向け漫画生成の統合、2026-07-31）

- Branch: `agent/manga-generation-integration-v1`
- Base: `feature/manga-canvas-mvp` (`ae1279e`)
- Draft PR: [#94](https://github.com/team478a/manga/pull/94)
- Preview: `https://mangai-hub-staging-git-agent-manga-ge-907c74-team478as-projects.vercel.app`
- 目的: PR #87〜#90の一般向け漫画生成機能を最新Cloud基盤へ安全に統合する
- 範囲: FLUXコマ生成、候補比較、レイヤー合成、原稿検査、作品進捗、
  キャラクター設定、画風・場所・小物設定
- 状態: ローカル品質ゲート、GitHub全CI、Vercel Preview成功。責任者確認待ち
- 詳細: `docs/cloud/MANGA_GENERATION_INTEGRATION_REPORT.md`
- 未実施: migration適用、実Provider有料生成、実ブラウザ確認、マージ
- 変更しない範囲: 成人向け、Desktop、Stripe、Marketplace

---

## 0. 現在の優先タスク（一般向けモニターWebマニュアル同期、2026-07-31）

- Branch: `codex/cloud-monitor-guide-sync-v1`
- Base: `feature/manga-canvas-mvp` (`ee6e2ca`、PR #92 merge後)
- 目的: モニターが現在の8工程と利用可能範囲を迷わず理解し、制作画面からいつでもマニュアルを開けるようにする
- 対象: `/dashboard/monitor/guide`、`/admin/general-monitors/guide`、Cloud共通サイドバー
- Draft PR: [#93](https://github.com/team478a/manga/pull/93)
- Preview: `https://mangai-hub-staging-git-codex-cloud-mo-eaf18e-team478as-projects.vercel.app`
- 状態: 実装・ローカル全品質ゲート・実装commitの全CI・Vercel成功、責任者確認待ち
- 変更しない範囲: DB、migration、認証、AI生成・保存ロジック、Feature Flag、成人向け境界、Desktop

---

## 0. 現在の優先タスク（一般向け制作工程の利用入口修正、2026-07-31）

- Branch: `codex/cloud-workflow-entrypoints-v1`
- Base: `feature/manga-canvas-mvp` (`38c1481`、PR #91 merge後)
- 目的: 市場分析以外の実装済み工程を、共通メニューから実際に利用可能にする
- 対象: Cloud共通サイドバー、工程入口Route、利用者本人の進行先解決
- Draft PR: [#92](https://github.com/team478a/manga/pull/92)
- 状態: 実装・ローカル主要品質ゲート完了、CI・Vercel Preview確認中
- 変更しない範囲: DB、migration、AI生成・保存ロジック、成人向け境界、Desktop

---

## 0. 現在の優先タスク（一般向け制作工程の表示整理、2026-07-31）

- Branch: `codex/cloud-workflow-labels-v1`
- Base: `feature/manga-canvas-mvp` (`7eb783f`)
- 目的: 一般向けモニターへ、実装済み工程と準備中工程を誤解なく案内する
- 対象: Cloud共通サイドバー、Dashboard、`/creator`、シナリオ採用画面
- 状態: 実装・ローカル主要品質ゲート完了、Draft PR作成前
- 変更しない範囲: DB、API、認証、制作・保存ロジック、Feature Flag、Desktop

---

## 0. 現在の優先タスク（クラウド制作の日本語化・初回ガイド、2026-07-31）

- Branch: `codex/cloud-creator-ja-guide-v1`
- Base: `feature/manga-canvas-mvp` (`3d16839`)
- 目的: モニターが英語の内部用語に迷わず、新しい紫基調UI上で
  最初の制作操作を理解できるようにする
- 対象: `/creator`と関連する作品作成・構成・ゴミ箱・ページ編集
- 状態: 実装とローカル主要品質ゲート完了、Draft PR #85で確認中
- 変更しない範囲: DB、API契約、認証、制作・保存ロジック、Desktop

---

## 0. 現在の優先タスク（招待メール文面編集、2026-07-31）

- Branch: `codex/cloud-monitor-email-template-v1`
- Base: `feature/manga-canvas-mvp` (`506cf2b`)
- 目的: 管理画面からモニター招待メールの件名・本文を安全に変更する
- 管理画面: `/admin/general-monitors/email`
- migration: `202607310003_cloud_general_monitor_email_template.sql`
- 状態: 実装とローカル主要品質ゲート完了、Draft PR準備中

---

## 0. 現在の優先タスク（モニター操作の処理中表示、2026-07-31）

- Branch: `codex/cloud-action-pending-feedback-v1`
- Base: `feature/manga-canvas-mvp` (`6ebdbaa`)
- 目的: ボタンクリック直後に処理中表示を出し、無反応に見える状態と二重送信を防ぐ
- 対象: モニター招待・運用・設定・フィードバック・初回開始
- 変更範囲: 表示層のみ。Server Action、認証、DB、API、Desktopは変更しない
- Draft PR: [#83](https://github.com/team478a/manga/pull/83)
- Preview:
  `https://mangai-hub-staging-hvbsecmo4-team478as-projects.vercel.app`
- 状態: 実装、ローカル品質ゲート、全CI、Vercel Preview成功。責任者確認待ち

---

## 0. 現在の優先タスク（一般向けモニター本番統合、2026-07-31）

- Branch: `codex/cloud-monitor-production-v1`
- Base: `feature/manga-canvas-mvp`
- 本番URL: `https://app.mang-ai.com`
- 目的: 一般向けRelease 1〜6を約10名へ本番招待制で段階公開する
- 除外: Stripe、販売、Marketplace、成人向け公開、Desktop
- 状態: 統合済み、品質ゲートとDraft PR作成中
- 正本:
  [`cloud/CLOUD_GENERAL_MONITOR_PRODUCTION_INTEGRATION.md`](cloud/CLOUD_GENERAL_MONITOR_PRODUCTION_INTEGRATION.md)

成人向け市場分析・企画のコードが統合履歴に含まれても、Productionの成人向け
Feature Flagは未設定または`false`を必須とする。本番マージ、migration適用、
Feature Flag有効化、redeploy、実招待はDraft PRの全CIと責任者承認後に行う。

---

## 0. 現在の優先タスク（Release 2 AI企画提案・限定公開準備、2026-07-30）

- Branch: `codex/cloud-proposal-generation-v1`
- Base: `codex/cloud-research-ai-auto-ux-v1` (`a21fd94`)
- Draft PR: [#69](https://github.com/team478a/manga/pull/69)
- 目的: 完了した一般向け市場分析から3企画を生成・比較・選択し、シナリオ生成へ引き継ぐ
- 状態: 実装・限定公開前ハードニング・ローカル品質ゲート完了。更新Preview CIと責任者実機受入れ待ち
- 正本: `docs/CURRENT_TASK.md`、`docs/cloud/CLOUD_PROPOSAL_GENERATION_V1.md`、`docs/cloud/CLOUD_RELEASE2_LIMITED_RELEASE_RUNBOOK.md`

管理画面で設定済みのOpenAI接続とSupabase Vaultを再利用する。APIキーをローカル・Vercelへ複製しない。成人向けReportを外部AIへ送信しない。

---

## 0. 現在の優先タスク（売れ筋優先・AIおまかせ市場分析、2026-07-30）

- Branch: `codex/cloud-research-ai-auto-ux-v1`
- Base: `codex/cloud-adult-planning-option-v1` (`58a18b9`)
- 目的: 簡単な希望だけで「今、どんな漫画が買われる可能性が高いか」を具体的に提示する
- 状態: local実装済み。migrationと管理者キー登録は責任者申告で完了。更新Preview実機E2E、責任者承認待ち
- 正本: `docs/CURRENT_TASK.md`、`docs/cloud/CLOUD_RESEARCH_AI_AUTO_UX_SPEC.md`

成人向け内容は外部AIへ送信しない。APIキーは通常テーブル、Client、URL、ログ、監査へ出さない。既存stacked PRをrebase、force push、Close、mergeしない。

---

## 0. 現在の優先タスク（成人向け企画ブリーフ、2026-07-29）

本節を、直後に残る成人向け市場分析と一般向けRelease 1統合記録より優先する。

- Branch: `codex/cloud-adult-planning-option-v1`
- Base: `codex/cloud-adult-research-option-v1` (`a9969ac`)
- 親Draft PR: [#66](https://github.com/team478a/manga/pull/66)
- Draft PR: [#67](https://github.com/team478a/manga/pull/67)
- 目的: 成人向け市場分析を完了した許可利用者へ、外部AIを使わない企画ブリーフを機能単位権限付きで提供する
- 状態: 実装・全CI完了、Vercel Preview Ready、責任者の実機受入れ待ち
- Preview: `https://mangai-hub-staging-git-codex-cloud-ad-95f9df-team478as-projects.vercel.app`
- 正本: `docs/CURRENT_TASK.md`、`docs/cloud/CLOUD_ADULT_PLANNING_OPTION_SPEC.md`、`docs/cloud/CLOUD_ADULT_PLANNING_IMPLEMENTATION_REPORT.md`

この段階では利用者入力の保存・履歴・再表示だけを提供する。成人向け文章・画像の自動生成、外部Provider送信、Stripe自動許可、作品公開・販売は行わない。migration適用とFeature Flag有効化は責任者承認まで禁止する。

---

## 0. 現在の優先タスク（成人向け市場分析オプション、2026-07-29）

本節を、直後に残る一般向けRelease 1統合記録より優先する。

- Branch: `codex/cloud-adult-research-option-v1`
- Base: `codex/cloud-release1-integration-v1` (`6491a7d`)
- 親Draft PR: [#65](https://github.com/team478a/manga/pull/65)
- Draft PR: [#66](https://github.com/team478a/manga/pull/66)
- 目的: 成人向け市場分析を購入者・管理者許可利用者へ提供できる許可制Cloudオプション
- 状態: 実装・全CI完了、Vercel Preview Ready、責任者の実機受入れ待ち
- Preview: `https://mangai-hub-staging-git-codex-cloud-ad-7158e2-team478as-projects.vercel.app`
- 正本: `docs/CURRENT_TASK.md`、`docs/cloud/CLOUD_ADULT_RESEARCH_OPTION_SPEC.md`、`docs/cloud/CLOUD_ADULT_RESEARCH_IMPLEMENTATION_REPORT.md`

一般向け市場分析は成人向け権限に依存させない。成人向けの画像・本文生成、Stripe自動連携、作品公開・販売は対象外。migration適用、Feature Flag有効化、DB Kill Switch有効化、本番公開は責任者承認まで行わない。

---

## 0. 現在の優先タスク（2026-07-29）

過去の引継ぎ記録より本節を優先する。

- Branch: `codex/cloud-release1-integration-v1`
- Base: `origin/feature/manga-canvas-mvp` (`7615d06`)
- Draft PR: [#65](https://github.com/team478a/manga/pull/65)
- 目的: 市場分析だけを限定公開できるRelease 1統合
- 統合元: PR #50、#56〜#62
- 除外: PR #48〜#49、#51〜#55、#63〜#64
- 状態: 公開前ハードニングと全品質ゲートを実行中。merge・本番反映は禁止
- 正本: `docs/CURRENT_TASK.md`、`docs/cloud/CLOUD_RELEASE1_INTEGRATION_REPORT.md`、`docs/cloud/CLOUD_RELEASE1_BETA_ACCEPTANCE.md`

既存PRは統合元としてそのまま保持し、rebase、force push、Closeを行わない。以下の節は保守性改善・Desktop作業時点の履歴として残す。

## 1. 引継ぎ情報

- 更新日: 2026-07-26
- リポジトリ: `team478a/manga`
- デフォルトブランチ: `feature/manga-canvas-mvp`
- デフォルト最新コミット: `c99a96b172fd1b45c8e8b3c4f4b2417347a0e62e`（`Merge pull request #32 from team478a/codex/creator-workflow`）
- 保守性改善統合ブランチ: `integration/maintenance-stack-20260726`
- 統合PR: **#34**（`integration/maintenance-stack-20260726` → `feature/manga-canvas-mvp`、Draft、mergeable、責任者レビュー待ち）
- デザイン仕様PR: **#33**（`design/mangai-ui-refresh` → `handoff/codex-to-claude-20260725`、Draft、文書のみ）
- 現在状態: `READY_FOR_REVIEW`（PR #34のレビュー・マージ判断待ち）

**この文書が正本です。会話履歴・過去のセッション要約を正本として扱わないでください。**

## 2. 製品構成

| 製品 | 主な配置 | 責務 |
| --- | --- | --- |
| MANGAI Hub / Cloud | リポジトリルート、`src/` | 一般漫画制作、Project/Canvas、認証、公開、販売、Stripe、管理 |
| MANGAI Desktop | `apps/desktop/` | Windowsローカル制作、成人向け制作、Ollama、ComfyUI、書き出し、更新 |
| 共通Domain | `packages/` | Canvas、AI、Project、Export、IPC schema等の共通処理 |
| Hub DB | `supabase/` | PostgreSQL、RLS、Storage、migration |

製品方針は、一般漫画をCloud、成人向け漫画をDesktopで扱う分離構成です。成人向け処理と人物・参照画像・完成Pageはローカル優先・fail-closedを維持します。

## 3. 現在のブランチ構造

```text
feature/manga-canvas-mvp (デフォルト)
  ├─ PR #30〜#32: Vercel workspace package build修正、パスワード確認・再設定フロー、
  │                Creatorプロフィール・作品アップロード安全性強化（merge済み）
  │
  ├─ integration/maintenance-stack-20260726 (Draft PR #34)
  │    保守性改善PR #14〜#28（15コミット、stacked）をcherry-pickし、
  │    PR #30〜#32の機能と統合済み。責任者レビュー・マージ判断待ち。
  │
  └─ handoff/codex-to-claude-20260725
       └─ design/mangai-ui-refresh (Draft PR #33)
            「MANGAI Creative Studio」デザイン仕様（docs/design/配下、文書のみ）
            責任者が方向性を承認済み。画面別「デザイン承認条件」は未了。
```

PR #14〜#28（元のstacked Draft PR、`codex/pr-09-desktop-migration-runner`〜`codex/pr-23-hub-structured-logging`）は、PR #34への統合作業の元データとしてそのまま残存しています。個別にmerge・rebase・closeはしていません。

## 4. 保守性改善スタックの統合状況（PR #34）

2026-07-24時点で完了していた保守性改善PR-01〜PR-23（GitHub Draft PR #14〜#28）を、2026-07-26に`feature/manga-canvas-mvp`の最新状態へ統合しました。

- 統合方法: 古い順に1コミットずつ`git cherry-pick`（一括cherry-pickではない）
- 競合: 3件（`src/app/actions.ts`＝PR#19、`package.json`＝PR#20、`src/app/actions/{auth,profile,work}-actions.ts`＝PR#27）。いずれも分割構造（薄い互換entrypoint＋機能別ファイル）を採用しつつ、PR #30〜#32由来の新機能（パスワード確認、sharp画像形式検証、旧画像Storage削除等）を保持する形で解決
- 品質ゲート: lint/typecheck/deps:check/hub:test(116/116)/canvas:test(26/26)/ai:test(44/44)/desktop:test(98/98)/migration検証/Hub build/Desktop build/rc:preflight/git diff --check、すべてPASS
- CI（PR #34）: Required Quality PASS、Migration roundtrip PASS、Desktop Windows PASS（Accessibility testsを含む）、Vercel Preview Ready

詳細・競合解決の判断根拠は[`docs/integration/MAINTENANCE_STACK_INTEGRATION_20260726.md`](../docs/integration/MAINTENANCE_STACK_INTEGRATION_20260726.md)を参照してください。

## 5. Claude Code / Codexが最初に行うこと

```bash
git fetch origin
git checkout integration/maintenance-stack-20260726
git pull origin integration/maintenance-stack-20260726

git status --short
git log --oneline --decorate -15
git diff feature/manga-canvas-mvp...HEAD --stat
```

その後、以下を読みます。

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`（本ファイル）
4. `docs/CURRENT_TASK.md`
5. `docs/HANDOFF_LOG.md`
6. 対象機能の設計文書

## 6. 現在の次工程

1. PR #34の責任者レビュー・マージ判断を待つ（本ブランチでの新規変更は、レビュー指摘への対応以外は行わない）。
2. PR #34が`feature/manga-canvas-mvp`へmergeされたら、PR #33（`docs/design/DESKTOP_CREATIVE_STUDIO_SPEC.md`）のビジュアル仕様承認（§4各画面末尾・§8）が揃っているか確認する。
3. 上記2点が揃った時点で、**merge後の最新`feature/manga-canvas-mvp`から新しい実装ブランチを作成**し、Phase D1（デザイントークン導入）へ着手する。`design/mangai-ui-refresh`をそのまま実装ブランチとして流用しない。
4. hosting環境決定後、Hub Structured Loggingのlog sink、alert通知先、保持期間、担当者を設定する。
5. Supabase stagingへmigrationを適用し、Desktop端末認証を確認する。
6. Stripe test決済、失敗、返金、download E2Eを実施する。
7. 実Ollama、実ComfyUI、承認済みDezgo safe素材試験を実施する。
8. Windowsコード署名、署名済み自動更新、クリーンPC受入れを実施する。

外部環境や契約が必要な作業を、mockや静的確認だけで完了扱いにしないでください。

## 7. 外部環境待ち・責任者判断待ち

| 項目 | 状態 | 必要条件 |
| --- | --- | --- |
| Desktop Accessibility（ローカル） | LOCAL_BLOCKED_EXTERNAL_ENVIRONMENT | Xサーバー（ディスプレイ）を持つ実行環境。GitHub ActionsのDesktop Windows workflowでは`npm run test:a11y`が成功済み |
| Vercel Preview deployment | PASS（CI確認済み） | ― |
| Vercel本番環境の通し受入れ | BLOCKED_EXTERNAL_ENVIRONMENT | Vercel/Supabase/Stripe本番設定 |
| Windows実署名 | BLOCKED_EXTERNAL_ENVIRONMENT | 信頼されたコード署名証明書 |
| 署名付き更新E2E | BLOCKED_EXTERNAL_ENVIRONMENT | 署名済み2version、公開更新URL |
| クリーンWindows受入れ | BLOCKED_EXTERNAL_ENVIRONMENT | Windows VMまたは新規PC |
| Ollama実環境E2E | BLOCKED_EXTERNAL_ENVIRONMENT | Ollama、対象モデル |
| ComfyUI実環境E2E | BLOCKED_EXTERNAL_ENVIRONMENT | ComfyUI、モデル、workflow JSON |
| Dezgo実API E2E | BLOCKED_EXTERNAL_ENVIRONMENT | BYOK key、課金承認、safe素材条件 |
| Supabase staging | BLOCKED_EXTERNAL_ENVIRONMENT | staging DB、接続情報、`psql` |
| Stripe E2E | BLOCKED_EXTERNAL_ENVIRONMENT | Stripe test、Webhook endpoint |
| log sink/alert | DECISION_REQUIRED | hosting、通知先、保持期間、担当者 |
| Desktopブランドカラー・テーマ・Tailwind非移行 | 確定済み（責任者指示、2026-07-26） | ― |
| Hubの配色・ダークモード方針 | DECISION_REQUIRED | Desktopデザイン確定後に判断（`docs/design/DESIGN_SYSTEM.md`§5） |

## 8. 壊してはいけない境界

- `feature/manga-canvas-mvp`へ直接pushしない。
- PR #34、PR #33を無断でrebase、force push、squashしない。
- 既存migrationを書き換えない。
- API responseの互換フィールドを削除しない。
- Desktop IPC schema、backup version、Project保存形式を無断変更しない。
- `MangaiDatabase`、`service.ts`、`actions.ts`等の互換entrypointを利用箇所確認前に削除しない。
- Domain Errorを生のError message判定へ戻さない。
- 未知例外、Supabase error詳細、Stripe error、token、Prompt、画像、メールをクライアントやlogへ露出しない。
- 成人向け、人物、参照画像、完成Pageの外部送信制限を緩和しない。
- `design/mangai-ui-refresh`（PR #33）でUIコード・CSS・Reactコンポーネントを変更しない。

## 9. 標準品質ゲート

```bash
npm run deps:check
npm run lint
npm run typecheck
npm run hub:test
npm run canvas:test
npm run ai:test
npm run desktop:test
npm run desktop:test:a11y
npm run db:migrations:validate
npm run build
npm run desktop:build
npm run rc:preflight
git diff --check
```

環境依存で実行できない項目は、コマンド、error、必要環境を`docs/CURRENT_TASK.md`へ記録します。`desktop:test:a11y`はローカルの実行可否とGitHub Actions Windows CIの結果を区別して記録してください。

## 10. Codex ⇄ Claude Code間で引き継ぐ場合

利用上限または作業区切りで引き継ぐ場合:

1. 新規変更を開始しない。
2. `docs/CURRENT_TASK.md`を更新する。
3. `docs/HANDOFF_LOG.md`へ追記する。
4. テスト結果と未完了項目を記録する。
5. 小さなcheckpoint commitを作成し、現在branchへpushする。
6. 次の担当者へ以下の指示を渡す。

```text
AGENTS.md、CLAUDE.md、docs/AI_HANDOFF.md、docs/CURRENT_TASK.md、
docs/HANDOFF_LOG.mdを読み、git status、直近15コミット、
feature/manga-canvas-mvpとの差分を確認してください。
CURRENT_TASK.mdの未完了項目から継続し、完了済み変更を作り直さないでください。
```
