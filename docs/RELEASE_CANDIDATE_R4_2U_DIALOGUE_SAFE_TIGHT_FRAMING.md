# PR-R4-2U 台詞安全な再制作フレーミング

- 状態: `IN_PROGRESS`
- Branch: `codex/fix-r4-2u-dialogue-safe-rework-framing`
- Base: `origin/feature/manga-canvas-mvp` @ `72f1d0d`（PR #277 merge commit）

## 結論

PR #277反映後のProduction限定受入れでは、ページ22・4コマ目の1案生成がProvider moderationを通過し、704×1024 PNGを生成した。予約2 creditは正常に確定し、使用54／予約0／残46となった。

一方、画像は人物の顔・首付近だけの極端なcropとなり、口内と胸元付近の吹き出し状領域へ原台詞と一致する「証拠を」が描画された。販売品質には未達であり、候補の配置、採用、品質承認、Canvas revision、公開・販売状態は変更していない。

## Production受入れ証跡

- 基準: PR #277 merge commit `72f1d0d07a678679191541b768a184a10e1c609b`
- 対象: Productionの`test`モニター、既存32ページ作品の22ページ・4コマ目
- Worker: [31906333027](https://github.com/team478a/manga/actions/runs/31906333027)
- Worker結果: `status=idle requests=2 processed=1`
- credit: 使用52／予約0／残48 → 使用52／予約2／残46 → 使用54／予約0／残46
- 生成物: 704×1024 PNG、手動確認待ち100%
- 合格: Provider moderation、正立、モノクロ一枚絵、課金確定、予約解放
- 不合格: 画角、頭部・上半身の収まり、背景余白、口内文字、吹き出し状領域、台詞混入
- 保護: 配置、採用、品質承認、Canvas revision、作品、公開・販売状態は変更していない
- 停止: 成功Jobのため安全再実行は行わず、追加Provider呼出しを停止した

Prompt、Provider応答、署名URL、API keyは記録しない。

## 原因判断

Panel Specificationの画角が`extreme_close_up`または`detail`の場合、場面欄へ混入した台詞を除外して58%短縮構図へ切り替える既存の`close_up`分岐を通らず、長文Promptへ動作、感情、背景、構図、演出を直接含める経路が残っていた。

実画像が原台詞と一致する文字を再現したこととコード経路は整合する。ただしProduction Prompt本体は秘密・利用者コンテンツ保護のため記録していないので、原因はコードと出力からの推論である。

## 実装

- Provider向けの動作、感情、背景、構図、演出から引用発話を除外する
- Storyboardの必須dialogueに一致する語をProvider向け場面記述から除外する
- 場面欄への台詞混入を検知した`extreme_close_up`／`detail`だけ、被写体高58%の短縮安全フレームへ切り替える
- 台詞のない意図的な`extreme_close_up`／`detail`は元の画角を維持する
- Panel Specificationの画角、動作、感情、背景、構図、演出の原文を変更しない
- revision／Image-to-Image／Inpainting／Outpaintingには短縮安全フレーム切替を適用しない

## 不変契約

- URL、公開API、DB、migration、RPC、Storage、Feature Flag
- Provider、model、pricing、credit単価、retry回数、timeout、Scheduler
- target panel、source revision、参照Asset選択、Panel Specification
- Canvas schema、checkpoint、PNG／PDF、作品公開・販売
- 成人向け境界、Desktop

## 回帰テスト

- 台詞混入の`extreme_close_up`が58%短縮安全フレームになる
- Provider Promptから引用発話と既知台詞を除外する
- Panel Specificationは元の`extreme_close_up`と動作原文を保持する
- 台詞のない意図的な`extreme_close_up`は通常Promptと元画角を維持する
- 通常の`medium`でもProvider Promptだけを浄化し、Panel Specification原文を保持する
- 既存のクローズアップ、2〜4候補、参照素材、修正・安全再実行契約を維持する

## 検証

- 集中テスト: 35/35成功
- Hub: 731/731成功
- Canvas: 26/26成功
- AI: 48/48成功
- 100ページ長編: 4/4成功
- dependency／module boundary: 0 error、既存warning 2件
- lint、Hub typecheck: 成功
- migration manifest: 59/59成功
- research eval、Cloud漫画repository受入れ、owner isolation: 成功
- workspace package build、Next Webpack production build: 成功
- RC preflight: repository structure READY。外部secretと手動E2Eは既存どおりPENDING
- 通常Turbopack: 既知のWindows path長上限で停止。Webpack buildを正式なローカル判定とする
- Desktop typecheck: 既存`@napi-rs/keyring`型宣言不足で停止。Desktop差分はなく、Windows CIを正式判定とする
- CI／Vercel Preview: Draft PR作成後に確認する

## ロールバック

本PRのPrompt構築と回帰テスト、記録文書だけをrevertする。DB、migration、Storage、Canvas、Production Assetの復元は不要。

## 停止条件

Draft PRとCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsの成功を確認して停止する。責任者merge前にProductionで追加生成しない。

merge後は同じ対象コマを1案だけ再制作する。moderation、髪上端、両目、引き構図、左右背景余白、一続きの画面、口内文字・吹き出し・疑似文字なしを目視し、合格前は候補を配置・採用しない。
