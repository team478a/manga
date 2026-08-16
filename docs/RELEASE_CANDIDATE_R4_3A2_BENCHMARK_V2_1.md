# RELEASE CANDIDATE — PR-R4-3A2 Benchmark v2.1契約修正

作成日: 2026-08-16

Branch: `codex/fix-r4-3a2-benchmark-v2-1-contract`

Base: `origin/feature/manga-canvas-mvp` @ `355ebfd095297acee34cf32ef4469eeae2958501`（PR #291 merge commit）

## 現在判定

`READY_FOR_OWNER_REVIEW / BLOCKED_FIXTURE_SHORTAGE / BLOCKED_SKLEARN`

- Draft PR: [#292](https://github.com/team478a/manga/pull/292)（Draft／MERGEABLE）
- Vercel Preview: [確認済み](https://mangai-hub-staging-git-codex-fix-r4-3-7f4fb4-team478as-projects.vercel.app)

PR #291のEvidence、Judge境界、metricsを維持し、誤って公開ラベルを同梱する旧fixture契約をv2.1へ修正した。実画像140件は未提供であり、精度合格を主張しない。

## 変更内容

- public `manifest.json / cases.json`とevaluator-only `labels.private.json`を分離
- dev 48/48/16、private holdout 12/12/4の厳密件数
- Production-native image profile、SHA-256、label-neutral path、PNG metadata検査
- intendedを最新`panelSpecificationSchema`で検証
- 2名以上review、不一致adjudication、6不良分類各10件の契約
- cross-split duplicateとprofile別class imbalanceの検査
- univariate AUC、dev CV、holdout balanced accuracyを検査するPython tool
- 旧v1のFAIL結果をnegative-control evidenceとして保存
- 意味の異なるVisual／runtime failureの強制mappingを廃止

## 不変

Production、顧客作品、DB、migration、RPC、RLS、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas、checkpoint、PNG／PDF、成人向け境界、Desktopは変更しない。外部Provider呼出し、画像生成、採用、Canvas配置、課金は0。

## 検証

- 集中テスト: 14/14成功
- Hub: 755/755成功
- Canvas: 26/26成功
- AI: 48/48成功
- 100ページ長編: 4/4成功
- dependency／module boundary、lint、Hub typecheck: 成功
- migration／rollback: 59/59成功
- research eval、Cloud漫画repository acceptance、owner isolation: 成功
- Python syntax／help: 成功。同梱checkerとrepo内fileのSHA-256一致
- workspace packages／Next.js Webpack build: 成功
- 非strict fixture preflight: 正常に`BLOCKED_FIXTURE_SHORTAGE`
- strict fixture preflight: 実画像不足により失敗することが期待値
- Python final acceptance: v2.1画像不足とローカル`scikit-learn`不足により停止
- Turbopack build: Windows作業パス長上限で停止。Webpack build成功
- Desktop test／a11y／build: 差分外の既知`@napi-rs/keyring`型宣言不足でローカル停止し、GitHub Windows buildで正式判定する
- RC preflight: repository structure ready。外部設定と手動E2Eは従来どおり対象外
- 初回HEAD CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功
- 最終文書同期HEAD: 同じ5チェックを再確認して停止する

## 責任者確認事項

1. 140画像の収集元・利用権・Production profile
2. 独立reviewerとadjudicator
3. private holdout管理者と配布経路
4. 外部VLM送信範囲と検証予算
5. v2.1 acceptance完了後のPR-R4-3B開始可否
