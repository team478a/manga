# RELEASE CANDIDATE R4-2K: クローズアップの顔フレーミング固定

作成日: 2026-08-15

Branch: `codex/fix-r4-2k-closeup-framing`

Base: `origin/feature/manga-canvas-mvp` @ `0d987a0`（PR #267 merge commit）

Draft PR: [#268](https://github.com/team478a/manga/pull/268)

## 目的

PR-R4-2JのProduction受入れで技術的に生成成功したクローズアップ画像が、鼻・口・顎だけへ過度に寄り、両目と顔全体を欠いた。外部契約と課金条件を変えず、クローズアップの構図契約だけを明確にする。

## Productionで確認した事実

- 対象は`test`モニターの既存作品、ページ22。
- 失敗候補の安全な再実行ボタンを1回だけ使用した。
- Jobは1件だけ登録され、重複POSTはなかった。
- 公式Worker run `31859031742`は`status=idle requests=2 processed=1`で成功し、継続Workerは不要だった。
- creditは使用38→40、予約0→2→0、残り62→60で正しく確定した。
- 新しいAssetは704×1024で、疑似文字は見られなかった。
- 鼻・口・顎だけの極端な寄りで、両目と頭部を含む顔全体がフレーム外へ切れたため販売品質未達と判定した。
- 画像のCanvas配置、品質承認、追加Provider生成は行っていない。

## 原因と変更

既存`close_up`は「顔と表情が主役になる」とだけ指定していたため、Providerが顔の一部だけを画面いっぱいに描く余地があった。

ネーム画角と画面の構図上書きから実効画角を一度解決し、次を人物ありの`close_up`だけへ日英で固定した。

- 頭頂から顎までの顔全体を画面内に収める。
- 両目・鼻・口・顎を欠かさない。
- 顔の主要部分をフレーム端で切らない。
- 頭上と顎下へわずかな余白を残す。

この文言は既存の一枚場面契約へ含めるため、Prompt先頭と末尾に同じ正本から現れる。`wide`等への明示上書き、人物なしの背景／効果生成、意図的な`extreme_close_up`／`detail`には適用しない。

## 回帰テスト

- focused `cloud-panel-image-generation`: 26/26
- Hub全体: 成功
- Canvas: 26/26
- AI: 48/48
- 100ページ長編: 4/4
- dependency／module／size boundary: 成功（既存warning 2件のみ）
- lint: 成功
- Hub typecheck: 成功
- Supabase migration validation: 59/59
- research eval: 成功
- Cloud漫画repository受入れ: 成功
- owner isolation: 成功
- workspace package build: 成功
- Next.js Webpack production build: 成功
- RC structure preflight: 成功
- `git diff --check`: 成功

ローカル標準Turbopack buildは既知のWindowsパス長上限で停止した。Desktop typecheck／test／a11yは既存`@napi-rs/keyring`型宣言不足でbuild前停止した。今回Desktop差分はなく、GitHub Windows CIとVercel Previewを正式結果とする。

## 外部契約

変更しないもの:

- URL、公開API、DB、migration、RPC、Storage
- Feature Flag、Provider、model、pricing、credit
- retry、timeout、Scheduler
- Canvas schema、checkpoint、PNG／PDF
- 成人向け境界、Desktop

## ロールバック

`resolveFaceFramingContract`、実効画角の解決、および対応する2テストを単一commitでrevertする。DB、Storage、migration、作品データの巻き戻しは不要。

## 停止条件

Draft PRを作成し、Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsの成功を確認して停止する。責任者merge前にProductionへ反映せず、実Providerで追加生成しない。
