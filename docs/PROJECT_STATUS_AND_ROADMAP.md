# MANGAI 現在の実装状況と今後のロードマップ

## 2026-08-10 現在地（R3完了・R4 Release Candidate受入れ）

- 現行基準は`feature/manga-canvas-mvp`の`78f4503f6ca235c1c949cddc33c91e7efcc34fa3`（PR #216 merge commit）。
- PR-R0、R1、R2A、R2B、R2C、R3は完了し、architecture共通化の実装残件は0。
- Cloud漫画制作、Hub、Desktopの主要コード機能とローカル品質ゲートは揃っている。次は新機能追加ではなく実環境Release Candidate受入れを行う。
- R4はR4-0（文書・台帳）、R4-1（Hub／Supabase／Vercel／Stripe）、R4-2（Desktop実AI／アクセシビリティ／Windows配布／最終RC）の3工程へ統合する。詳細は[`RELEASE_CANDIDATE_R4_PLAN.md`](RELEASE_CANDIDATE_R4_PLAN.md)。
- RC台帳は2 passed、11 pending、2 blocked。信頼されたWindowsコード署名証明書と署名済み2version／公開update URLが揃うまで署名関連はblocked。
- 成人向けDezgo production接続、依存更新、旧PRの追加merge／closeはR4の対象外。

以下は2026-07-18時点の履歴として保持する。

最終確認日: 2026-07-18
対象ブランチ: `feature/manga-canvas-mvp`
実装基準コミット: `026ab21`

## 1. 現在地

2026-07-18に、一般漫画をMANGAI Cloud、成人向け漫画をMANGAI Desktop Adultで扱う製品分離方針を明確化しました。Cloudは一般向けAI API、Desktop AdultはOllamaとローカルComfyUIを優先し、低スペック端末の外部Provider利用は承認済み条件下のBYOKに限定します。新しい実装順と完了条件は[`PRODUCT_DEVELOPMENT_PLAN_CLOUD_DESKTOP.md`](PRODUCT_DEVELOPMENT_PLAN_CLOUD_DESKTOP.md)を正本とします。

MANGAIは、公開・販売を担当するWeb製品「MANGAI Hub」と、ローカル漫画制作を担当するWindows製品「MANGAI Desktop」の2製品構成です。

| 製品           | 現在の段階                            | 要約                                                                                                |
| -------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| MANGAI Hub     | Marketplace・Cloud Editor MVP実装済み | 認証、作品公開、販売に加え、一般漫画のProject管理、Canvas編集、保存、各種書き出し                   |
| MANGAI Desktop | ローカル制作・AI・配布基盤実装済み    | Project/Episode/Page/素材、書き出し、Creator Chat、ComfyUI、Undo/Redo、インストーラー、自動更新基盤 |

コード上の主要機能は揃っていますが、一般公開版としては次が未完了です。

- 実Ollama・実ComfyUIを使ったユーザー環境E2E
- 信頼された証明書によるWindows実署名
- Git remote、公開リポジトリ、初回署名リリース
- 署名済み旧版から新版への自動更新とクリーンPC E2E
- Hubの本番Supabase・Stripe・Vercel環境での通し確認

したがって、現在の位置づけは「機能開発用MVPを越え、Release Candidate準備へ進める状態」です。

2026-07-18にCloud／Desktop製品計画のPhase 2まで完了しました。Phase 1の安全な保存基盤に加え、Project・Episode・Page管理、Asset Library、Canvas、コマ・レイヤー・吹き出し・縦横書き、自動保存、Undo / Redo、preview、PDF・連番画像・販売パッケージ書き出しが揃いました。次の製品開発対象はPhase 3の一般向けCloud AIです。詳細は[`PHASE2_CLOUD_CREATOR_EDITOR_COMPLETION.md`](PHASE2_CLOUD_CREATOR_EDITOR_COMPLETION.md)を参照してください。

2026-07-15に低スペックPC向けのハイブリッド生成を最優先方針へ変更しました。既存RC基盤を維持しつつ、人物・センシティブ処理をローカルへ固定し、safeな背景・素材だけをAsset Libraryまたは外部Providerへrouteする基盤を追加します。Phase 1調査は[`desktop/HYBRID_GENERATION_PHASE1_AUDIT.md`](desktop/HYBRID_GENERATION_PHASE1_AUDIT.md)に記録しています。

