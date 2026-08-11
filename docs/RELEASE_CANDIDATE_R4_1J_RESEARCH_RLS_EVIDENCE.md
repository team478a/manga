# PR-R4-1j 市場分析RLS再帰修正 証跡

## 結論

Productionで報告された「市場分析を表示できませんでした」は、招待状態やReport保存失敗ではなく、認証利用者が保存済みReportを読む際の`profiles` RLS再帰が原因だった。

`public.is_admin()`を固定`search_path`の`SECURITY DEFINER`関数へ変更する追加migrationにより、既存のURL、application code、Report schema、所有者RLS条件を変更せずに再帰を解消する。

## Production診断（2026-08-11）

- 対象モニターは`active`、onboarding完了、利用期限内、AI上限内だった。
- AI利用記録は9件、市場分析Reportは4件。直近2回を含むReportは保存済みだった。
- 4件とも入力・結果・12 findingsの必須表示フィールドは期待するJSON型だった。
- 対象利用者のJWT claimを同一transaction内で再現してReportを読むと、`stack depth limit exceeded`を再現した。
- stackは`current_profile_id()`から`profiles`を参照し、`profiles_read_own_or_admin`／`profiles_admin_all`が`is_admin()`を呼び、`is_admin()`が再び`profiles`を参照して循環していた。

利用者入力、Report本文、Prompt、API key、認証情報は証跡へ記録していない。

## 修正

- migration: `202608110001_profile_admin_rls_recursion.sql`
- rollback: 同名rollbackで`SECURITY INVOKER`と関数設定を旧状態へ戻す。
- canonical schemaとmigration manifestを同期する。
- `is_admin()`の判定条件は`user_id = auth.uid() and role = 'admin'`のまま維持する。
- `profiles`、市場分析ReportのRLS policy、table、RPC、API、URLは変更しない。

## 非永続Production検証

追加migrationと同じ関数定義をtransaction内だけで有効にし、対象利用者claimで確認した。

- `current_profile_id()`: 対象profileへ正常解決
- `is_admin()`: `false`
- 所有Report可視件数: 4件
- 直近Report可視件数: 1件

検証後に`ROLLBACK`し、Productionの`is_admin()`が`SECURITY INVOKER`、関数設定なしへ戻っていることを確認した。永続的なProduction変更はない。

## 回帰テスト

- 集中テスト: 14/14成功（新規migration assertion 2件＋市場分析既存12件）
- migration manifest／checksum: 52/52成功
- full `rc:validate`: 成功
  - Desktop: 182/182
  - Hub: 629/629
  - Hub／Desktop production build: 成功
  - migration validation: 52/52
- `git diff --check`: 成功
- GitHub: Draft PR [#228](https://github.com/team478a/manga/pull/228)、MERGEABLE
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功
- Preview: `https://mangai-hub-staging-git-codex-fix-prof-a5b7c1-team478as-projects.vercel.app`

## 適用・停止条件

1. Draft PRの全CIとVercel Preview成功を確認する。
2. 責任者merge後にProductionへ追加migrationを適用する。
3. 対象モニター本人が既存Report履歴・直近Reportを再表示できることを確認する。
4. 新規市場分析を1件実行し、保存、詳細表示、再読込、履歴からの再表示を確認する。

上記3〜4が終わるまで市場分析のProduction受入れとR4-1全体は`pending`とする。PR-R4-2へ進まない。
