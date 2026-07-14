# MANGAI

このリポジトリは、漫画制作を行う **MANGAI Desktop** と、作品公開・販売を行う **MANGAI Hub** を段階的に分離しています。既存のルートNext.jsアプリはMANGAI Hubとして維持しています。

- Desktop: [`apps/desktop`](apps/desktop)、起動方法は [`docs/desktop/README.md`](docs/desktop/README.md)
- Hub: ルートNext.jsアプリ、詳細は [`docs/hub/README.md`](docs/hub/README.md)
- 全体構成: [`docs/architecture/OVERVIEW.md`](docs/architecture/OVERVIEW.md)
- ここまでの実装記録・引き継ぎ: [`docs/IMPLEMENTATION_HISTORY.md`](docs/IMPLEMENTATION_HISTORY.md)
- 現在の実装状況と今後のロードマップ: [`docs/PROJECT_STATUS_AND_ROADMAP.md`](docs/PROJECT_STATUS_AND_ROADMAP.md)

現在のコードを基準にした詳細な機能一覧は [`docs/IMPLEMENTED_FEATURES.md`](docs/IMPLEMENTED_FEATURES.md) を参照してください。

## 実装済み

- Next.js App Router / TypeScript / Tailwind CSS
- Supabase Auth による登録・ログイン・ログアウト
- `/dashboard` と `/admin` 配下の未ログインアクセス制限
- 共通ヘッダーとクリエイター向けカード型マイページ
- クリエイターマイページ
- 作品アップロード、編集、公開一覧、詳細ページ
- デジタル商品登録
- グッズ販売申請
- 売上管理画面
- ユーザー、作品、商品、注文、グッズ申請の管理画面
- ローカル版の販売用パッケージ作成
- Desktop販売パッケージv1のブラウザ内検証・プレビュー
- Desktop販売パッケージから非公開作品・停止中商品を作成
- DesktopからHubの公開作品・販売中商品数を読み取り専用で確認
- Hub本人承認によるDesktop端末認証と非公開下書きの読み取り
- Desktopのローカル構造化ログと同意制クラッシュレポート
- Supabase PostgreSQL スキーマとRLS
- Stripe Checkout、Webhook、購入後期限付きダウンロード

## ファイル構成

