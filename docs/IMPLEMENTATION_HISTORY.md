# MANGAI 実装記録・引き継ぎ資料

最終更新: 2026-07-16

対象ブランチ: `feature/manga-canvas-mvp`

実装基準コミット: `5ddcc3b`

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

## 26. 履歴込み完全バックアップ

Projectバックアップ形式をversion 2へ拡張し、Undo/Redoスナップショット、Creator Chat、AI生成ジョブ、生成出力と素材参照を保存・復元できるようにしました。履歴内だけに残る削除済みオブジェクトを含めてIDを再割り当てし、復元後のRedo/Undoを維持します。旧version 1も引き続き復元できます。

## 27. Canvasツールバーの機能別メニュー化

Canvas上部の常設ボタンを「追加」「レイアウト」「表示」の3メニューへ整理しました。選択対象に応じた削除、画像編集、素材配置は常時確認できる文脈操作として残しています。ネイティブの開閉操作に加え、上下矢印、Home、End、Escape、領域外クリック、フォーカス復帰へ対応し、ツールバーとショートカットのアクセシビリティ情報を追加しました。

## 28. 縦書き基本禁則・自動縦中横

縦書きの列境界で閉じ句読点・小書き文字などが行頭へ、開き括弧が行末へ配置されない基本禁則を追加しました。連続する半角数字は2桁単位で1文字分のセルへ横組みする自動縦中横に対応しています。Canvas表示とPDF・画像ZIPの書き出しは`canvas-core`の共通レイアウトを利用し、既存Text Objectにも保存変更なしで適用します。

## 29. 縦書きルビ

本文の`｜親文字《よみ》`を解析し、親文字を通常の縦書きレイアウトへ、読みを親文字の右側へ小さく配置する明示ルビへ対応しました。記法は既存のText Object本文へ保存されるため、DBマイグレーションなしでUndo/Redo、完全バックアップ、復元を利用できます。CanvasとPDF・画像ZIPの書き出しは共通のルビ座標を使い、不完全な記法は通常文字として保持します。

## 30. ルビ入力支援UI

縦書き本文の選択範囲を親文字として保持し、読みを入力してルビ記法を挿入できる編集UIを追加しました。記法内へカーソルを置いた解除、親文字・読みの文字数上限、改行・ルビ記号の検証、画面内エラー、操作後のフォーカスと選択復帰に対応しています。変更は既存のデバウンス保存を通り、通常のText編集としてUndo/Redoへ記録されます。

## 31. 横書きルビ・共通行レイアウト

明示ルビ記法を横書きでも解析し、親文字の上側へ読みを表示する機能を追加しました。日本語を全角、ASCIIを半角として幅を見積もる共通行レイアウトで、CanvasとPDF・画像ZIPの折り返し・揃え・ルビ位置を統一しています。ルビの親文字は可能な限り行をまたがず次行へ送り、明示的な空行も保持します。

## 32. 斜めコマ

Panelへ矩形・右上がり・右下がりの形状と0〜45%の傾斜率を追加しました。Canvasは同じ形状を背景、選択枠、画像クリップへ使い、PDF・画像ZIPはSVG pathとclipPathで同じ形状を書き出します。既存DBは移行前バックアップ後に矩形・12%で補完し、Undo/Redo、完全バックアップ、復元でも形状と傾斜率を維持します。

## 33. 曲線コマ

Panel形状へ左辺・右辺が内側へ湾曲する曲線コマを追加しました。変形率0〜45%で曲線の深さを調整でき、CanvasとPDF・画像ZIPは`canvas-core`の共通ベジェパスを使って背景、枠線、画像クリップを一致させます。既存のshape・slant保存領域を利用するためDB移行は不要で、Undo/Redo、完全バックアップ、復元でも形状を維持します。

## 34. 1話単位テンプレート

選択中のEpisode末尾へ、短編8ページ、標準16ページ、4コマ8ページの話構成を一括追加する機能を追加しました。各ページには既存のページテンプレートからコマを自動配置し、確認画面でページ数と用途を表示します。一括追加はSQLiteトランザクション内で処理し、全ページ・全コマを1回のUndo/Redoで戻す・再適用することができます。

## 35. MANGAI販売パッケージ v1

Desktop書き出しへ`MANGAI販売パッケージ.zip`を追加しました。形式名`mangai.sales-package`、version 1のmanifestに、作品情報、商品PDF、連番画像ZIP、表紙、先頭3ページのサンプル、販売文、SNS文を役割付きで収録します。全ファイルのバイト数とSHA-256を記録し、共通`export-core`で形式、パス、role、重複、実ファイル一致を検証します。仕様は[`desktop/SALES_PACKAGE_SPEC.md`](desktop/SALES_PACKAGE_SPEC.md)へ記録しました。

## 36. Hub販売パッケージ確認画面

認証済みHubダッシュボードへ`/dashboard/import-package`を追加しました。販売パッケージZIPをサーバーへ送信せずブラウザ内で解析し、形式・version・role・パス・ファイル数・展開前後の上限・全ファイルのバイト数とSHA-256を検証します。検証後は作品情報、表紙、先頭3ページのサンプル、収録ファイル一覧を表示します。危険な相対パス、manifest外ファイル、不足ファイル、サイズ・ハッシュ不一致を拒否します。

## 37. Hub下書きインポート確定処理

検証済み販売パッケージから、非公開の`works`下書きと停止中の`digital_products`を作成するServer Actionを追加しました。商品は本編PDFまたは連番画像ZIPを選択でき、価格・作品名・説明・商品名を確定前に編集できます。サーバー側でも認証、manifest、role、容量、SHA-256、PDF・ZIP・画像シグネチャを再検証し、表紙・最大3枚のサンプル・商品ファイルをSupabase Storageへ保存します。途中失敗時はDBとアップロード済みファイルをロールバックします。`works.sample_image_urls`と所有者限定のStorage削除policyをスキーマへ追加し、公開作品詳細でサンプルを表示します。

## 38. DesktopからHub公開状況を確認

販売パッケージの`sourceProjectId`をHub作品へ記録し、公開済み作品と販売中商品数だけを返す読み取り専用APIを追加しました。Desktopの「Hub連携」画面ではHub URLをローカル保存し、作品名、最終更新、販売状態、公開URLを確認できます。通信先はHTTPSに限定し、開発用localhostだけHTTPを許可します。非公開下書きは匿名APIへ露出せず、Supabase Service Role Key、Stripe Secret Key、Hubログイン情報をDesktopへ保存しません。URL制約、公開応答、非公開応答を含むDesktop統合テストは29/29成功しています。

## 39. Hub端末コード認証

Hubへログインした本人が8桁・15分のコードを承認するDesktop端末認証を追加しました。256bitトークンはHub DBへSHA-256ハッシュだけを保存し、DesktopではElectron `safeStorage`によりOS暗号化してmain processだけで使用します。90日間の`works:read` scopeに限定し、本人の非公開下書き、公開状態、販売中・停止中商品数を確認できます。Hubの端末管理画面とDesktopの両方から失効できます。端末認証開始、承認確認、解除を含むDesktop統合テストは30/30成功しています。

## 40. 端末認証rate limitと期限切れ清掃

匿名の端末認証開始APIへ、15分あたりIP単位10回・全体300回のDB rate limitを追加しました。接続元IPはサーバー秘密値によるHMACだけを保存し、PostgreSQL行ロックで複数インスタンス間でも原子的に判定します。接続元不明のローカル環境は50回まで許可します。未承認・期限切れ認証は1日、失効・トークン期限切れは30日の保持期間後に自動清掃します。DesktopはHTTP 429の再試行案内を表示し、統合テストは31/31成功しています。

## 41. Desktop構造化ログ・クラッシュ同意

Desktopへ端末内JSONL構造化ログ、5MB・過去3世代のローテーション、明示同意後だけ保存する詳細クラッシュレポートを追加しました。mainの未捕捉例外・Promise rejection、renderer異常終了・応答停止、child process異常を捕捉します。秘密field、Bearer、API key、JWT、URL token、home directoryを保存前に除外し、Project本文・Chat本文・prompt・画像は診断イベントへ渡しません。詳細レポートは最大20件で、設定画面から同意変更、保存先表示、全削除ができます。外部送信は常に無効です。除外・ローテーション・同意前後・削除を含む統合テストは33/33成功しています。

