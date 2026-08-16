# PR-R4-2Y 失敗候補の再実行デッドロック解消

作成日: 2026-08-16
Branch: `codex/accept-r4-2y-page22-device-quality`
Base: `origin/feature/manga-canvas-mvp` @ `be7ae34`（PR #281 merge commit）
Draft PR: [#282](https://github.com/team478a/manga/pull/282)（Draft／MERGEABLE）
Vercel Preview: https://mangai-hub-staging-git-codex-accept-r-5e2140-team478as-projects.vercel.app

## 目的

PR #281反映後のProduction受入れで再現した、同一コマの失敗候補を再実行できない画面上のデッドロックを解消する。既存の再実行API、保存済み生成条件、安全再構成、課金・排他契約を維持する。

## Production受入れ結果

- 対象は`test`モニターのページ22・コマ1。開始時はCanvas revision 8、使用64／予約0／残36だった。
- ネームどおりの構図で候補2案だけを登録し、予約4／残32を確認した。
- 公式Worker [31916441291](https://github.com/team478a/manga/actions/runs/31916441291)は`status=idle requests=3 processed=2`で成功した。
- 2 Jobとも画像Assetを作成せず失敗し、予約は全額解放された。最終は使用64／予約0／残36。Provider課金、Canvas revision、PNG、公開・販売状態の変更はない。
- ページ完成判定は画像4/4、セリフ1/1、生成中0、失敗1、保存revision 8／最新8、PNG成功。コマ1・2・4の目視確認、未配置候補1件、自動配置確認が残る。
- 失敗Jobの「このコマだけ再実行」はすべて無効で、「同じコマの生成または候補確認が進行中」と表示された。実際にはqueued／running Jobは0だった。

## 原因

- `hasUnresolvedPanelGeneration`は同一コマのqueued／runningに加え、未採用のcompleted候補も未解決として返す。
- この判定は「候補を使わず作り直す」など、確認待ち候補を残したまま追加生成しない操作には必要である。
- 失敗Jobの再実行ボタンにも同じ判定を使っていたため、過去または同一候補群のcompleted候補があるだけで、失敗した候補を補充できなかった。
- 再実行APIは失敗Job IDから所有者境界内で保存済み入力を復元し、新しいJobを登録する。画面以外に同じcompleted候補排他はない。

## 実装

1. 同一コマの`queued`／`running`だけを判定する`hasActivePanelGeneration`をdomainへ追加する。
2. 失敗Jobの案内と再実行ボタンだけをactive判定へ切り替える。
3. 未採用completed候補を含む従来の`hasUnresolvedPanelGeneration`は、候補の作り直し・品質確認取消しの排他として維持する。
4. sibling failed／completed候補では再実行可能、queued／runningがあれば停止する回帰テストを追加する。

## 回帰境界

- 変更なし: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry回数、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- 再実行時は既存APIが失敗Job ID、保存済み入力、rate limit、所有者条件、一般向け安全再構成を引き続き使用する。
- 同一コマにqueued／running Jobがある間は再実行を無効化し、並行重複を許可しない。
- 本PR中は追加のProduction Provider実行を行わない。merge後に今回失敗したコマ1の候補を1件だけ安全再実行する。
- Prompt本文、Provider応答、署名URL、利用者画像、API keyをログ・文書へ記録しない。

## 検証

- 集中: `manga-panel-candidate-boundary`、`cloud-interactive-generation-retry` 12/12成功。
- Hub全体737/737、Canvas 26/26、AI 48/48、100ページ長編4/4、migration 59/59が成功。
- dependency／module boundary、lint、Hub typecheck、research eval、Cloud漫画repository、owner isolation、workspace packages、Webpack production build、RC structure、diff checkが成功。
- Desktop test／a11y／buildは、この変更範囲より前に既知の`@napi-rs/keyring`型宣言不足で停止した。Windows CIを正式判定にする。
- Draft PR #282のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功した。

## 停止条件

- Draft PR #282はDraft／MERGEABLE。Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Productionの予約Creditが0、Canvas revision 8、公開・販売変更なしを確認する。
- 責任者のmerge前に失敗Jobの再実行と次工程へ進まない。
