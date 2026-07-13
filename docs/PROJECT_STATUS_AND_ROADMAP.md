# MANGAI 現在の実装状況と今後のロードマップ

最終確認日: 2026-07-13  
対象ブランチ: `master`  
実装基準コミット: `f813780`

## 1. 現在地

MANGAIは、公開・販売を担当するWeb製品「MANGAI Hub」と、ローカル漫画制作を担当するWindows製品「MANGAI Desktop」の2製品構成です。

| 製品           | 現在の段階                         | 要約                                                                                                |
| -------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| MANGAI Hub     | Marketplace MVP実装済み            | 認証、作品公開、検索、デジタル商品、Stripe決済、購入後配布、売上、グッズ申請、管理者機能            |
| MANGAI Desktop | ローカル制作・AI・配布基盤実装済み | Project/Episode/Page/素材、書き出し、Creator Chat、ComfyUI、Undo/Redo、インストーラー、自動更新基盤 |

コード上の主要機能は揃っていますが、一般公開版としては次が未完了です。

- 実Ollama・実ComfyUIを使ったユーザー環境E2E
- 信頼された証明書によるWindows実署名
- Git remote、公開リポジトリ、初回署名リリース
- インストール・更新・アンインストールのクリーンPC E2E
- Hubの本番Supabase・Stripe・Vercel環境での通し確認

したがって、現在の位置づけは「機能開発用MVPを越え、Release Candidate準備へ進める状態」です。

## 2. 製品境界

| 領域         | MANGAI Hub                     | MANGAI Desktop                     |
| ------------ | ------------------------------ | ---------------------------------- |
| 実行環境     | Next.js / Web                  | Electron / Windows                 |
| 主データ     | Supabase PostgreSQL / Storage  | ローカルSQLite / Projectフォルダー |
| 認証         | Supabase Auth                  | 現在はローカル利用、認証不要       |
| 決済         | Stripe Checkout / Webhook      | 秘密鍵を保持しない                 |
| AI           | 現在は販売プラットフォーム中心 | Ollama、ComfyUI、Mock              |
| ファイル責務 | 公開作品・販売ファイル         | 制作素材・生成画像・販売用書き出し |

DesktopはSupabase Service Role KeyやStripe Secret Keyを保持せず、HubはDesktopのローカルIPCへアクセスしません。この分離は今後も維持します。

## 3. MANGAI Hub 実装済み

### アカウント・権限

- メール登録、ログイン、ログアウト
- プロフィール作成・編集
- `/dashboard`と`/admin`のアクセス制御
- クリエイター、管理者、公開利用者の権限分離
- Supabase RLSによる所有者・管理者・公開範囲制御

### 作品・商品・販売

- 作品登録、画像アップロード、編集、公開設定
- 公開作品一覧、詳細、キーワード検索、タグ絞り込み
- デジタル商品登録・編集、非公開Storage保存
- Stripe Checkout Sessionと仮注文作成
- Webhook署名検証と冪等な注文状態更新
- 決済成功、失敗、キャンセル、全額返金
- 決済確認後の期限付きダウンロードURL
- クリエイター売上一覧と受取予定額

### 運営

- グッズ販売申請と状態管理
- ユーザー、作品、商品、注文、申請の管理画面
- 管理ダッシュボード集計

### 互換機能

- 旧Web版ローカル販売パッケージ機能を保全
- 公開WebからPC内ファイルへアクセスさせないため既定無効

## 4. MANGAI Desktop 実装済み

### Project・編集ワークスペース

- Project作成、一覧、再オープン、名称変更、複製、削除
- OSフォルダー選択による保存先指定と既定保存先復帰
- 同一保存先の重複利用防止
- Episode作成、切り替え、名称変更、並び替え、削除
- Page追加、複製、並び替え、削除、番号正規化
- Page Prompt、Negative Prompt、メモの保存
- 代表画像、ズーム、プレビュー、素材情報表示

### 素材管理

- JPG、JPEG、PNG、WebPの複数選択・ドラッグ&ドロップ
- Projectフォルダーへ原本を壊さずコピー
- SHA-256による重複防止
- 寸法、MIME、容量、サムネイル表示
- Pageへの追加、全素材の連続Page化
- 削除前確認と`.trash`移動

### Undo / Redo

- Project単位の永続操作履歴
- ツールバーボタン、`Ctrl+Z`、`Ctrl+Y`、`Ctrl+Shift+Z`
- 直近50件の履歴表示
- 再起動後のUndo/Redo
- Undo後の新規編集によるRedo分岐破棄

