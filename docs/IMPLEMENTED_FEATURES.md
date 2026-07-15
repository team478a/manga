# MANGAI Creator Platform 実装済み機能

最終確認日: 2026-07-15

この文書は、READMEの計画ではなく現在のソースコードを基準に、MVPで利用できる機能と制約を整理したものです。

## 1. システム概要

MANGAI Creator Platformは、AIクリエイターが作品を公開し、デジタル商品を販売し、グッズ化を運営へ申請するためのWebアプリケーションです。クラウド機能とは別に、外部販売サイトへ手動出品するファイル一式をPC上で作成するローカル機能も備えています。

### 技術構成

| 分類              | 採用技術                                    |
| ----------------- | ------------------------------------------- |
| Web               | Next.js 16 App Router、React 19、TypeScript |
| UI                | Tailwind CSS、Lucide React                  |
| 認証・DB・Storage | Supabase                                    |
| 決済              | Stripe Checkout、Stripe Webhook             |
| ローカル保存      | SQLite（better-sqlite3）                    |
| パッケージ生成    | JSZip、Node.js File System API              |
| 入力検証          | Zod                                         |

## 2. 利用者区分と権限

| 区分             | 主な権限                                                         |
| ---------------- | ---------------------------------------------------------------- |
| 未ログイン利用者 | 公開作品の閲覧・検索、販売中商品の購入、販売パッケージ画面の利用 |
| クリエイター     | プロフィール、自分の作品・商品・グッズ申請・売上の管理           |
| 管理者           | 全ユーザー・作品・商品・申請・注文の確認、グッズ申請の更新       |

- `/dashboard` と `/admin` はSupabase Authによるログイン保護があります。
- `/admin` は `profiles.role = 'admin'` のユーザーだけが利用できます。
- DBではRow Level Security（RLS）を有効化し、所有者・管理者・公開データごとにアクセスを制限しています。
- Service Role Keyはサーバー側の管理処理だけで使用します。

## 3. 認証・プロフィール

### 実装済み

- メールアドレスとパスワードによる新規登録
- ログイン、ログアウト
- 認証状態に応じたヘッダーナビゲーション
- 初回利用時のプロフィール作成
- 表示名と自己紹介の編集
- 未ログイン時の保護ページからログイン画面へのリダイレクト
- 一般ユーザーが管理画面へアクセスした場合のマイページへのリダイレクト

### 主な画面

- `/signup`
- `/login`
- `/dashboard`

## 4. 作品公開・検索

### クリエイター向け

- 作品の新規登録
- タイトル、説明、タグ、画像、公開設定の保存
- JPG、PNG、WebP画像のアップロード
- 登録済み作品の一覧表示
- 作品情報、公開状態、画像の編集
- 自分の作品だけを操作できる所有者制御

### 一般公開

- 公開作品のカード一覧
- 作品詳細ページ
- タイトル・説明を対象にしたキーワード検索
- タグによる絞り込み
- キーワードとタグの併用
- 検索結果件数と条件クリア
- 作品に紐づく販売中デジタル商品の表示

### 主な画面

- `/works`
- `/works/[id]`
- `/dashboard/works`
- `/dashboard/works/new`
- `/dashboard/works/[id]/edit`

## 5. デジタル商品

### 実装済み

- 自分の作品に紐づくデジタル商品の登録
- 商品名、説明、税込価格、販売状態の保存
- PDF、PNG、JPG、ZIPの販売ファイルアップロード
- 商品情報、販売状態、販売ファイルの編集
- 販売ファイルを非公開Storageに保存
- 販売中かつ公開作品に紐づく商品だけを購入画面へ表示

### 主な画面

- `/dashboard/products`
- `/dashboard/products/new`
- `/dashboard/products/[id]/edit`

## 6. Stripe決済・ダウンロード

### 購入フロー

1. 購入者がメールアドレスを入力します。
2. 金額、プラットフォーム手数料、クリエイター受取額を確定し、`pending` 注文を作成します。
3. Stripe Checkout Sessionを作成してStripeへ遷移します。
4. Stripe Webhookの署名を検証し、決済結果を注文へ反映します。
5. 成功画面でもStripe Sessionを再確認し、Webhook到着前後の取りこぼしを補完します。
6. Session内の注文ID・商品IDと支払済み注文が一致した場合だけ、非公開Storageから5分間有効な署名付きURLを発行します。

### 実装済みステータス処理

- 決済完了: `paid`
- 決済失敗: `failed`
- キャンセル: `canceled`
- 全額返金: `refunded`
- 同一Webhookの再送を考慮した冪等更新
- Stripe Payment Intent IDの注文への保存
- キャンセルURLの注文IDをHMACで認証し、改ざん時は注文を更新しない
- 購入者メールアドレスの小文字正規化と形式・長さ検証
- 本番の成功・キャンセルURLは設定済みHTTPS originだけを使用

