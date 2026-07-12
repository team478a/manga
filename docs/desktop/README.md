# MANGAI Desktop

## 起動

```powershell
cd apps/desktop
npm install
npm run dev
```

本番ビルドと起動:

```powershell
npm run build
npm start
```

## 保存先

Electron main processで `app.getPath("documents")` を取得し、次を作成します。

```text
{Documents}/MANGAI/
  mangai_local.sqlite
  projects/
  assets/
  exports/
  logs/
  .trash/
```

素材は `{project}/assets/` へコピーし、SQLiteには相対パス、SHA-256、画像寸法、MIME、サイズを保存します。削除対象は即時消去せず `.trash` へ移動します。

## SQLiteスキーマ

- `projects`: 作品設定、保存先、代表素材、最近開いた日時
- `episodes`: プロジェクト内の話と順序
- `pages`: ページ番号、順序、寸法、配置素材、プロンプト、メモ
- `panels`: 将来のコマ編集向け座標・生成情報
- `assets`: 相対パス、画像メタ情報、SHA-256

外部キー、cascade、WALを有効化し、すべての値はパラメータ化クエリで扱います。

## セキュリティ

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- rendererにはcontextBridgeで必要最小限のAPIだけを公開
- 全IPC入力をZodで検証
- 相対パスをプロジェクトルート内へ解決してトラバーサルを拒否
- Supabase・Stripeの秘密鍵はDesktopへ含めない
- 削除前にrendererで確認し、mainではゴミ箱へ移動

## 実装済み

- プロジェクト作成、一覧、再オープン、名前変更、複製、ゴミ箱移動、最近開いた順
- Episode作成
- Page追加、複製、削除、上下並べ替え、番号正規化
- JPG/JPEG/PNG/WebPの複数選択・ドラッグ＆ドロップ
- SHA-256による重複防止、原本を壊さないコピー
- 素材一覧、ファイル名、寸法、サイズ、削除、ページ追加
- 全素材から連続ページ作成
- ページプレビュー、ズーム、リセット
- プロンプト、ネガティブプロンプト、メモの自動保存
- SQLite永続化
- Desktopの「書き出し」からPDF、画像ZIP、作品情報JSON、販売文、SNS告知文を生成
- `export_history` への書き出し履歴保存

## 未実装

- Undo/Redo（ボタンは将来位置のみ）
- 表紙の選択UIとプロジェクト一覧サムネイル
- Episodeの切替・並べ替え・削除
- Panel編集
- AI画像生成
- インストーラー作成、コード署名、自動更新

完了条件ごとの確認結果は [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) を参照してください。