## 42. Hub DBマイグレーション往復基盤

販売パッケージ取り込み、Desktop端末認証、認証rate limitを3つの順序付きforward migrationへ分割し、それぞれに逆順適用できるrollbackを追加しました。データ損失につながるrollbackは対象データや有効な端末認証が存在すると停止します。manifest・対応ファイル・トランザクション境界・破壊的forward SQLを検査するNodeスクリプトも追加しました。

GitHub ActionsではPostgreSQL 16上で旧スキーマからforward適用、機能assertion、逆順rollback、再適用を行い、現在の`schema.sql`を2回適用する冪等性も検証します。ローカル環境にはPostgreSQL実行環境がないため、静的検査のみ成功を確認し、実DB往復はCIと今後のSupabase stagingで確認します。運用手順は[`hub/DATABASE_MIGRATIONS.md`](hub/DATABASE_MIGRATIONS.md)へ記録しました。

## 43. Supabase staging読み取り専用preflight

実Supabaseへ適用した後の状態を変更せずに検査する`db:staging:preflight`を追加しました。`MANGAI_DB_ENV=staging`の明示を必須にし、標準のPostgreSQL接続環境変数を`psql`へ安全に引き渡します。接続情報やパスワードは出力しません。

検査SQLは読み取り専用トランザクション内で、PostgreSQL version、販売パッケージ列、Desktop端末認証表・関数、RLS、service role限定権限、Storage bucket・削除policy、無効index、承認済み端末データの必須値を確認します。接続情報と`psql`が未設定のため、実stagingでの実行は未完了です。

## 44. Stable / Beta更新チャンネル

Desktopの更新操作へStable・Beta選択を追加し、端末内の`settings/update.json`へ永続化しました。Stableは正式版、Betaは先行版を取得し、更新確認・ダウンロード・適用待ちの途中では切替を拒否します。不正な設定ファイルはStableへ安全にフォールバックします。

GitHub公開ビルドはowner/repositoryを安全に埋め込み、`electron-updater`のGitHub providerで正式ReleaseとPrereleaseを分離します。generic配布にも`latest.yml`・`beta.yml`を使用できます。リリースworkflowはtagとpackage versionの一致、Stableの通常semver、Betaの`-beta.N`形式を検証します。設定永続化、入力拒否、HTTPS・GitHub配布元解決を含むDesktop統合テストは35/35成功しました。

## 45. Hub決済イベント状態遷移テスト

Stripe Webhookイベントを副作用のない状態遷移計画へ分離し、Checkout同期成功、非同期成功・失敗、Payment Intent失敗、全額返金、未対応イベントをNode標準テストで検証できるようにしました。`checkout.session.async_payment_failed`を新たに処理し、Payment Intentを文字列・展開済みobjectのどちらでも解決します。

失敗イベントは`pending`・`failed`注文だけを対象とし、遅延した失敗通知が`paid`・`refunded`を上書きしないようにしました。返金はWebhook順序が前後しても後続の決済成功で戻らない状態遷移です。使用されていなかった旧501 API `/api/stripe/checkout`を削除し、`/api/checkout/create-session`へ一本化しました。Hub専用CIを追加し、決済イベントテスト5/5、TypeScript、ESLint、Next.js本番ビルドをPull Requestごとに検証します。

## 46. Checkout・キャンセル・ダウンロード認可

Checkout作成前にpending状態、注文・商品ID、購入者メール、出品者、商品販売状態、作品公開状態、整数金額を共通ポリシーで照合するようにしました。購入者メールは小文字へ正規化し、本番の成功・キャンセルURLは`NEXT_PUBLIC_SITE_URL`で指定したHTTPS originだけを使用します。Host由来URLへの意図しないリダイレクトを防ぐため、本番でURL未設定の場合はCheckout作成を停止します。

キャンセルURLには注文IDをサーバー秘密値でHMAC化したトークンを付け、欠落・改ざん・別注文への流用時はDBを更新しません。購入後ダウンロードはStripe Sessionの支払状態に加え、metadataの注文IDと商品IDをDB照会へ再適用します。メール・注文照合、HTTPS制約、HMAC改ざん、未払い・metadata不足を含むHubテスト10/10、TypeScript、ESLint、Next.js本番ビルドに成功しました。

## 47. Desktop UI/UX監査・デザイントークン

参照UI資料と現在のrenderer、preload、main IPCを照合し、Project、Episode、Page、Asset、Canvas、Properties、Layers、Creator Chat、Ollama、ComfyUI、Generation Jobs、Export、Settingsの監査表を作成しました。既存機能の再利用、見た目変更、再配置、統合、不足修正、未実装を分類し、SQLite、IPC、Canvasデータ、Undo / Redo、書き出し、配布基盤を変更しない境界を明記しました。

UI統合の第1段階として、Desktop CSSへダークテーマの背景、文字、境界線、アクセント、状態色、Canvas色、フォーカスリングを変数化して導入しました。ホーム、ワークスペース、Canvas周辺、Creator Chat、AI生成、Hub、設定を同じトークンへ統一し、Canvas Pageの白背景はアプリテーマから分離しています。保存状態とCreator Chat状態は共通`StatusBadge`で点・文言・色を併用して表示します。画面配置、Canvasロジック、IPC、SQLiteは変更していません。

## 48. Desktop App Shell統合

編集画面を一段固定の`AppHeader`、64pxの`GlobalNav`、`ProjectPanel`、中央Canvas、`InspectorPanel`、30pxの`StatusBar`へ分離しました。ヘッダーにはProject / Episode / Pageのパンくず、保存状態、左右パネル、Undo / Redo、インポート、主操作の書き出しを配置し、バックアップ、直近操作履歴、更新チャンネルは「その他」メニューへ集約しています。

左端ナビは漫画編集、Creator Chat、画像生成、Hub連携、設定の既存画面だけを表示し、専用画面へ移動した後もナビを維持します。下部ステータスには現在Page、Project保存先、Page寸法、DPI、ズーム、素材数を実データから表示します。Project / Episode / Page / Asset操作は`ProjectPanel`、Project / Page / Asset情報は`InspectorPanel`へ既存IPC接続のまま分離しました。Lucide Reactのアイコン、ツールチップ、選択状態、狭幅時のラベル省略を追加しています。

## 49. 左パネルの構成・素材統合

Projectパネルを「構成」と「素材」の2タブへ分離しました。構成タブにはProject、Episode、話テンプレート、Pageサムネイルと並び替えを集約し、素材タブには素材追加、ファイル名検索、PNG・JPEG・WebP形式フィルター、件数、サムネイル一覧を配置しています。Project表紙、Page、Panelで参照中の素材には「使用中」を表示し、CanvasへのD&Dと全素材の連続Page化は既存処理を維持します。

共通`Tabs`は選択状態と関連tabpanelをARIAで結び、クリックに加えて左右矢印、Home、Endで切り替えられます。最後に開いたタブは端末の`localStorage`へ保存し、両タブのDOMと個別スクロール領域を維持したまま表示を切り替えます。SQLite、IPC、Asset保存形式は変更していません。

## 50. 右Inspectorのプロパティ・レイヤー・AI統合

右Inspectorを「プロパティ」「レイヤー」「AI」の3タブへ分離しました。最後に開いたタブは端末へ保存し、左右矢印、Home、Endによるキーボード切り替えにも対応しています。プロパティにはCanvasの選択オブジェクト設定と既存のProject / Page / Asset情報を集約し、レイヤーには選択、表示、ロック、前面 / 背面移動、D&D並び替えを移設しました。Canvasの表示メニューから右パネルを開いてレイヤータブへ直接移動できます。

Canvas内部の選択・保存・画像編集・レイヤー並び替え処理は持ち上げず、React Portalで右パネルの表示領域へ接続しています。このためSQLite、IPC、Undo / Redo、Canvasデータ形式を変更せず、既存操作を再利用します。

