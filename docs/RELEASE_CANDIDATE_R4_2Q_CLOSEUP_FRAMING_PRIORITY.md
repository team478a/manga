# PR-R4-2Q クローズアップ構図優先度・公式JSON契約

- Draft PR: [#274](https://github.com/team478a/manga/pull/274)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-tnt1bshvg-team478as-projects.vercel.app

## 結論

PR-R4-2PのProduction受入れで、Provider moderationと安全再実行は正常化した。一方、生成された704×1024 PNGは両目・顔・無記名面を満たしたものの、頭頂と上半身が画面外となる顔全面の極端な寄りで、販売品質には達していない。

R4-2Qでは、FLUX.2へ渡す短縮JSONの最初に中景構図を置き、`portrait`による顔寄りの初期解釈を除く。あわせてカメラ契約をBFL公式例の数値`lens-mm`へ合わせる。Provider、model、pricing、credit、DB、Canvas等の外部契約は変更しない。

## Production受入れ証跡

- 基準: PR #273 merge commit `9519bfc1c4722d49459c0564aff75d14c95f3395`
- 対象: Productionの`test`モニター、既存32ページ作品の22ページ・4コマ目
- 操作: 既存の失敗Jobから「このコマだけ再実行」を1回だけ実行
- Worker: [GitHub Actions run 31870804091](https://github.com/team478a/manga/actions/runs/31870804091)
- Worker結果: `status=idle requests=2 processed=1`
- Job結果: 手動確認待ち100%、704×1024 PNGを1件生成
- credit: 使用46／予約0／残54 → 使用46／予約2／残52 → 使用48／予約0／残52
- 重複: 新規生成中は1件だけ。追加Worker、再試行、重複Jobなし
- 保護: 候補採用、コマ配置、品質承認、Canvas revision、作品、公開・販売状態は変更していない

### 目視品質

- 改善: Provider moderation通過、両目・鼻・口・顎が自然、疑似文字と吹き出しなし
- 未達: 髪が上端で切れ、頭頂・首・両肩・背景余白が不足。顔がほぼ画面全体を占有
- 判定: 技術的生成は成功、販売用コマとしては不採用

## 原因

短縮JSONは後段の`composition`で65%構図を指定していたが、最初の`scene`が`manga portrait`、人物位置が`portrait silhouette`、camera distanceも`medium portrait distance`だった。BFL公式ガイドは重要要素を先頭に置くことを推奨しており、先頭の`portrait`解釈が後段の数値構図より優先された可能性が高い。

また、カメラは独自の文字列`lens`を使っていた。BFL公式JSON例では数値の`lens-mm`が使われる。

参考:

- [BFL FLUX.2 Prompting Guide](https://docs.bfl.ai/guides/prompting_guide_flux2)
- [BFL JSON Structured Prompting](https://docs.bfl.ai/guides/usecases_t2i_json_prompting)

## 実装

- `scene`の先頭を`medium shot from mid-torso upward`に固定
- 人物位置を胸元から上、完全な髪のシルエット、両肩、頭部周囲の背景へ固定
- 構図を頭部・首・両肩・頭上余白・左右背景、被写体高約55%へ固定
- camera distanceを同じ中景語彙へ統一
- 独自`lens`を削除し、BFL公式例と同じ数値`lens-mm: 50`へ変更
- focusへ頭部と上半身全体、周囲背景の保持を明示
- Provider拒否後の一般向け安全再実行でも、保存済み旧短縮JSONを同じ新契約へ正規化
- 人物同一性、衣装、表情、場面、画風、参照画像の役割、候補差分は維持

## 不変契約

- URL、公開API、DB、migration、RPC、Storage、Feature Flag
- Provider、model、pricing、credit単価、retry回数、timeout、Scheduler
- 参照Asset選択、target panel、source revision、Panel Specification
- Canvas schema、checkpoint、PNG／PDF、作品公開・販売
- 成人向け境界、Desktop
- Prompt、画像、Provider応答、API key、署名URLをログ・文書へ保存しない

## 検証

- 集中テスト: 32/32 成功
- Hub: 728/728 成功
- Canvas: 26/26 成功
- AI: 48/48 成功
- 100ページ長編: 4/4 成功
- dependency boundaries: 5 packages／21 source files成功
- module boundaries: 336 files、0 errors、既存warning 2件
- lint: 成功
- Hub typecheck: 成功
- migration manifest: 59/59 成功
- research eval: 成功
- Cloud漫画repository受入れ: 成功
- owner isolation: 成功
- workspace package build: 成功
- Next Webpack production build: 成功
- RC preflight: repository structure READY。ローカル外部secretと手動E2EだけPENDING
- 通常Turbopack build: 既知のWindowsパス長上限で停止。Vercelを正式判定にする
- GitHub／Vercel: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsは初回HEADですべて成功

## 停止条件と次の確認

Draft PRのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsがすべて成功した時点で停止する。merge前に追加のProduction Provider生成を行わない。

merge後は同じ対象コマを1案だけ再制作し、頭頂、髪全体、首、両肩、背景余白、疑似文字なしを目視確認する。候補採用やCanvas反映は品質合格後の別判断とする。
