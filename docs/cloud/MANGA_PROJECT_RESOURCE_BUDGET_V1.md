# MANGAI Cloud 作品別リソース予算 v1

更新日: 2026-08-01

## 目的

32〜100ページの長編制作で、一作品の生成がアカウント全体のクレジット、費用、Storageを意図せず消費し続けることを防ぐ。

## 実装内容

- 作品別の月間生成クレジット上限
- 作品別の月間推定費用上限
- 作品別のStorage上限
- 警告表示を開始する割合
- 作品単位の生成停止スイッチ
- 長編作品コックピットでの使用量、上限、警告、停止状態の確認
- 所有者または管理者だけが変更できる保存RPC
- Job登録時とAsset容量変更時のDB強制停止

利用者画面には集計したクレジット、概算費用、容量だけを表示する。Provider名、モデル名、API単価、内部の料金計算式は表示しない。

## DB境界

Migration: `202608010010_cloud_project_resource_budgets.sql`

主な追加物:

- `public.cloud_project_resource_budgets`
- `public.save_cloud_project_resource_budget(...)`
- `public.get_cloud_project_resource_usage(uuid)`
- 既存作品への初期行作成と、新規作品作成時の自動作成trigger
- 生成Job登録前のクレジット・費用・停止状態検査trigger
- 生成Asset登録・容量更新前のStorage上限検査trigger

数値上限が未設定の場合は、従来のアカウント全体上限だけを使用する。作品別上限を設定した場合は、アカウント上限と作品上限の両方を満たす必要がある。

## 適用手順

1. Supabase SQL Editorで `supabase/migrations/202608010010_cloud_project_resource_budgets.sql` を実行する。
2. 次を確認する。

```sql
select
  to_regclass('public.cloud_project_resource_budgets') is not null as project_budgets,
  to_regprocedure('public.get_cloud_project_resource_usage(uuid)') is not null as usage_function,
  to_regprocedure('public.save_cloud_project_resource_budget(uuid,integer,bigint,bigint,integer,boolean)') is not null as save_function;
```

3. 対象作品のコックピットを開き、「作品の生成量・費用・容量」が表示されることを確認する。
4. 小さいテスト上限を設定し、上限超過の生成が安全な日本語案内で停止することを確認する。
5. 確認後に実運用値へ戻す。

Rollbackが必要な場合は `supabase/rollbacks/202608010010_cloud_project_resource_budgets.sql` を使用する。本番相当データでは、先に設定値の退避と責任者承認を行う。

## 安全性

- RLSにより、作品所有者だけが自分の作品の予算と使用量を参照できる。
- 保存RPCは作品所有者または管理者だけが実行できる。
- 上限判定はUIだけに依存せずDB triggerでも行う。
- 内部SQLエラーは利用者へ表示せず、安全な案内へ変換する。
- 並行Job登録は予算行をlockし、同時実行による上限超過を抑止する。

## 現時点の制限

- 費用は確定請求額ではなく、Job台帳の予約・確定値を基にした概算である。
- Storage使用量は作品に紐づく生成Assetを集計する。
- Migration未適用環境ではコックピットを壊さず、設定準備中として縮退表示する。
- 実Providerを使った上限停止と、100ページ実データでの負荷確認は別途必要。