Creator Chatは従来の専用画面に加え、Canvasを見ながら使える右パネル表示へ対応しました。現在のEpisode / Pageを追従し、履歴選択、テンプレート、Project情報参照、送信・停止、コピー、再生成、Pageメモ保存、AI設定への導線を維持しています。Desktop TypeScript、ESLint、統合テスト35/35、本番rendererビルド、Windows x64 unpackedパッケージ作成に成功しました。

## 51. 制作状態・AI接続・生成ジョブ・書き出し統合

制作画面の下部ステータスへOllamaとComfyUIの接続要約を追加しました。設定の有効・無効を読み取り、有効なProviderだけをローカル接続確認し、確認中、接続済み、無効、失敗を共通StatusBadgeで表示します。状態は60秒ごとに更新し、手動更新とAI設定画面への導線も備えています。

Project単位の生成ジョブを2秒間隔で更新し、待機中・実行中件数を下部へ表示します。制作画面上のDrawerでは直近8件の種類、Provider、状態、プロンプト、進捗、失敗内容を確認でき、実行中ジョブのキャンセルと既存AI生成画面への移動に対応しました。生成処理、Job保存、ComfyUI通信は既存IPCを再利用しています。

書き出し操作を確認・進捗・結果の一貫したダイアログへ変更しました。開始前にPDF、連番画像ZIP、MANGAI販売パッケージと対象Page数を確認でき、実行中はPage描画とパッケージ作成の進捗・キャンセルを表示します。完了後は保存先と警告を表示し、失敗・キャンセル時はProjectを変更せず閉じるか再実行できます。OS通知の`alert`は廃止し、既存書き出しIPCと進捗イベントを維持しています。Desktop TypeScript、ESLint、統合テスト35/35、本番rendererビルド、Windows x64 unpackedパッケージ作成に成功しました。

## 52. Desktopレスポンシブ・キーボード・総合回帰

1366px以上では左Projectパネル、Canvas、右Inspectorの3カラムを維持し、1365px以下では左パネルとCanvasの幅を優先して右Inspectorを310pxのオーバーレイへ切り替えるようにしました。オーバーレイは背景クリックまたはEscapeで閉じられ、1280px幅では初期状態を閉じます。850px以下では保存先やAI接続詳細を段階的に省略します。1920px、約1440px、1280px幅の製品版で、ヘッダー、Canvas、左右パネル、下部ステータス、右オーバーレイを実画面確認しました。

左右パネルの開閉ボタンへ`aria-controls`と`aria-expanded`を追加しました。書き出しダイアログは表示時と進捗・完了・失敗への遷移時に操作可能要素へフォーカスし、Tab / Shift+Tabを内部で循環させ、実行中以外はEscapeで閉じて元の操作位置へ戻します。生成Drawerも開いた時に閉じる操作へフォーカスし、Escape終了後は下部ステータスのトリガーへ戻します。

DesktopはTypeScript、ESLint、統合テスト35/35、本番rendererビルド、Windows x64 NSISインストーラーとblockmap作成に成功しました。HubはTypeScript、ESLint、決済・ダウンロード認可テスト10/10、Next.js本番ビルドに成功しました。UI-1からUI-6までのDesktop UI統合計画は完了し、次は外部サービスを含む配布候補版受入れへ移行します。

## 53. 配布候補版preflight・受入れ基盤

Desktop、Hub、Supabase migrationの型検査、Lint、テスト、本番buildを順番に実行する`rc:validate`を追加しました。`rc:preflight`はHub / Supabase、Stripe、Desktop端末認証、staging DBの設定準備状況を確認し、環境変数の値、URL、パスワード、API keyを表示せず、設定済み・未設定・placeholderだけを報告します。外部設定不足も配布判定で失敗にする`rc:preflight:strict`も利用できます。

実サービスE2Eは自動検証と分離し、Ollama、ComfyUI、複数Page書き出し、販売パッケージ、Hub staging、Desktop端末認証、Stripeテスト決済、Windows成果物の受入れ手順と完了条件を[`desktop/RELEASE_CANDIDATE_ACCEPTANCE.md`](desktop/RELEASE_CANDIDATE_ACCEPTANCE.md)へ固定しました。ローカル品質ゲートの結果と外部サービス待ちを混同せず、未実施項目を明示してRC判定できる状態にしています。

2026-07-15に`rc:validate`を実行し、Desktop TypeScript、ESLint、統合テスト35/35、本番renderer build、Hub TypeScript、ESLint、テスト10/10、Next.js本番build、Supabase migration静的検証3件がすべて成功しました。外部接続設定は未投入のため通常preflightは`PENDING`、strict preflightは意図どおり終了コード1です。

## 54. 複数Page書き出しRC自動受入れ

3Page作品を実画像から書き出す既存統合テストを、単独実行できる`rc:export-acceptance`へ昇格しました。PDFのPage数・300 DPI換算寸法、連番PNGの順序と寸法、WebP素材の合成、空Pageの白背景に加え、販売パッケージ内のPDF / ZIPが外側の成果物とbyte単位で一致することを確認します。

販売パッケージの表紙、Project情報、先頭3Pageのsample、全ファイルのbyte数・SHA-256も検査します。書き出しをキャンセルした直後に再実行し、別の出力先へ完全な3Page PDFを生成できることまで受入れ条件へ追加しました。

2026-07-15に`rc:export-acceptance`を実行し、対象テスト1/1が成功しました。

## 55. 現行Windows製品版・9Page書き出し目視受入れ

現行コードからWindows x64 unpacked製品版を再作成し、受入れ用に複製したProjectへ短編8Page構成を追加して合計9Pageを書き出しました。製品版の書き出し確認ダイアログ、Page別進捗、パッケージング、完了画面、表紙未設定警告が同じダイアログ内で正常に遷移することを確認しました。

PDFは9Page・384×576ptで、連番画像ZIPは`001.png`〜`009.png`、販売パッケージv1はPage数9、sample 3件、表紙0件、manifest記載の全8ファイルについてbyte数とSHA-256が一致しました。ただし、この時点の受入れ用Projectは後述の複製不具合により作品素材とCanvas内容を失っていました。したがって、書き出し処理と空Page・コマ枠の確認には有効ですが、作品内容の目視受入れ完了という当初の判定は取り下げます。

## 56. Project完全複製・白紙PDF修正

ホーム画面のProject複製がProject設定、Episode、Page数だけをコピーし、素材ファイル、Page画像、コマ、吹き出し、テキスト、表紙を落としていた問題を修正しました。複製時は全素材のbyte数とSHA-256を確認し、新しいProject保存先へ別IDでコピーします。Episode、Page、コマ、吹き出し、テキストにも新IDを割り当て、Page素材、コマ素材、親吹き出し、表紙の参照を複製先IDへ張り替えます。途中失敗時は複製先DB行と保存フォルダをロールバックします。

回帰テストでは赤色Page素材、画像付きコマ、吹き出し、縦書きテキスト、表紙を含むProjectを複製し、ID分離、参照整合性、素材hash、複製先からの書き出しを検証しました。製品版でも元Projectの素材4件、コマ4件、吹き出し3件、テキスト3件、表紙が複製先へ保持され、再生成PDFをPNGへ描画して黄・緑・青・赤の4コマと文字が表示されることを確認しました。Desktop TypeScript、ESLint、統合テスト36/36が成功しています。

## 57. Windows RC成果物・整合性ゲート

現行0.1.0からWindows x64 NSISインストーラーとblockmapを再生成しました。成果物のpackage version、installer名、ファイルサイズ、blockmap形式、Authenticode状態を確認する`rc:windows-artifacts`を追加し、更新metadataがある場合は記載されたSHA-512とサイズも実ファイルへ照合します。`metadata`と`signed`を指定すると、それぞれ更新metadataと有効なAuthenticode署名を必須条件にできます。

更新ビルドは`MANGAI_RELEASE_OUTPUT`で通常の`release/`と分離して生成できるようにしました。ダミーHTTPS URLによる検証版で`latest.yml`、installer、blockmapの整合性と設定ファイルの自動復元を確認し、検証用URLを含む成果物は正式配布先へ昇格していません。通常RC成果物の機械検証は成功し、署名必須ゲートは`NotSigned`だけを理由に意図どおり失敗します。残るWindows配布条件はコード署名とインストール・アンインストールE2Eです。

