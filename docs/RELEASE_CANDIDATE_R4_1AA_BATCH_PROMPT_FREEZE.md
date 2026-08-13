# PR-R4-1aa-3 長編一括生成条件固定

## 結論

4〜8ページ一括生成では、全コマの準備完了後、durable targetを1件も登録する前に、Provider、model、pricing、画風version、人物versionの一貫性を検証する。準備中に管理設定または作品設定が更新されて条件が混在した場合はfail-closedで中止し、再確認を求める。

## 監査した経路

`startCloudPageGenerationBatch`は合算preflight後、各コマを`prepareStoryboardPanelImage`で準備する。準備処理は採用scenario、人物visual profile、作品style bible、negative promptを生成入力へ含め、`characterProfileVersions`と`styleBibleVersion`をmetadataへ固定する。完成した入力は非公開`cloud_generation_batch_targets`へ原子的に登録され、Workerは同じ入力を既存quota境界から順次Job化する。

既存処理は各targetの版を固定していたが、16コマ等を複数chunkで準備している途中に管理model／pricingまたは人物／画風が更新されると、同じbatch内へ異なる条件が入る時間差があった。

## 修正

- preflight時点のmodel／pricingをbatch開始条件として保持する。
- 全targetのProvider／model／pricingが開始条件と一致することを確認する。
- 全targetで画風ID／versionが同一かつ存在することを確認する。
- 同一人物profileが複数targetに現れる場合、versionが同一であることを確認する。
- 不一致時はRPCを呼ばず、target、Provider Job、credit予約を作らない。

公開URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing値、credit、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Desktopの外部契約は変更していない。

## 検証

- 集中・関連: 21/21
- Hub: 658/658
- Canvas: 26/26
- AI: 48/48
- Desktop: 182/182
- Desktop accessibility: 成功
- dependency boundary／size、lint、全typecheck: 成功
- Supabase migration manifest: 54/54
- Hub production build: 短い物理worktreeの同一commitで成功
- Desktop build、`git diff --check`: 成功
- RC preflight: repository structure成功。ローカルへ本番Secretを保存しないため外部設定とmanual E2EはPENDING。

## Production状態と次工程

一般向けモニター`test`の対象作品は画風v1と主要人物3名v1を設定済み。19〜22ページは4ページ／16コマで必要32 credit、残り8 credit、24不足のため生成は開始していない。実Provider Job、batch target、credit消費も追加していない。

本PRの全CIとVercel Preview成功後に停止する。merge後、管理者が`test`へ既存Trialを30日付与し、残りcredit 32以上、blocker 0を確認して4ページ生成を1回だけ実施する。4ページ受入れ合格前に8ページ完成原稿／販売品質受入れへ進まない。
