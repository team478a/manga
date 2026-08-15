# PR-R4-2O クローズアップProvider Prompt短縮・安定化

作成日: 2026-08-15
対象: `team478a/manga`
Branch: `codex/fix-r4-2o-compact-closeup-provider-prompt`
Base: `feature/manga-canvas-mvp` @ `9047f40e7623200f28c3afb1b5dd41ac87fa4557`（PR #271 merge commit）
Draft PR: [#272](https://github.com/team478a/manga/pull/272)（Draft／MERGEABLE）
Vercel Preview: https://mangai-hub-staging-l6vr8i9ca-team478as-projects.vercel.app

## 結論

PR #271反映後のProduction受入れでProvider moderationは解消し、画像Jobは正常完了した。一方、生成画像は鼻・口・顎だけの極端なcropと生成文字混入が残り、販売品質には到達していない。

R4-2Oでは、人物あり・新規`close_up`のProvider Promptだけを短いJSON契約へ切り替え、撮影距離、被写体占有率、無記名描画面を一意にした。既存の2〜4候補比較、参照画像の役割、他画角、修正系経路、外部契約は維持する。

## Production受入れ証跡

- アカウント: ログイン済み`test`モニター
- 対象: ページ22・4コマ目
- 操作: 有効な「この候補を使わず作り直す（1案）」を1回だけ実行
- Job: `230eac0d-e1d3-4813-bd43-bb6830c492ba`
- Asset: `f7a22c48-fe92-48ca-8697-b2ee3ac6d70d`
- Provider／model: `black-forest-labs`／`flux-2-pro`
- operation: `text_to_image`
- `source_asset_id`: `null`
- Worker: [run 31867709945](https://github.com/team478a/manga/actions/runs/31867709945)
- Worker結果: `status=idle requests=2 processed=1`
- 画像: 704×1024 PNG
- Credit: 使用44→46、予約0→2→0、残り56→54
- 重複Job: なし
- 継続Worker: なし
- Provider moderation block: 解消

配置、品質承認、候補採用、Canvas revision、作品、公開・販売状態は変更していない。R4-2O実装後のProduction生成は行っていない。

## 品質判定

生成画像は次の理由で`販売品質未達`と判定した。

- 鼻・口・顎だけの極端なcrop
- 両目と頭頂が画面外
- 口元に`証拠を`という生成文字
- 一般向けmoderationと画像ファイル生成は正常

## 原因の切り分け

確認済み事実:

- 新Jobは`text_to_image`で、失敗候補画像をsourceへ固定していない。
- 保存済み画風参照Assetは完全な頭部と全身を含む清潔な無記名画像である。
- 既存Promptは同じ場面契約、構図、動作、感情、背景、演出を複数回記述している。
- Storyboardの動作・感情等に台詞内容が含まれる場合、画像Providerへ文字列が流入し得る。

推論:

- 長く重複したPromptが撮影距離、被写体サイズ、無記名描画面の優先度を希釈し、Providerが`close_up`を極端な寄りとして解釈した可能性が高い。
- 台詞本文と類似する文字列が視覚指示へ残り、描画文字として生成される余地があった。

## BFL公式契約との整合

- [FLUX.2 Prompting Guide](https://docs.bfl.ai/guides/prompting_guide_flux2): 語順が重要で、通常は30〜80語程度の簡潔なPrompt、構造化JSON、複数参照の明示的な役割指定を案内している。
- [Text-to-image prompting](https://docs.bfl.ai/guides/prompting_guide_t2i_negative): FLUX.2はnegative promptではなく、望む結果を正方向で記述する。
- [Editing and control](https://docs.bfl.ai/guides/usecases_editing_controlnets): 編集・参照経路は対象と役割を明確にする。

## 実装

`src/lib/cloud-panel-image-generation.ts`:

- 人物あり・新規`close_up`だけを短いJSON Provider契約へ切り替える。
- 被写体を中央の安定した中距離portraitとし、完全なsilhouetteと周囲背景を保つ。
- 被写体高を画像高のおよそ65%、レンズを70mm相当へ固定する。
- Storyboardの台詞本文と引用符付き発話を動作・表情・背景から除外し、安全な視覚描写へ置き換える。
- 描画面全体を清潔な無記名モノクロ線画・自然な陰影へ固定する。
- `input_image_N`ごとの参照役割を維持する。
- 2〜4候補では候補番号と候補別制作差分を短縮契約内へ維持する。

`src/modules/manga/domain/general-audience-generation-retry.ts`:

- Provider拒否後に保存済み構図を安全化する既存変換先を、新しい非crop中距離構図へ同期する。

適用外:

- revision
- Image-to-Image
- Inpainting
- Outpainting
- 人物なしJob
- `close_up`以外の画角

## 不変の外部契約

URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、retry回数、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、成人向け境界、Desktopは変更していない。

## 検証

- 集中テスト: 31/31成功
- `npm run deps:check`: 成功（336 files、0 errors、既存warnings 2）
- `npm run lint`: 成功
- Hub typecheck: 成功
- 全体typecheck: Hub成功後、既存Desktop依存`@napi-rs/keyring`の型宣言不足だけで停止
- `npm run hub:test`: 726/726成功
- `npm run canvas:test`: 26/26成功
- `npm run ai:test`: 48/48成功
- `npm run db:migrations:validate`: 59/59成功
- `npm run cloud:longform:acceptance`: 4/4成功
- `npm run research:eval`: 成功
- `npm run cloud:manga:acceptance:repo`: 成功
- `npm run cloud:manga:owner-isolation`: 成功
- Workspace package build: 成功
- Next.js Webpack production build: 成功（exit 0）
- `npm run rc:preflight`: structure READY。既存のローカル外部Secret不足と手動E2E待ちのみ
- `git diff --check`: 成功
- Core quality: 成功
- Migration roundtrip: 成功
- Windows build: 成功
- Vercel: 成功
- Vercel Preview Comments: 成功

今回Desktop差分はないため、Desktopの正式判定はGitHub Windows buildを使用する。

## ロールバック

R4-2Oのcommitをrevertする。DB、migration、RPC、Storage、Canvas schemaのrollbackは不要。既にProductionで完成した1候補と消費済み2 creditは履歴として保持し、候補を配置・承認しない。

## 停止条件

- Draft PR作成
- Core quality成功
- Migration roundtrip成功
- Windows build成功
- Vercel成功
- Vercel Preview Comments成功
- Draft／MERGEABLE確認
- Vercel Preview URL確認

merge前に追加のProduction Provider生成を行わない。merge後に1案だけ受入れし、構図、両目・頭頂、生成文字、credit、重複Jobを確認する。責任者判断前に次工程へ進まない。