```txt
src/
  app/
    login/ signup/
    dashboard/
      works/ products/ sales/ goods-requests/
    works/
    sales-packages/
    admin/
    api/stripe/checkout/
  components/
  lib/
supabase/schema.sql
```

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` に以下を設定してください。

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DESKTOP_AUTH_RATE_LIMIT_SECRET=replace-with-at-least-32-random-bytes
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

認証だけを確認する段階では、まず以下の3つがあれば動作確認できます。

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Supabase設定

1. Supabaseで新規プロジェクトを作成します。
2. SQL Editorで `supabase/schema.sql` を実行します。
3. Authentication のメールログインを有効にします。
4. Storageに `works` と `digital-products` が作成されていることを確認します。
5. 管理者ユーザーにする場合は、対象プロフィールの `role` を `admin` に変更します。

開発中に新規登録後すぐマイページへ進みたい場合は、SupabaseのAuthentication設定でメール確認を一時的に無効にしてください。メール確認を有効にする場合は、確認メールを開いたあとにログインしてください。

## 認証まわりの確認手順

1. `.env.local` にSupabaseの値を設定します。
2. `npm run dev` を実行します。
3. `/signup` で新規登録します。
4. 登録後またはログイン後に `/dashboard` が表示されることを確認します。
5. ログアウト後に `/dashboard` へアクセスし、`/login` へ戻されることを確認します。
6. ヘッダーに「MANGAI Creator」「作品を探す」「ログイン」「新規登録」「ログアウト」が状態に応じて表示されることを確認します。

## 作品アップロード用Storage設定

`supabase/schema.sql` を実行すると、作品画像用のStorage bucket `works` が作成されます。

- bucket名: `works`
- 公開設定: public
- 対応形式: JPG、PNG、WebP
- ファイルサイズ上限: 10MB

Supabase管理画面で手動作成する場合は、Storageから `works` bucketを作成し、Public bucketとして保存してください。あわせてSQL Editorで `supabase/schema.sql` のStorage policy部分を実行してください。

## 作品アップロードの確認手順

1. `.env.local` にSupabaseの値を設定します。
2. Supabase SQL Editorで `supabase/schema.sql` を実行します。
3. `npm run dev` を実行します。
4. `/signup` または `/login` でログインします。
5. `/dashboard/works/new` で作品タイトル、説明、タグ、画像、公開設定を入力して保存します。
6. `/dashboard/works` に自分の作品だけが表示されることを確認します。
7. 「編集する」から `/dashboard/works/[id]/edit` を開き、内容や公開設定、画像差し替えを保存できることを確認します。

## デジタル商品登録用Storage設定

`supabase/schema.sql` を実行すると、販売ファイル用のStorage bucket `digital-products` が作成されます。

- bucket名: `digital-products`
- 公開設定: private
- 対応形式: PDF、PNG、JPG、ZIP
- ファイルサイズ上限: 50MB

販売ファイルは公開URLではなく、Storage内のパスとして `digital_products.file_url` に保存します。購入後ダウンロード機能を実装する段階で、購入者だけに署名付きURLを発行する設計です。

## デジタル商品登録の確認手順

1. `.env.local` にSupabaseの値を設定します。
2. Supabase SQL Editorで `supabase/schema.sql` を実行します。
3. `/signup` または `/login` でログインします。
4. 先に `/dashboard/works/new` から作品を1つ登録します。
5. `/dashboard/products/new` で作品、商品名、説明、税込価格、販売ファイル、販売状態を入力して保存します。
6. `/dashboard/products` に自分の商品だけが表示されることを確認します。
7. 「編集する」から `/dashboard/products/[id]/edit` を開き、商品名、説明、価格、販売状態、ファイル差し替えを保存できることを確認します。

## デジタル商品の購入確認手順

Stripe Checkoutへの遷移、Webhookによる決済状態反映、決済確認後の期限付きダウンロードURL発行まで実装しています。

1. `.env.local` にSupabaseの値を設定します。
2. Supabase SQL Editorで `supabase/schema.sql` を実行します。
3. クリエイターでログインし、公開状態の作品を作成します。
4. `/dashboard/products/new` で、その作品に紐づくデジタル商品を「販売中」で登録します。
5. `/works/[id]` を開き、販売中の商品が表示されることを確認します。
6. 商品の「購入ボタン」から `/checkout/[productId]` に進みます。
7. 購入者メールアドレスを入力し、「購入へ進む」を押します。
8. Stripe Checkoutへ遷移することを確認します。
9. `orders` テーブルに `pending` の仮注文が作成され、`amount`、`platform_fee`、`creator_revenue` が保存されることを確認します。
10. Stripe画面でキャンセルすると `/checkout/cancel?order_id=...` に戻り、注文が `canceled` になることを確認します。
11. テスト決済を完了し、Webhookまたは成功画面の再確認で注文が`paid`になることを確認します。
12. 決済済み注文だけに期限付きダウンロードURLが発行されることを確認します。
13. 商品を「停止中」に変更した場合、購入準備できないことを確認します。

手数料計算:

- `platform_fee = amount * 20%`
- `creator_revenue = amount - platform_fee`
- 金額は整数円で保存します。

## グッズ販売申請の確認手順

1. `.env.local` にSupabaseの値を設定します。
2. Supabase SQL Editorで `supabase/schema.sql` を実行します。
3. `/signup` または `/login` でクリエイターとしてログインします。
4. 先に `/dashboard/works/new` から作品を1つ登録します。
5. `/dashboard/goods-requests/new` で作品と希望商品タイプを選び、申請メモを書いて送信します。
6. `/dashboard/goods-requests` に自分の申請だけが表示されることを確認します。
7. 管理者ユーザーでログインし、`/admin/goods-requests` を開きます。
8. 全クリエイターの申請が表示され、状態と管理者メモを更新できることを確認します。

グッズ販売申請は、初期段階では印刷会社API連携やグッズ決済を行いません。運営が申請内容を確認し、手動で対応する前提です。

## 管理者設定と確認手順

管理者画面は `profiles.role` が `admin` のユーザーだけ閲覧できます。一般クリエイターが `/admin` にアクセスした場合は `/dashboard` に戻され、未ログインの場合は `/login` に戻されます。

管理者にするSQL:

```sql
update public.profiles
set role = 'admin'
where user_id = '対象ユーザーのauth.users.id';
```

メールアドレスを管理画面に表示するには、`.env.local` に `SUPABASE_SERVICE_ROLE_KEY` を設定してください。このキーはサーバー側だけで使用し、ブラウザには公開しません。

確認手順:

1. `.env.local` にSupabaseの値を設定します。
2. Supabase SQL Editorで `supabase/schema.sql` を実行します。
3. 管理者にしたいユーザーで一度ログインし、`profiles` が作成されたことを確認します。
4. 上記SQLで対象ユーザーの `role` を `admin` にします。
5. 管理者ユーザーで `/admin` を開き、登録ユーザー数、公開作品数、デジタル商品数、グッズ販売申請数、注文数、売上合計（仮）が表示されることを確認します。
6. `/admin/users` でユーザー一覧、`/admin/works` で全作品、`/admin/products` で全デジタル商品が見られることを確認します。
7. 一般クリエイターで `/admin` にアクセスし、`/dashboard` に戻されることを確認します。

## ローカル版: 販売用パッケージ作成

`/sales-packages` から、販売サイトへ手動出品するためのファイル一式を作成できます。Supabase未設定でもローカル機能として利用できます。

保存先:

```txt
{Documents}\MANGAI\projects\{projectId}\sales_package\
```

ローカルSQLite:

```txt
{Documents}\MANGAI\mangai_local.sqlite
```

保存される情報:

- 販売パッケージ情報
- AI生成した販売文
- 表紙画像パス
- サムネイル画像パス
- 書き出し履歴
- 作成日時

書き出し内容:

- `本編PDF.pdf`
- `本編画像ZIP.zip`
- `表紙画像.*`
- `サムネイル画像.*`
- `販売用説明文.txt`
- `タグ一覧.txt`
- `SNS告知文.txt`
- `作品情報.json`

使い方:

1. `npm run dev` を実行します。
2. `/sales-packages` を開きます。
3. プロジェクトID、作品タイトル、販売文、タグ、対象年齢などを入力します。
4. 必要に応じて「販売文案を作成」を押します。
5. 表紙画像、サムネイル画像、本編PDF、本編画像を登録します。
6. 「販売用ファイルを書き出す」を押します。
7. `Documents/MANGAI/projects/{projectId}/sales_package/` に出力されたファイルを販売サイトへ手動で登録します。

対象年齢を「成人向け」にした場合、注意書きに以下が自動追加されます。

- 18歳未満閲覧禁止
- 登場人物はすべて成人であること
- 実在人物ではないこと
- 違法コンテンツを含まないこと

## 権限設計

- 公開作品は誰でも閲覧できます。
- クリエイターは自分の作品、商品、申請、売上のみ操作できます。
- 管理者は全データを確認できます。
- RLSは `supabase/schema.sql` で有効化済みです。

## Stripe決済について

`/api/checkout/create-session` でStripe Checkout Sessionを作成します。Stripeはテストモード前提です。

必要な環境変数:

```env
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Stripeテスト環境の設定:

