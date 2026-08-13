# PR-R4-1aa 4ページ限定Production受入れ

## 現在の結論

R4-1zはPR #244としてマージ済みで、Production UIにもdurable登録と合算preflightが反映されている。ただしProduction DB migration未適用とCloud AI credit不足を確認したため、4ページの有料生成はfail-closedで開始していない。

## 対象

- Production: `https://app.mang-ai.com`
- 利用者: 一般向けモニター`test`
- 作品: `b008b746-94c6-4e83-85dd-3bb0e379c96a`
- ページ: 19〜22ページ（各4コマ）
- 生成: 4ページ／16コマ、1案／コマ
- Model／料金版: `flux-2-pro`／`bfl-flux2-2026-03`

## Production preflight

- 必要credit: 32
- 現在の残りcredit: 8
- 不足: 24
- 最大予約費用: $0.48
- モニターAI残り: 85回
- 作品credit: 上限設定なし
- Worker: 最短6回／約30分
- 1分Job化上限: 3コマ
- 結果: 開始ボタン無効。Provider Job追加0件。

## Production migration確認

Supabase SQL Editorで、DB変更を伴わない`to_regclass`／`to_regprocedure`のSELECTを実施した。

- `cloud_generation_batch_targets`: false
- `create_cloud_generation_batch_targets`: false
- `get_cloud_generation_batch_target_progress`: false
- `retry_cloud_generation_batch_targets`: false
- `dispatch_next_cloud_generation_batch_target`: false

最初の確認はEditorに残っていた旧入力が混在して構文エラーとなった。続く確認SELECTは1行を正常に返した。いずれも参照だけで、Production DBを変更していない。

## 再開条件

1. merge済み`202608130001_cloud_generation_batch_targets.sql`をProductionへ適用する。
2. tableと4 RPCの存在、権限、固定search pathをread-only検証する。
3. `test`の利用可能Cloud AI creditを最低32にする。全利用者のplan価格・単価を変更せず、対象利用者のentitlementで準備する。
4. 同じ19〜22ページを選択し、blocker 0、要求16コマ、必要32 creditを再確認する。
5. その時点で初めて一括生成を開始する。

## 合格条件

- 要求16 targetを原子的に永続登録し、silent partial successがない。
- Schedulerで16 Jobすべてが完了する。
- credit予約／確定と失敗時解放が一致する。
- 4ページの採用、保存、再読込、checkpointを確認する。
- 品質に問題があればR4-1abへ進まず、修正PRを分離する。

## 不変条件

Provider、model、pricing、credit単価、rate limit、retry、timeout、Scheduler頻度／上限、公開URL／API、Storage、Canvas schema、PDF／PNG、成人向け境界、Desktopは変更しない。

## 停止条件

Production migration適用とcredit準備の両方が成立するまで有料生成を開始しない。R4-1aa合格前に8ページ完成原稿／販売品質受入れへ進まない。
