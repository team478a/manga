# 原稿未生成表示・品質フィードバック保存阻害修正

## 目的

2026-08-19の利用者報告で確認した次の2件を、外部生成・課金・保存契約を緩めずに解消する。

1. 原稿編集画面がコマ枠、吹き出し、文字だけを表示し、画像生成前であることや次の操作が分からない。
2. 原稿の品質フィードバックが繰り返し保存失敗する。

## 基準

- Base: `origin/feature/manga-canvas-mvp` @ `24da38c8632d3f36cf364bf616f3af668322cd4a`
- Branch: `codex/fix-r4-3-monitor-manuscript-blockers`
- Production変更: なし

## 調査結果

### 原稿画像

- 写真のCanvasにはコマ枠、吹き出し、テキストだけが存在し、コマ画像が結び付いていない。
- 現行製品は画像生成の費用・Provider送信を利用者の明示操作で開始するため、Storyboardから作成したネームだけでは完成原稿画像にならない。
- 既存の一括生成入口は作品構成画面、1コマ生成入口はEditor左側の下部にあり、空白原稿の初期表示から状態と入口を判断しにくかった。
- 完成状態の詳細取得が失敗した場合は既存Page Completion表示自体が省略されるため、Canvasだけを見ても未生成と表示障害を区別できなかった。

### 品質フィードバック

- APIは利用者sessionでモニター資格、ページ所有、作品・ページ一致、対象コマ、生成Jobを検証している。
- その後のINSERTだけは利用者Supabase clientでRLSを再評価しており、一般モニター報告が使うserver-only保存境界と実装が分かれていた。
- 結果として、事前検証を通過してもProduction側のRLS／schema状態で原稿評価だけ保存失敗し得た。

## 修正

### 原稿画像の状態案内

- Canvas自身から画像なしコマ数を算出し、Page Completion詳細が取得できない場合も上部案内を表示する。
- 生成Jobに応じて「未生成」「生成中」「生成失敗」「生成済み・配置確認待ち」を区別する。
- 未生成時は、表示中の内容が完成原稿ではなくネームであることを明示する。
- 作品画面の`4〜8ページをまとめて生成`へ直接移動する導線を追加する。
- 1コマだけの場合は、コマ選択後に既存AI制作アシストを使うことを案内する。

### 品質フィードバック保存

- App Routerは従来どおり利用者sessionでモニター資格と対象所有を検証する。
- 検証済みpayloadだけを`general-monitor/infrastructure`のserver-only repositoryへ渡す。
- repositoryは構造化列へ保存し、既存の列不足判定だけ従来schemaへfallbackする。
- RLS違反、制約違反、接続障害を成功扱いにしない。
- DBの生エラーや内部情報を利用者へ表示しない。

## 安全境界

- 画像生成は利用者の明示操作前に開始しない。
- Provider request、credit予約・確定、model、pricing、retry、timeout、Schedulerを変更しない。
- DB、migration、RPC、Storage、Canvas schema、PNG／PDF、成人向け境界、Desktop製品コードを変更しない。
- Production作品、Canvas、Job、Asset、feedbackを変更しない。

## 回帰検査

- 集中: 6/6 PASS
- dependency boundary: PASS
- module boundary: error 0、既存warning 2
- lint: PASS
- Hub typecheck: PASS
- Hub: 810/810 PASS
- Canvas: 26/26 PASS
- AI: 48/48 PASS
- Desktop: 182/182 PASS
- Desktop accessibility: violation 0
- migration validation: 61/61 PASS
- Hub production build: PASS
- `git diff --check`: PASS

## merge後の確認

1. 報告元モニターで同じページを再読込し、上部に未生成状態と一括生成導線が表示されることを確認する。
2. 有料生成は自動開始されないことを確認する。
3. 同じ入力で品質フィードバックを1件保存し、成功表示と本人履歴／管理者一覧を確認する。
4. 画像生成を実行する場合は、必要creditとProvider設定を画面で確認し、4〜8ページ単位の明示操作として別途実施する。

## Draft PR・Preview

- Draft PR: [#309](https://github.com/team478a/manga/pull/309)
- 初回HEAD: `a0701c52b91b1a88d8c9d51d75f59dd678a39170`
- PR状態: Draft／MERGEABLE
- Core quality: PASS
- Migration roundtrip: PASS
- Windows build: PASS
- Vercel: PASS
- Vercel Preview Comments: PASS
- Preview: [Ready](https://mangai-hub-staging-git-codex-fix-r4-3-babd9e-team478as-projects.vercel.app)
- Production変更: なし
