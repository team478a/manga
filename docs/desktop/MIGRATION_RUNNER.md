# Desktop SQLite migration runner

## 変更概要

Desktop SQLiteのversioned migrationを`infrastructure/sqlite/migration-runner.ts`へ分離しました。`MangaiDatabase`はmigration内容を定義し、runnerが未適用判定、事前backup、transaction実行、`schema_migrations`登録、structured logを一元管理します。

## 修正対象の問題

以前は事前backup対象と実行migrationが別々に列挙されていました。このため、後から追加された`character-profiles-v1`が実行一覧にはある一方、事前backup判定から漏れていました。

各migrationメソッドも未適用判定と`schema_migrations`登録を個別に実装しており、追加時に一部の処理を忘れる可能性がありました。

## Migration契約

```ts
type Migration = {
  version: string;
  name: string;
  backupRequired: boolean;
  run: (database: Database.Database) => void;
};
```

現在の12 migrationは、すべて1つの配列で順序付き定義されています。

1. `canvas-v1`
2. `canvas-relative-text-v1`
3. `canvas-panel-shape-v1`
4. `hybrid-generation-policy-v1`
5. `hybrid-generation-routing-v1`
6. `asset-library-v1`
7. `panel-layers-v1`
8. `adult-generation-consent-v1`
9. `adult-provider-policy-v1`
10. `adult-provider-policy-import-v1`
11. `content-class-v1`
12. `character-profiles-v1`

新しいmigrationを追加する場合は、この配列への定義とmigration本体だけを追加します。migration本体から未適用判定、backup、transaction、登録処理を呼び出してはいけません。

## 実行順序

既存DBでは、未適用migrationごとに次を実行します。

1. WALをcheckpointする
2. SQLite本体を一時backup名へコピーする
3. 同じディレクトリ内で正式backup名へrenameする
4. migration transactionを開始する
5. 最初の未適用migrationでは共通schema準備も同じtransaction内で実行する
6. migration本体を実行する
7. `schema_migrations`へversion、name、適用時刻を登録する
8. transactionをcommitする
9. structured logへ成功を記録する

migrationまたは共通schema準備が失敗するとtransaction全体がrollbackされ、versionは登録されません。次回起動時に同じmigrationを再試行できます。

新規DBでは復元元がないためmigration backupを作らず、同じtransactionと登録処理を実行します。すべて適用済みの場合は、冪等な共通schema準備だけをtransactionで実行します。

## Backupとログ

backupは次の形式で`backups/`へ保存します。

```text
mangai_local-before-{migration-version}-{UTC timestamp}.sqlite
```

途中コピーは`.tmp`として作成し、成功時だけ正式名へrenameします。コピー失敗時は`.tmp`を削除し、migrationを開始しません。

次のeventを`logs/desktop.jsonl`へ秘密値なしで記録します。

- `migration_backup_created`
- `migration_applied`
- `migration_failed`

## DB migration・後方互換性・セキュリティ

新しいschema versionやデータ変換は追加していません。既存12 migrationのSQL、適用順、`schema_migrations.version`、backupファイル形式を維持しています。Project、Canvas、Asset、AI設定、成人向けPolicyの公開契約にも変更はありません。

事前backupが全migrationへ適用されるため、既存利用者データの保護範囲は広がります。renderer、IPC、外部serviceへSQLite接続や秘密値を公開しません。

クリーンインストール時にDesktopのdevelopment推移依存`fast-uri` 3.1.3に対するhigh severity advisoryを検出したため、lockfileを修正版3.1.4へ更新しました。rootとDesktopの`npm audit`はいずれも0件です。

## テスト内容

- 全pending migration直前に個別backupが作成される
- 12 migrationのversionとnameがrunnerから登録される
- `character-profiles-v1`もbackup対象になる
- migration途中失敗でschemaとデータがrollbackされる
- 失敗したversionが登録されず、修正後に再試行できる
- 適用済みmigrationは二重実行・二重backupされない
- 旧Canvas DBから現行schemaまで更新できる
- backup作成・適用eventがstructured logへ残る

全体回帰ではHub 49/49、canvas-core 26/26、ai-core 44/44、Desktop 93/93、日英アクセシビリティ違反0件、TypeScript、ESLint、Hub／Desktop production build、16 Supabase migration静的検査、RC preflightに成功しています。

## 手動確認

1. Desktopを終了し、利用中SQLiteの別コピーを保管する
2. test用コピーの`schema_migrations`から任意のversionを削除する
3. Desktopを起動し、対応する`before-{version}` backupが作成されることを確認する
4. `schema_migrations`へversionが再登録されることを確認する
5. `logs/desktop.jsonl`でbackupと適用eventを確認する
6. Project、Canvas、Asset、AI設定を開き、既存内容が維持されることを確認する

本番利用DBの`schema_migrations`を手動変更してはいけません。この手順は複製したtest DBだけで実施します。

## Rollback

コードをPR-09前へ戻しても、schema versionとテーブル構造は同じためDB rollbackは不要です。起動失敗時はDesktopを終了し、対象migration直前の`mangai_local-before-*.sqlite`を別名で保全してからSQLite本体へ戻します。WAL／SHMを残したまま本体だけを差し替えないでください。

## 残課題

- migration SQL本体を`MangaiDatabase`から個別moduleへ段階的に移動する
- backup世代数と総容量の運用上限を定義する
- 古い主要製品versionの実SQLite fixtureを継続追加する
