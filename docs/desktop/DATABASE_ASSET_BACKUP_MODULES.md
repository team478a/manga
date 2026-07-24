# Desktop Asset／Backupモジュール境界

## 目的

`MangaiDatabase`の公開APIとSQLite schemaを維持したまま、素材管理とProjectバックアップのSQLite／filesystem／ZIP責務を分離する。

## 構成

```text
apps/desktop/src/main/
  database.ts                         # 既存互換Facade
  modules/
    assets/
      asset-repository.ts             # assets／projectsのSQLiteアクセス
      asset-file-service.ts           # 画像検査、copy、trash、data URL
    backup/
      backup-manifest.ts              # manifest型、互換検証
      backup-operation.ts             # 進捗・cancel契約
      backup-writer.ts                # ZIP逐次書き込み
      backup-reader.ts                # ZIP検証・逐次展開
      restore-service.ts              # stagingとcommit失敗時cleanup
```

## Asset境界

- `AssetRepository`はSQLite文だけを保持する。
- `AssetFileService`はSQLiteを参照せず、Project配下のファイルだけを扱う。
- `MangaiDatabase`は入力をZodで検証し、RepositoryとFile Serviceを跨ぐtransactionを管理する。
- import時にファイルcopy後のDB transactionが失敗した場合、copy済みファイルを削除する。
- delete時は整合性を確認してProject内trashへ移動し、DB transaction失敗時は元の場所へ戻す。
- `importAssets`、`saveAssetLibraryMetadata`、`deleteAsset`、`assetData`、`projectCover`の公開契約は変更しない。

## Backup／Restore境界

- `backup-manifest.ts`はversion 1／2の形式と参照整合性を検証する。
- `BackupWriter`はAssetを一件ずつSHA-256検証し、`yazl`で一時ファイルへstream出力してから正式名へrenameする。
- `BackupReader`はentry数、展開後容量、圧縮率、path traversal、重複entry、Asset byte数とSHA-256を検証し、一時Projectへ一件ずつ展開する。
- `RestoreService`は読取り済みstagingとDB commitの境界を管理し、commit失敗時にstagingを必ず削除する。
- `MangaiDatabase`は既存IDのremapとSQLite transactionを担当するcommit callbackを提供する。

## 互換性

- SQLite migrationは追加しない。
- `.mangai-backup` format versionは変更しない。
- 既存version 1／2バックアップを復元できる。
- Electron IPC、preload API、renderer APIは変更しない。
- Backup／Restoreの進捗phaseとAbortSignal契約を維持する。

## 検証

- Asset file serviceのProject外path拒否
- Restore commit失敗時のstaging cleanup
- Asset import／library metadata／delete／Undo／Redo
- version 1／2 Backup／Restore
- streaming cancel、ZIP bomb、破損Asset拒否
- automatic backup、DB recovery

## ロールバック

この変更にはDB migrationがないため、PRのrevertだけで旧Facade内実装へ戻せる。生成済みバックアップと既存Projectデータの変換は不要。

## 残る分割

復元時のID remapと多数のSQLite insertはまだFacade内のcommit callbackに残る。Project／Canvas Repository分離後に専用Restore Repositoryへ移し、最終的に`database.ts`を500行以下へ縮小する。
