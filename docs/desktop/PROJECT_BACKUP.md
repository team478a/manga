# Projectバックアップ・復元

更新日: 2026-07-14

## 概要

MANGAI Desktopは、Projectの編集データと素材画像を単一の`.mangai-backup`ファイルへ保存し、別Projectとして復元できます。元Projectは上書きしません。

バックアップ対象:

- Project設定、表紙
- Episode、Pageと並び順
- コマ、吹き出し、縦書き・横書きテキスト
- 素材画像の本体とメタ情報
- Page・コマ・表紙から素材への参照
- 吹き出しと子テキストの親子関係
- Undo/Redoのbefore・afterスナップショットと取消状態
- Projectに紐づくCreator Chatセッションとメッセージ
- AI生成ジョブ、生成出力、生成素材との参照

現在の対象外:

- AI接続設定とComfyUIワークフロー
- 端末全体で共有するプロンプトテンプレート

## 操作

ホームのProjectカード、または編集画面上部の「バックアップ」から保存します。既定の保存先は`{Documents}/MANGAI/backups/`です。

ホーム上部の「バックアップから復元」で`.mangai-backup`を選びます。復元Projectは元タイトルに`(復元)`を付け、新しいProject IDと保存フォルダーで作成します。

## 自動バックアップ

Desktopは起動15秒後と、その後30分ごとに全Projectの状態を確認します。Project内容のフィンガープリントが直近の自動バックアップと異なる場合だけバックアップを作成します。ホームの「自動バックアップ」から即時確認もできます。

```text
{Documents}/MANGAI/backups/automatic/{projectId}/
  auto-{timestamp}-{fingerprint}.mangai-backup
```

- Projectごとに新しい5世代を保持
- 未変更Projectは再保存しない
- 変更があっても前回作成から30分未満なら次回確認まで待機
- 書き込み中は`.partial`を使用し、完成後に正式ファイル名へ変更
- 前回中断で残った`.partial`は次回確認時に削除
- 失敗はホーム画面と`{Documents}/MANGAI/logs/desktop.log`へ記録
- 手動バックアップとマイグレーション前SQLiteバックアップは自動削除しない

## SQLite破損時の自動リカバリー

Desktop起動時に既存SQLiteへ`PRAGMA quick_check`を実行します。SQLiteの破損コードまたは整合性検査の失敗を検出した場合だけ、次の手順で復旧します。権限エラーや通常の起動エラーは破損として扱いません。

1. `mangai_local.sqlite`、WAL、SHMを日時付きフォルダーへ移動して原本を保全
2. Projectごとの最新自動バックアップがあれば、新しいDBへ順番に復元
3. 自動バックアップがなければ、最新の正常なマイグレーション前SQLiteを使用
4. どちらもない場合は空の新しいDBで起動
5. 復旧結果、失敗したバックアップ、原本の保管場所をホーム画面とログへ表示

```text
{Documents}/MANGAI/backups/recovery/{timestamp}/
  mangai_local.sqlite
  mangai_local.sqlite-wal
  mangai_local.sqlite-shm
```

自動Projectバックアップからの復旧ではProject IDと各データIDを新しく発行します。version 2バックアップの場合はUndo/Redo、Creator Chat、AI生成ジョブも新IDへ参照を変換して復旧します。破損原本は自動削除しないため、必要に応じて専門的なデータ復旧へ利用できます。

## ファイル形式と安全性

バックアップはバージョン付きZIPです。

```text
manifest.json
assets/{旧Asset ID}
```

- `manifest.json`に形式名`mangai.project-backup`とバージョン`2`を保存
- 旧バージョン`1`のバックアップも引き続き復元可能
- 元PCの絶対保存パスはバックアップへ記録しない
- 素材ごとにサイズとSHA-256を検証
- 復元時にProject、Episode、Page、Asset、CanvasオブジェクトIDを新規発行
- Page・コマ・表紙・親吹き出しの参照を新IDへ再マッピング
- 履歴内だけに残る削除済みオブジェクトにも新IDを予約し、Undo/Redoを維持
- 実行中・待機中だった生成ジョブは再送信せず`RESTORED_INTERRUPTED`として復元
- 破損、素材欠落、未対応形式、参照不整合、サイズ上限超過を拒否
- 復元処理が失敗した場合は、途中作成したDB行とProjectフォルダーを削除

## 自動テスト

Project設定、素材、Canvas、履歴を新IDで同じ内容へ復元できることを確認しています。復元後のRedo/Undo、Creator Chat本文、完了済み生成ジョブ、生成出力と素材リンク、旧version 1互換も検証しています。素材を改ざんしたバックアップは復元前に拒否し、空のProjectを残しません。自動バックアップの変更検知・世代管理と、破損DBの原本保全・再構築・SQLiteフォールバックも検証しています。