## 58. Windows installer E2E

NSIS成果物を一時フォルダーへsilent installし、製品EXE、Desktop・Start Menuショートカット、Windowsのアンインストール登録を確認後、silent uninstallと残存物の消失を検査する`rc:windows-installer-e2e`を追加しました。既存のMANGAI Desktop、ショートカット、登録情報を検出した場合は上書きせず停止し、ローカルでは`allow-local`の明示を必須にしています。製品データを変更しないよう、インストールしたアプリ自体は起動しません。

現行0.1.0インストーラーでE2Eに成功しました。NSISのアンインストーラーはプロセス終了後にショートカットと登録情報を遅延削除するため、すべての消失を待って判定します。同じ検査を署名・metadata検証後のWindowsリリースworkflowへ追加しました。これによりWindows成果物で残るRC条件はコード署名証明書の設定です。

## 59. インストール済み製品版の起動スモーク

インストール結果のファイル確認だけでなく、製品版EXEがSQLiteを初期化してrendererを描画できることまで検査する起動スモークを追加しました。`--mangai-smoke-test`は`MANGAI_SMOKE_DOCUMENTS`で指定した絶対パスをElectronのDocuments保存先へ一時設定し、`#root`へのReact描画を最大10秒待って正常終了します。通常起動ではこの処理を使用しません。

NSIS E2Eは一時Documents配下に`MANGAI/mangai_local.sqlite`が作成されたことも確認します。現行コードから0.1.0インストーラーとunpacked製品を再生成し、成果物整合性、silent install、製品版起動、renderer描画、隔離SQLite生成、silent uninstall、残存物消失がすべて成功しました。通常の作品データは変更していません。

## 60. Windows配布SBOM・SHA-256証跡

Desktopのpackage-lockとローカルMANGAIパッケージを読み取り、SPDX 2.3 JSONを生成する`rc:windows-evidence`を追加しました。同じ名前・versionの依存を統合し、package URL、license、取得元、lockfileにあるSHA-512 integrity、直接依存関係を記録します。標準の`npm sbom`はローカル`file:`パッケージの依存を欠落として停止するため、依存関係を変更せずlockfileを直接扱っています。

インストーラー、blockmap、存在する更新metadata、SBOMを対象に`SHA256SUMS.txt`を生成し、`verify`モードでは既存ファイルの製品名・version・パッケージ数・対象一覧・全checksumを再検証します。現行0.1.0では562パッケージと3成果物の検証に成功し、SBOM改変の否定テストも失敗として検出しました。Windowsリリースworkflowは署名と起動E2Eの後にSBOMとchecksumをDraft Releaseへ追加します。

## 61. 現行ステータス・残タスク再整理

ロードマップの基準を2026-07-15・`c0b5ff3`へ更新し、Project完全複製、Desktop統合テスト36/36、NSIS install・製品版起動・uninstall E2E、SPDX SBOM、SHA-256証跡、Hub/Desktop依存脆弱性0件を反映しました。古い「インストール未確認」「Desktopテスト26件」「WebP PDF非対応」の記載も現行実装へ合わせました。

残作業を[`REMAINING_TASKS.md`](REMAINING_TASKS.md)へ集約し、RC公開を止める外部サービスE2E・コード署名・初回公開と、外部準備なしで進められる機能改善、公開後のHub成長機能を分離しました。現時点の最優先はSupabase staging・端末認証・Stripeテスト、実Ollama・ComfyUI、署名済みDraft Release、クリーンWindowsでの署名付き自動更新です。

## 62. 別ドライブProject削除・ゴミ箱退避

カスタムProjectがDocumentsと異なるドライブにある場合、従来の`rename`ではWindowsが`EXDEV`を返し、Projectを中央`.trash`へ移動できない問題を修正しました。中央ゴミ箱を優先し、別ボリューム時だけProject保存先の親フォルダーにある`.mangai-trash`へ同一ドライブ内で退避します。ファイル退避に成功した後だけDB行を削除し、DB削除失敗時は元の保存先へ戻します。ファイルシステムrootやMANGAIデータrootをProjectとして削除する操作も拒否します。

自動テストでは`EXDEV`フォールバック、退避失敗時のDB・原本保持、カスタム保存先内の素材`.trash`を検証しました。さらにCドライブのSQLiteからDドライブの実Projectを削除し、内容をDドライブの`.mangai-trash`へ保持できることを専用E2Eで確認しました。一時領域を削除後、Desktop統合テスト39/39、TypeScript、ESLintに成功しています。

## 63. DesktopからHub非公開下書きへの限定更新

Desktop端末認証へ`works:write:draft` scopeを追加し、承認画面で付与内容を明示するようにしました。コードを手入力した場合も、権限確認画面を一度表示しなければ承認できません。既存の`works:read`トークンは読み取り専用のままで、更新には再認証が必要です。

Desktopから変更できる対象を、本人所有・Project ID一致・`draft`・非公開のHub作品に限定しました。更新項目は作品名と説明だけで、公開状態、商品、価格、販売ファイル、決済情報は変更できません。Desktop画面ではHubとの差分を表示し、利用者の確認後にだけ更新します。`updated_at`を使った楽観的ロックにより、Hub側で先に編集された場合は上書きせず再確認を促します。

Desktop TypeScript、Hub TypeScript、ESLint、Desktop統合テスト41/41、Hubテスト10/10、Next.js本番buildに成功しました。

## 64. 素材削除の永続Undo/Redo

素材削除をProjectの操作履歴へ追加しました。削除時は素材ファイルをProject内`.trash`へID付きで退避し、DBから素材、Page・コマ参照、表紙参照を外します。Undoではファイルのbyte数とSHA-256を検証して元の場所へ戻し、素材行、Page・コマ、表紙、AI生成出力参照を復元します。Redoでは同じ素材だけを再び退避します。ファイル操作またはDB復元に失敗した場合は履歴状態を進めず、可能なファイル移動を元へ戻します。

履歴スナップショットは削除対象の素材IDだけを追跡します。Undo後に追加した別素材はRedoの対象になりません。アプリを閉じて開き直した後もUndoできることを確認しました。Projectバックアップは現在存在する素材と通常のUndo履歴を保存し、Projectローカルのゴミ箱を必要とする素材削除履歴だけはポータブル復元対象から除外します。

Desktop TypeScript、ESLint、統合テスト41/41に成功しました。

## 65. AI生成素材追加のUndo/Redo

ComfyUIの1回の生成で新規登録された全素材を、`AI生成素材を追加`という1件のProject履歴へまとめました。Undoでは生成ジョブとプロンプト等の監査記録を`completed`のまま保持し、素材ファイル、表紙、Page・コマ参照、生成出力の素材参照だけを戻します。Redoでは同じID・内容の素材をSHA-256検証後に復元します。外部AIへ送信済みの処理や計算コストは取り消し対象にしません。

既存素材と同一hashで重複排除された画像は削除対象に含めません。複数画像の登録途中で破損画像などにより失敗した場合は、先に登録済みの新規素材をロールバックし、半端な素材一覧とUndo履歴を残さないようにしました。

Desktop TypeScript、ESLint、統合テスト42/42に成功しました。

## 66. 書き出し・AI設定の監査履歴

書き出しは外部成果物を削除するUndoにはせず、既存`export_history`を読み出すDesktop APIを追加しました。書き出しダイアログには直近3件の実行日時、ファイル数、確認事項数、保存先を表示し、書き出し完了後に自動更新します。

Project固有ではないAI設定もProject Undoへ混ぜず、端末内の監査履歴として保存・表示します。Ollama / ComfyUIの有効状態、ローカル／リモート接続の区分、変更項目、モデル選択の有無だけを記録し、接続URL、ホスト名、モデル名の実値は履歴へ保存しません。同じ設定を再保存した場合は履歴を増やしません。

Desktop TypeScript、ESLint、統合テスト42/42に成功しました。

## 67. AI通信先の明示許可origin

OllamaとComfyUIの接続先検証を強化しました。`localhost`、IPv4の`127.0.0.0/8`、IPv6の`[::1]`は従来どおりローカルHTTP接続を許可します。リモート接続はHTTPSだけに限定し、AI設定の許可一覧へ登録したscheme、host、portが完全一致するoriginだけへ接続します。許可originは最大20件です。

