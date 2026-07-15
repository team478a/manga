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
