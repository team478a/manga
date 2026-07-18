# Hubデータベースマイグレーション

MANGAI HubのSupabase PostgreSQL変更を、安全に追加・検証・取り消すための運用ルールです。

## ファイル構成

- `supabase/schema.sql`: 新規環境を現在の完全な状態へ構築する正規スキーマ
- `supabase/migrations/{id}_{name}.sql`: 既存環境へ順番に適用するforward SQL
- `supabase/rollbacks/{id}_{name}.sql`: 対応する変更を取り消すrollback SQL
- `supabase/migrations/manifest.json`: 適用順序と説明を管理するmanifest
- `supabase/tests/`: PostgreSQL 16上で使うbootstrapとassertion

`id`は12桁の日時形式で昇順にし、forwardとrollbackで同じファイル名を使用します。各SQLは明示的な`begin;`と`commit;`を1組だけ持たせます。

## 現在の変更単位

| ID             | 内容                                                            | rollback時の保護                       |
| -------------- | --------------------------------------------------------------- | -------------------------------------- |
| `202607140001` | 販売パッケージ由来のサンプル画像・Project ID・Storage削除policy | 対象データが存在する場合は停止         |
| `202607140002` | Desktop端末認証                                                 | 有効な承認済み端末が存在する場合は停止 |
| `202607140003` | 端末認証rate limit・期限切れ清掃                                | 関数、rate limit表、indexを除去        |
| `202607180001` | 一般Cloud／成人Desktopのcontent class境界                       | 追加列、制約、policy、indexを除去      |
| `202607180002` | Cloud Creator保存、RLS、revision、非公開Asset基盤               | Storage object存在時は停止して保護     |
| `202607180003` | Cloud Project・Episode・Page管理と表紙設定RPC                   | 追加関数と表紙参照を除去               |
| `202607180004` | 一般向けCloud AI永続Queue、moderation、worker lease             | Job関数とJobテーブルを除去             |
| `202607180005` | Cloud AI plan、quota、原価ledger、rate limit、予算停止         | 課金表・予約列を除去しPhase 3 RPCへ復元 |
| `202607180006` | Stripe Subscription entitlement同期                            | event表・同期関数・event時刻列を除去    |
| `202607180007` | 購入者Profile・購入履歴・再ダウンロード                        | 購入者列・policy・indexを除去           |
| `202607180008` | Cloud Projectから非公開作品・停止中商品への同期              | 同期RPCを除去                           |
| `202607180009` | Cloud AI管理操作の変更前後を記録する監査ログ                 | 監査ログ表を除去                        |
| `202607180010` | quota・Job失敗・予算警告・生成停止の永続通知                | 通知表と生成関数を除去                  |

データを失う可能性があるrollbackは、条件を満たさない限り例外で停止します。停止した場合は自動回避せず、バックアップと対象データを確認してください。

## ローカル静的検査

```powershell
npm run db:migrations:validate
```

この検査はmanifestの順序と重複、forward/rollbackの一対一対応、トランザクション境界、forward SQLへの破壊的命令の混入、正規スキーマとの対応を確認します。

## CIの往復検証

`.github/workflows/hub-db-migrations.yml`はPostgreSQL 16の使い捨てDBで次を実行します。

1. 旧状態の最小スキーマを構築
2. forwardを昇順適用し、列・表・権限・rate limit動作を検証
3. rollbackを逆順適用し、追加した列・表・関数・policyが除去されたことを検証
4. forwardを再適用し、同じassertionを再実行
5. 別DBで`schema.sql`を2回適用し、新規構築と冪等性を検証
6. 同じDBへ読み取り専用staging preflightを実行

ローカルで同じSQL往復試験を行う場合はPostgreSQL 16と`psql`が必要です。未導入環境では静的検査を実行し、実DB試験はGitHub Actionsで確認します。

## stagingの読み取り専用preflight

PostgreSQL clientの`psql`をインストールし、staging専用の接続情報を環境変数へ設定します。接続先の取り違えを防ぐため、`MANGAI_DB_ENV=staging`が完全一致しなければコマンドは停止します。

```powershell
$env:MANGAI_DB_ENV = "staging"
$env:PGHOST = "db.your-project.supabase.co"
$env:PGPORT = "5432"
$env:PGDATABASE = "postgres"
$env:PGUSER = "postgres"
$env:PGPASSWORD = "staging database password"
$env:PGSSLMODE = "require"
npm run db:staging:preflight
```

preflightは読み取り専用トランザクション内で、PostgreSQL version、主要表と列、RLS、関数権限、Storage bucket・policy、無効index、承認済み端末データの整合性を検査します。作品・商品・端末認証の件数だけを表示し、migration適用やrollbackは行いません。接続情報やパスワードも出力しません。

## 本番適用手順

1. Supabaseのバックアップを取得し、復元できることを確認します。
2. maintenance時間と対象migration IDを記録します。
3. stagingへforwardを1件ずつ昇順適用し、`npm run db:staging:preflight`とHubの認証・インポート・端末認証を確認します。
4. 本番へ同じ順序で適用し、各変更後にエラーと主要件数を確認します。
5. 障害時はアプリを先に安全な版へ戻し、対応rollbackを新しいものから逆順で実行します。
6. rollback guardが停止した場合はSQLを強制変更せず、バックアップ復元またはデータ移行を選択します。

本番での自動rollbackは行いません。スキーマ変更とアプリ配布の互換期間を設け、削除や型変更は「新規追加 → データ移行 → 利用切替 → 後続リリースで削除」に分割します。

## 新しいmigrationの追加

1. 次のIDでforwardとrollbackを作成します。
2. `manifest.json`へ同じID、名前、説明を追加します。
3. `schema.sql`にも最終状態を反映します。
4. 必要なbootstrapまたはassertionを追加します。
5. 静的検査とHubのTypeScript、ESLint、本番ビルドを実行します。
6. Pull Requestの`Hub DB migrations`が成功してから適用します。