接続URLと許可originに含まれるユーザー名・パスワード、base path、query、fragmentを拒否し、HTTP redirectも追跡しません。設定保存時にもmain processで同じ検証を行うため、不正なURLをSQLiteへ保存して後から使用する経路を防ぎます。許可originの追加・削除は既存のAI設定監査履歴へ変更項目として記録しますが、実際のURLやhostは記録しません。

完全一致origin、port不一致、未登録origin、HTTPリモート接続、URL credential、base path、redirect拒否の回帰テストを追加しました。Desktop TypeScript、ESLint、統合テスト44/44に成功しています。

## 68. 同意制クラッシュレポート送信client

詳細クラッシュレポートの外部送信clientを追加しました。端末内保存とは別の明示同意を必要とし、自動送信せず、利用者が未送信件数を確認して送信操作を確定した場合だけ処理します。端末内保存をOFFにすると外部送信同意もOFFになります。

送信先は製品resourcesの設定から取得するHTTPS endpointだけを許可し、credential、query、fragment、HTTP redirectを拒否します。送信直前にversion 1 schemaで再検証して秘密値除外を再実行し、256KB上限、10秒timeout、同時送信拒否を適用します。SHA-256 report IDを冪等キーとして付与し、成功したファイルだけを端末内ledgerへ記録するため、途中失敗後は残りだけを再試行できます。

現行の配布設定はendpointが`null`であり、受付APIとプライバシー運用が確定するまで外部通信と送信同意UIを無効にしています。受付API契約と有効化条件は[`desktop/DIAGNOSTICS_UPLOAD_DESIGN.md`](desktop/DIAGNOSTICS_UPLOAD_DESIGN.md)へ記録しました。Desktop TypeScript、ESLint、本番renderer build、統合テスト46/46に成功しています。

## 69. 多言語化基盤・追加アクセシビリティ

rendererへ型付きの日本語・英語辞書とlocale contextを追加しました。ホームまたは設定から表示言語を切り替え、localStorageへ保存して次回起動時に復元します。HTMLの`lang`と日時formatも選択言語へ連動します。最初の移行範囲はホーム、新規Project、global navigation、workspace header、status bar、一般設定です。対象年齢など既存データのenum値は変更せず、表示ラベルだけを翻訳しています。

画面先頭へskip linkを追加し、Project一覧は明示的なbuttonでkeyboardから開けるようにしました。新規Projectをmodal backdrop付きdialogへ変更し、初期focus、Tab / Shift+Tab循環、Escape終了、起点へのfocus復帰を実装しました。errorはalertと閉じるbuttonに分離し、クリック領域だけに依存しません。OS設定に合わせたreduced motionとWindows forced colorsも追加しました。

対応範囲と残作業は[`desktop/LOCALIZATION_ACCESSIBILITY.md`](desktop/LOCALIZATION_ACCESSIBILITY.md)へ記録しました。Desktop TypeScript、ESLint、本番renderer build、統合テスト46/46に成功しています。

## 70. 編集サイドパネルの英語化

左側のProject panelと右側Inspectorを日本語・英語辞書へ移行しました。Project構成、Episode追加・名称変更・並び替え・削除、Episodeテンプレート、Page追加・選択・並び替え、素材追加・検索・形式filter・連続Page化、Project・Page・選択画像のInspector操作が表示localeへ連動します。既存データやテンプレートIDは変更せず、名称と説明だけを翻訳します。

Page一覧は行全体をクリックする`div`から、Page選択用buttonと上下移動buttonを分離した構造へ変更しました。keyboardとスクリーンリーダーで「選択」と「並び替え」を別操作として認識できます。素材検索のcase変換も選択localeを使用します。

保存・書き出しstatusも英語表示へ対応し、locale切替直後のstatus表示を更新します。Desktop TypeScript、ESLint、本番renderer build、統合テスト46/46に成功しています。

## 71. Canvas編集機能の英語化

`MangaCanvas`内の固定日本語を日本語・英語辞書へ移行しました。追加・レイアウト・表示menu、Page layoutテンプレート、grid・snap、画像編集、複数選択削除、素材配置、レイヤー一覧と表示・lock・前後移動が表示localeへ連動します。

Inspectorへportal表示するコマ形状、画像fit・scale・offset・回転・透明度、吹き出し種別・尻尾・色・線幅、テキスト本文・親吹き出し・縦横書き・文字サイズ・色・揃えも翻訳しました。ルビの選択案内、入力、追加・解除、全validation messageも英語表示へ対応しています。

新規コマ・吹き出し・テキスト、複製名、テンプレート適用後のコマ名は作成時のlocaleで初期化し、保存済みの利用者編集名は変更しません。MangaCanvas内の固定日本語が残っていないことを検索で確認しました。Desktop TypeScript、ESLint、本番renderer build、統合テスト46/46に成功しています。

## 72. Creator Chatの英語化・履歴操作のアクセシビリティ

Creator Chatの専用画面とCanvas右パネルを日本語・英語辞書へ移行しました。履歴、新規Chat、AI設定、生成状態、コピー、再生成、Pageメモ保存、テンプレート、Project文脈、送信・停止、エラー表示が選択localeへ連動します。対象年齢は従来の内部値を保持したまま表示だけを翻訳します。

履歴行全体をクリックする構造を、Chat選択buttonと名称変更・削除buttonへ分離しました。各入力、選択、履歴操作へアクセシブルラベルを追加し、エラーは`role="alert"`で通知します。組み込みプロンプトテンプレート名・本文、保存済み会話、外部AIからの応答は利用者コンテンツとして自動翻訳しません。

Desktop TypeScript、ESLint、本番renderer build、統合テスト46/46に成功しています。

## 73. 画像生成・生成ジョブの英語化

ComfyUI画像生成画面と制作画面の生成ジョブDrawerを日本語・英語辞書へ移行しました。ワークフロー選択・追加・編集・削除・既定化・検証、Prompt入力、生成開始、状態、進捗、履歴、キャンセル、再実行、AI接続状態が選択localeへ連動します。履歴日時も選択localeで整形します。

ワークフロー選択へアクセシブルラベルを追加し、設定完了通知は`role="status"`、生成・履歴エラーは`role="alert"`で通知します。生成ジョブDrawerのfocus対象は翻訳文言に依存しないdata属性で特定するため、localeを切り替えても初期focusとEscape終了を維持します。ComfyUIやmain processが返すメッセージ、Prompt、ワークフロー名は外部・利用者データとして自動翻訳しません。

Desktop TypeScript、ESLint、本番renderer build、統合テスト46/46に成功しています。

## 74. 低スペック・ハイブリッド生成 Phase 1現状調査

低スペックPC対応の方針を、単純な軽量モデル化から「人物・センシティブ処理はローカル、safeな背景・素材はAsset Libraryまたは外部Provider、枠・吹き出し・文字はbuiltin、最終合成はローカル」とするハイブリッド生成へ変更しました。

現行の画像生成、ComfyUI、generation jobs、Project素材、Canvas、IPC、Provider設定、通信制限、ログ、バックアップを調査しました。既存基盤を維持したままGeneration Routerと作品別外部送信ポリシーを前段へ追加できる一方、現状はリモートComfyUIを許可した場合にSensitivityを構造的に判定する層がないことを確認しました。

互換性判断、追加型、migration候補、shadow routing、テスト基準、外部依存を[`desktop/HYBRID_GENERATION_PHASE1_AUDIT.md`](desktop/HYBRID_GENERATION_PHASE1_AUDIT.md)へ記録しました。調査時点でDesktop統合テスト46/46、canvas-core単体テスト24/24に成功しています。コードとDBスキーマは変更していません。

## 75. ハイブリッド生成の型・純粋Router

`packages/ai-core`へ21種類のHybrid Generation Job Type、5種類のExecution Target、4段階のSensitivity、5種類のExternal Processing Policy、Job Draft、Routing Context、Route DecisionとZod schemaを追加しました。Routerはネットワーク、DB、ファイルへアクセスしない純粋関数です。

