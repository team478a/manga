# MANGAI 実装記録・引き継ぎ資料

最終更新: 2026-07-13

- 漫画Canvasの30オブジェクト性能を製品版で確認し、再現可能なDB性能スモークテストを追加
  対象ブランチ: `master`
  実装基準コミット: `f813780`

この文書は、MANGAI Hubの保全からMANGAI Desktop、自動更新基盤までの実装経緯をまとめた引き継ぎ資料です。最新の機能一覧と今後の優先順位は [`PROJECT_STATUS_AND_ROADMAP.md`](PROJECT_STATUS_AND_ROADMAP.md) を参照してください。

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
| `df75731` | Creator Chat、Ollama、ComfyUI、生成ジョブを追加               |
| `f544ba8` | ComfyUIワークフロー管理を強化                                 |
| `6a9be41` | Chat対象切り替えとAIモデルキャッシュを追加                    |
| `298fe98` | プロンプトテンプレート複製・編集を追加                        |
| `656ee6a` | 画像生成進捗表示を追加                                        |
| `fee995a` | 永続Undo/Redoと操作履歴を追加                                 |
| `7eeef1b` | Project保存先選択を追加                                       |
| `b41e477` | Windows NSISインストーラーを追加                              |
| `553a549` | ブランドアイコンと署名ワークフローを追加                      |
| `f813780` | 自動更新とGitHub Releases配布基盤を追加                       |

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

| テーブル            | 用途                                                 |
| ------------------- | ---------------------------------------------------- |
| `projects`          | 作品設定、保存先、代表素材、作成・更新・最終表示日時 |
| `episodes`          | Projectに属するEpisodeと表示順                       |
| `pages`             | Episodeに属するPage、寸法、画像、プロンプト、メモ    |
| `panels`            | 将来のコマ編集用座標・生成情報                       |
| `assets`            | 相対パス、MIME、寸法、容量、SHA-256                  |
| `export_history`    | 書き出し先、生成ファイル、警告、日時                 |
| `operation_history` | Project編集の変更前後、取消状態、操作日時            |

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

Desktop統合テストは16件すべて成功しています。AIテストにはOllama、ComfyUI、Creator Chat、ジョブ、キャンセル、タイムアウト、素材登録、ワークフロー管理を含みます。編集履歴テストには永続化、複数回Undo/Redo、履歴分岐の破棄を含み、保存先テストでは選択フォルダーの作成と永続化を確認しています。

## 11. 当時の未実装・既知課題

以下はDesktop基盤実装時点の記録です。Panel編集、WebP合成、Projectバックアップ・復元は後続セクションで実装済みです。

- Panel編集、高度なコマ割り
- WebPのPDF変換
- カスタム保存先が別ドライブの場合の安全なゴミ箱移動
- 信頼された証明書によるWindows実署名
- Git remote設定と初回公開リリース
- 自動更新の実配布先E2E
- Projectバックアップ・復元

## 12. Creator Chat・ローカルAI基盤

Ollama、ComfyUI、モックプロバイダー、Creator Chat、生成ジョブ、プロンプトテンプレート、生成画像の素材登録を追加しました。Creator Chat内のProject・Episode・Page切替、Ollamaモデル一覧のSQLiteキャッシュ・オフライン復元、初期テンプレートの複製とカスタムテンプレート編集、画像生成の段階別進捗表示にも対応しています。設定・利用方法は [`desktop/AI_CREATOR.md`](desktop/AI_CREATOR.md)、完了条件は [`desktop/AI_IMPLEMENTATION_STATUS.md`](desktop/AI_IMPLEMENTATION_STATUS.md) を参照してください。

## 13. 推奨する次工程

1. 実環境のOllama・ComfyUIによるE2E確認
2. 信頼された証明書によるWindows実署名
3. Git remote設定と初回署名リリース
4. export-coreのWebP変換対応

## 14. Undo / Redo・操作履歴

Project編集の変更前後をSQLiteへ永続化し、ツールバー操作、キーボードショートカット、直近50件の履歴表示に対応しました。対象範囲と制限は [`desktop/UNDO_REDO.md`](desktop/UNDO_REDO.md) を参照してください。

## 15. Project保存先選択

新規Project作成画面からOSネイティブのフォルダー選択ダイアログを開き、Projectルートを指定できるようにしました。キャンセル時は現在値を保持し、「既定に戻す」で `{Documents}/MANGAI/projects/{projectId}` へ戻せます。

## 16. Windowsインストーラー

Electron BuilderとNSISによるWindows x64インストーラー生成を追加しました。`better-sqlite3`のABI再構築とASAR外展開を設定し、Electron 39.8.5でDesktop統合テスト16件と依存関係監査0件を確認しています。生成方法と配布前課題は [`desktop/WINDOWS_INSTALLER.md`](desktop/WINDOWS_INSTALLER.md) を参照してください。

## 17. ブランドアイコン・コード署名準備

漫画原稿と「M」を組み合わせたMANGAI DesktopアイコンをSVG、PNG、Windows ICOで追加しました。署名版専用コマンドは環境変数から証明書を受け取り、証明書なしでは停止し、`forceCodeSigning`で未署名成果物を拒否します。信頼された証明書自体の取得と実署名は外部発行が必要なため未完了です。

## 18. 自動更新・公開配布基盤

