# PR-R4-2AC 安全再構成でネーム構図を維持

## 目的

PR #285の第2段階安全再構成でProvider moderationの行き止まりは解消した。一方、完成画像から元ネームの人物配置と物語上の場面が失われたため、安全な構図情報だけを短縮Provider契約へ保持し、一般向け境界を緩めずに漫画としての場面を維持する。

## 基準

- Base: `origin/feature/manga-canvas-mvp` @ `035c2a6`（PR #285 merge commit）
- Branch: `codex/accept-r4-2ac-conservative-retry`
- 対象: 短縮Provider契約と第2段階の保守的な一般向け再構成

## PR #285のProduction受入れ

- 対象: `test`モニター、ページ22、コマ1
- 開始状態: 画像4/4、セリフ1/1、生成中0、失敗1、Canvas revision 8、PNG成功、Credit 使用68／予約0／残32
- 失敗Jobを1件だけ再実行した。受付後はCredit 使用68／予約2／残30となり、追加の再実行は行っていない。
- 最初のWorkflow [31923450510](https://github.com/team478a/manga/actions/runs/31923450510)は既定の`check` modeで設定検査だけを行い、WorkerとProvider処理は実行していない。
- `mode=run`を明示した公式Worker [31923479315](https://github.com/team478a/manga/actions/runs/31923479315)を1回だけ実行した。`status=idle requests=2 processed=1`で成功した。
- 最終状態: 画像4/4、セリフ1/1、生成中0、失敗0、Credit 使用70／予約0／残30、Canvas revision 8、PNG成功。
- 新候補は704×1024 PNGとして正常に完成した。正立、顔、手、人体、描画面の清潔さは満たしたが、整った室内に人物が直立する汎用的な絵となり、元ネームの場面と構図を十分に伝えなかったため不採用とした。
- 候補は品質承認、採用、Canvas配置を行っていない。Canvas、公開・販売状態、設定は変更していない。追加のProvider生成も行っていない。
- Prompt本文、署名URL、API key、利用者画像は文書・ログへ記録していない。

## 判明した原因

- PR #285の第2段階安全再構成により、Provider moderation後もAssetまで完成できることを確認した。
- ただし、保守的な再構成は背景、場所、構図、動作、表情を一律に日常場面へ置換していた。
- クローズアップ向け短縮Provider契約も汎用的な中距離人物画を優先し、元ネームの構図をProviderへ渡していなかった。
- この組合せにより、安全性と人体品質は改善した一方、人物数、人物と背景の相対配置、視線方向、物語上の場面が失われた。

## 実装

- クローズアップ向け短縮Provider契約へ、元ネームの構図を短い`layout`として追加する。Provider優先順の`composition`、`framing`、`scene`と既存の2,000文字上限は維持する。
- 第2段階再構成は、元の画角、人物数、安全な人物・背景の相対配置を維持し、刺激の強い出来事そのものだけを直前または直後の安全な瞬間へ置換する。
- `layout`は長さを制限し、ローカルmoderationを通過したものだけを再利用する。危険語またはmoderation拒否を含む場合は、安全な相対配置のfallbackへ置換する。
- 人物設定、衣装、ネームの画角、人物数、参照Assetを維持し、ポーズ、視線、間隔、光と影で元の物語上の拍を伝える。
- 第2段階済みJobが再度拒否された場合に停止する既存境界は変更しない。

## 不変条件

- URL、API response、DB、migration、RPC、Storage、Feature Flag
- Provider、model、pricing、credit単価、Worker自動retry回数、timeout、Scheduler
- Canvas schema、checkpoint、PNG／PDF、公開・販売状態
- 成人向け境界、Desktop

## 検証

- 集中テスト: 52/52
- Hub: 740/740
- Canvas: 26/26
- AI: 48/48
- 100ページ長編: 4/4
- dependency／module boundary: 成功（既存warning 2件）
- lint: 成功
- Hub typecheck: 成功
- migration: 59/59
- research eval: 成功
- Cloud漫画repository受入れ: 成功
- owner isolation: 成功
- workspace packages build: 成功
- Next.js Webpack production build: 成功
- RC preflight: repository structure ready。外部設定と手動項目は従来どおり環境依存
- `git diff --check`: 成功
- Desktopローカルのtypecheck、test、a11y、buildは既存の`@napi-rs/keyring`配布物に`index.d.ts`が含まれないため開始前に停止する。今回の変更はDesktopを含まず、Windows CIを正式判定にする。

## Merge後の受入れ

1. 現在の不採用候補は再試行せず、ネーム構図を含む新しい一般向けコマを対象にする。
2. 責任者の明示確認後、候補を1案だけ生成する。
3. 公式Workerを1回だけ実行し、Credit予約と確定または全額復元を確認する。
4. 元ネームの画角、人物数、人物・背景の相対配置、物語上の場面が維持されていることを確認する。
5. 正立、画像内文字、人体、小物、物語構図の品質ゲートを通過しない候補は配置しない。
6. Canvas revision、PNG、公開・販売状態が意図せず変化していないことを確認する。

## ロールバック

このPRのcommitを通常のrevertで戻す。DB、migration、Storage、Canvas schemaは変更しないため、データrollbackは不要。revert後は第2段階再構成が従来の汎用的な日常構図へ戻る。