対象はProject名・表紙、Episode操作、Page操作、Page内容です。素材ファイル操作、AI生成、書き出し、AI設定は対象外です。

### 書き出し

- 本編PDF
- 本編画像ZIP
- 作品情報JSON
- 販売用説明文
- SNS告知文
- `export_history`への記録

JPG・PNGはPDFとZIPへ収録します。WebPはZIPへ収録しますが、現在PDF変換対象外です。

### Creator Chat・ローカルAI

- Ollama、ComfyUI、Mockプロバイダー
- AI設定、接続確認、モデル一覧
- Ollamaモデル一覧のSQLiteキャッシュとオフライン復元
- Creator Chatのストリーミング、停止、再生成、履歴復元
- Chat内のProject、Episode、Page切り替え
- 初期プロンプトテンプレート11種
- テンプレートの複製、カスタム版の追加・編集・削除
- ComfyUIワークフローJSON登録、編集、既定化、検証、接続テスト
- 生成ジョブ、失敗再実行、キャンセル、タイムアウト
- 生成段階の進捗表示
- 生成画像のProject素材への自動登録

### Windows配布

- Electron Builder / NSIS x64インストーラー
- インストール先選択、ショートカット作成
- MANGAIブランドアイコン（SVG、PNG、ICO）
- `better-sqlite3`のElectron ABI再構築とASAR外配置
- 環境変数ベースのコード署名専用ビルド
- 証明書未設定時の署名ビルド拒否
- `electron-updater`によるHTTPS更新確認
- 更新ダウンロード進捗と再起動適用
- `latest.yml`、EXE、blockmap生成
- 署名Secrets必須のGitHub Actions Draft Release

## 5. データ・セキュリティ

### Desktop

