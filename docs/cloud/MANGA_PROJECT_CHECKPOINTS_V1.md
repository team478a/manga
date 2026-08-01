# MANGA Project Checkpoints v1

## 目的

32〜100ページの制作中に安全な作業バックアップを残し、完成原稿を変更不能な履歴として固定します。大きな修正、一括生成、書き出し前の復帰点を作品単位で管理します。

## 利用者向け機能

- 作品詳細画面から名前を付けて「作業バックアップ」を作成
- 原稿チェック合格かつ全ページ確定後に「完成版」を固定
- 固定時点のページ数と作成日時を履歴表示
- 現在の作品revisionと一致する固定版を表示
- 作成処理中はボタンを無効化し、「作成中」「固定中」を表示

## 保存方式

- Canvas JSONをSHA-256で識別し、同じ内容は作品内で1回だけ保存
- 2回目以降は変更されたページのCanvasだけが新しいblobになる
- checkpointには作品・章・話・シーン・ページ・Asset metadataのmanifestを保存
- APIキー、Provider秘密情報、生成単価は保存しない
- checkpointとreleaseは更新APIを持たず、作成後は不変

## 完成版の条件

- 作品が1〜100ページ
- 実行中または待機中の画像生成Jobがない
- すべてのページに保存済みCanvas snapshotがある
- すべてのページが`finalized`
- ページrevisionと確定revisionが一致
- 制作Context revisionと確認済みrevisionが一致

条件はUIだけでなくDB RPCでも再確認します。

## DB

- migration: `202608010011_cloud_project_checkpoints.sql`
- rollback: `supabase/rollbacks/202608010011_cloud_project_checkpoints.sql`
- tables: `cloud_project_backup_blobs`, `cloud_project_checkpoints`, `cloud_project_checkpoint_pages`
- RPC: `create_cloud_project_checkpoint(uuid,text,text)`
- RLS: 作品を閲覧できる利用者だけが履歴を読み取れる
- 書き込み: 認証利用者はsecurity definer RPC経由のみ

## staging適用後の確認SQL

```sql
select
  to_regclass('public.cloud_project_backup_blobs') is not null as backup_blobs,
  to_regclass('public.cloud_project_checkpoints') is not null as checkpoints,
  to_regclass('public.cloud_project_checkpoint_pages') is not null as checkpoint_pages,
  to_regprocedure('public.create_cloud_project_checkpoint(uuid,text,text)') is not null as create_function,
  coalesce((select relrowsecurity from pg_class where oid='public.cloud_project_checkpoints'::regclass),false) as checkpoints_rls;
```

## v1の境界

- v1は固定版の作成・履歴・差分重複排除まで
- 固定版を現在の作品へ復元する操作は次のタスク
- blob本体の利用者向け表示・ダウンロードは行わない
- Supabase staging適用、実ブラウザ、100ページ実データの確認は未実施
