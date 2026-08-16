# RELEASE CANDIDATE — PR-R4-3A 漫画品質ベンチマーク基盤

作成日: 2026-08-16

Branch: `codex/feat-r4-3a-quality-benchmark`

Base: `origin/feature/manga-canvas-mvp` @ `75eb8582ceedf1b2c5cd78a515b79b02201a20e0`（PR #290 merge commit）

## 判定

`IMPLEMENTED_LOCAL / BLOCKED_FIXTURE_SHORTAGE`

R4-3Aのschema、provider-neutral Judge境界、集計、preflight、監査文書は実装した。一方、権利確認済みの正解付き実画像は0/30、採用可能画像0/15、主要6群0/5である。実測精度、実費、遅延、採用Providerは確定していない。

## 実装範囲

- Visual Judge用failure語彙と既存runtime語彙の互換map
- `ok / unknown / not_evaluated`を保持するEvidence schema
- Evidence coverageと0〜100変換境界
- provider SDKをimportしない`MangaVisualJudge` interface
- 30〜50画像の非公開fixture manifest schemaとreadiness判定
- critical recall、false positive、failure一致、unknown、coverage、Judge費用、遅延の集計
- fixture実ファイル、SHA-256、MIME、寸法を検証するpreflight
- 現行Judge、DB／RPC／RLS、ログ、BFL Fill、VLM／embedding／OCRの監査

## 変更しないもの

- Production環境、Production DB／Storage、既存作品
- App Router、API、URL、Feature Flag
- migration、RPC、RLS、Canvas schema、checkpoint、PNG／PDF
- Provider、model、pricing、credit、retry、timeout、Scheduler
- 既存品質score、ranking、auto adopt、repair runtime
- 成人向け境界、Desktop

## 検証

- 集中テスト: 8/8成功
- Hub: 750/750成功
- Canvas: 26/26成功
- AI: 48/48成功
- 100ページ長編: 4/4成功
- dependency／module boundary、lint、Hub typecheck: 成功
- migration／rollback: 59/59成功
- research eval、Cloud漫画repository acceptance、owner isolation: 成功
- workspace packages／Next.js Webpack production build: 成功
- Fixture preflight: 正常に`BLOCKED_FIXTURE_SHORTAGE`を報告
- Turbopack build: Windowsの作業パス長上限で停止。Webpack buildでコード・route生成を確認
- Desktop test／a11y／build: 差分外の既知の`@napi-rs/keyring`型宣言不足でローカル停止。GitHub Windows buildで正式判定する
- RC preflight: repository structure ready。外部設定と手動E2Eは従来どおり対象外／未実施
- Draft PR / CI / Vercel Preview: 作成・確認予定

## Production変更確認

Production API、DB、Storage、既存作品、外部VLM、画像生成Providerへの呼出しは実施していない。外部課金0、利用者credit変更0、生成・採用・Canvas配置0。

## 責任者確認事項

1. fixture収集元と画像利用権
2. 外部VLMへ送信できるfixture範囲
3. 比較対象Providerと検証予算
4. Judge採用基準、unknown時の停止条件、費用負担
5. R4-3B開始可否

詳細は`docs/quality-engine-benchmarks.md`を参照。責任者確認前にR4-3Bへ進まない。
