# MANGAI Phase 7 Supabase staging準備

更新日: 2026-07-18

## 現在の完了範囲

- Supabase forward migration 13件と対応rollback 13件をmanifestで管理
- forward／rollback／正規schemaの改行正規化SHA-256を固定
- checksum、適用順、重複、transaction境界、破壊的forward SQLを静的検査
- PostgreSQL 16で全forward、全rollback、再適用に成功
- 正規`schema.sql`の新規構築と二重適用に成功
- staging用read-only assertionをPostgreSQL 16で完走
- Supabase Project refと接続先host／pooler userが一致しないpreflightを拒否
- CI用の接続先例外はloopback PostgreSQLだけに限定

## 実stagingで必要なもの

1. 本番とは別のSupabase staging Project
2. staging Project ref
3. PostgreSQL接続host、database、user、password
4. PostgreSQL client `psql`
5. 適用直前のSupabase backupと復元確認
6. staging用のテスト利用者と管理者アカウント

接続password、service role key、JWT秘密値はリポジトリ、Markdown、Codexの回答、スクリーンショットへ保存しない。Windows Credential Manager、CI secret、または作業中のprocess環境変数だけで扱う。

## staging適用前の確認

```powershell
npm run db:migrations:validate
npm run hub:test
npm run rc:preflight
```

環境変数は[DB migration運用手順](hub/DATABASE_MIGRATIONS.md)に従って設定する。`MANGAI_STAGING_PROJECT_REF`と`PGHOST`または`PGUSER`が一致しない場合、preflightは接続前に停止する。

## staging適用後の確認

```powershell
npm run db:staging:preflight
```

その後、staging利用者で次を確認する。

- ログイン、再ログイン、ログアウト
- 一般向けCloud Projectの作成、保存、revision競合
- 非公開Cloud Assetの所有者分離
- 成人向けまたは区分不明データのCloud保存拒否
- Desktop端末認証、期限切れ、失効
- Cloud AI Jobのquota前拒否、予約、確定、解放
- Stripe test webhookの冪等性と順序保証
- 購入履歴と本人限定再ダウンロード

## 現在の判定

ローカルDB準備: **合格**

実Supabase staging: **Projectと接続資格情報の準備待ち**
