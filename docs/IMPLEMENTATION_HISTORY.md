# MANGAI 実装記録・引き継ぎ資料

最終更新: 2026-07-12  
対象ブランチ: `master`  
現在のHEAD: `1726dd2`

この文書は、MANGAI Hubの保全からMANGAI Desktop基盤構築までの実装経緯と、現在の利用可能範囲をまとめた引き継ぎ資料です。

## 1. 現在の製品構成

MANGAIを次の2製品へ分離しています。

| 製品           | 配置                            | 責務                                                                      |
| -------------- | ------------------------------- | ------------------------------------------------------------------------- |
| MANGAI Hub     | リポジトリルートのNext.jsアプリ | 作品公開、検索、販売、Stripe決済、売上、グッズ申請、運営管理              |
| MANGAI Desktop | `apps/desktop`                  | ローカル漫画プロジェクト、Episode、Page、素材、プレビュー、販売用書き出し |

Hubの既存コードは移動せず維持し、Desktopと共通パッケージを追加する段階的な構成を採用しています。

## 2. Git保全履歴

| コミット  | 内容                                                          |
| --------- | ------------------------------------------------------------- |
| `baa1977` | 正常ビルドできるMANGAI Hub Marketplace MVPを初期保全          |
| `7a5a9e3` | Electron、React、Vite、SQLiteによるDesktop基盤を追加          |
| `26df166` | DesktopからPDF、画像ZIP、作品情報、販売文を書き出す機能を追加 |
| `1726dd2` | Episode切り替えとプロジェクト代表画像表示を追加               |

Hub保全タグ:

```text
marketplace-mvp-2026-07-12
```

## 3. ディレクトリ構成

```text
apps/
  desktop/
    src/main/       Electron main、SQLite、ファイル操作、IPC
    src/preload/    contextBridge API
    src/renderer/   React UI
    tests/          Electronランタイム統合テスト

packages/
  shared/           Zodスキーマ、IPC入力検証
  project-core/     Project/Episode/Page/Panel/Asset型
  export-core/      PDF、ZIP、JSON、販売文生成

src/                MANGAI Hub（Next.js）
supabase/           Hub用PostgreSQL・RLS・Storageスキーマ
docs/
  architecture/     全体構成
  desktop/          Desktop仕様・完了条件
  hub/              Hub仕様
```

## 4. MANGAI Hubの実装済み機能

- Supabase Authによる登録、ログイン、ログアウト
- クリエイターのプロフィール編集
- 作品登録、画像アップロード、編集、公開
- 公開作品のキーワード検索とタグ絞り込み
- デジタル商品の登録、編集、非公開Storage保存
- Stripe Checkout Session作成
- Stripe Webhook署名検証
- 決済完了、失敗、キャンセル、全額返金の注文状態反映
- 決済確認後の5分間署名付きダウンロードURL発行
- クリエイター売上画面
- グッズ販売申請と管理者対応
- ユーザー、作品、商品、注文、申請の管理画面
- RLSによる公開範囲・所有者・管理者制御

旧Web版ローカル販売パッケージ処理はコードを保全していますが、公開WebからPC内ファイルへアクセスさせないため既定で無効です。

```env
MANGAI_ENABLE_LEGACY_LOCAL_TOOLS=false
```

詳細: [`IMPLEMENTED_FEATURES.md`](IMPLEMENTED_FEATURES.md)

## 5. MANGAI Desktopの実装済み機能

### プロジェクト

- 新規作成、一覧、再オープン
- タイトル、サブタイトル、説明、ジャンル、対象年齢の登録
- 右開き・左開き、ページ寸法、DPIの設定
- 名前変更、複製、削除前確認
- 削除データの `.trash` 移動
- 最近開いた順の表示
- 最初に取り込んだ素材を代表画像として表示

### Episode・Page

- Episode作成と切り替え
- Page追加、複製、削除
- Pageの上下並べ替えと番号再計算
- 選択EpisodeごとのPage管理
- 全素材から連続Page作成
- プロンプト、ネガティブプロンプト、メモの自動保存

### 素材

- JPG、JPEG、PNG、WebPの取り込み
- 複数選択とドラッグ＆ドロップ
- 元ファイルを変更しないプロジェクトフォルダへのコピー
- SHA-256による同一プロジェクト内の重複防止
- ファイル名、画像寸法、容量、サムネイルの表示
- Pageへの追加、削除前確認、`.trash` 移動

### ワークスペース

- 左: Project、Episode、Page、素材
- 中央: Pageプレビュー、ズーム、縮小、表示リセット
- 右: Project情報、Page情報、素材情報、プロンプト、メモ
- 上部: 保存状態、インポート、書き出し、将来用Undo/Redo・設定位置

### 書き出し

Desktopの「書き出し」から以下を生成します。

```text
本編PDF.pdf
本編画像ZIP.zip
作品情報.json
販売用説明文.txt
SNS告知文.txt
```

