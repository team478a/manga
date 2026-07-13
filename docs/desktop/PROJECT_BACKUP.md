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

現在の対象外:

- Undo/Redo履歴
- Creator Chatの会話履歴
- AI生成ジョブ履歴
- AI接続設定とComfyUIワークフロー

## 操作

ホームのProjectカード、または編集画面上部の「バックアップ」から保存します。既定の保存先は`{Documents}/MANGAI/backups/`です。

ホーム上部の「バックアップから復元」で`.mangai-backup`を選びます。復元Projectは元タイトルに`(復元)`を付け、新しいProject IDと保存フォルダーで作成します。

## ファイル形式と安全性

バックアップはバージョン付きZIPです。

```text
manifest.json
assets/{旧Asset ID}
```

- `manifest.json`に形式名`mangai.project-backup`とバージョン`1`を保存
- 元PCの絶対保存パスはバックアップへ記録しない
- 素材ごとにサイズとSHA-256を検証
- 復元時にProject、Episode、Page、Asset、CanvasオブジェクトIDを新規発行
- Page・コマ・表紙・親吹き出しの参照を新IDへ再マッピング
- 破損、素材欠落、未対応形式、参照不整合、サイズ上限超過を拒否
- 復元処理が失敗した場合は、途中作成したDB行とProjectフォルダーを削除

## 自動テスト

Project設定、PNG素材、表紙、Page、画像入りコマ、吹き出し、親子テキストをバックアップし、新IDで同じ内容へ復元できることを確認しています。素材を改ざんしたバックアップは復元前に拒否し、空のProjectを残さないことも確認しています。