- Electron `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- rendererからNode.js APIを直接使用しない
- contextBridgeで限定APIのみ公開
- IPC入力をZodで検証
- Projectルート外へのパストラバーサル拒否
- SQLite Foreign Key、WAL、パラメータ化クエリ
- 秘密鍵をDesktopへ同梱しない
- 更新配布URLはHTTPSのみ許可

### Hub

- Supabase RLS
- Service Role KeyとStripe Secret Keyはサーバー限定
- Stripe Webhook署名検証
- 非公開販売ファイルと期限付き署名URL

## 6. 検証済み

2026-07-13時点の直近確認:

| 対象                                    | 結果                          |
| --------------------------------------- | ----------------------------- |
| Desktop TypeScript                      | 成功                          |
| Desktop ESLint                          | 成功                          |
| Electron main / Vite本番ビルド          | 成功                          |
| Desktop統合テスト                       | 16件成功                      |
| NSIS x64生成                            | 成功                          |
| 更新メタデータ付きNSIS生成              | 成功                          |
| 展開版Windows起動                       | 成功                          |
| `latest.yml` / blockmap                 | 生成確認                      |
| 依存関係監査                            | Electron 39.8.5更新時点で0件  |
| Hub TypeScript / ESLint / Next.jsビルド | Desktop分離時の回帰確認で成功 |

実サービス依存のE2Eは未確認です。HTTP互換モックではOllama、ComfyUI、成功、失敗、タイムアウト、キャンセル、画像取得を確認しています。

## 7. 既知の制限・未完了

### 公開を止める要因

- Windowsコード署名証明書が未取得
- Git remoteと実公開先が未設定
- 自動更新の実公開サーバーE2Eが未実施
- 実Ollama・ComfyUI環境のE2Eが未実施
- Hub本番環境の決済・Webhook・ダウンロードE2Eが未実施

### 機能上の制限

- WebPページをPDFへ変換しない
- Panelデータ型はあるが、コマ割り編集UIは未実装
- 吹き出し、テキスト、レイヤー、描画ツールは未実装
- 素材削除やAI生成をUndo対象にしていない
- カスタム保存先が別ドライブの場合のゴミ箱移動を未検証
- DesktopとHub間の作品・販売情報連携は未実装
- 自動バックアップ、復元UI、クラッシュレポートは未実装

## 8. 推奨ロードマップ

### Phase 1: Desktop Release Candidate

目的: 既存機能を安全に配布・更新できる状態にする。

1. 実Ollama・ComfyUI E2Eと対応バージョン表
2. クリーンWindows環境でインストール、起動、更新、アンインストール確認
3. コード署名証明書取得と実署名
4. Git remote設定と最初の署名済みDraft Release
5. Projectバックアップ・復元、DB破損時のリカバリー
6. 別ドライブ保存先の削除・ゴミ箱動作確認

完了条件:

- 新規PCでインストールから画像生成・書き出しまで完走
- 旧版から新版へ署名付き自動更新できる
- Projectをバックアップから復元できる
- 重大度High以上の既知脆弱性が0件

### Phase 2: 漫画制作機能の強化

目的: 「AI素材管理ツール」から「漫画編集ツール」へ進める。

1. WebPのPDF変換
2. Panel作成、移動、リサイズ、テンプレート
3. 吹き出し、縦書き・横書きテキスト
4. レイヤー順、ロック、表示切り替え
5. Canvas操作のUndo/Redo統合
6. Pageテンプレートと一括生成フロー

完了条件:

- Desktop内で1話分の基本レイアウトを完成できる
- JPG、PNG、WebP混在でもPDFが欠落しない
- Panel・テキスト編集をUndo/Redoできる

2026-07-13進捗: Canvas基盤、既定・テンプレート・ドラッグ式の矩形コマ作成、100pxグリッドとスナップ切替、素材の直接D&Dと画像配置、Canvas内画像編集専用モード、吹き出し、縦横テキスト、親子テキストの相対座標保存と追従、レイヤーD&D、6テンプレート、Undo/Redo、JPG・PNG・WebP合成PDF/ZIPまで実装しました。ビルド・自動テスト・NSIS生成に成功し、パッケージ版の基本操作と再起動復元も確認しています。全手動シナリオは残作業です。

### Phase 3: DesktopとHubの連携

目的: 制作完了から公開・販売までの二重入力を減らす。

1. Desktop販売パッケージ仕様の正式化
2. Hub側インポートAPIまたは手動インポート画面
3. 作品情報、表紙、サンプル、商品ファイルの受け渡し
4. DesktopからHub公開状況を確認する読み取り連携
5. 認証方式と端末認可の設計

完了条件:

- DesktopのProjectからHubの下書き作品を作成できる
- 秘密鍵をDesktopへ保存せず安全に認可できる
- 公開前に差分と対象ファイルを確認できる

### Phase 4: 本番運用・成長機能

目的: 継続運用と販売拡大に耐える基盤にする。

- Hub本番決済・返金・ダウンロードE2E
- メール通知と運営通知
- クラッシュレポート、構造化ログ、利用者同意
- stable / beta更新チャンネル
- DBマイグレーション試験とロールバック
- アクセシビリティ、キーボード操作、多言語化
- グッズ会社API、配送、在庫連携

## 9. 次に決めるべきこと

| 判断項目        | 推奨                                   | 影響                                               |
| --------------- | -------------------------------------- | -------------------------------------------------- |
| 次の最優先      | Phase 1 Release Candidate              | 既存投資を安全に試用可能にする                     |
| 初回配布先      | GitHub Releases                        | 現在のBuilder・Actions構成をそのまま利用できる     |
| AI配布方式      | Ollama / ComfyUIは外部インストール継続 | インストーラー肥大化とモデルライセンス問題を避ける |
| Desktop-Hub連携 | Phase 2後に開始                        | 編集データモデル確定前のAPI手戻りを避ける          |
| Panel編集の範囲 | テンプレート＋矩形編集から開始         | 自由描画より短い経路で漫画編集価値を出せる         |

## 10. 推奨する次の実装単位

実装作業として次に着手するなら、以下の順を推奨します。

1. Canvas手動受け入れ4シナリオの完全完走
2. 画像編集専用モード、親子座標の相対化
3. Projectバックアップ・復元
4. 実環境E2Eチェックリストと診断画面

コード署名証明書とGit remoteは外部準備が必要なため、並行して進めます。

## 11. 関連文書

- [実装履歴](IMPLEMENTATION_HISTORY.md)
- [現在のHub機能](IMPLEMENTED_FEATURES.md)
- [全体アーキテクチャ](architecture/OVERVIEW.md)
- [Desktop概要](desktop/README.md)
- [Creator Chat・ローカルAI](desktop/AI_CREATOR.md)
- [Undo / Redo](desktop/UNDO_REDO.md)
- [Windowsインストーラー](desktop/WINDOWS_INSTALLER.md)
- [自動更新・公開配布](desktop/AUTO_UPDATE.md)
