# PR-R4-2R 短縮クローズアップの一枚絵・画面内ランドマーク契約

- Draft PR: [#275](https://github.com/team478a/manga/pull/275)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-7249f5-team478as-projects.vercel.app

## 結論

PR #274反映後のProduction受入れでは、安全再実行がProvider moderationを通過して704×1024 PNGを生成した。しかし、頭頂と両目が画面外になり、口元から胸元だけが大きく写った。顔中央には不要な矩形線も生成され、販売品質には達していない。

R4-2Rでは、同じ構図語をさらに重ねず、短縮JSONから欠落していた「画面全体が一続きの一枚絵」という出力契約を復元する。人物位置は抽象的な占有率ではなく、頭頂、肩、腰の画面内ランドマークで指定する。Provider、model、pricing、credit、DB、Canvas等の外部契約は変更しない。

## Production受入れ証跡

- 基準: PR #274 merge commit `ebc9107ae02c577dba03efad384f1213e8442e8a`
- 対象: Productionの`test`モニター、既存32ページ作品の22ページ・4コマ目
- 初回再制作: Job `487df1f8-1096-4513-a329-a60117e0e712`をWorker run [31873260143](https://github.com/team478a/manga/actions/runs/31873260143)が1件処理し、`provider_moderation_blocked`で終了
- 安全再実行: Worker run [31873352419](https://github.com/team478a/manga/actions/runs/31873352419)が1件処理し、Asset `2d3a5c3e-f943-4c83-a387-0e4b27a45a30.png`を生成
- credit: 使用48／予約0／残52 → 初回予約2・全額解放 → 安全再実行予約2 → 使用50／予約0／残50
- 保護: 候補採用、コマ配置、品質承認、Canvas revision、公開・販売状態は変更していない

### 目視品質

- 成功: PNG保存、Provider moderation通過、候補表示、credit確定
- 未達: 頭頂、髪全体、両目が画面外。口、顎、首、胸元だけの過度な接写
- 未達: 顔中央を横切る不要な矩形線があり、一続きの場面画像になっていない
- 判定: 技術的生成は成功、販売用コマとして不採用

## 原因

FLUX.2はnegative promptをサポートしないため、既存`negativePrompt`のコマ枠・疑似文字禁止はBFL requestへ送られない。通常の詳細Promptは`output_type`で一枚絵を指定していたが、R4-2O以降の短縮JSONには同じ出力契約がなく、`surface_finish`だけだった。

R4-2Qの`mid-torso upward`と被写体高55%も、実画像では頭部の画面内位置を固定できなかった。数値の占有率ではなく、髪上端を画面上部15%付近、両肩を左右余白内、腰を画面下部へ置く画面内ランドマークへ変える。

参考:

- [BFL FLUX.2 Prompting Guide](https://docs.bfl.ai/guides/prompting_guide_flux2)
- [BFL Working Without Negative Prompts](https://docs.bfl.ai/guides/prompting_guide_t2i_negative)

## 実装

- `scene`を完全な腰上の中景へ変更し、頭部と上半身全体を最初に固定
- `output_type`へ画面全体を端から端まで満たす一続きのモノクロ一枚絵を追加
- 人物位置を髪上端約15%、両肩を左右余白内、腰を画面下部へ固定
- 構図を髪、顔、首、肩、胸、腰がすべて画面内にある腰上中景へ変更
- `canvas`へ全画面が途切れない一つの場面であることを追加
- camera distanceとfocusを同じ腰上中景へ統一し、`lens-mm: 50`を維持
- Provider拒否後の一般向け安全再実行も、保存済み旧短縮JSONへ同じ出力・ランドマーク契約を補う

## 不変契約

- URL、公開API、DB、migration、RPC、Storage、Feature Flag
- Provider、model、pricing、credit単価、retry回数、timeout、Scheduler
- 参照Asset選択、target panel、source revision、Panel Specification
- Canvas schema、checkpoint、PNG／PDF、作品公開・販売
- 成人向け境界、Desktop
- Prompt、画像、Provider応答、API key、署名URLをログ・文書へ保存しない

## 検証

- 初回生成と安全再実行の集中テスト: 32/32成功
- Hub: 728/728成功
- Canvas: 26/26成功
- AI: 48/48成功
- 100ページ長編: 4/4成功
- dependency boundaries: 5 packages／21 source files成功
- module boundaries: 336 files、0 errors、既存warning 2件
- lint、Hub typecheck: 成功
- migration manifest: 59/59成功
- research eval、Cloud漫画repository受入れ、owner isolation: 成功
- workspace package build、Next Webpack production build: 成功
- RC preflight: repository structure READY。ローカル外部secretと手動E2EだけPENDING
- 通常Turbopack build: 既知のWindowsパス長上限で停止。Vercel Previewを正式判定にする
- Desktop test／typecheck／build／a11y: 既存の`@napi-rs/keyring`型宣言不足でbuild前に停止。今回Desktop差分はなく、Windows CIを正式判定にする
- 初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments: すべて成功

## 停止条件と次の確認

Draft PRと全CI／Vercel Preview成功後に停止する。merge前に追加のProduction Provider生成を行わない。

merge後は同じ対象コマを1案だけ再制作し、頭頂、髪全体、両目、首、両肩、腰上、背景余白、一続きの画面、疑似文字なしを目視確認する。候補採用やCanvas反映は品質合格後の別判断とする。