### 金額計算

- プラットフォーム手数料: 商品価格の20%（切り捨て）
- クリエイター受取額: 商品価格 − プラットフォーム手数料
- 通貨: 日本円

### API・画面

- `/checkout/[productId]`
- `/checkout/success`
- `/checkout/cancel`
- `POST /api/checkout/create-session`
- `POST /api/stripe/webhook`

### Stripe側で購読するイベント

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `payment_intent.payment_failed`
- `charge.refunded`

## 7. 売上管理

### クリエイター向け

- 自分に紐づく注文一覧
- 購入者メールアドレス、金額、手数料、受取額、注文状態の表示
- クリエイター受取予定額の集計表示

### 管理者向け

- 全注文一覧
- 購入金額、手数料、クリエイター受取額、注文状態の表示
- 支払い済み注文を対象にした売上合計のダッシュボード表示

### 主な画面

- `/dashboard/sales`
- `/admin/orders`

## 8. グッズ販売申請

### クリエイター向け

- 自分の作品を指定したグッズ販売申請
- 希望商品タイプと申請メモの登録
- 自分の申請一覧と対応状態の確認

### 管理者向け

- 全申請の確認
- 申請状態と管理者メモの更新
- `pending`、`approved`、`rejected`、`in_progress`、`completed` の状態管理

### 主な画面

- `/dashboard/goods-requests`
- `/dashboard/goods-requests/new`
- `/admin/goods-requests`

## 9. 管理者機能

### ダッシュボード

- 登録ユーザー数
- 公開作品数
- デジタル商品数
- グッズ販売申請数
- 注文数
- 支払い済み注文の売上合計

### 管理画面

- ユーザー一覧とユーザー詳細
- ユーザーの表示名、権限、登録日
- Service Role Key設定時のメールアドレス表示
- 全作品の公開状態・作者・作成日の確認
- 全デジタル商品の作品・作者・価格・販売状態の確認
- 全注文の確認
- グッズ申請の状態更新

### 主な画面

- `/admin`
- `/admin/users`
- `/admin/users/[id]`
- `/admin/works`
- `/admin/products`
- `/admin/orders`
- `/admin/goods-requests`

## 10. ローカル販売パッケージ

Supabase未設定でも `/sales-packages` から利用できる、PCローカル専用の出品準備機能です。

### 実装済み

- プロジェクトID単位の販売情報保存
- タイトル、サブタイトル、ジャンル、タグ、対象年齢、価格メモ、販売予定サイトの管理
- 表紙とサムネイルのアップロード
- `Documents/MANGAI` 内にある生成済み画像の選択
- 許可されたローカル画像の取り込み
- キャッチコピー、説明文、短い紹介文、サムネイル文言、SNS告知文のテンプレート生成
- 成人向け選択時の注意書き自動追加
- 本編PDFと複数画像の登録
- SQLiteへの販売パッケージ、生成文、書き出し履歴の保存

「販売文案を作成」機能は、外部AI APIを呼ばないテンプレートベースの文章生成です。

### 書き出しファイル

- `本編PDF.pdf`
- `本編画像ZIP.zip`
- `表紙画像.*`
- `サムネイル画像.*`
- `販売用説明文.txt`
- `タグ一覧.txt`
- `SNS告知文.txt`
- `作品情報.json`

### ローカル保存先