Phase 1の最初の実装として、DBや既存生成経路へ影響しない純粋Generation Routerと型・schemaを追加しました。分類不明、成人向け、人物、参照画像、完成Pageをfail-closedでローカル固定し、safeな背景・小物・効果だけをAsset Libraryまたは許可済みcloud候補にできます。

作品別外部送信ポリシーをSQLiteへ追加し、`safe_assets_only`を既定にしました。ローカル優先、外部送信前確認、月間費用上限、custom cloud Job Typeを保存でき、再起動、Project複製、バックアップ・復元で維持します。

既存画像生成を正式にRouter経由へ切り替えました。現在は分類情報がない生成を安全側へ固定し、loopbackのローカルComfyUIだけを実行します。remote ComfyUIは外部接続前に拒否し、生成履歴へ実行先、Sensitivity、理由、blocked状態を表示します。route履歴はバックアップ・復元対象ですが、Prompt本文と画像は含みません。

Project内Asset Libraryを追加しました。素材を背景・小物・効果・人物・その他へ分類し、ファイル名とタグ、形式、分類、お気に入りで検索できます。カードにはPage・Panel・表紙での現在使用数を表示し、既存のドラッグ配置で再利用します。分類情報は再起動、素材削除Undo、Project複製、バックアップ・復元で維持します。

背景・小物・効果のsafe Job入力をRouterとAsset Libraryへ接続しました。一致素材がある場合だけ`asset_library`を候補に加え、お気に入り優先の候補を端末内で提示します。一致がなければlocal fallback、ローカル生成先もなければblockedとなり、remote ComfyUIや外部APIへ自動送信しません。

Library不一致のsafe Jobをloopback ComfyUI生成フォームへ引き継げるようにしました。Job Typeとタグを保持し、生成された新規画像を背景・小物・効果へ自動分類します。通常画像生成の外部送信禁止分類は維持し、safe Jobもremote ComfyUIでは送信前に拒否します。

外部safe素材Providerのinterface、送信manifest、費用見積もり、明示確認の契約を追加しました。Library不一致時に、Promptだけが対象で入力素材・キャラクター参照・完成Pageは対象外であること、Providerの保持・学習利用条件、費用状態を事前表示できます。実Providerは未設定・既定無効で、現段階では外部通信も送信確定操作も行えません。

`panel_layers`永続基盤を追加しました。既存のコマ画像は`panels.image_asset_id`を残したまま`flattened_legacy`レイヤーへ自動移行し、背景・人物・小物・効果・tone・mask・correctionの分類、素材・生成Job参照、順序、表示、lock、opacity、blend mode、画像変形を保存できます。Undo、複製、バックアップ・旧形式復元に対応しています。Canvasでは画像の直接移動・等比拡縮・回転とfit・offset数値編集ができ、maskは下位合成結果へalphaを適用し、後続correctionは透明パッチとして重なります。PDF・連番PNG ZIPも同じ規則でローカル合成します。合成結果は内部PNGへ必要時だけ更新し、`panels.image_asset_id`を利用する従来経路にも互換表示を提供します。

低スペックRuntime Profile基盤を追加しました。起動時にRAM・GPU・専用VRAMを診断して安全なprofileを自動選択し、設定画面で確認・端末別上書きできます。GPU未検出でもDesktopは起動し、ローカル画像生成はMainプロセスで同時1件に制限します。

Runtime ProfileをComfyUI送信へ接続し、profile上限を超える解像度を縦横比維持で縮小、batchを1へ固定、ControlNet・LoRA過多をネットワーク送信前に拒否します。調整後の解像度は生成履歴と画面で確認できます。

12GB以下のprofileではCreator Chatと画像生成をMainプロセスで排他制御し、ComfyUI送信前にOllamaモデルを`keep_alive: 0`でGPUから解放します。16GB以上では限定的な同時利用を許可します。

ローカル画像生成の永続Queueを追加しました。実行中に追加した生成はSQLiteへ待機し、優先順位順に1件ずつ処理されます。待機・実行中Jobの一時停止、再開、キャンセル、優先順位変更と、アプリ再起動後の自動復元に対応します。バックグラウンド完了した素材は開いているProjectへ自動反映されます。

