# MANGAI Desktop UI/UX現状監査

最終確認日: 2026-07-15

対象: MANGAI Desktop renderer / preload / main IPC

参照資料: `MANGAI_UI_UX_CODEX_INSTRUCTIONS.md`、`MANGAI_UI_REFERENCE.png`

## 1. 監査の目的

既存の制作機能、SQLite、IPC、Canvasデータ、Undo / Redo、書き出し、配布基盤を変更せず、初期ユーザーが迷わず制作を進められるUIへ統合するための変更境界を確定する。

今回の監査はコード変更前の基準であり、参照画像をそのまま複製するための仕様ではない。現行APIに存在しない画面や操作は追加しない。

## 2. 現在の画面構成

現在のDesktop rendererは、次の2種類の画面を`App`内で切り替えている。

1. Projectホーム
   - 新規Project作成
   - 最近のProject一覧
   - 開く、複製、削除
   - 保存先選択
   - バックアップ、復元、自動バックアップ
2. Projectワークスペース
   - 上部ツールバー
   - 左: Project、Episode、Page、Asset
   - 中央: Canvas
   - 右: Project情報、Page情報、選択Asset情報
   - Creator Chat、AI生成、Hub、設定はワークスペースを離れて専用画面へ切り替え

Canvas固有のツール、レイヤー、選択オブジェクトのプロパティは`MangaCanvas`内に実装されている。つまり、外側の右情報パネルとCanvas内のプロパティ・レイヤーが別の場所に存在する。

## 3. 変更分類

| 分類 | 意味                                           |
| ---- | ---------------------------------------------- |
| A    | そのまま再利用できる                           |
| B    | 機能を変えず見た目だけ変更する                 |
| C    | 既存機能の配置を変更する                       |
| D    | 重複または分散しているUIを統合する             |
| E    | UI刷新と同時に不具合または不足状態の修正が必要 |
| F    | 現在は未実装。主要ナビゲーションへ出さない     |

## 4. 機能監査表

| 機能            | 現在の画面                               | 使用コンポーネント                            | API / IPC                                                                   | 現在の問題                                                                               | UI変更方針                                                                                       | 分類    |
| --------------- | ---------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------- |
| Project         | ホーム、左パネル、右情報パネル           | `App`、`Inspector`                            | `projects:list/create/open/rename/duplicate/delete`、cover、storage、backup | ホームと編集画面で情報階層が異なる。編集画面ではProject名だけが左・右・ヘッダーに分散    | ホームカードを整理し、編集画面ではヘッダーのパンくずを正とする。詳細操作は重複させない           | A/B/C/D |
| Episode         | 左パネル                                 | `App`内Episode一覧                            | `episodes:create/rename/reorder/delete/apply-template`                      | Page・Assetと縦積みされ、一覧領域が狭い。操作ボタンが常時多数表示される                  | 左の「構成」タブへ移動。現在Episodeを強調し、低頻度操作はメニューへ集約                          | A/B/C   |
| Page            | 左パネル、右情報パネル                   | `App`、`Inspector`                            | `pages:add/duplicate/delete/reorder/save`                                   | サムネイル、並び替え、Page操作が分散。Page選択と詳細の関係が弱い                         | 「構成」タブへ統合。Page番号・サムネイルを主表示し、複製・削除をコンテキスト操作へ集約           | A/B/C/D |
| Asset           | 左パネル、右情報パネル、Canvas D&D       | `App`、`Inspector`、`MangaCanvas`             | `assets:pick/import/delete/url`、`projects:set-cover`                       | 構成一覧と同じスクロール領域にあり、検索・種別フィルター・欠損表示がない                 | 左の「素材」タブへ分離。既存サムネイルURLとD&Dを再利用。検索等は実データで実装可能な範囲だけ追加 | A/B/C/E |
| Canvas          | 中央ワークスペース                       | `MangaCanvas`、React Konva                    | `canvas:panel/balloon/text/object/batch`                                    | エンジンは完成しているが、外側パネルとCanvas内パネルの配置競合で表示領域が狭い           | Canvasデータと操作ロジックは維持。背景、選択色、ツール配置だけ段階的に変更                       | A/B/C   |
| Properties      | Canvas内レイヤーパネル下部、右情報パネル | `CanvasProperties`相当の内部実装、`Inspector` | Canvas保存IPC、`pages:save`、Project rename                                 | Page/Asset情報と選択オブジェクト設定が別パネル。選択対象がどこで編集できるか分かりにくい | 右の「プロパティ」タブへ統合。Page、Asset、Panel、Balloon、Textを選択対象に応じて表示            | A/C/D   |
| Layers          | Canvas右横の追従パネル                   | `MangaCanvas`内レイヤーUI                     | Canvas batch save                                                           | Canvas幅を追加で消費し、右情報パネルとも競合する                                         | 右の「レイヤー」タブへ移動。選択、表示、ロック、D&D、前後移動は既存ロジックを再利用              | A/C/D   |
| Creator Chat    | 専用画面                                 | `CreatorChat`                                 | `ai:chat:*`、templates、runtime                                             | Canvasから離れるため、Pageを見ながら相談できない。接続・対象コンテキストが画面内に分散   | 右の「AI」タブへ配置し、Project/Episode/Pageコンテキストを固定表示。必要時は閉じられる構造にする | A/B/C   |
| Ollama          | AI設定、Creator Chat                     | `AISettings`、`CreatorChat`                   | `ai:settings:*`、`ai:provider:check/models`                                 | 接続状態が設定画面を開かないと分かりにくい                                               | 設定画面は維持し、要約状態だけステータスバーとAIタブへ表示                                       | A/B/C   |
| ComfyUI         | AI設定、AI生成専用画面                   | `AISettings`、`GenerationJobs`                | provider check、workflows、`ai:image:generate`                              | ワークフロー管理と一般向け生成操作が同一画面に混在。接続状態が常時見えない               | 生成入力と高度なワークフロー設定を視覚的に分離。接続要約はステータスバーへ配置                   | A/B/C/D |
| Generation Jobs | AI生成専用画面                           | `GenerationJobs`                              | `ai:jobs:list`、generate、cancel、retry                                     | 生成画面を閉じると進捗を確認できない。状態名が内部値のまま表示される                     | ステータスバーに件数を表示し、ジョブがある場合だけDrawerを展開。状態を日本語化                   | A/B/C/D |
| Export          | ヘッダーから即時実行、右上進捗           | `App`内書き出し処理                           | `projects:export`、cancel、progress event                                   | 出力内容・範囲・出力先を開始前に確認できず、完了が`alert`。履歴UIがない                  | ヘッダーの主操作から既存書き出しを開くダイアログへ変更。進捗と完了状態を同じ導線へ統合           | A/B/C/E |
| Settings        | 専用画面                                 | `AISettings`、`UpdateControl`、診断UI         | AI、diagnostics、updater、paths                                             | AI設定、診断、更新が複数箇所に分散。ワークスペースから完全に離れる                       | 設定画面は専用画面として維持し、グローバルナビまたはヘッダーから開く。接続状態表示だけ共通化     | A/B/C/D |

