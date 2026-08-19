# Production原稿の不採用画像・短い縦書き品質修正

## 対象

- Base: `29744d3a720ce6c270face0b29768b746b33f239`
- Branch: `codex/fix-r4-3-production-text-quality`
- 利用者確認ページ: Production作品の22ページ
- Production変更: なし

## 確認した現象

1. 生成候補を不採用として記録しても、既にCanvasへ配置済みの画像layerが残り、画像内の不要文字が原稿へ表示され続ける。
2. 6文字以下の短い縦書きが、吹き出し内でoverflowしていなくても2列へ分割される。
3. 上記の状態でも、従来の完成判定と販売前検査は専用理由で停止できなかった。

## 修正契約

- 不採用操作は品質記録に加えて、その生成Job由来のCanvas layerを外す。
- そのlayerがpanelの代表画像だった場合は、直前の表示可能な背景・補正・legacy layerへ戻す。代替がなければ空へ戻す。
- 不採用Job由来の表示layerが残るページは`IMAGE_QUALITY_REJECTED`で完成不可にする。
- 6文字以下かつ明示改行なしの縦書きは、18px以上の範囲で1列を優先する。1列が不可能な場合だけ従来の最大非overflow sizeを使う。
- 既存原稿の短い縦書きが非overflowの複数列である場合、販売前検査を`text_layout` errorで停止する。

## 回帰テスト

- 不採用layer除去と直前背景への復帰
- 不採用画像が残るページの完成拒否
- 「証拠を」が縮小され1列になること
- 既存の短文2列を販売前検査で拒否すること
- 不採用UIがCanvas除去処理を呼ぶこと

## 品質ゲート

- 集中テスト: 55/55成功
- dependency／module境界: error 0、既存warning 2件
- lint: 成功
- Hub型検査: 成功
- Hub tests: 全件成功
- Canvas tests: 26/26成功
- AI tests: 48/48成功
- Desktop tests: 182/182成功
- Desktop accessibility: violation 0
- Supabase migration validation: 61件成功
- Hub build: 成功
- Desktop build: 成功
- RC preflight: repository structure ready。外部秘密値と手動E2Eはローカル環境ではPending
- `git diff --check`: 成功

## 不変条件

DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF処理、成人向け境界、Desktop製品コードは変更しない。Production作品・画像・DBへ直接変更を行わない。

## merge後のProduction受入れ

1. 対象ページで不要文字を含む生成候補を不採用にする。
2. Canvasから画像が外れ、保存済み表示になるまで待つ。
3. 必要なら適切な候補を採用または再生成する。再生成は利用者の明示操作と既存credit確認を必須とする。
4. 短いセリフを再配置し、1列になっていることを確認する。
5. 完成判定、原稿プレビュー、PNGを確認する。

この受入れはPR merge前には実施しない。
