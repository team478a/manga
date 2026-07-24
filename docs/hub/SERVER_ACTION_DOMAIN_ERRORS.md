# Hub Server Action Domain Error

## 対象

- 認証、プロフィール
- 作品、デジタル商品、グッズ申請
- Checkout開始
- Desktop端末承認・失効
- Cloud AI管理設定・通知
- Marketplace下書き同期
- Desktop販売パッケージ取込
- legacyローカル販売Action

## 表示境界

Server Actionがredirect queryまたはAction結果へ渡せるのは、入力検証など
利用者向けに作成したDomain Errorのメッセージだけです。Supabase、Storage、
Stripe、RPC、filesystemや未知例外のメッセージは操作別fallbackへ置き換えます。

```text
Form／Domain input
  -> ValidationError／PayloadTooLargeError
Infrastructure
  -> StorageTransactionError／INTERNAL_ERROR
Server Action
  -> safe Domain message or operation fallback
  -> redirect／Action result
```

## 分類

| 失敗 | Code |
| --- | --- |
| Form、manifest、MIME、hash、ID不正 | `VALIDATION_ERROR` |
| 作品画像・商品ファイルの容量超過 | `PAYLOAD_TOO_LARGE` |
| upload・cleanup失敗 | `STORAGE_TRANSACTION_ERROR` |
| DB更新・監査ログ・通知更新失敗 | `INTERNAL_ERROR` |
| Checkout Provider設定・実行失敗 | 既存のCheckout Domain Error |

Supabase Authのサインイン失敗は、アカウント有無を推測しにくい固定メッセージを
維持します。サインアップ失敗もSupabaseの生メッセージを表示しません。

## 互換性

- Form field、Action名、redirect先、成功メッセージは変更しない
- 作品・商品のStorage pathと公開範囲は変更しない
- 販売パッケージmanifest、hash検証、容量上限、cleanupは維持する
- Cloud AI管理値、監査内容、通知所有者条件は変更しない
- DB migration、Desktop IPC、保存形式の変更はない

## Rollback

この変更のcommitをrevertします。DBやStorageのrollbackは不要です。
