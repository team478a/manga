# PR-R4-2T 顔面無記名・引き構図の正方向契約

- Draft PR: [#277](https://github.com/team478a/manga/pull/277)（Draft／MERGEABLE）
- 状態: `CI_RUNNING`

## 結論

PR #276反映後のProduction限定受入れでは、ページ22・4コマ目の1案生成がProvider moderationを通過し、704×1024 PNGを生成した。予約2 creditは正常に確定し、使用52／予約0／残48となった。

一方、頭頂は画像上端に接し、人物が画面高の約9割を占め、左右の背景余白も不足した。口元には「証 拠を」に見える疑似文字が生成され、販売品質には未達である。候補の配置、採用、品質承認、Canvas revision、公開・販売状態は変更していない。

## Production受入れ証跡

- 基準: PR #276 merge commit `faeef6719b44e4754752da799726380075657461`
- 対象: Productionの`test`モニター、既存32ページ作品の22ページ・4コマ目
- Worker: [31886026453](https://github.com/team478a/manga/actions/runs/31886026453)
- Worker結果: `status=idle requests=2 processed=1`
- credit: 使用50／予約0／残50 → 使用50／予約2／残48 → 使用52／予約0／残48
- Asset: `2fe8d763-cedd-4a13-99ea-afc85adbc758.png`、704×1024 PNG、手動確認待ち100%
- 合格: moderation、正立、両目、顔、首、肩、モノクロ一枚絵
- 不合格: 頭上余白、引き構図、左右背景余白、顔面疑似文字
- 保護: 配置、採用、品質承認、Canvas revision、作品、公開・販売状態は変更していない
- 停止: 成功Jobのため安全再実行は行わず、追加Provider呼出しを停止した

Prompt、Provider応答、署名URL、API keyは記録しない。

## 原因判断

PR-R4-2Sの短縮JSONは身体部位列挙を除去してmoderationを通過したが、JSON先頭の`scene`が`medium portrait`のままで、後段の72%座標より顔寄り解釈が優先された可能性が高い。

また、Storyboardの台詞本文自体は短縮Promptから除去されていたが、台詞を含む動作のfallbackが`a natural speaking pose`だった。実画像の口元へ元台詞と一致する疑似文字が生じたため、発話を想起させる語をProvider契約から除去し、望む描画面を正方向で限定する。

## 実装

- `composition`と`framing`を短縮JSONの先頭へ移す
- `medium portrait`を余白の広い`roomy environmental portrait`へ変更する
- 被写体高58%、髪上端18%、衣服下端82%、左右環境余白18%へ引く
- cameraを明示的に引いた環境ポートレート距離へ変更する
- 台詞除去後のfallbackから`speaking`を除き、姿勢と視線だけで物語を表す
- 顔面を自然な解剖・線画・陰影だけで完成させる正方向の`face_finish`を追加する
- 描画面を人物、衣服、環境、光、影だけの`surface_content`へ固定する
- Provider拒否後の一般向け安全再実行も同じ契約へ正規化する

## 不変契約

- URL、公開API、DB、migration、RPC、Storage、Feature Flag
- Provider、model、pricing、credit単価、retry回数、timeout、Scheduler
- target panel、source revision、参照Asset選択、Panel Specification
- Canvas schema、checkpoint、PNG／PDF、作品公開・販売
- 成人向け境界、Desktop

## 回帰テスト

- JSON先頭3キーが`composition`、`framing`、`scene`になる
- 初回生成と安全再実行が同じ58%／18%／82%／18%契約を持つ
- 短縮Promptに元台詞、`speaking`、`lettering`、`unmarked`を含めない
- 正方向の`surface_content`と`face_finish`を持つ
- 人物同一性、参照Asset ID、camera angle、50mm、target panelを維持する
- wide上書きにはクローズアップ契約を適用しない

## 検証

- 集中テスト: 32/32成功
- Hub: 728/728成功
- Canvas: 26/26成功
- AI: 48/48成功
- 100ページ長編: 4/4成功
- dependency／module boundary: 0 error、既存warning 2件
- lint、Hub typecheck: 成功
- migration manifest: 59/59成功
- research eval、Cloud漫画repository受入れ、owner isolation: 成功
- workspace package build、Next Webpack production build: 成功
- RC preflight: repository structure READY。外部secretと手動E2Eは既存どおりPENDING

## ロールバック

本PRの2つのPrompt構築ファイルと2つのテストだけをrevertする。DB、migration、Storage、Canvas、Production Assetの復元は不要。

## 停止条件

Draft PRとCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsの成功を確認して停止する。責任者merge前にProductionで追加生成しない。

merge後は同じ対象コマを1案だけ再制作する。moderation、髪上端、両目、引き構図、左右背景余白、一続きの画面、顔面疑似文字なしを目視し、合格前は候補を配置・採用しない。
