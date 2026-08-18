# RELEASE CANDIDATE: PR-R4-3A-7 Monitor Review Portal

## 対象

- Branch: `codex/feat-r4-3a7-monitor-review-portal`
- Base: `feature/manga-canvas-mvp` @ `d154895cc04e198a60090ae4c74ea90ed1e7299b`
- 目的: 招待モニターがBenchmark専用画像を独立Human Reviewできるモバイル画面と管理者進捗画面を追加する。

## 実装

- fail-closed Feature Flag `MANGAI_MONITOR_QUALITY_REVIEW_ENABLED`
- モニター画面 `/dashboard/monitor/quality-review`
- 同意、1画像判定、確信度、欠陥分類、下書き自動保存、再開、画像確定、最終送信
- 管理画面 `/admin/general-monitors/quality-review`
- Reviewer A/Bの別人制約、割当、確定数・送信状況
- private Storageと120秒署名URL
- 本人限定RPC、直接テーブル権限なし、既存Human Review record契約の再利用

## 変更しない境界

- Provider、model、pricing、credit、retry、timeout、Scheduler
- Canvas schema、漫画生成、PNG／PDF、販売処理
- 成人向け境界、Desktop
- 顧客作品、Production作品、モニター作品
- 正解label、AI監査、他Reviewer回答

## 検証記録

- 集中テスト: 成功（13/13）
- migration validate: 成功（60本）
- Hub typecheck: 成功
- deps／lint／Hub 792/792／Canvas 26/26／AI 48/48／Webpack Hub build／RC structure／diff check: 成功
- 通常Turbopack: 既知Windows path lengthでローカル停止
- Desktop typecheck／test／a11y／build: 差分外のローカル`@napi-rs/keyring`型宣言不足。GitHub CIで正式判定
- Draft PR: [#299](https://github.com/team478a/manga/pull/299)（Draft／MERGEABLE）
- GitHub CI: 実装HEAD `f213ff4`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsがすべて成功
- Vercel Preview: [Ready](https://mangai-hub-staging-git-codex-feat-r4-377b35-team478as-projects.vercel.app)
- Production変更: なし

## 運用上の残作業

- private Batch 01の人間による権利確認
- 権利確認済みpackageのstaging登録手順と照合
- 異なるモニターへのReviewer A/B割当
- 390×844相当の実機受入れ
- A/B完了後のresponse export、比較、不一致裁定

責任者確認前にProduction登録、有効化、R4-3B実装へ進まない。
