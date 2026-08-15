# RELEASE CANDIDATE R4-2L: クローズアップ余白・無記名描画面の固定

作成日: 2026-08-15

Branch: `codex/fix-r4-2l-closeup-clean-output`

Base: `origin/feature/manga-canvas-mvp` @ `7f3dc73`（PR #268 merge commit）

Draft PR: 作成前

Vercel Preview: 確認前

## 目的

PR-R4-2K反映後のProduction受入れで顔の主要部分は画面内へ改善したが、頭頂のcropと口元への生成文字が残った。外部契約、課金条件、Providerを変えず、人物クローズアップの余白と参照付き描画面の清潔さを正方向Promptで固定する。

## Productionで確認した事実

- 対象は`test`モニターの既存作品、ページ22。
- 最初の有効な「この候補を使わず作り直す（1案）」を1回だけ使用した。
- Jobは1件だけ登録され、重複POSTはなかった。
- 先行run `31860684723`は誤って`mode=check`で起動したが、scheduler設定確認だけでWorker／Provider requestを送っていない。
- 公式Worker run `31860725448`は`status=idle requests=2 processed=1`で成功し、継続Workerは不要だった。
- creditは使用40→42、予約0→2→0、残り60→58で正しく確定した。
- 新しいAssetは704×1024で、両目、鼻、口、顎を含み、前回の口元だけの極端なcropは改善した。
- 頭頂と髪がフレーム外へ切れ、口元に生成文字`証拠をさ`が混入したため販売品質未達と判定した。
- 画像のCanvas配置、品質承認、追加Provider生成は行っていない。

## 原因と変更

既存の顔全体契約は主要な顔パーツを守ったが、頭部全体を囲む明確な余白と首・肩までの画角を要求していなかった。また、参照素材の役割は構図より同一性を優先しないことを示していたが、参照画像に由来する文字状の模様を人物表面へ再現しない正方向契約がなかった。

次を同じPanel Specification由来Promptの先頭と末尾へ固定する。

- 人物ありの`close_up`を極端な顔だけの寄りではなく、頭と肩が分かる構図にする。
- 頭頂の外側、髪の左右、顎、首、両肩の付け根を画面内へ収める。
- 頭部全体の周囲へ画像短辺のおよそ10%の明確な余白を残す。
- 参照素材から再構成する対象を人物同一性、輪郭、髪型、衣装、線画の筆致へ限定する。
- 肌、口元、衣服、背景を、解剖学的輪郭と自然な素材陰影だけで構成した清潔な無記名面として完成させる。

人物なしJob、`wide`等への画角上書き、既存の参照選択、候補数、moderation境界は変更しない。

## 回帰テスト

- focused `cloud-panel-image-generation`: 27/27
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

Desktop差分はない。ローカルの既存`@napi-rs/keyring`型宣言不足はGitHub Windows CIを正式結果とする。

## 外部契約

変更しないもの:

- URL、公開API、DB、migration、RPC、Storage
- Feature Flag、Provider、model、pricing、credit
- retry、timeout、Scheduler
- Canvas schema、checkpoint、PNG／PDF
- 成人向け境界、Desktop

## Production変更

上記PR #268受入れの1 Job／2 creditだけ。R4-2Lコード実装後のProvider E2E、画像配置・品質承認、DB／Storage／作品内容の変更は行っていない。

## ロールバック

`resolveFaceFramingContract`、参照素材・人物表面の無記名描画契約、および対応する回帰テストを単一commitでrevertする。DB、Storage、migration、作品データの巻き戻しは不要。

## 停止条件

Draft PRを作成し、Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsの成功を確認して停止する。責任者merge前にProductionへ反映せず、実Providerで追加生成しない。
