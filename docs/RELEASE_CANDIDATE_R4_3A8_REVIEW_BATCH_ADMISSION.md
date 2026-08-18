# RELEASE CANDIDATE: PR-R4-3A-8 Review Batch Admission

## 対象

- Branch: `codex/feat-r4-3a8-review-batch-admission`
- Base: `feature/manga-canvas-mvp` @ `2ab608b799c1c8092adad589fc0ae2df3d664bd6`
- 目的: 権利未確認画像をモニターHuman Reviewへ登録できないようにし、確認済み28件をstagingへ安全に取込む入口を追加する。

## 実装

- 権利確認packageの構造検査とHuman完了検査を分離
- 確認者、確認日時、Provider規約、Benchmark利用、顧客／Production作品不使用、個人情報なし、成人向けなしを全件で必須化
- package SHA-256、画像SHA-256、PNG、寸法、必須Content Credentials、case setを再検査
- 既定dry-runのstaging専用取込CLI
- staging URL／環境project ref／明示確認project refの三者一致
- Production project ref拒否、一般Supabase環境変数不使用
- private bucketへの非上書きupload、失敗時のStorage／DB cleanup
- 取込後も`draft`で停止し、active化とReviewer A/B割当を別工程へ分離

## 不変

- Production DB／Storage／作品
- 既存migration、RPC、RLS、URL、API、Feature Flag
- Provider、model、pricing、credit、retry、timeout、Scheduler
- runtime Visual Judge、自動修復、Canvas、checkpoint、PNG／PDF、成人向け境界、Desktop
- Human ReviewerをAIで代替しない

## 現在の状態

- private Batch 01: 28画像の機械検査済み
- Human権利確認: 0/28（完了回答は未受領）
- モニターA/B: 0/56
- 正式Benchmark: 0/140
- staging／Production取込: 未実施

## ローカル検証

- 集中回帰: 15/15成功
- dependency／module boundary、lint、Hub typecheck: 成功
- Hub: 796/796成功
- Canvas: 26/26成功
- AI: 48/48成功
- migration／rollback: 60本成功
- 研究評価、Cloud漫画repository、owner isolation、100ページ4/4: 成功
- Hub production build: Webpackで成功
- RC preflight: structure ready
- `git diff --check`: 成功
- 通常Turbopack: 既知のWindows path length上限で停止
- Desktop typecheck／test／a11y／build: 差分外のローカル`@napi-rs/keyring`型宣言不足。GitHub Windows CIで正式判定する

## 停止条件

- Draft PR、全CI、Vercel Previewを確認して停止する。
- 完了済み権利確認packageを受領するまでstagingへapplyしない。
- staging取込後も、件数・private bucket・SHA確認前にactive化しない。
- 責任者確認とA/B Human Review完了前にProduction登録やR4-3Bへ進まない。

## Draft PR

- PR: [#300](https://github.com/team478a/manga/pull/300)（Draft／MERGEABLE）
- Preview: [Ready](https://mangai-hub-staging-git-codex-feat-r4-e9ad91-team478as-projects.vercel.app)
- Core quality: 成功
- Migration roundtrip: 成功
- Windows build: 成功
- Vercel: 成功
- Vercel Preview Comments: 成功
- Production／staging変更: なし
