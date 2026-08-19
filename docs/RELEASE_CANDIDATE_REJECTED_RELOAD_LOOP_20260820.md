# MANGAI Rejected Candidate Reload Loop Release Candidate

作成日: 2026-08-20
Branch: `codex/fix-r4-3-rejected-reload-loop`
Base: `feature/manga-canvas-mvp` @ `f9f2b544fe0ffc0cc5c23064097ccce089f1073d`
Draft PR: [#314](https://github.com/team478a/manga/pull/314)

## 目的

既存原稿修復で不採用画像layerをCanvasから外した後、不採用Jobの`auto_placed`履歴を未読込画像と誤認してページを再読込し続ける問題を止める。

## Production受入れ

- Production deployment `641F4jYmhK19GWyKbxmDw4zkLo9M`がPR #313 merge commitを含み、Ready／Productionであることを確認した。
- `test`の対象22ページで「既存原稿を修復」を1回実行した。
- 対象は不採用画像3件、短い縦書き0件、逆転背景2コマだった。
- Canvas revisionは8から9へ進み、保存済み、PNG成功を確認した。
- 残りcreditは24のまま。画像生成、Provider API呼出し、credit消費は0件。
- 修復後は画像2/4、生成中0、失敗1、コマ1・2未配置の未完成状態となり、不採用画像の警告は消えた。

## 根因

自動配置済みJobのAssetをCanvasへ反映するeffectは、`panel_adoption_status=auto_placed`かつ同じ`sourceJobId`のlayerがない場合に再読込する。不採用修復はlayerを安全に外す一方、監査履歴としてJobの`auto_placed`状態を保持する。この組合せにより、不採用Jobを未読込の正常Jobと誤認した。

Runtime Logsでは対象page-lock APIが200であり、DB、RPC、認証、lease取得の障害ではない。再読込によりReact stateが`checking`へ戻り続けていた。

## 修正契約

自動反映の再読込候補から`quality_review_status=rejected`を除外する。

- 通常の完成Job／auto placementは従来どおり再読込する。
- 不採用履歴は変更しない。
- Canvas修復内容を戻さない。
- ページ完成guardを緩めない。
- Provider APIを呼ばない。

## 回帰検査

- 集中UI契約: 18/18
- dependency/module boundary: error 0、既存warning 2
- lint: 成功
- Hub／Desktop typecheck: 成功
- Hub: 821/821
- Canvas: 26/26
- AI: 48/48
- Desktop: 182/182
- Desktop accessibility: violation 0
- Supabase migration validation: 61件
- Hub build: 成功
- Desktop build: 成功（既知のbundle size warningのみ）
- RC preflight: Repository structure READY。外部設定と手動E2EのPendingは既存ローカル環境依存
- `git diff --check`: 成功

## CI／Preview

- 初期HEAD `c53baed`のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Preview: `https://mangai-hub-staging-git-codex-fix-r4-3-6d2c28-team478as-projects.vercel.app`
- `/login`にMANGAI Creator Platform、メールアドレス、パスワード、ログインボタンが表示された。
- ブラウザコンソールのerror／warningは0件。
- PreviewでProductionデータ、Provider、credit、Canvasを操作していない。

## 不変範囲

DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF処理、成人向け境界、Desktop製品コードを変更しない。

## Rollback

本PRをrevertする。DB／schema変更がないためmigration rollbackは不要。Productionのrevision 9は通常のCanvas revision／checkpoint契約で保持する。

## 停止条件

Draft PR、全CI、Vercel Previewの確認後に停止する。責任者確認前にProductionで不足コマを再生成しない。