枠・tone・吹き出し・文字・合成・書き出しはbuiltin、人物・成人向け・修正処理はlocalへ固定します。分類不明、人物入力、Character参照、完成Page、restricted Prompt、外部許可のない入力Assetもfail-closedでlocalへ戻します。safeな背景・小物・効果はAsset Libraryを優先し、作品ポリシー、Provider有効状態、費用上限を満たす場合だけcloud候補にします。利用者の明示cloud指定も安全ポリシーを上書きできません。

ai-core単体テスト12/12、Desktop TypeScript、ESLint、本番renderer build、統合テスト46/46、canvas-core 24/24に成功しています。DB、IPC、UI、既存ComfyUI実行経路は変更していません。

## 76. 作品別ハイブリッド生成ポリシーの永続化

`project_generation_policies`を追加し、ProjectごとにExternal Processing Policy、ローカル優先、外部送信前確認、月間費用上限、custom cloud Job Typeを保存できるようにしました。新規・既存Projectはいずれも`safe_assets_only`、ローカル優先、送信前確認を既定値とします。値はai-coreのZod schemaとmain process IPCで検証し、rendererからDBや外部Providerへ直接アクセスさせません。

既存DBは`hybrid-generation-policy-v1` migration前に自動バックアップし、全Projectへ安全な既定値を追加します。ポリシーは再起動、Project複製、自動バックアップの変更検知、手動バックアップ、復元で維持します。generation policyを含まない旧version 1 / 2バックアップは既定値で復元できます。

ai-core単体テスト12/12、Desktop TypeScript、ESLint、本番renderer build、統合テスト47/47、canvas-core 24/24に成功しています。既存ComfyUI経路とUIは変更しておらず、次のshadow routingまでは実行判断に使用しません。

## 77. ハイブリッド生成のshadow routing・監査履歴

既存ComfyUI画像生成の前段で純粋Routerをshadow実行し、`generation_route_decisions`へJob Draft、作品ポリシーを反映したContext、判定先、reason code、確認要否、blocked状態、PromptのSHA-256を保存するようにしました。Prompt本文、Negative Prompt、入力・出力画像はroute履歴へ保存しません。限定IPCからProject別履歴を読み出せます。

現行UIは生成種別とSensitivityをまだ指定しないため、`adult_character_render / external_forbidden / personPresence=unknown`へ補完し、cloud許可にならないfail-closed判定を記録します。現時点では判定結果で実行先を変更せず、既存ComfyUI生成、キャンセル、失敗、素材登録を維持します。RouterへProjectのローカル優先設定も反映しました。

route履歴はProjectバックアップversion 2へ追加し、復元時にProject、Page、Panel、Asset、Job参照を新IDへ置換します。route履歴を持たない旧version 1 / 2も復元できます。ai-core単体テスト13/13、Desktop TypeScript、ESLint、本番renderer build、統合テスト47/47、canvas-core 24/24に成功しています。

## 78. ハイブリッド生成のローカル実行ゲート

既存ComfyUI画像生成をshadow modeから正式なRouter実行へ切り替えました。汎用画像生成は分類情報が不足するため安全側の`adult_character_render / external_forbidden / personPresence=unknown`として判定し、Routerが`local`を選び、接続URLがlocalhost、127.0.0.0/8、IPv6 loopbackの場合だけ既存ComfyUI Providerを実行します。

HTTPSのremote ComfyUIを設定しても、Providerへの接続、workflow読込、Prompt送信より前に`ROUTE_BLOCKED`で拒否します。route判定の保存自体に失敗した場合も生成を続けないfail-closed構成です。拒否されたJobはfailed状態とerror codeを保持し、Prompt本文・Negative Prompt・画像をroute監査履歴へ複製しません。

画像生成履歴へExecution Target、Sensitivity、判定理由、blocked状態を日本語・英語で表示します。既存のloopback ComfyUI生成成功に加え、remote ComfyUIがネットワーク処理前に拒否される統合テストを追加しました。ai-core単体テスト13/13、Desktop TypeScript、ESLint、本番renderer build、統合テスト48/48、canvas-core 24/24に成功しています。

## 79. Project内Asset Library

外部通信を使わず既存Project素材を検索・再利用するAsset Libraryを追加しました。素材へ未分類・背景・小物・効果・人物・その他の分類、最大20件のタグ、お気に入りを保存できます。素材ブラウザーは従来の形式filterに加え、ファイル名とタグの横断検索、分類filter、お気に入りfilterに対応し、Page・Panel・表紙での現在使用数をカードへ表示します。検索した素材は既存のドラッグ操作でCanvasへ再利用できます。

`asset-library-v1` migrationは既存Assetsへ追加カラムだけを加え、migration前バックアップを作成します。分類情報は再起動、素材削除のUndo、Project複製、自動・手動バックアップ、復元で保持します。新項目を持たない旧バックアップは未分類・タグなし・お気に入りなしで復元します。入力は共有Zod schemaとmain processで検証し、rendererからSQLiteやファイルへ直接アクセスさせません。

Asset Libraryの再起動・複製・バックアップ・旧形式復元テストを追加しました。ai-core単体テスト13/13、Desktop TypeScript、ESLint、本番renderer build、統合テスト49/49、canvas-core 24/24に成功しています。

## 80. safe素材JobのAsset Library route

背景・小物・効果を明示するsafe Job入力schemaとDesktop APIを追加し、Project内Asset Library検索をGeneration Routerへ接続しました。Job Draftは`sensitivity=safe`、`personPresence=none`、外部入力Assetなしとして構造化し、分類情報が不足する既存汎用画像生成とは分離しています。

指定分類のファイル名・タグに一致する素材がある場合だけ`asset_library`を利用可能候補へ加え、Routerの`asset_library_preferred`判定でお気に入り優先の最大20件を提示します。候補を選ぶと編集画面へ戻り、その素材が選択状態になります。一致がない場合はloopbackのローカルComfyUIがあればlocal fallback、remote ComfyUIしかない場合はblockedです。この経路はcloudや外部背景Providerを候補へ加えないため、検索queryや素材を外部へ送信しません。

safe Jobと判定は既存generation jobs・route監査履歴へ保存します。Library一致、local fallback、remote設定時blockedの統合テストを追加しました。ai-core単体テスト13/13、Desktop TypeScript、ESLint、本番renderer build、統合テスト50/50、canvas-core 24/24に成功しています。

## 81. safe JobのローカルComfyUI handoff

Asset Libraryに一致せずRouterがlocal fallbackを返したsafe Jobを、既存ComfyUI生成フォームへ引き継げるようにしました。背景・小物・効果のJob Typeと検索語由来のタグをRequestへ保持し、handoff中の分類を画面へ明示します。利用者は任意に通常画像生成へ戻せます。

AIServiceはsafe Job Typeがある画像生成を`sensitivity=safe / personPresence=none`としてrouteし、分類指定がない通常画像生成は従来どおり`external_forbidden`として扱います。どちらも実行できるのはloopback ComfyUIだけです。remote ComfyUIへsafe Requestを渡した場合も、workflow読込やPrompt送信より前にblockedとなります。

ローカル生成された新規素材はJob Typeに対応するLibrary分類と最大20件のタグを自動保存します。SHA-256重複排除で既存素材が再利用された場合は、利用者が設定した既存分類を上書きしません。safe local生成成功・Library分類・remote拒否の統合テストを追加しました。ai-core単体テスト13/13、Desktop TypeScript、ESLint、本番renderer build、統合テスト51/51、canvas-core 24/24に成功しています。

## 82. 外部safe素材Providerの送信プレビュー契約

外部safe素材Providerのdescriptor、対応Job Type、保持・学習利用・料金説明、費用見積もり、送信manifest、明示確認を`ai-core`の型とZod schemaへ追加しました。Provider未設定、無効、Job非対応、作品ポリシー拒否、費用不明のいずれかなら実行不可となるfail-closed判定です。確認契約はpayload、費用、Provider条件をすべて確認済みにする必要があります。

Library不一致時にDesktopから送信プレビューを開き、Promptだけを対象とし、Negative Prompt、入力素材、キャラクター参照、完成Pageは送らないことを表示します。プレビュー結果にはPrompt本文を含めずSHA-256だけを保持し、generation jobやroute履歴も増やしません。実Provider、endpoint、credentialは未設定で、外部通信と送信確定操作は実装していません。