接続失敗・タイムアウト等の一時障害は同一Jobを最大3回まで指数バックオフで自動再試行します。試行回数と次回時刻はSQLiteへ保存され、再起動後も継続します。設定不備・不正workflow・route拒否は再試行しません。

端末別の夜間Queue時間帯を設定できます。時間外の生成はProvider通信なしで待機し、開始時刻に自動実行します。日跨ぎの時間帯と設定の再起動復元に対応し、既定は無効です。

選択中EpisodeのPrompt入力済みPageをページ順で画像生成Queueへ一括登録できます。空Promptは件数を表示してスキップし、夜間時間帯、自動再試行、一時停止・再開、優先順位、再起動復元を一括Jobにも適用します。

登録済みComfyUI workflowから`VAEDecodeTiled`を検出し、生成画面とAI一括診断へ低スペック適合状態を表示します。CPUオフロードはworkflow JSONではなくComfyUI起動環境の設定として分離し、実環境確認が必要であることを明示します。

AI一括診断は接続中ComfyUIからversion、GPU、VRAM、タイルVAEノード、`--cpu-vae`、VRAM mode、予約VRAMを取得できます。開発PCではComfyUIが未検出のため、実画像生成E2Eは保留です。

設定画面のAI接続診断を日英辞書へ移行しました。接続状態、workflow、低スペック適合、ComfyUI実行環境、Ollamaモデル、診断日時がlocaleへ連動し、診断領域には見出し参照、`aria-busy`、説明参照を設定しています。

診断データとプライバシー設定も日英辞書へ移行しました。ローカル詳細レポート同意と外部送信同意を別管理する安全条件を維持し、保存件数、未送信件数、最終送信日時、削除・手動送信の確認と状態通知がlocaleへ連動します。

AI Provider詳細と設定変更履歴も日英辞書へ移行しました。有効化、接続URL、許可origin、モデル・生成パラメータ、保存・接続確認・モデル更新、監査履歴の状態と変更フィールドがlocaleへ連動します。履歴へURLやモデル名の実値を保存しない仕様は維持しています。

プロンプトテンプレートと更新Controlも日英辞書へ移行しました。テンプレートの追加・編集・複製・削除、Stable/Betaチャンネル、更新確認・取得・進捗・再起動確認がlocaleへ連動します。保存済みテンプレート本文は利用者コンテンツとして自動翻訳しません。

設定画面の一般情報とRuntime Profile補足も日英辞書へ移行し、設定画面コンポーネント内の固定日本語を解消しました。データ保存先、AIログ方針、RAM/GPU/VRAM、推奨Profile、低スペック警告、端末設定保存結果がlocaleへ連動します。

Hub連携画面も日英辞書へ移行しました。公開・販売状態、device code認証、承認待ち、非公開下書きの差分と限定更新、安全なscope、コピー・更新の状態通知がlocaleへ連動します。公開・商品・価格・販売ファイル・決済を変更できない権限制限は維持しています。

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

2026-07-18に製品境界Phase 0を完了しました。Hub／Cloudは`general`だけを保存・公開・販売でき、Desktop Adultは`adult`をローカル専用既定で扱います。旧データの区分が不明な場合は`adult`へ倒し、成人向け販売パッケージとCloud保存をServer／RLSでも拒否します。

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

対象はProject名・表紙、Episode操作、Page操作、Page内容、素材削除、AI生成素材追加です。AIの外部実行と生成ジョブ記録は取り消さず、生成された素材だけをUndo/Redoします。書き出しとAI設定は外部副作用・端末共通設定として監査履歴に分離しています。

### 書き出し

- 本編PDF
- 本編画像ZIP
- 作品情報JSON
- 販売用説明文
- SNS告知文
- MANGAI販売パッケージZIP v1
- `export_history`への記録

JPG・PNG・WebPを共通Pageレンダラーで合成し、PDFと連番PNG ZIPへ収録します。使用中のWebPはSVG合成前にPNGへ正規化し、Sharp/librsvgでの欠落を防ぎます。

### Creator Chat・ローカルAI

