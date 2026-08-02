# 一般向けCloud漫画制作 統合レポート v2

## 目的

最新の`feature/manga-canvas-mvp`へ、Draft PR #94〜#121で積み上げた一般向け漫画生成・長編制作機能を非破壊で統合する。

## 統合範囲

- BFL FLUXによる一般向けコマ画像生成、複数候補、採用、再生成
- コマ部分修正、画角拡張、比較、マスク提案、構図制御
- 背景・人物・効果の分離生成と透明レイヤー合成
- キャラクター設定、画風・世界観設定、参照画像割当
- 8／32／100ページの構成、章・シーン、制作進捗、連続性管理
- 4〜8ページ一括生成、編集ロック、永続PDF Export、Storage lifecycle
- 作品別予算、チェックポイント、差分確認、復元、完成準備
- 限定モニターのページ／コマ品質フィードバック

## 最新ベースから保持した機能

- 管理者ユーザーの停止、再開、安全な削除
- 削除済みユーザーの一覧除外
- 招待送信状況、初回ログイン状況
- 表示名・メール・状態・招待・ログインによる検索と絞り込み

## migration統合

- forward／rollback／canonical schemaを46件へ同期した。
- 最新ベースの`202608020001_cloud_general_monitor_invite_tracking`を保持した。
- 同一IDだったcheckpoint restoreは`202608020003_cloud_project_checkpoint_restore`へ改番した。
- stagingには旧ファイル名でSQL適用済みだが、SQLのオブジェクト内容は同一である。

## 品質確認

- `npm run deps:check`: 成功
- `npm run lint`: 成功
- `npm run build:packages`: 成功
- `npm run typecheck`: 成功（Hub／Desktop）
- `npm run research:eval`: 成功
- `npm run hub:test`: 421/421成功
- `npm run db:migrations:validate`: 46件成功
- migration forward → rollback → reapply: 成功
- canonical schema二重適用・assertion: 成功
- `npm run build`: 成功
- `git diff --check`: 成功

100ページfixtureでは、全ページ検査、変更ページだけの復元対象判定、4ページ×25segmentのPDF結合を確認した。

## 外部確認が必要な項目

- Vercel Previewでのレスポンシブ表示と操作確認
- 実BFL credentialを使う少額生成
- 8ページ以上の実ブラウザ編集・保存・PDF目視比較
- 責任者によるDraft PR承認

## 対象外

成人向け機能、Desktop新規実装、Stripe、Marketplace、本番Feature Flag変更、本番公開は行わない。
