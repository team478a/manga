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

Windowsインストーラーは `npm run desktop:dist:win` で生成します。詳細は [`WINDOWS_INSTALLER.md`](WINDOWS_INSTALLER.md) を参照してください。

更新メタデータ付きビルドとGitHub Releases運用は [`AUTO_UPDATE.md`](AUTO_UPDATE.md) を参照してください。

Projectバックアップの対象範囲と復元仕様は [`PROJECT_BACKUP.md`](PROJECT_BACKUP.md) を参照してください。

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

新規Project画面の「参照…」からWindowsのフォルダー選択ダイアログを開き、任意のProjectフォルダーを指定できます。「既定に戻す」を選ぶと、従来どおり `{Documents}/MANGAI/projects/{projectId}` を使用します。選択したフォルダーにはアプリが `assets/` などを作成するため、Project専用フォルダーを指定してください。別のProjectが使用中の保存先は指定できません。

## SQLiteスキーマ

- `projects`: 作品設定、保存先、代表素材、最近開いた日時
- `episodes`: プロジェクト内の話と順序
- `pages`: ページ番号、順序、寸法、配置素材、プロンプト、メモ
- `panels`: コマの座標、スタイル、画像変形・生成情報
- `balloons` / `text_objects`: 吹き出し、自由テキスト、親基準の相対テキスト座標
- `assets`: 相対パス、画像メタ情報、SHA-256
- `operation_history`: Undo/Redo用の変更前後スナップショット
- `ai_provider_settings` / `ai_models`: AI接続設定とモデルキャッシュ
- `chat_sessions` / `chat_messages`: Creator Chat履歴
- `generation_jobs` / `generation_outputs`: AI生成ジョブと出力
- `comfy_workflows`: ComfyUIワークフロー設定

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

- プロジェクト作成、一覧、再オープン、名前変更、複製、ゴミ箱移動、最近開いた順、代表画像表示
- Project編集データと素材を`.mangai-backup`へ保存し、新しいProjectとして復元
- 素材・情報・Canvasレイヤーパネルの開閉、状態保持、狭幅レイアウト
- 新規Projectの保存先フォルダー選択と既定保存先への復帰
- Episode作成・切り替え・名前変更・並び替え・削除
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
- 任意素材の代表画像設定
- Creator Chat、Ollama、ComfyUI、生成ジョブ、AI設定
- Ollamaモデル・ComfyUIワークフローを含むAI接続一括診断
- Project単位のUndo/Redo、キーボードショートカット、操作履歴
- ComfyUI画像生成とProject素材への自動登録

## 未実装

- 高度なAIエージェント
- 信頼された証明書による実署名と初回公開リリース
- Undo/Redo・Creator Chat・AI生成ジョブ履歴を含む完全バックアップ

完了条件ごとの確認結果は [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) を参照してください。

Creator Chat、Ollama、ComfyUIの設定と使い方は [`AI_CREATOR.md`](AI_CREATOR.md) を参照してください。