ai-core単体テスト16/16、Desktop TypeScript、ESLint、本番renderer build、統合テスト51/51、canvas-core 24/24に成功しています。

## 83. Panelレイヤー永続基盤

既存`pages`と`panels`を置き換えず、コマ内の画像構成を保存する`panel_layers`を追加しました。背景、人物、小物、効果、tone、mask、correction、従来統合画像を区分し、素材ID、生成元Job ID、順序、表示、lock、opacity、normal・multiply・screen・overlay、fit・offset・scale・rotationを保持します。保存入力はZodとmain processで検証し、別Projectの素材・生成Job参照を拒否します。

既存`panels.image_asset_id`はCanvasと書き出し互換用に維持し、migration時に`flattened_legacy`レイヤーへ自動登録します。migration前SQLiteバックアップ、従来編集による互換レイヤー同期、分離済みレイヤーを従来編集しても互換レイヤーを再追加しない保護を実装しました。

レイヤーはProject Bundle、Undo / Redo、再起動、Project複製、手動・自動バックアップ、旧バックアップ復元へ統合しました。複製・復元時はPanel・Asset・生成Job参照を新IDへ変換し、Asset Libraryの使用数にも反映します。現段階の描画と書き出しは従来統合画像を維持し、分離レイヤーのCanvas表示とローカル合成は次工程です。

Desktop TypeScript、Web TypeScript、ESLint、本番renderer build、統合テスト52/52、canvas-core 25/25、ai-core 16/16に成功しています。

## 84. PanelレイヤーCanvas編集・ローカル合成

CanvasのコマInspectorへ分離画像レイヤー一覧を追加し、選択素材を背景・人物・小物・効果・tone・mask・correctionとして追加・差し替えできるようにしました。表示、lock、前後移動、削除、opacity、normal・multiply・screen・overlayを編集できます。既存のfit・offset・scale・rotation設定をレイヤーごとに描画へ反映し、コマ形状からはみ出す部分をclipします。

共通Page rendererも`panel_layers`を受け取り、PDFと連番PNG ZIPをローカルで複数レイヤー合成します。分離レイヤーが1件でも存在するコマは従来統合画像へ戻らず、全レイヤーを非表示にした状態も維持します。分離レイヤーがない旧Projectだけは従来の`panels.image_asset_id`描画を継続します。赤い分離レイヤーが緑の互換画像より優先されることを、書き出しPNGの画素で検証しました。

Desktop TypeScript、ESLint、本番renderer build、統合テスト52/52、canvas-core 25/25、ai-core 16/16に成功しています。Canvas上の直接移動・拡縮・回転、mask・correction固有処理、互換cache更新は次工程です。

## 85. Panelレイヤー画像のCanvas直接変形

選択したPanelレイヤー画像を専用編集モードでCanvas上からドラッグ移動、四隅の等比拡縮、回転できるようにしました。変形結果はレイヤーのfit、scale、offset、rotationへ変換して限定IPCで保存するため、再起動、Undo / Redo、PDF・画像ZIP書き出しへそのまま反映されます。

Inspectorへfit、倍率、横・縦offset、回転の数値入力、中央リセット、編集開始・終了操作を追加しました。対象レイヤーを非表示またはlockした場合、別レイヤーや別オブジェクトへ移動した場合、Escapeを押した場合は専用編集を終了します。従来統合画像の直接編集も維持しています。

Desktop TypeScript、ESLint、本番renderer build、統合テスト52/52、canvas-core 25/25、ai-core 16/16に成功しています。renderer buildには既知の500KB超chunk警告だけが残ります。

## 86. Panel mask合成・correction透明パッチ

Panel Layerの`mask`を通常画像表示からalpha maskへ変更しました。maskはそれより下にある合成済みレイヤーへ画像alphaとopacityを適用し、後続レイヤーには影響しません。`correction`は透明部分を維持する修正パッチとして後段合成し、opacityとblend modeを利用できます。Inspectorには日英の挙動説明を表示し、maskでは意味を持たないblend mode操作を無効化します。

CanvasではPorter-Duffの`destination-in`が他オブジェクトを消さないよう、Panel内スタックをpixel ratio 1のオフスクリーンcacheへ隔離しました。直接編集中はcacheを解除してmask元画像を表示し、編集終了後に再合成します。Page rendererはSVG alpha maskを逐次入れ子にし、PDFと連番PNG ZIPへ同じ順序で反映します。

赤い背景の右半分を透明maskで除外し、その後ろへ青いcorrectionパッチを置く画素テストを追加しました。Desktop TypeScript、ESLint、本番renderer build、統合テスト53/53、canvas-core 25/25、ai-core 16/16に成功しています。renderer buildには既知の500KB超chunk警告だけが残ります。

## 87. Panel分離レイヤーの互換cache

Panel内の分離レイヤーをローカル合成した内部PNGを生成し、`panels.image_asset_id`へ設定する互換cacheを追加しました。Canvasと新しいPage rendererは`panel_layers`を正式な描画元として維持しつつ、従来の単一画像参照しか扱わない経路でも最新のコマ画像を表示できます。元の`flattened_legacy`は上書きせず、分離レイヤーを外した場合の復帰先として保持します。

cacheはレイヤー保存、Panel寸法・形状変更、Canvas一括更新、Project再オープン、Undo / Redo後に同期します。Panel寸法・形状、各レイヤー設定、参照素材SHA-256からsignatureを作り、一致時は画像生成・ファイル読込・DB更新を省略します。再生成時も対象Panelで表示中の参照素材だけを読み、全Project素材をメモリへ展開しません。

内部PNGは予約タグ付きAssetとしてバックアップとProject複製へ含めますが、素材ブラウザー、素材件数、一括Page化から除外します。main processでもメタデータ編集と削除を拒否します。cache作成、内容変更時の同一Asset更新、同一signature時の無更新、Undo / Redoでの従来画像復帰・cache再利用を統合テストへ追加しました。

Desktop TypeScript、ESLint、本番renderer build、統合テスト53/53、canvas-core 25/25、ai-core 16/16に成功しています。renderer buildには既知の500KB超chunk警告だけが残ります。

## 88. 低スペックRuntime Profile基盤

Electron起動時にOS RAMとGPU情報を診断し、`cpu_only`、VRAM 6GB、8GB、12GB、16GB、24GB以上のRuntime Profileを自動選択する基盤を追加しました。GPUは検出できても専用VRAMが不明な場合は最小profileへ倒し、GPU未検出時もアプリを停止せず編集・素材利用を継続します。

設定画面へRAM、GPU名、専用VRAM、推奨・実効profileを表示し、自動選択または手動profileを端末設定へ保存して再起動後に復元できます。CPUのみの場合はローカル画像生成非推奨を表示します。全ローカルprofileはbatch 1・同時生成1件を共通制約とし、Mainプロセスで競合した2件目を`LOCAL_JOB_BUSY`として拒否・失敗履歴へ記録します。

Desktop TypeScript、ESLint、本番renderer build、統合テスト54/54、canvas-core 25/25、ai-core 19/19に成功しています。renderer buildには既知の500KB超chunk警告だけが残ります。profile別workflow parameter適用、Ollamaとの排他、モデルunload、永続Queueは次工程です。

## 89. Runtime Profile別ComfyUI workflow制約

Runtime Profileの制約を実際のComfyUI送信経路へ接続しました。指定解像度の最大辺がprofile上限を超える場合は縦横比を保って8px単位で縮小し、API workflow内の`batch_size`は1へ固定します。調整は登録済みworkflowを変更せず、送信用cloneだけへ適用します。

workflow内のControlNet Loader / ApplyとLoRA Loaderを検出し、8GB profileはControlNet最大1・LoRA最大2、12GB profileは最大2・3として上限超過をネットワーク送信前に拒否します。Generation Jobには使用profile、要求・実効解像度、調整有無を残し、縮小時は生成画面へ実効解像度を日英で表示します。

