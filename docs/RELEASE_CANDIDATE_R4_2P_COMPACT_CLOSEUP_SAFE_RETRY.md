# PR-R4-2P 短縮クローズアップの一般向け安全再実行

作成日: 2026-08-15
対象: `team478a/manga`
Branch: `codex/fix-r4-2p-compact-closeup-safe-retry`
Base: `feature/manga-canvas-mvp` @ `e16e00111affb143e854b3bff6637821dbf084f0`（PR #272 merge commit）
Draft PR: [#273](https://github.com/team478a/manga/pull/273)（Draft／MERGEABLE）
Vercel Preview: https://mangai-hub-staging-5cgcg63dm-team478as-projects.vercel.app

## 結論

PR #272反映後のProduction受入れで、R4-2Oの短縮クローズアップPromptはProvider moderationによりAsset生成前に拒否された。予約creditは全額復元した。

調査の結果、既存の一般向け安全再実行は旧来の複数行Promptだけを変換し、新しいJSON契約内の直接描写を安全化できていなかった。R4-2PではProvider拒否後の安全再実行時だけ、短縮JSONの動作、表情、背景、候補演出を間接表現へ置換し、人物同一性と撮影契約を維持する。

## Production受入れ証跡

- アカウント: ログイン済み`test`モニター
- 対象: ページ22・4コマ目
- 操作: 有効な1案再制作を1回だけ実行
- Job: `d0eb56b3-50b9-4bf3-b618-2a7251c6ab56`
- Provider／model: `black-forest-labs`／`flux-2-pro`
- Worker: [run 31869411513](https://github.com/team478a/manga/actions/runs/31869411513)
- Worker結果: `status=idle requests=2 processed=1`
- Job結果: `provider_moderation_blocked`
- 試行: 1/2
- 進捗: 1%
- actual cost: 0
- Asset: なし
- Credit: 使用46、予約0→2→0、残り54→52→54
- 重複Job: なし
- 継続Worker: なし

候補採用、画像配置、品質承認、Canvas revision、作品、公開・販売状態は変更していない。

## 根因

R4-2Oは人物あり・新規`close_up`の場面情報を短いJSONへ集約した。

- `subjects[].action`
- `subjects[].expression`
- `background`
- `variation`

既存の`buildGeneralAudienceGenerationRetry`は、`この瞬間の動作:`、`動作:`、`表情・感情:`、`感情:`、`演出:`等の独立行だけを安全化していた。JSON Provider契約については旧構図の身体部位列挙だけが置換対象だった。

このためR4-2O導入後、Provider拒否から「このコマだけ再実行」を選んでも、短縮JSON内の直接描写は変更されず、同じ拒否を繰り返す状態だった。

## 実装

Provider拒否後の一般向け安全再実行時だけ、短縮JSONを次のように変換する。

- `subjects[].action`: 姿勢と視線で場面を伝える穏やかな動作
- `subjects[].expression`: 一般向けの抑制された自然な表情
- `background`: 非直接的で簡潔な物語上の環境
- `variation`: 姿勢、視線、距離、光、影で緊張感を間接表現

次は維持する。

- 人物descriptionと衣装
- position
- style
- camera angle／distance／70mm相当
- 被写体高約65%の非crop構図
- clean unmarked surface
- `input_image_N`参照役割
- target panel ID
- reference Asset ID
- output設定

初回生成Promptは変更しない。旧Provider JSON契約と旧複数行Promptの安全化も維持する。

## 不変の外部契約

URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、retry回数、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、成人向け境界、Desktopは変更していない。

## 検証

- 集中テスト: 32/32成功
- `npm run deps:check`: 成功（336 files、0 errors、既存warnings 2）
- `npm run lint`: 成功
- Hub typecheck: 成功
- `npm run hub:test`: 726/726成功
- `npm run canvas:test`: 26/26成功
- `npm run ai:test`: 48/48成功
- `npm run db:migrations:validate`: 59/59成功
- Workspace package build: 成功
- Next.js Webpack production build: 成功
- `git diff --check`: 成功
- Core quality: 成功
- Migration roundtrip: 成功
- Windows build: 成功
- Vercel: 成功
- Vercel Preview Comments: 成功

## ロールバック

R4-2Pのcommitをrevertする。DB、migration、RPC、Storage、Canvas schemaのrollbackは不要。Productionで失敗したJobは履歴として保持し、再実行しない。

## 停止条件

- Draft PR作成
- Core quality成功
- Migration roundtrip成功
- Windows build成功
- Vercel成功
- Vercel Preview Comments成功
- Draft／MERGEABLE確認
- Vercel Preview URL確認

merge前に追加のProduction Provider生成を行わない。merge後に失敗Jobの安全再実行を1回だけ行い、Asset、Provider moderation、構図、文字混入、credit、重複Jobを確認する。責任者判断前に次工程へ進まない。