- Ollama、ComfyUI、Mockプロバイダー
- AI設定、接続確認、モデル一覧
- localhost接続と、HTTPS完全一致origin許可リストによるリモート通信先制限
- URL credential・base path・query・fragment・HTTP redirectの拒否
- Ollamaモデル選択とComfyUIワークフローを含むAI接続一括診断
- Ollamaモデル一覧のSQLiteキャッシュとオフライン復元
- Creator Chatのストリーミング、停止、再生成、履歴復元
- Chat内のProject、Episode、Page切り替え
- 初期プロンプトテンプレート11種
- テンプレートの複製、カスタム版の追加・編集・削除
- ComfyUIワークフローJSON登録、編集、既定化、検証、接続テスト
- 生成ジョブ、失敗再実行、キャンセル、タイムアウト
- 生成段階の進捗表示
- 生成画像のProject素材への自動登録
- ローカル保存と分離した外部送信同意、未送信件数、手動送信・再送client
- HTTPS受付先、schema再検証、redirect拒否、SHA-256冪等ID（受付先は既定未設定）
- 日本語・英語locale基盤、ホーム・global navigation・header・statusの英語表示
- Project構成、Episode、Page、素材browser、Inspectorの英語表示
- Canvas toolbar、Page layout、object properties、ruby、layer操作の英語表示
- Creator Chatの専用画面・Canvas右パネル・履歴・テンプレート・送信操作の英語表示
- ComfyUI画像生成・ワークフロー管理・生成履歴・生成ジョブDrawerの英語表示
- 言語設定の再起動保持、HTML lang・日時locale連動
- 作品別ハイブリッド生成ポリシーのSQLite永続化、複製・バックアップ・復元
- 既存画像生成のローカル実行ゲート、理由・実行先・Prompt hashの監査履歴
- Project素材の分類・タグ・お気に入り・使用数表示・検索・Canvas再利用
- 背景・小物・効果のsafe Job入力、Asset Library route、候補選択
- safe JobのローカルComfyUI handoffと生成素材のLibrary自動分類

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
- installer・blockmap・更新metadataのversion、SHA-512、サイズ、Authenticode検証
- silent install、隔離データでの製品版起動、renderer・SQLite、silent uninstall E2E
- SPDX 2.3 SBOMと`SHA256SUMS.txt`の生成・改変検証

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
- AIのリモート通信はHTTPSかつ明示したoriginとの完全一致だけを許可
- Ollama・ComfyUI通信のHTTP redirectを拒否
- skip link、dialog focus trap・Escape・focus復帰、error alert
- reduced motionとWindows forced colors

### Hub

- Supabase RLS
- Service Role KeyとStripe Secret Keyはサーバー限定
- Stripe Webhook署名検証
- 非公開販売ファイルと期限付き署名URL

## 6. 検証済み

2026-07-16時点の直近確認:

| 対象                                    | 結果                          |
| --------------------------------------- | ----------------------------- |
| Desktop TypeScript                      | 成功                          |
| Desktop ESLint                          | 成功                          |
| Electron main / Vite本番ビルド          | 成功                          |
| Desktop統合テスト                       | 58/58成功                     |
| ai-core Router・外部送信・Runtimeテスト | 23/23成功                     |
| canvas-core単体テスト                   | 25/25成功                     |
| NSIS x64生成                            | 成功                          |
| 更新メタデータ付きNSIS生成              | 成功                          |
| NSIS install・製品版起動・uninstall E2E | 成功                          |
| Windows成果物・SBOM・checksum検証       | 成功                          |
| C→DドライブProject削除・退避E2E         | 成功                          |
| Canvas手動受け入れA〜D                  | 成功                          |
| JPG/PNG/WebP混在PDF・ZIP画素確認        | 成功                          |
| `latest.yml` / blockmap                 | 生成確認                      |
| 依存関係監査                            | 2026-07-15 Hub/Desktopとも0件 |
| Hub TypeScript / ESLint / Next.jsビルド | Desktop分離時の回帰確認で成功 |

実サービス依存のE2Eは未確認です。HTTP互換モックではOllama、ComfyUI、成功、失敗、タイムアウト、キャンセル、画像取得を確認しています。

## 7. 既知の制限・未完了

### 公開を止める要因

- Windowsコード署名証明書が未取得
- Git remote、公開リポジトリ、実公開先が未設定
- 自動更新の実公開サーバーE2Eが未実施
- 実Ollama・ComfyUI環境のE2Eが未実施
- Hub本番環境の決済・Webhook・ダウンロードE2Eが未実施