## 5. 既存機能の再利用境界

### 変更しない

- `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`
- preloadの`contextBridge`公開方式
- main processのIPC入力検証
- SQLiteスキーマとProject保存形式
- Canvasオブジェクトの型と座標データ
- Canvas batch save
- Undo / Redoのスナップショット方式
- PDF・画像ZIP・販売パッケージの生成処理
- Ollama・ComfyUI provider
- 生成ジョブの永続化と状態遷移
- Windowsインストーラーと自動更新方式

### 外側から段階的に整理する

- `App`の画面切り替えとワークスペース構造
- ヘッダーの操作優先度
- 左パネルの構成・素材タブ
- 右パネルのプロパティ・レイヤー・AIタブ
- 保存、接続、生成、書き出し状態の表示位置
- レスポンシブ時のパネル開閉方式
- CSSの色、余白、文字、境界線、状態トークン

## 6. 現在確認できたUI上の課題

### 高優先

1. ヘッダーが折り返し可能で、主要操作と低頻度操作が同じ優先度になっている。
2. 左パネルでProject、Episode、Page、Assetを縦積みし、Canvasと一覧の双方が狭くなる。
3. 右情報パネルとCanvas内レイヤー・プロパティが並立している。
4. Creator Chatと生成画面がワークスペースを置き換えるため、Canvasを見ながら利用できない。
5. Ollama、ComfyUI、生成ジョブの状態をワークスペースから常時確認できない。
6. 書き出しが即時開始され、事前確認・完了状態・履歴への導線が不足している。

### 中優先

1. 色がコンポーネント規則ではなく個別値としてCSS内に散在している。
2. 選択状態が緑のアウトライン中心で、参照画像のアクセント体系と統一されていない。
3. 1200px以下でも左右パネルを縮めるだけで、1280x720向けの右オーバーレイ方式がない。
4. Project名、Page、選択オブジェクトの現在地を一続きに確認できない。
5. 空状態は存在するが、次の主操作を一つに絞る共通パターンになっていない。

## 7. 未実装またはUIへ出さない項目

次の項目は参照画像に含まれていても、既存機能として確認できないか、現在の主要導線に必要ないため追加しない。

- リサーチ専用画面
- ストーリー専用管理画面
- キャラクター専用管理画面
- エージェント管理画面
- クラウド共同編集
- ComfyUIノードエディタ
- 動画・音声生成

次の項目は既存データまたはIPCを利用して実装可能だが、UIは未実装のため段階導入とする。

- 書き出し履歴の一覧
- Asset検索・種別フィルター
- Assetファイル欠損の永続警告
- 共通接続ステータスバー
- 生成ジョブDrawer
- 左右パネルのドラッグリサイズ
- 1280px幅での右パネルオーバーレイ