`electron-updater`によるHTTPS更新確認、手動ダウンロード、進捗表示、再起動適用を追加しました。更新用ビルドは配布URLを安全に埋め込み、`latest.yml`、NSIS EXE、blockmapを生成します。GitHub Actionsはタグ駆動の署名済みDraft Releaseを作成できますが、Git remoteと証明書Secretsが未設定のため実公開は未実施です。詳細は [`desktop/AUTO_UPDATE.md`](desktop/AUTO_UPDATE.md) を参照してください。

## 19. 漫画編集Canvas MVP

`konva` / `react-konva`と`packages/canvas-core`を追加し、既定・テンプレート・ドラッグ式の矩形コマ、100pxグリッドとスナップ切替、素材クリッピング、Canvas内画像編集モード、3種類の吹き出し、縦横テキスト、D&D対応統合レイヤー、6テンプレート、複数選択、Canvas Undo/Redoを実装しました。SQLiteはマイグレーション前バックアップ、schema version、Balloon・Text Object、親基準のText相対座標、Canvasスナップショットv2へ拡張しています。

Sharpを使う共通PageレンダラーでJPG・PNG・WebPをPage原寸へ合成し、DPI準拠PDFと連番PNG ZIP、進捗、キャンセル、ページ別エラーへ対応しました。Desktop 20件、canvas-core 16件、Hub回帰、Windows x64 NSIS生成に成功しています。

パッケージ版受け入れでsandboxed preloadのES Modules生成による黒画面を検出し、preloadだけCommonJSとして生成・梱包するよう修正しました。修正版で新規Project、Page、4コマ、吹き出し、縦書き、Undo/Redo、再起動復元を確認しています。詳細と残項目は [`desktop/MANGA_EDITOR.md`](desktop/MANGA_EDITOR.md) と [`desktop/MANGA_EDITOR_IMPLEMENTATION_STATUS.md`](desktop/MANGA_EDITOR_IMPLEMENTATION_STATUS.md) を参照してください。

## 20. Canvas手動受け入れ・WebP合成修正

2026-07-13〜14にパッケージ版で4つの受け入れシナリオを完走しました。4素材・4コマ・吹き出し・縦横テキスト・レイヤー順、複数回Undo/Redoと再起動復元、旧形式相当Pageの未編集出力、JPG/PNG/WebP混在PDF・ZIPを確認しています。旧DBそのものの移行は、マイグレーション前バックアップを含む自動テストで補完しました。

混在素材の目視・画素検査で、SVG内のWebP data URIがSharp/librsvgで描画されず、出力から欠落する問題を検出しました。ページで使用するWebPだけを合成前にPNGへ正規化し、WebPページの中央画素を検証する回帰テストを追加しました。Desktop統合テスト20/20、canvas-core 16/16、TypeScript、ESLint、本番ビルド、Windows x64パッケージ生成に成功し、修正版パッケージの出力でも全4色を確認しています。

## 21. Projectバックアップ・復元

Project設定、Episode、Page、Canvasオブジェクト、表紙、素材本体をバージョン付き`.mangai-backup`へ保存し、新しいIDと保存フォルダーで別Projectとして復元する機能を追加しました。素材サイズ・SHA-256、参照整合性、ファイル形式、展開サイズを検証し、失敗時は途中データを削除します。ホームと編集画面からバックアップでき、ホームから復元できます。

Project設定、素材、画像入りコマ、吹き出し、親子テキスト、表紙の復元と、改ざん素材の拒否を統合テストへ追加し、Desktop統合テスト21/21に成功しました。Undo/Redo、Creator Chat、AI生成ジョブの履歴は現行バックアップの対象外です。詳細は [`desktop/PROJECT_BACKUP.md`](desktop/PROJECT_BACKUP.md) を参照してください。

## 22. Canvas狭幅レイアウト

外側の素材パネル、Project・Page情報パネル、Canvas内レイヤー／プロパティを独立して開閉できるようにしました。開閉状態は端末へ保存し、狭いウィンドウの初回表示ではCanvas領域を優先します。ツールバーは折り返し可能な高さへ変更し、ズーム操作は固定座標ではなくCanvas内のsticky配置へ移しました。

## 23. AI接続一括診断

AI設定へOllama・ComfyUIの一括診断を追加しました。現在の設定を保存したうえで、HTTP到達性と応答時間、Ollamaモデル一覧・選択モデル・キャッシュ状態、ComfyUIワークフローの登録・既定設定・全マッピングを確認します。診断は生成ジョブを開始せず、各結果を成功・要確認・失敗に分けて表示します。

## 24. Project自動バックアップ

起動後と30分ごとの変更確認、Projectごと5世代保持、未変更スキップ、途中ファイルの除去を備えた自動バックアップを追加しました。ホームには状態、最終確認時刻、即時実行ボタンを表示し、失敗内容は`logs/desktop.log`へ記録します。手動バックアップも一時ファイルへ書き込んでから正式名へ移す方式に変更しました。

## 25. SQLite破損検出・自動リカバリー

起動時の`quick_check`とSQLite破損コード判定を追加しました。破損時はSQLite・WAL・SHMの原本を`backups/recovery/`へ隔離し、最新のProject自動バックアップから新しいDBを再構築します。自動バックアップがない場合はマイグレーション前SQLiteへフォールバックし、復旧結果と原本保管場所をホームとログへ表示します。
