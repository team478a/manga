# PR-R4-2Z 安全再実行への最新画像品質契約継承

作成日: 2026-08-16
Branch: `codex/fix-r4-2z-retry-quality-contract`
Base: `origin/feature/manga-canvas-mvp` @ `e52540c`（PR #282 merge commit）
Draft PR: [#283](https://github.com/team478a/manga/pull/283)（Draft／MERGEABLE）
Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-031855-team478as-projects.vercel.app

## 目的

PR #282反映後のProduction限定受入れで、失敗Jobの再実行、Credit予約・確定、Asset生成が正常に完了した一方、生成画像へ端末UI風の疑似文字、衣装上の文字状模様、画面端の文字状模様が残った。古い失敗Jobの保存済み入力を安全再構成する際にも、現行の画像品質契約を必ず補強する。

## Production受入れ結果

- 対象は`test`モニターのページ22・コマ1。開始時はCanvas revision 8、使用64／予約0／残36だった。
- 失敗候補の再実行ボタンが有効になったことを確認し、1 Jobだけ登録した。登録後は同じコマの再実行が無効となり、並行重複を防止した。
- 公式Worker [31918003768](https://github.com/team478a/manga/actions/runs/31918003768)を`mode=run`で1回だけ実行した。`status=idle requests=2 processed=1`で成功した。
- 新しいprivate画像Assetが1件作成され、Creditは使用64／予約2／残34から使用66／予約0／残34へ確定した。
- 新候補は正立、自然な人体、小物の単一性を概ね満たした。一方、端末画面、衣装、画面端に文字状模様があり、販売品質未達として追加生成なしで不採用にした。
- 最終状態は画像4/4、必須台詞1/1、生成中0、失敗0、Canvas revision 8／最新8、PNG成功、使用66／予約0／残34。既存の未配置候補1件と目視確認blockerは残る。
- Canvas配置、Canvas保存、公開・販売、Production設定の変更は行っていない。

## 原因

- 通常の新規コマ生成には、正立、自然な人体、各小物を一つだけ配置、端末画面を空のガラス面にする正方向契約と、文字・疑似文字・ロゴ等のnegative promptが存在する。
- Provider拒否後の安全再実行は、失敗Jobへ保存された古い生成入力を復元し、直接描写だけを一般向けへ置換していた。
- その変換は保存済みの古いnegative promptをそのまま維持し、短縮Provider契約にも現在の端末・小物・描画面品質条件を補強していなかった。
- そのため、再実行経路だけがPR #281で強化した新規生成品質契約へ追従していなかった。

## 実装

1. 安全再実行の正方向promptへ、正立、自然な顔・手指・関節、小物単一性、空の端末画面、人物・背景・小物・光・影だけの描画面を追加する。
2. 古い短縮Provider JSONを再構成する際、同じ品質条件を`quality_gate`へ追加する。
3. 文字、疑似文字、記号、字幕、吹き出し、看板、ロゴ、透かし、端末UI、重複小物を現行のnegative promptとして先頭へ補強し、元Job固有のnegative promptも維持する。
4. 対象コマ、参照Asset、人物・画風・世界観version、画像操作、保存済みPanel Specificationは変更しない。
5. 二重安全化禁止と、一般向けmoderationが`allow`になる既存契約を維持する。

## 回帰境界

- 変更なし: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、Credit単価、retry回数、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- 新規生成promptは変更せず、Provider拒否後に保存済み入力を安全再構成するdomain関数だけを補強する。
- Prompt本文、Provider応答、署名URL、利用者画像、API keyをログ・文書へ記録しない。
- 本PRではProduction Providerを再実行しない。merge後に、必要ならページ22・コマ1を新しい条件から1候補だけ再制作し、4項目品質確認後に採否を決める。

## 検証

- 集中: 安全再実行、対話型再実行、新規コマ生成39/39成功。
- 安全化後も対象コマ、参照Asset、元negative promptを維持し、最新版の端末・小物・画像内文字条件を追加することを確認した。
- 安全化後のpromptとnegative promptを既存moderationへ渡し、`allow`を確認した。
- Hub 737/737、Canvas 26/26、AI 48/48、100ページ長編4/4、migration 59/59成功。
- dependency／module boundary、lint、Hub typecheck、research eval、Cloud漫画repository、owner isolation、workspace packages、Webpack production build、RC structure、diff check成功。
- 初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功した。

## 停止条件

- Draft PR #283の最終文書同期HEADでも、Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsの成功を確認する。
- Preview deploymentを確認し、Production未変更、予約Credit 0、Canvas revision 8、公開・販売未変更を維持する。
- 責任者のmerge前にProduction再生成と次工程へ進まない。