Desktop TypeScript、ESLint、本番renderer build、統合テスト55/55、canvas-core 25/25、ai-core 20/20に成功しています。renderer buildには既知の500KB超chunk警告だけが残ります。VAEタイル、CPUオフロード、モデル解放は検証済みworkflowテンプレートとresource schedulerで対応します。

## 90. ローカルAIのGPU排他とOllamaモデル解放

12GB以下のRuntime ProfileではCreator ChatとComfyUI画像生成を同時実行しないMainプロセス排他を追加しました。画像生成中のChat、Chat中の画像生成、複数の同時Chatは`LOCAL_RESOURCE_BUSY`として失敗Jobへ記録し、Providerへの二重送信を防ぎます。16GB以上のprofileでは限定的同時利用を維持します。

ローカル画像生成を確保した後、設定中のローカルOllamaモデルへ`keep_alive: 0`を送り、解放成功後だけComfyUI workflowを送信します。Ollamaが無効、remote接続、モデル未選択の場合は解放要求を行いません。モデル解放失敗は`MODEL_UNLOAD_FAILED`としてfail-closedで停止します。

Desktop TypeScript、ESLint、本番renderer build、統合テスト55/55、canvas-core 25/25、ai-core 21/21に成功しています。HTTP mockでモデル解放要求、ComfyUI送信、競合Chat拒否の順序も確認しました。次工程は永続Queueと停止・再開・再起動復元です。

## 91. ローカル画像生成の永続Queue

画像生成中に追加されたRequestを`LOCAL_JOB_BUSY`で失敗させず、既存`generation_jobs`へ`queued`として保存する永続Queueへ移行しました。Queueはpriority降順・作成日時順で1件ずつ自動実行し、既存の単発生成は従来どおり完了Bundleを返します。

`paused`状態、priority列、Queue index、限定IPCを後方互換で追加し、生成Job画面から実行中・待機中Jobの一時停止、再開、キャンセル、優先順位の上下操作ができます。実行中の一時停止・キャンセルはComfyUIへinterruptを送り、待機中操作は外部通信を行いません。

アプリ終了時に実行中だった画像Jobは、次回DBオープン時に`RECOVERED_AFTER_RESTART`付きの待機状態へ戻し、AIService初期化後に自動再開します。Creator Chatは応答途中から安全に復元できないため、従来どおり`INTERRUPTED`で失敗確定します。

Desktop TypeScript、ESLint、本番renderer build、統合テスト56/56、canvas-core 25/25、ai-core 21/21に成功しています。Queueの順次実行、一時停止・再開・priority、キャンセル、SQLite再オープン復元を統合テストで確認しました。生成画面は待機Jobの完了を監視し、新しい素材を現在のProject Bundleへ自動反映します。夜間一括、Page batch、自動再試行上限は次工程です。

## 92. 画像生成Jobの上限付き自動再試行

ComfyUI接続失敗、通信タイムアウト、Ollamaモデル解放失敗など、`AIProviderError.retryable`が明示された一時障害だけを同一Jobで自動再試行するようにしました。workflow不正、Runtime Profile上限超過、route拒否、Provider無効は即時失敗とし、無意味な再送を行いません。

試行回数、最大回数、次回試行時刻をSQLiteへ後方互換追加し、最大3回、1秒から最大30秒の指数バックオフで再実行します。遅延中は他の実行可能Jobを先に処理し、アプリ再起動後も保存済み時刻から待機を継続します。一時停止したJobを利用者が再開した場合は遅延を解除します。

生成画面へ試行回数と次回時刻を日英表示しました。Desktop TypeScript、ESLint、本番renderer build、統合テスト56/56、canvas-core 25/25、ai-core 21/21に成功しています。HTTP接続を1回切断し、同一Job IDの2回目試行で生成完了する経路を統合テストで確認しました。

## 93. 夜間画像生成Queue

画像生成Queueを指定時間帯だけ実行する夜間Modeを追加しました。有効化、開始・終了時刻を端末共通SQLite設定へ保存し、22:00〜07:00のような日跨ぎと、09:00〜17:00の同日範囲を扱えます。既定は無効です。

時間外に投入された画像JobはProviderへ送信せず、試行回数0の待機状態で保持します。Mainプロセスは次の開始時刻にtimerでQueueを再開し、設定変更時はtimerを再計算します。終了時刻を過ぎた実行中Jobは途中停止せず、現在の1件を完了してから次を待機させます。

生成画面へ夜間Mode、開始・終了時刻、保存操作を日英で追加しました。Desktop TypeScript、ESLint、本番renderer build、統合テスト56/56、canvas-core 25/25、ai-core 22/22に成功しています。日跨ぎ判定、開始までの時間、時間外のProvider未送信、SQLite再オープン後の設定維持を確認しました。

## 94. Episode内Pageの一括画像生成Queue

選択中Episodeに属するPageのうち、Promptが入力されたものだけをページ順で永続画像生成Queueへ一括登録できるようにしました。空Promptはスキップして対象件数とともに日英表示し、別Project・別EpisodeのPage IDと重複IDはMainプロセスで拒否します。

`generation_jobs`へ後方互換な`queue_order`を追加し、同じpriorityの一括Jobを登録順、すなわちPage順で実行します。各Jobは既存の夜間時間帯、最大3回の自動再試行、一時停止・再開、priority変更、再起動復元を利用します。

Desktop TypeScript、ESLint、本番renderer build、統合テスト57/57、ai-core 22/22に成功しています。ページ順、空Promptスキップ、重複拒否、永続Queue順序を統合テストで確認しました。renderer buildには既知の500KB超chunk警告だけが残ります。

## 95. 低スペックComfyUI workflow適合監査

登録済みComfyUI API workflowのノード種別を解析し、標準VAE Decode、`VAEDecodeTiled`、`VAEEncodeTiled`を識別する低スペック適合監査を追加しました。生成画面では選択workflowのタイルVAE対応状態を日英表示し、AI一括診断では既定workflowを独立項目として判定します。

CPUオフロードはworkflowノードではなくComfyUIの起動引数・Dynamic VRAM設定に依存するため、JSONから有効と推測しません。画面では実環境確認が必要であることを明示し、既存workflowの自動書き換えや強制無効化は行いません。

Desktop TypeScript、ESLint、本番renderer build、統合テスト57/57、ai-core 23/23に成功しています。タイルVAE検出とCPUオフロードの実環境分離を単体・統合テストで確認しました。残る完了条件は、実モデル用workflowとComfyUI起動設定を用いた8GB端末E2Eです。

## 96. ComfyUI低スペック実行環境診断

ComfyUI公式APIからversion、GPU、VRAM、タイルVAEノード、CPU VAE起動設定、VRAM mode、予約VRAMを取得する実環境診断を追加しました。起動引数全体はrendererへ渡さず、低スペック判断に必要な項目だけを構造化してAI一括診断へ表示します。

接続確認には`/system_stats`と`/object_info/VAEDecodeTiled`を利用し、既存のURL制限、redirect拒否、timeoutを維持します。HTTP mockで8GB GPU、`--cpu-vae`、`--lowvram`、`--reserve-vram`とタイルVAEノードの解析を確認しました。

Desktop TypeScript、ESLint、本番renderer build、統合テスト58/58、ai-core 23/23に成功しています。開発PCではComfyUIプロセスと一般的な配置フォルダーが見つからなかったため、実モデルによる画像生成E2Eは引き続き外部環境待ちです。

## 97. AI接続診断の英語化・ARIA改善

設定画面のAI接続診断を日英辞書へ移行しました。Ollama・ComfyUI接続、workflowマッピング、低スペックworkflow、ComfyUIのGPU・VRAM・起動設定、Ollamaモデル準備状態、最終診断日時が選択localeへ連動します。Runtime Profileの選択肢も英語表示へ対応しました。

診断sectionを見出しへ関連付け、処理中は`aria-busy`を設定し、実行buttonを説明文へ関連付けました。既存の`aria-live="polite"`による結果通知を維持しています。

Desktop TypeScript、ESLint、本番renderer build、統合テスト58/58に成功しています。renderer buildには既知の500KB超chunk警告だけが残ります。設定画面の診断データ・Provider詳細・テンプレートとHub画面の辞書移行、axe・Narrator評価は次工程です。
