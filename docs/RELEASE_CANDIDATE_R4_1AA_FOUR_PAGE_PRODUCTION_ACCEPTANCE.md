# PR-R4-1aa 4ページ限定Production受入れ

## 現在の結論

R4-1zとACL修正PR #245はマージ済みで、Production UIにもdurable登録と合算preflightが反映されている。Production migrationとACL境界は成立した。Cloud AI credit不足と個別Plan付与画面の欠落により、4ページの有料生成はfail-closedで開始していない。先に個別利用枠の運用解除PRを完了する。

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
8. PR #245はmerge commit `a5e903d5f062fab9c05068a67a8c102854ff5dd5`でマージ済み。

ローカルではPostgreSQL 16で全54 migrationのforward／rollback／reapply／canonical、集中17/17、deps、lint、全typecheck、RC structure、diff checkに成功した。

最初の存在確認はEditorに残っていた旧入力が混在して構文エラーとなった。続く確認SELECTは正常に完了し、構文エラー時のDB変更はない。

## 個別credit準備の阻害要因と解除

- Productionの`test`はFree上限20、使用12、予約0、残り8 credit。
- 現行管理画面は全体Planの月間creditやrate limitを編集できるが、個別ユーザーのentitlementを付与できない。全体Plan値の変更はR4-1aaの不変条件に反する。
- 接続中Chromeは`test`のProduction sessionだけで、Production Supabase管理者sessionはない。Supabase CLIはaccess tokenなし、Vercel CLIは別teamだけに接続されているため、管理者資格情報の抽出や迂回は行わない。
- 管理者ユーザー詳細へ、既存Free／Trial／Creatorを1〜90日の新期間として付与する最小操作を追加する。
- Stripe管理中、現在期間の予約credit、queued／running Job、停止中Plan、同時更新はfail-closedで拒否する。変更前後は既存Cloud AI管理監査へ記録する。
- DB／migration／RPCと全体Plan値は変更しない。解除PRのmerge後、管理者画面から`test`へTrial 30日を付与する。

## 運用解除PRの検証

- Draft PR: [#246](https://github.com/team478a/manga/pull/246)
- Preview: https://mangai-hub-staging-be38wgjhu-team478as-projects.vercel.app

- 集中: 10/10
- Hub: 654/654
- Canvas: 26/26
- AI: 48/48
- Desktop: 182/182
- Desktop a11y: violations 0
- deps、lint、全typecheck: 成功
- migration manifest: 54/54
- Hub production build: 短い物理worktreeで成功
- Desktop build、RC repository structure、diff check: 成功
- Provider Job追加: 0件
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。

## 再開条件

1. ACL追加migrationの修正PR #245をmergeする（完了）。
2. 個別Cloud AI利用枠の運用解除PRを全CI成功後にmergeする。
3. 管理者画面から`test`へTrial 30日を付与し、利用可能Cloud AI creditを最低32にする。全利用者のplan価格・単価は変更しない。
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