## 8. 参照画像の採用・非採用

### 採用する

- ダークテーマとCanvasを主役にする情報密度
- ヘッダー、左ナビ、構成/素材、Canvas、右Inspector、ステータスの役割分離
- 紫系アクセントとニュートラル背景
- Project / Episode / Pageの現在地表示
- AIを閉じられる右側領域へ置く考え方
- 生成ジョブを制作画面から確認できる考え方

### そのまま採用しない

- 未実装機能を含むグローバルナビ
- 生成ジョブ一覧の常時大型表示
- プロパティとAIを常に同時表示する幅構成
- 参照画像固有のストーリー・キャラクター・リサーチ画面

文書仕様と参照画像が競合する場合は、既存機能を壊さないことと文書仕様を優先する。

## 9. 画面幅ごとの方針

| 画面幅    | 左ナビ                   | 左パネル               | 右パネル             | Canvas                   |
| --------- | ------------------------ | ---------------------- | -------------------- | ------------------------ |
| 1920x1080 | アイコン＋必要な補助表示 | 280〜300px             | 340〜360px           | 常時最大領域を確保       |
| 1440x900  | アイコン中心             | 260〜280px             | 320px前後            | 左右パネルを閉じられる   |
| 1280x720  | 56〜64pxアイコン列       | 240〜260px、閉じられる | 画面上のオーバーレイ | ヘッダーを折り返さず優先 |

## 10. UI状態の保存方針

既存の`localStorage`利用を継続し、次をUI状態として保持する。

- 左右パネルの開閉
- 左パネルの構成・素材タブ
- 右パネルのプロパティ・レイヤー・AIタブ
- Canvasレイヤー表示状態からの移行値
- ズーム、グリッド、スナップ

Project、Episode、Page、Asset、Canvasオブジェクト、生成ジョブ、書き出し履歴は既存SQLiteを正とし、UI刷新のためにスキーマを変更しない。

## 11. 変更前ベースライン

2026-07-15に次を実行した。

| 項目               | 結果      |
| ------------------ | --------- |
| Desktop TypeScript | 成功      |
| Desktop ESLint     | 成功      |
| Desktop統合テスト  | 35/35成功 |

テストにはProject、Episode、Page、Asset、Canvas、Undo / Redo、バックアップ、書き出し、Ollama、ComfyUI、Creator Chat、生成ジョブ、Hub連携、診断、更新チャンネルが含まれる。

## 12. 実装順序とコミット境界

### UI-1 デザイントークンと共通部品（完了）

- 色、文字、余白、境界線、角丸、フォーカス、状態色をCSS変数化
- 共通`StatusBadge`を保存状態とCreator Chat状態へ適用
- 状態を色だけでなく点と文言で表示
- 現行レイアウト、Canvas、IPCを維持したままダークテーマを適用

`IconButton`、`Tabs`、`Tooltip`は利用箇所と同時に実装し、未使用の共通部品を先行追加しない。

### UI-2 App Shell（完了）

- 一段固定の`AppHeader`
- 実装済み画面だけを表示する`GlobalNav`
- `ProjectPanel`と`InspectorPanel`の分離
- Canvasを中央に維持する`MainWorkspace`
- Page、保存先、寸法、DPI、ズーム、素材数を表示する`StatusBar`
- バックアップ、操作履歴、更新を「その他」メニューへ集約

Canvas内部、SQLite、IPC、Undo / Redo、書き出し処理は変更していない。

### UI-3 左パネル統合（完了）

- 構成 / 素材タブとキーボード切り替え
- 最後に開いたタブの端末保存
- Episode / Page操作を構成タブへ集約
- Asset追加、名前検索、PNG / JPEG / WebPフィルター
- Project内で使用中のAsset表示
- Asset D&Dと全素材の連続Page化を維持
- 両タブを保持したまま表示を切り替え、タブ別スクロール位置を維持

### UI-4 右パネル統合

- プロパティ / レイヤー / AIタブ
- Canvas選択状態の外部共有
- 既存レイヤー・プロパティUIの移設
- Creator Chatのパネル化

### UI-5 状態・生成・書き出し

- 保存状態
- Ollama / ComfyUI接続要約
- 生成ジョブ件数とDrawer
- 書き出しダイアログ、進捗、完了状態

### UI-6 レスポンシブと回帰

- 1280x720、1440x900、1920x1080
- キーボードとフォーカス
- Desktop typecheck / lint / test / build / NSIS
- Hub typecheck / lint / test / build

## 13. 次の実装単位

次は`UI-4 右パネル統合`へ進む。

現在Canvas内にあるレイヤー・選択オブジェクトプロパティと、外側のProject / Page / Asset情報を「プロパティ」「レイヤー」へ統合する。その後、Creator Chatを同じ右領域の「AI」タブへ段階的に配置する。Canvas選択・D&D・保存ロジックは既存実装を再利用する。