- JPG・PNGはPDFとZIPへ収録
- WebPはZIPへ収録し、PDF対象外であることを警告
- テンプレートベースの販売文案を生成
- `export_history` へ出力先、ファイル一覧、警告、日時を保存

## 6. SQLiteデータ構造

保存先:

```text
{Documents}/MANGAI/mangai_local.sqlite
```

| テーブル         | 用途                                                 |
| ---------------- | ---------------------------------------------------- |
| `projects`       | 作品設定、保存先、代表素材、作成・更新・最終表示日時 |
| `episodes`       | Projectに属するEpisodeと表示順                       |
| `pages`          | Episodeに属するPage、寸法、画像、プロンプト、メモ    |
| `panels`         | 将来のコマ編集用座標・生成情報                       |
| `assets`         | 相対パス、MIME、寸法、容量、SHA-256                  |
| `export_history` | 書き出し先、生成ファイル、警告、日時                 |
| `operation_history` | Project編集の変更前後、取消状態、操作日時 |

設定:

- Foreign Key有効
- WALモード
- パラメータ化クエリ
- Project削除時の関連レコードcascade
- 素材本体はSQLiteへ保存しない

## 7. ローカル保存先

Electron main processで `app.getPath("documents")` を取得します。ユーザー名やドライブは固定していません。

```text
{Documents}/MANGAI/
  mangai_local.sqlite
  projects/
    {projectId}/
      assets/
      .trash/
  assets/
  exports/
  logs/
  .trash/
```

## 8. セキュリティ設計

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- rendererからNode.js APIを直接使用しない
- contextBridgeで限定したAPIのみ公開
- IPC入力をZodで検証
- プロジェクトルート外へのパストラバーサルを拒否
- Supabase Service Role KeyとStripe Secret KeyをDesktopへ同梱しない
- ファイル削除前に確認
- 即時消去ではなく `.trash` へ移動
- 公開Web側ではローカルファイル操作を既定無効化

## 9. 起動・検証コマンド

### Desktop

```powershell
cd apps/desktop
npm install
npm run dev
```

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

`better-sqlite3` はElectronのNode ABI向けにpostinstallで再ビルドします。再ビルド環境によってはPythonとC++ Build Toolsが必要です。

### Hub

```powershell
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
```

## 10. 最終検証記録

2026-07-12時点:

| 検証                           | 結果 |
| ------------------------------ | ---- |
| Hub TypeScript                 | 成功 |
| Hub ESLint                     | 成功 |
| Hub Next.js本番ビルド          | 成功 |
| Desktop TypeScript             | 成功 |
| Desktop ESLint                 | 成功 |
| Electron mainビルド            | 成功 |
| Vite rendererビルド            | 成功 |
| Windows Electron起動           | 成功 |
| SQLite永続化テスト             | 成功 |
| Page並び替えテスト             | 成功 |
| 画像付きPDF・ZIP書き出しテスト | 成功 |

Desktop統合テストは15件すべて成功しています。AIテストにはOllama、ComfyUI、Creator Chat、ジョブ、キャンセル、タイムアウト、素材登録、ワークフロー管理を含みます。編集履歴テストには永続化、複数回Undo/Redo、履歴分岐の破棄を含みます。

## 11. 現在の未実装・既知課題

- Undo/Redo
- Panel編集、高度なコマ割り
- WebPのPDF変換
- カスタム保存先が別ドライブの場合の安全なゴミ箱移動
- Desktopインストーラー
- Windowsコード署名
- 自動更新
- npm監査で報告されるhigh severity依存関係の精査

## 12. Creator Chat・ローカルAI基盤

Ollama、ComfyUI、モックプロバイダー、Creator Chat、生成ジョブ、プロンプトテンプレート、生成画像の素材登録を追加しました。Creator Chat内のProject・Episode・Page切替、Ollamaモデル一覧のSQLiteキャッシュ・オフライン復元、初期テンプレートの複製とカスタムテンプレート編集、画像生成の段階別進捗表示にも対応しています。設定・利用方法は [`desktop/AI_CREATOR.md`](desktop/AI_CREATOR.md)、完了条件は [`desktop/AI_IMPLEMENTATION_STATUS.md`](desktop/AI_IMPLEMENTATION_STATUS.md) を参照してください。

## 13. 推奨する次工程

1. 実環境のOllama・ComfyUIによるE2E確認
2. 保存先選択ダイアログ
3. Electron Builder等によるWindowsインストーラー
4. export-coreのWebP変換対応
5. 依存関係監査とアップデート方針決定

## 14. Undo / Redo・操作履歴

Project編集の変更前後をSQLiteへ永続化し、ツールバー操作、キーボードショートカット、直近50件の履歴表示に対応しました。対象範囲と制限は [`desktop/UNDO_REDO.md`](desktop/UNDO_REDO.md) を参照してください。
