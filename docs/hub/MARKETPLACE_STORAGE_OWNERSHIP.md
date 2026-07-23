# Marketplace Storage所有者境界

更新日: 2026-07-24

対象bucket:

- `works`
- `digital-products`

## 新規保存パス

新しく保存する作品画像と販売ファイルは、bucket内で次の形式を使用します。

```text
{auth_user_id}/{resource_id}/{file_name}
```

`auth_user_id`はSupabase Auth User IDです。Profile IDではありません。`resource_id`には作品、商品、または所有権確認済みCloud ProjectのUUIDを使用します。ファイル名はpath traversalを拒否したうえで安全なASCII名へ変換します。

## Policy

- insert: 認証済みで、pathの先頭が`auth.uid()`と一致する場合だけ許可
- update: `storage.objects.owner_id = auth.uid()::text`の場合だけ許可
- delete: `storage.objects.owner_id = auth.uid()::text`の場合だけ許可
- Service Role: Supabase標準のRLS bypassをServer内部処理だけで使用
- 管理者: Browserから他人のStorage objectを直接変更する特例は設けない

アプリケーション側でも作品・商品・Cloud Projectの所有権を確認し、確認前に更新用ファイルをアップロードしません。

## 既存パスとの互換性

従来の`general/...` objectは移動しません。新規insertでは旧形式を拒否しますが、既存objectは`owner_id`が現在のAuth User IDと一致する場合に限り更新・削除できます。既存の作品公開URLと購入済み商品の保存pathは維持されます。

## 検証

PostgreSQL 16のRLS試験で次を確認します。

- 所有者のinsert、update、delete
- 別ユーザーのupdate、delete拒否
- 未認証insert拒否
- 新規`general/...` insert拒否
- 既存`general/...`の所有者更新・削除
- forward、全rollback、再適用
- canonical schemaの二重適用

## Rollback

障害時はアプリを先に旧版へ戻し、`202607240001_storage_owner_policies`のrollbackを適用します。rollbackは旧insert／update Policyへ戻しますが、保存済みの新形式objectを削除・移動しません。
