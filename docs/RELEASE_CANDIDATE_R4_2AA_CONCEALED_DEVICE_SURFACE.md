# PR-R4-2AA 端末表示面を描かせない正方向契約

作成日: 2026-08-16
Branch: `codex/fix-r4-2aa-concealed-device-surface`
Base: `origin/feature/manga-canvas-mvp` @ `59b8377`（PR #283 merge commit）
Draft PR: 作成前
Vercel Preview: 確認前

## 目的

PR #283反映後のProduction限定受入れで、安全再実行、Credit確定、Asset生成は正常だったが、BFL生成画像が端末の空画面指定を守らず、時刻とUI風文字・アイコンを描き込んだ。画面を空にする指定から、表示面そのものをカメラへ見せない正方向契約へ切り替える。

## Production受入れ結果

- 対象は`test`モニターのページ22・コマ1。開始時はCanvas revision 8、使用66／予約0／残34だった。
- 失敗Jobを1件だけ安全再実行し、使用66／予約2／残32、生成中1、同一コマの再実行ボタン無効を確認した。
- 公式Worker [31920132648](https://github.com/team478a/manga/actions/runs/31920132648)を`mode=run`で1回だけ実行した。`status=idle requests=2 processed=1`で成功した。
- private画像Assetが1件作成され、Creditは使用68／予約0／残32へ正常確定した。
- 新候補は正立、人体、小物1個を満たした。一方、端末に時刻、UI風文字・アイコンが明確に描かれ、顔の上端も大きく切れていたため販売品質未達と判定した。
- 新候補は追加生成なしで不採用にした。最終は画像4/4、必須台詞1/1、生成中0、失敗0、Canvas revision 8／最新8、PNG成功、使用68／予約0／残32。
- Canvas配置、Canvas保存、公開・販売、Production設定は変更していない。

## 原因

- BFL FLUX.2はnegative promptをProviderへ送れない既存契約で、正方向promptだけを送信する。
- 「反射と光だけの空のガラス画面」は表示面を正面へ描くこと自体を要求するため、モデルが端末らしいUIを補完する余地が残った。
- PR #283により安全再実行へ品質契約は正しく継承されたが、契約内容だけでは実Providerの出力制御として不十分だった。

## 実装

1. 手持ち端末が必要な場合、無地の背面または細い側面だけをカメラへ向ける。
2. 表示面は人物の体側または画面外へ向け、Providerへ表示面を描かせない。
3. 短縮Provider JSONの`quality_gate`、通常の長文prompt、Provider拒否後の安全再実行を同じ契約へ統一する。
4. 正立、自然な人体、小物単一性、描画面、既存negative promptは維持する。

## 回帰境界

- 変更なし: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、Credit単価、retry回数、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- Provider adapterは変更せず、BFLへnegative promptを送らない既存契約を維持する。
- 対象コマ、参照Asset、人物・画風・世界観version、画像操作、Panel Specificationを維持する。
- Prompt本文、Provider応答、署名URL、利用者画像、API keyをログ・文書へ記録しない。
- 本PRではProduction Providerを再実行しない。

## 検証

- 集中: コマ生成、BFL adapter、安全再実行47/47成功。
- 短縮Provider契約は2,000文字未満を維持する。
- 通常生成と安全再実行の両方へ、端末背面・側面契約が含まれることを確認した。
- Hub 737/737、Canvas 26/26、AI 48/48、100ページ長編4/4、migration 59/59成功。
- dependency／module boundary、lint、Hub typecheck、research eval、Cloud漫画repository、owner isolation、workspace packages、Webpack production build、RC structure、diff check成功。
- Draft PR、CI、Vercel Previewは作成後に追記する。

## 停止条件

- Draft PRを作成し、Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsの成功を確認する。
- Production未変更、予約Credit 0、Canvas revision 8、公開・販売未変更を維持する。
- 責任者のmerge前にProduction再生成と次工程へ進まない。