1. Stripeダッシュボードでテストモードを有効にします。
2. Developers > API keys から Secret key をコピーします。
3. `.env.local` の `STRIPE_SECRET_KEY` に `sk_test_...` を設定します。
4. ローカル確認では `NEXT_PUBLIC_SITE_URL=http://localhost:3000` を設定します。
5. Stripe Checkoutではテストカード `4242 4242 4242 4242` を使えます。

今回実装済み:

- 仮注文作成
- Stripe Checkout Session作成
- `success_url`: `/checkout/success?session_id={CHECKOUT_SESSION_ID}`
- `cancel_url`: `/checkout/cancel?order_id=xxx`
- metadataに `order_id`、`product_id`、`creator_id` を設定
- キャンセル時に注文ステータスを `canceled` に更新
- Webhook署名検証と冪等な注文更新
- `paid`、`failed`、`refunded`の状態反映
- 購入者への期限付きダウンロードURL発行

## 今後の実装計画

Desktop Release Candidate、漫画編集機能、DesktopとHubの連携、本番運用の順に整理しています。詳細は [`docs/PROJECT_STATUS_AND_ROADMAP.md`](docs/PROJECT_STATUS_AND_ROADMAP.md) を参照してください。

## Supabaseスキーマ変更

新規環境は`supabase/schema.sql`、既存環境は`supabase/migrations`の順序付きSQLを使用します。forward/rollbackの整合性は次のコマンドで確認できます。

```powershell
npm run db:migrations:validate
```

適用・rollback・PostgreSQL CIの詳細は[`docs/hub/DATABASE_MIGRATIONS.md`](docs/hub/DATABASE_MIGRATIONS.md)を参照してください。