- SQLite: `{Documents}\MANGAI\mangai_local.sqlite`
- 出力: `{Documents}\MANGAI\projects\{projectId}\sales_package\`

## 11. データベースとStorage

### Supabaseテーブル

| テーブル           | 用途                                   |
| ------------------ | -------------------------------------- |
| `profiles`         | 表示名、自己紹介、権限                 |
| `works`            | 作品、画像URL、タグ、公開状態          |
| `digital_products` | 販売ファイル、価格、販売状態           |
| `goods_requests`   | グッズ販売申請と管理者対応             |
| `orders`           | 購入者、金額内訳、Stripe情報、注文状態 |

### Storage bucket

| Bucket             | 公開範囲 | 用途・制限                                 |
| ------------------ | -------- | ------------------------------------------ |
| `works`            | Public   | 作品画像、最大10MB、JPG・PNG・WebP         |
| `digital-products` | Private  | 販売ファイル、最大50MB、PDF・PNG・JPG・ZIP |

## 12. 必要な環境変数

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- Supabase認証・通常操作にはURLとAnon Keyが必要です。
- 管理者メール表示、注文更新、署名付きURL発行にはService Role Keyが必要です。
- 決済にはStripe Secret KeyとWebhook Secretが必要です。
- 秘密鍵を `NEXT_PUBLIC_` 付きの環境変数へ設定してはいけません。

## 13. 現在の制約・未実装

- 購入者アカウントと購入履歴
- 有効期限後の購入者向け再ダウンロード導線
- 購入完了・申請更新などのメール通知
- 公開クリエイタープロフィールページ
- 作品・商品・ユーザーに対する管理者の削除・停止操作
- Stripe Connectによるクリエイターへの自動分配・振込
- 部分返金の独立した状態・金額管理
- 返金操作を開始する管理画面
- 印刷会社APIとのグッズ製造連携
- 外部AI APIを使った販売文生成
- ブラウザ操作を含むHub実サービスE2Eスイート
- Vercel、Supabase、Stripeの本番環境設定

### Desktop販売パッケージ確認

- 認証済み画面 `/dashboard/import-package`
- ZIPをサーバーへ送信しないブラウザ内検証
- `mangai.sales-package` v1の形式・version・role検証
- 危険な相対パス、manifest外ファイル、不足ファイルの拒否
- 250MBのZIP上限、500MBの展開後合計上限
- 全収録ファイルのサイズ・SHA-256照合
- 作品情報、表紙、サンプル、収録ファイル一覧のプレビュー
- 確認後の非公開作品下書きと停止中商品の一括作成
- 本編PDFまたは連番画像ZIPの商品ファイル選択
- サーバー側でのmanifest・サイズ・SHA-256・実ファイル形式の再検証
- Supabase Storageへの表紙、最大3サンプル、商品ファイル保存
- 途中失敗時の作品・Storageロールバック
- 販売パッケージの元Desktop Project IDを作品へ保存
- 公開済み作品と販売中商品数だけを返すDesktop向け匿名API
- Desktop「Hub連携」画面での公開・下書きステータス確認と差分表示
- Hubログイン中の本人が承認する8桁・15分のDesktop端末コード
- 90日・`works:read` / `works:write:draft`分離の端末トークンとHub端末管理・失効画面
- 認証済みDesktopから本人の非公開下書き・停止中商品数を確認
- 本人の非公開下書きに限った作品名・説明の確認付き更新と競合防止
- DesktopトークンのOS暗号化保存とrendererからの分離
- IPをHMAC化した端末認証開始rate limit（15分あたりIP 10回・全体300回）
- 期限切れ・失効済み端末認証と古いrate limit行の自動清掃

## 14. 実装状況の確認

2026-07-15時点で、TypeScript型チェック、ESLint、Next.js本番ビルド、Hub決済ポリシー・イベントテスト10/10は成功しています。Stripe決済とDesktop-Hub連携の実サービスE2Eには、Stripeテスト環境、Webhook、Supabaseの実値設定が別途必要です。

## 15. Desktop漫画編集Canvas

- 矩形コマ、素材画像クリッピングと画像配置調整
- 楕円・角丸・ナレーション吹き出しと8方向のしっぽ
- 縦書き・横書き、自由テキスト、親Balloon設定
- 統合レイヤー、表示、ロック、z-index、6種類のテンプレート
- ドラッグ式コマ作成、100pxグリッド、グリッド吸着、スナップ切替
- Canvas内画像編集モード、直接移動、四隅拡縮、回転、中央リセット
- 吹き出し内テキストの親基準相対座標保存、旧Page座標からの自動移行
- 単一・複数選択、移動、複製、削除、キーボード操作
- レイヤーD&D並び替え、前面／背面移動、連続z-index正規化
- 30オブジェクトPageの性能確認（製品版実操作、保存・移動・再読込スモークテスト）
- SQLite永続化、Canvasスナップショットv2、Undo/Redo
- 素材ファイル、Canvas内容、表紙と全参照を新IDで保持するProject完全複製
- JPG・PNG・WebP合成、DPI準拠PDF、連番PNG ZIP
- 使用中WebPのPNG正規化による、PDF・ZIP合成時の画像欠落防止
- 書き出し進捗、キャンセル、ページ別エラー
- Project設定・Canvas・素材をまとめる`.mangai-backup`と新IDでの安全な復元
- 素材・情報・Canvasレイヤーパネルの個別開閉、状態保持、狭幅時のCanvas優先表示
- ダークテーマのデザイントークン、固定ヘッダー、左端グローバルナビ、Project・Inspector分離、下部ステータスバー
- 左パネルの構成・素材タブ、選択タブ保持、素材名検索、形式フィルター、使用中素材表示
- 右パネルのプロパティ・レイヤー・AIタブ、選択タブ保持、Canvas選択設定のPortal統合
- Canvasを見ながら利用できるCreator Chat、履歴、テンプレート、再生成、Pageメモ保存
- Creator Chat専用画面・右パネルの日英表示、明示的な履歴選択button、操作別アクセシブルラベル
- 下部ステータスのOllama・ComfyUI接続要約、手動更新、Project別生成ジョブ件数
- 制作画面上の生成ジョブDrawer、直近履歴、進捗、失敗内容、キャンセル
- ComfyUI画像生成・ワークフロー管理・履歴・ジョブDrawerの日英表示とlocale準拠日時
- ハイブリッド生成のJob Type・Sensitivity・Execution Target・作品ポリシー型とfail-closedな純粋Router
- `safe_assets_only`既定の作品別外部送信ポリシー、費用上限、custom Job Typeの永続化・複製・バックアップ復元
- loopbackのローカルComfyUIだけを実行するRouterゲートと、Prompt本文を残さないroute監査履歴
- 生成履歴での実行先・Sensitivity・判定理由・拒否状態の日英表示
- Project素材の背景・小物・効果・人物分類、タグ、お気に入り、使用数表示
- 素材名・タグ・形式・分類・お気に入りによるAsset Library検索とCanvas再利用
- 背景・小物・効果のsafe Job検索と、Asset Library優先route・候補選択
- Library不一致時のlocal fallback、ローカル生成先なしのblocked判定
- safe Job条件のローカルComfyUI handoffと生成素材の分類・タグ自動登録
- 外部safe素材Providerの無効既定interface、Promptだけを対象とする送信manifest、費用・利用条件の事前プレビュー、3項目の明示確認契約
- 背景・人物・小物・効果・tone・mask・correctionを保持する`panel_layers`永続基盤、従来統合画像の自動移行、Undo・複製・バックアップ復元
- PanelレイヤーのCanvas表示、素材追加・差し替え、表示・lock・順序・opacity・blend mode編集、コマ形状内のPDF・連番PNG ZIPローカル合成
- Panelレイヤー画像のCanvas直接移動・等比拡縮・回転、fit・倍率・offset・回転の数値編集とリセット
- Panel maskのalpha逐次合成、correction透明パッチ、Canvas隔離cache、PDF・連番PNG ZIPでの同一合成
- PDF・連番画像ZIP・販売パッケージの確認、進捗、成功、警告、失敗、再実行ダイアログ
- 1365px以下の右Inspectorオーバーレイ、背景・Escape終了、狭幅ステータス省略
- ダイアログと生成Drawerの初期フォーカス、Tab循環、Escape終了、フォーカス復帰
- 秘密値除外・5MB/3世代ローテーション付きローカルJSONLログ
- 明示同意後だけ保存する最大20件の詳細クラッシュレポートと削除UI
- ローカル保存と別の明示同意、送信前確認、HTTPS限定、失敗再送に対応する外部送信client
- 日本語・英語locale基盤、主要shell翻訳、言語・日時localeの再起動保持
- skip link、keyboard操作可能なProject一覧、dialog focus管理、reduced motion・forced colors
- Project構成・Episode・Page・素材browser・Inspectorの英語表示とPage選択button
- Canvas toolbar・layout・コマ・吹き出し・テキスト・ルビ・layer操作の英語表示
- Creator Chatの履歴・テンプレート・文脈・送信状態・エラー・AI設定導線の英語表示
- 画像生成条件・ワークフロー操作・状態名・履歴操作・接続状態の英語表示
- main、renderer、child process異常の捕捉。外部自動送信なし

操作と制限は [`desktop/MANGA_EDITOR.md`](desktop/MANGA_EDITOR.md)、33条件の判定は [`desktop/MANGA_EDITOR_IMPLEMENTATION_STATUS.md`](desktop/MANGA_EDITOR_IMPLEMENTATION_STATUS.md) を参照してください。

## 16. 配布候補版の品質ゲート

- `rc:preflight`: 外部接続設定を秘密値なしで`configured`、`missing`、`placeholder`に分類
- `rc:preflight:strict`: Hub / Supabase、Stripe、端末認証、staging DBの不足を終了コードで検出
- `rc:validate`: Desktop・Hub・Supabase migrationの型検査、Lint、テスト、本番buildを一括実行
- `rc:windows-artifacts`: Windows installer、blockmap、更新metadataのversion・サイズ・SHA-512とAuthenticode状態を検証
- `rc:windows-installer-e2e`: 既存インストールを保護しながらNSISのinstall、隔離データでの製品版起動、SQLite・renderer、shortcut、登録、uninstall、残存物を検証
- `rc:windows-evidence`: SPDX 2.3 SBOMと配布成果物のSHA-256一覧を生成し、既存証跡の改変・欠落を再検証
- Ollama、ComfyUI、複数Page書き出し、Hub staging、Stripeテスト決済を分離した手動E2Eチェックリスト

判定方法は[`desktop/RELEASE_CANDIDATE_ACCEPTANCE.md`](desktop/RELEASE_CANDIDATE_ACCEPTANCE.md)を参照してください。
