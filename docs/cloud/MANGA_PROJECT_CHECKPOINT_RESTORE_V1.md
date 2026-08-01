# MANGA Project Checkpoint Restore v1

## 目的

32〜100ページ作品を、保存済みの作業バックアップまたは完成版の内容へ安全に戻します。復元を実行する直前にも自動バックアップを作り、操作を取り消せる復帰点を残します。

## 利用者向け動作

- 作品詳細のバックアップ履歴から復元対象を選ぶ
- 注意事項を確認し、チェックを入れた場合だけ復元できる
- 復元中はボタンを無効化して二重実行を防ぐ
- 復元履歴と最終復元日時を表示する
- migration未適用時は復元ボタンを無効化し、既存のバックアップ作成・履歴表示は継続する

## 安全条件

- 対象作品を編集できる本人だけが実行できる
- 別作品のcheckpointは利用できない
- 待機中または実行中の画像生成がある場合は拒否する
- 有効なページ編集ロックがある場合は拒否する
- 復元前checkpointを同一transaction内で先に作成する
- revisionは過去の値へ戻さず、現在値から単調増加させる
- 復元した全ページを`revision_required`にし、完成確定とContext確認を解除する
- Canvas blobが欠けている場合はtransaction全体を失敗させる
- DB内部エラーは利用者へ直接表示しない

## 復元対象

- 作品名、説明、綴じ方向、ページ寸法、DPI
- 章、話、シーン、ページ構成
- 各ページの保存済みCanvas JSON
- checkpointに含まれるAsset metadataの有効状態

APIキー、Provider設定、料金情報、成人向け許可、公開状態は復元しません。Assetの実ファイルは既存の非公開Storage objectを参照し、削除済みobjectそのものを再生成しません。

## DB

- migration: `202608020001_cloud_project_checkpoint_restore.sql`
- rollback: `supabase/rollbacks/202608020001_cloud_project_checkpoint_restore.sql`
- table: `cloud_project_checkpoint_restores`
- RPC: `restore_cloud_project_checkpoint(uuid,uuid)`
- RLS: 作品を閲覧できる利用者だけが復元履歴を読める
- 書き込み: 認証利用者はsecurity definer RPC経由のみ

## Supabase staging適用後の確認SQL

```sql
select
  to_regclass('public.cloud_project_checkpoint_restores') is not null as checkpoint_restores,
  to_regprocedure('public.restore_cloud_project_checkpoint(uuid,uuid)') is not null as restore_function,
  coalesce(
    (select relrowsecurity
     from pg_class
     where oid='public.cloud_project_checkpoint_restores'::regclass),
    false
  ) as restores_rls;
```

期待値は3項目すべて`true`です。

## 未実施

- Supabase stagingへのmigration適用
- 実ブラウザでの復元確認
- 100ページ実データでの所要時間・容量確認
- 復元後の再確認から完成版再固定までの実運用確認
- 責任者承認
