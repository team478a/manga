# PR-R4-3A-10 Production Draft Acceptance

## 結論

- Staging専用Supabaseを追加せず、既存ProductionのBenchmark専用境界へ権利確認済みBatch 01を非公開`draft`として登録した。
- Batchは`batch_private_01`、`PILOT_INTRINSIC_ONLY`、28ケースである。
- Reviewer割当と回答は0件、Feature Flagは停止中、通常作品と公開Storageは不変である。
- 28画像をprivate Storageから再取得し、DB記録のSHA-256と全件一致した。

## 基準

- Base: PR #302 merge commit `2da179c1b4c5534cf6eee182caeede773c932c7a`
- Branch: `codex/docs-r4-3a10-production-draft-acceptance`
- 対象migration: `202608180001_cloud_monitor_quality_review`
- Source package SHA-256: `05cf95e530d6ff699ade2a1237c882eb518281e15b9dcfb74f99a120f8a7ff59`
- 期間: 2026-08-20 00:00 JSTから2026-09-20 00:00 JST

## Production事前確認

- 対象Supabaseの`main / Production`と期待project refが一致した。
- migration適用前はBenchmark専用4テーブルと`manga-quality-review` bucketが存在しなかった。
- 実在する`admin` profileを確認し、取込actorに使用した。profile IDは文書・ログへ保存しない。
- Production用secret keyはSupabase画面から現在のローカル処理へだけ渡し、画面、stdout、環境ファイル、Gitへ保存しなかった。使用後はクリップボードを消去した。

## Migration受入れ

`202608180001_cloud_monitor_quality_review.sql`を責任者の明示承認後に適用した。適用後に次を確認した。

- private bucket `manga-quality-review`: `public=false`
- file size limit: 8 MiB
- MIME: PNG、JPEG、WebP
- 専用4テーブル: 4/4
- RLS: 4/4有効
- `anon`／`authenticated`の直接テーブル権限: 0
- 専用RPC: 3/3
- migration直後のBatch／case／assignment／response: 0件

## Draft取込受入れ

取込前dry-runは`PRODUCTION_BATCH_ADMISSION_READY`で成功し、DB／Storage／Production変更は0件だった。三重確認を指定した実取込後、Productionを直接読み取り検査した。

- Batch code: `batch_private_01`
- status: `draft`
- review scope: `PILOT_INTRINSIC_ONLY`
- source package SHA-256: 一致
- case: 28件
- private Storage object: 28件
- assignment: 0件
- response: 0件
- Storage再取得・SHA-256照合: 28/28、一致しない画像0件

登録処理は非上書きで実施した。顧客作品、Production作品、モニター作品、Prompt、Provider情報、正解labelはBatchへ含めていない。

## 不変確認

- Batch active化なし
- Reviewer A/B割当なし
- `MANGAI_MONITOR_QUALITY_REVIEW_ENABLED`変更なし
- 一般モニターFeature Flag変更なし
- 通常作品、Canvas、公開Storage、Provider、model、pricing、credit変更なし
- API、URL、PNG／PDF、成人向け境界、Desktop変更なし
- 正式Benchmark採用なし。正式件数は0/140のまま

## ローカル検証

- Benchmark batch admission回帰: 5/5
- Supabase migration／rollback manifest: 60本
- dependency／module boundary: error 0、既知warning 2件は差分外
- lint: 成功
- RC structure preflight: READY
- `git diff --check`: 成功
- 外部設定はローカルへ秘密値を残さないためPENDINGのまま。Production受入れ結果は上記の直接検査を正本とする。

## ロールバック

- active化前のため利用者への公開は発生していない。
- 問題時は対象Batch codeとStorage prefixを完全一致で確認し、Batchに限定して削除する。
- schema全体のrollbackは`supabase/rollbacks/202608180001_cloud_monitor_quality_review.sql`を使用できるが、Productionで自動実行しない。
- 回答が作成された後は、退避と責任者承認なしにBatch、Storage、schemaを削除しない。

## 次工程の停止条件

このPRでは証跡同期だけを行う。全CIとVercel Preview成功後、次を実行せず停止する。

- Batchの`active`化
- Reviewer A/B割当
- Production Feature Flag有効化
- モニター回答の正式Benchmark採用
- R4-3B Visual Judge本体

次工程は、責任者が異なる2名の有効モニターを確認し、active化、A/B割当、Feature Flag有効化、スマートフォン受入れの順序を別途承認してから開始する。

## Draft PR

- Draft PR: [#303](https://github.com/team478a/manga/pull/303)
- 初回HEAD: `4c2f6c6c2c77d8884a433b7d658a9a8c0ee2fba0`
- Core quality: 成功
- Migration roundtrip: 成功
- Windows build: 成功
- Vercel: 成功
- Vercel Preview Comments: 成功
- Preview: [Ready](https://mangai-hub-staging-git-codex-docs-r4-5a9ce0-team478as-projects.vercel.app)

最終証跡同期commitでも同じ5チェックを再確認して停止する。