### 機能上の制限

- 素材削除とAI生成素材追加は実ファイルを含む永続Undo/Redoに対応済み。書き出しとAI設定は監査履歴に分離済み
- 漫画編集workspace、Creator Chat、画像生成、書き出し、設定、更新、Hub連携の英語表示は対応済み。既知main process messageの英語変換と未知日本語文面fallbackも対応済み。日英29画面・状態のaxe A・AA監査は違反0件で、Pageあり編集、各menu、生成3状態も監査済み。Narrator・高コントラスト・150%表示のWindows実機確認は未完了
- RC手動・外部受入れは構造化記録へ集約し、完了証拠、例外承認、blocked理由をCLIで検証可能。現時点では実サービス、コード署名、Windows実機項目が未完了
- 別ドライブのカスタム保存先は同じドライブの`.mangai-trash`へ退避（実DドライブE2E済み）
- 販売パッケージ経由の下書き作成、公開情報の匿名照会、認証済み端末からの非公開下書き照会を実装済み。Desktopからの更新操作は未実装
- 手動・自動Projectバックアップ、履歴込み復元、DB破損時リカバリー、ローカル構造化ログ、同意制の詳細クラッシュレポート、別同意の手動送信clientを実装済み。外部受付APIと運用方針は未設定

## 8. 推奨ロードマップ

### Phase 1: Desktop Release Candidate

目的: 既存機能を安全に配布・更新できる状態にする。

1. 実Ollama・ComfyUI E2Eと対応バージョン表
2. クリーンWindows環境で署名済みinstall、起動、更新、uninstall確認（ローカル自動E2Eは完了）
3. コード署名証明書取得と実署名
4. Git remote設定と最初の署名済みDraft Release
5. 自動・履歴込み完全バックアップ、DB破損時リカバリー（実装済み）
6. 別ドライブ保存先の削除・ゴミ箱動作確認（実装・実DドライブE2E済み）

完了条件:

- 新規PCでインストールから画像生成・書き出しまで完走
- 旧版から新版へ署名付き自動更新できる
- Projectをバックアップから復元できる
- 重大度High以上の既知脆弱性が0件

### Phase 2: 漫画制作機能の強化

目的: 「AI素材管理ツール」から「漫画編集ツール」へ進める。

1. 高度な禁則、ルビ、縦中横（基本禁則・半角2桁の自動縦中横・明示記法の縦横ルビまで実装済み）
2. 曲線・斜めコマなど高度なコマ形状（左右辺の曲線コマ、右上がり・右下がりの斜めコマまで実装済み）
3. Canvasツールバーの機能別メニュー化とアクセシビリティ改善（実装済み）
4. 1話単位のテンプレート・一括生成フロー（8・16ページの3構成と一括Undo/Redoを実装済み）

完了条件:

- Desktop内で1話分の基本レイアウトを完成できる
- JPG、PNG、WebP混在でもPDFが欠落しない
- Panel・テキスト編集をUndo/Redoできる

2026-07-14進捗: Canvas基盤、既定・テンプレート・ドラッグ式の矩形コマ作成、右上がり・右下がりの斜めコマ、左辺・右辺の曲線コマ、100pxグリッドとスナップ切替、素材の直接D&Dと画像配置、Canvas内画像編集専用モード、吹き出し、縦横テキスト、親子テキストの相対座標保存と追従、レイヤーD&D、6ページテンプレート、短編8ページ・標準16ページ・4コマ8ページの話テンプレート、Undo/Redo、JPG・PNG・WebP合成PDF/ZIPまで実装しました。話テンプレートは既存ページを保持したままEpisode末尾へ追加し、一括Undo/Redoできます。Canvasツールバーは「追加」「レイアウト」「表示」へ整理し、キーボード操作とフォーカス復帰に対応しています。縦書きは基本禁則・半角2桁縦中横、縦横テキストは明示記法ルビをCanvasと書き出しへ共通適用し、本文選択から追加・解除できます。ビルド・自動テスト・NSIS生成に成功し、手動受け入れA〜D、再起動復元、旧形式相当Page出力、混在素材の画素確認も完了しています。

### Phase 3: DesktopとHubの連携

目的: 制作完了から公開・販売までの二重入力を減らす。

