# RELEASE CANDIDATE: PR-R4-3A-9 Production Draft Admission

## 対象

- Branch: `codex/feat-r4-3a9-production-draft-admission`
- Base: `feature/manga-canvas-mvp` @ `8650c12ba9009652cebc00e9cb8247807e1c4b2c`
- 目的: Staging専用Supabaseを新設せず、権利確認済みBenchmark Batch 01をProduction内の専用領域へ非公開`draft`として安全に登録できる入口を用意する。

## 実装

- 既定dry-runと既存staging経路は維持する。
- Productionは`--target-environment production`を明示した場合だけ選択できる。
- Production専用URL、service role、project refを使用し、一般のSupabase環境変数へfallbackしない。
- 対象project ref、Batch code、固定確認句`BENCHMARK_PRIVATE_DRAFT_ONLY`の三重確認を要求する。
- `created_by_profile_id`が対象環境の実在する管理者であることを取込前に検査する。
- 保存先はBenchmark専用4テーブルとprivate bucket `manga-quality-review`のBatch UUID配下だけに限定する。
- Batchは`draft`、scopeは`PILOT_INTRINSIC_ONLY`、Reviewer割当は0件のまま停止する。
- uploadは非上書き。登録後にBatch、case件数、割当0件、DB上のSHA-256、Storage再取得画像のSHA-256を検査する。
- 失敗時は当該BatchのStorage pathとDB Batchをcleanupする。

## 不変

- 通常作品、顧客作品、モニター作品、Canvas、公開Storage
- active化、Reviewer A/B割当、Feature Flag
- DB schema、migration、RPC、RLS、API、URL
- Provider、model、pricing、credit、retry、timeout、Scheduler
- runtime Visual Judge、自動修復、PNG／PDF、成人向け境界、Desktop

## 外部状態

- Production DB／Storageへのapplyは今回行わない。
- Staging専用Supabaseは準備しない。
- Human権利確認は28/28。モニターA/Bは0/56、正式Benchmarkは0/140のまま。

## 検証

- 実package Production dry-run: `PRODUCTION_BATCH_ADMISSION_READY`、28件、package SHA-256一致、外部変更0件
- 集中回帰: 5/5成功
- dependency／module boundary: 成功（既知warning 2件は差分外）
- lint、Hub／Desktop typecheck: 成功
- Hub: 797/797成功
- Canvas: 26/26成功
- AI: 48/48成功
- Desktop: 182/182成功
- Desktop accessibility: violation 0
- Hub production build、Desktop build: 成功
- migration validator: 60本成功
- RC preflight: structure ready
- migration roundtrip: GitHub CIで確認予定
- Windows build: GitHub CIで確認予定
- Vercel Preview: 確認予定
- `git diff --check`: 成功

## 次工程

1. Draft PRの全CIとVercel Previewを確認して停止する。
2. 責任者確認後、Production migration適用済み、専用private bucket、管理者profile ID、対象期間をread-onlyで確認する。
3. 28件のProduction dry-runを再実行する。
4. 明示承認後にだけProductionへapplyし、`draft`、28件、割当0件、SHA-256を再確認する。
5. 確認後にだけactive化し、異なるモニターをReviewer A/Bへ割り当てる。
6. A/B回答とadjudication完了前に正式Benchmarkへ加算せず、R4-3Bへ進まない。
