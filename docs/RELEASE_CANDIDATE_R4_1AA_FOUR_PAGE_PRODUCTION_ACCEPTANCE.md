# PR-R4-1aa 4ページ限定Production受入れ

## 現在の結論

R4-1zはPR #244としてマージ済みで、Production UIにもdurable登録と合算preflightが反映されている。Production migrationは適用したが、既定ACL差異を検出して即時修正し、追加migrationへ固定した。Cloud AI credit不足のため、4ページの有料生成はfail-closedで開始していない。

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

1. Supabase SQL EditorでDB変更を伴わない存在確認を実施し、tableと4 RPCが未適用であることを確認した。
2. merge済み`202608130001_cloud_generation_batch_targets.sql`をProductionへ適用し、`Success. No rows returned`を確認した。
3. 初回権限検証で、Productionのschema default privilege由来によりauthenticated SELECTが残る差異を検出した。RLS有効・policyなしで行は読めないが、設計上の直接権限なしを満たさないため生成を停止した。
4. Productionで`public`／`anon`／`authenticated`のtable権限を明示revokeし、service roleだけへCRUDを再付与した。
5. table、4 RPC、RLS、policyなし、table ACL、RPC ACL、security definer、固定search pathの16項目を再検証し、16/16成功した。
6. 再発防止として`202608130002_cloud_generation_batch_target_acl.sql`を追加し、既定ACLを明示的に打ち消す。
7. ACL修正Draft PR [#245](https://github.com/team478a/manga/pull/245)を作成した。Preview: https://mangai-hub-staging-git-codex-fix-r4-1-9c47e2-team478as-projects.vercel.app。全CI／Vercel Preview成功、Draft／MERGEABLE。

ローカルではPostgreSQL 16で全54 migrationのforward／rollback／reapply／canonical、集中17/17、deps、lint、全typecheck、RC structure、diff checkに成功した。

最初の存在確認はEditorに残っていた旧入力が混在して構文エラーとなった。続く確認SELECTは正常に完了し、構文エラー時のDB変更はない。

## 再開条件

1. ACL追加migrationの修正PRを全CI成功後にmergeする。
2. `test`の利用可能Cloud AI creditを最低32にする。全利用者のplan価格・単価を変更せず、対象利用者のentitlementで準備する。
3. 同じ19〜22ページを選択し、blocker 0、要求16コマ、必要32 creditを再確認する。
4. その時点で初めて一括生成を開始する。

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