1. Desktop販売パッケージ仕様の正式化（`mangai.sales-package` v1、SHA-256付きZIPを実装済み）
2. Hub側インポートAPIまたは手動インポート画面（ブラウザ内の安全検証・プレビュー画面を実装済み）
3. 作品情報、表紙、サンプル、商品ファイルの受け渡し（非公開作品・停止中商品の作成まで実装済み）
4. DesktopからHub公開状況を確認する読み取り連携（公開作品・販売中商品数の照会を実装済み）
5. 認証方式と端末認可（15分コード、90日scope、OS暗号化保存、Hubからの失効を実装済み）

完了条件:

- DesktopのProjectからHubの下書き作品を作成できる
- 秘密鍵をDesktopへ保存せず安全に認可できる
- 公開前に差分と対象ファイルを確認できる

2026-07-15進捗: Phase 3のコード実装は完了しました。販売パッケージによる確認・下書き作成、公開情報の匿名照会、本人承認の端末コード方式に加え、本人の非公開下書きの作品名・説明だけをDesktopから更新できる限定scopeを実装しました。差分確認、明示承認、楽観的ロックを備え、公開・商品・価格・ファイル・決済は変更できません。実Supabase環境での複数端末・期限切れ・失効・限定更新E2EとCDN層の多層防御設定はPhase 4で実施します。

### Phase 4: 本番運用・成長機能

目的: 継続運用と販売拡大に耐える基盤にする。

- Hub本番決済・返金・ダウンロードE2E（決済ポリシー・イベント10件の自動テスト、非同期失敗、状態遷移、キャンセル・ダウンロード認可まで実装済み。実Stripe E2Eは未実施）
- メール通知と運営通知
- クラッシュレポート、構造化ログ、利用者同意、別同意の手動送信client（受付API・保持期間・削除運用は未設定）
- stable / beta更新チャンネル（端末選択・永続化、GitHub prerelease、generic channel metadataまで実装済み）
- DBマイグレーション試験とロールバック（変更単位SQL、rollback guard、PostgreSQL 16往復CI、staging読み取り専用preflightを実装済み。実Supabase staging試験は未実施）
- アクセシビリティ、キーボード操作、多言語化
- グッズ会社API、配送、在庫連携

## 9. 次に決めるべきこと

| 判断項目        | 推奨                                   | 影響                                               |
| --------------- | -------------------------------------- | -------------------------------------------------- |
| 次の最優先      | Phase 1 Release Candidate              | 既存投資を安全に試用可能にする                     |
| 初回配布先      | GitHub Releases                        | 現在のBuilder・Actions構成をそのまま利用できる     |
| AI配布方式      | Ollama / ComfyUIは外部インストール継続 | インストーラー肥大化とモデルライセンス問題を避ける |
| Desktop-Hub連携 | 公開情報の読み取りから段階導入         | 秘密鍵なしで連携し、更新操作は端末認可後に追加する |
| Panel編集の範囲 | テンプレート＋矩形編集から開始         | 自由描画より短い経路で漫画編集価値を出せる         |

## 10. 推奨する次の実装単位

実装作業として次に着手するなら、以下の順を推奨します。

1. 実モデル用VAEタイルworkflowとCPU offload起動設定の8GB実機E2E
2. Provider選定後にcredential、費用見積、明示確認後の外部safe素材送信を接続
3. Supabase staging、Stripe、実Ollama・ComfyUI、署名付き更新のRC受入れ

コード署名証明書とGit remoteは外部準備が必要なため、並行して進めます。

## 11. 関連文書

- [実装履歴](IMPLEMENTATION_HISTORY.md)
- [残タスク一覧](REMAINING_TASKS.md)
- [現在のHub機能](IMPLEMENTED_FEATURES.md)
- [全体アーキテクチャ](architecture/OVERVIEW.md)
- [Desktop概要](desktop/README.md)
- [Creator Chat・ローカルAI](desktop/AI_CREATOR.md)
- [Undo / Redo](desktop/UNDO_REDO.md)
- [Windowsインストーラー](desktop/WINDOWS_INSTALLER.md)
- [自動更新・公開配布](desktop/AUTO_UPDATE.md)
- [診断ログとプライバシー](desktop/DIAGNOSTICS_PRIVACY.md)
- [Hub DBマイグレーション運用](hub/DATABASE_MIGRATIONS.md)
