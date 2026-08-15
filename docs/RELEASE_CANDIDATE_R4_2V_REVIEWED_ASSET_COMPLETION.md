# PR-R4-2V 確認済み生成Assetの完成判定同期

- Draft PR: [#279](https://github.com/team478a/manga/pull/279)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-cf4c4b-team478as-projects.vercel.app

## 目的

PR #278 merge後のProduction限定受入れで、販売品質を満たしたページ22・4コマ目の候補を品質確認して配置した。しかし候補Jobと保存Canvas layerの`sourceJobId`が一致しない場合、同じ生成画像Assetが確認済みでも完成判定だけが目視確認を要求し続ける境界が残った。

PR-R4-2Vでは、生成画像そのものが同一である場合に品質確認結果を完成判定へ引き継ぐ。DB、migration、RPC、Storage、API、Canvas schema、Providerおよび課金契約は変更しない。

## Production受入れ結果

- 対象: `test`モニター、既存作品ページ22・4コマ目
- 実行: 候補1案、公式Worker 1回のみ
- Worker: [31909535792](https://github.com/team478a/manga/actions/runs/31909535792)（`status=idle requests=2 processed=1`）
- Credit: 使用54／予約0／残46 → 使用54／予約2／残44 → 使用56／予約0／残44
- 画像: 704×1024 PNG。頭髪全体、両目、首、肩、胴体、手、左右背景を含み、吹き出し、疑似文字、口内文字はない
- 判定: ページ22・4コマ目の候補として合格し、品質確認と配置を実施
- 保存: Canvas revision 6→7、保存済み、PNG成功
- 追加生成、重複Job、追加Worker、安全再実行なし
- 公開・販売状態は変更していない

## 原稿プレビュー

- コマ4は新しい合格画像へ更新され、構図と無記名面を確認した。
- ページ全体は未完成。コマ1の不自然な上下方向、コマ3の画像内疑似文字、未配置候補2件、自動配置確認が残る。
- このPRでは既存画像の再生成、候補採用、Canvas変更を追加で行わない。

## 実装

- 完成判定へ`reviewedGenerationAssetIds`を追加する。
- 最新の品質イベントが`selected`である生成Jobの`output_asset_id`を確認済みAssetとして解決する。
- 可視layerは、`sourceJobId`または`assetId`のどちらかが確認済みなら目視確認済みとする。
- 異なる画像への確認結果は引き継がず、従来どおり`IMAGE_QUALITY_REVIEW_REQUIRED`を維持する。

## 回帰テスト

- 同一Asset・異なる候補Job IDで目視確認blockerが解消する。
- 未確認Assetは従来どおり`review_required`となる。
- 4ページfixture、PNG、PDF、必須セリフ、revision、Asset可用性の既存契約を維持する。
- 集中12/12、Hub 732/732、Canvas 26/26、AI 48/48、100ページ長編4/4、dependency／module boundary、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository、owner isolation、workspace packages、Webpack production build、RC structure、diff checkに成功した。
- Desktopローカル検査は既存`@napi-rs/keyring`型宣言不足で開始前に停止した。今回Desktop差分はなく、Windows CIを正式判定にする。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功した。

## ロールバック

このPRの3ファイルの変更をrevertする。DB／migration／保存Canvasの変更はないため、data rollbackは不要。

## 停止条件

Draft PR、Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsの成功を確認して停止する。責任者確認前にページ22の追加生成や残りコマの採用を行わない。
