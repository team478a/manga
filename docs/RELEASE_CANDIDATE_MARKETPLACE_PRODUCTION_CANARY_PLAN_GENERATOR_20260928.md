# Marketplace Production canary計画generator

作成日: 2026-09-28
対象: 一般向けMarketplace Production 1件canary
状態: offline generator実装済み／live販売無効

## 目的

固定済みのcanary計画を手入力で組み立てる工程をなくし、schema、時刻、保存先、上書きの誤りをProduction接続前に防ぐ。

## 入力

- repository外の未作成JSON絶対path
- 商品UUID
- 売り手Profile UUID
- 購入者Profile UUID
- 50〜1,000円の整数金額
- 1〜24時間の整数期間

氏名、メール、カード情報、API key、秘密値、自由記述は入力しない。

## コマンド

```powershell
npm run marketplace:production:canary-plan:create -- `
  --output "C:\secure\marketplace-canary.json" `
  --product-id "<product UUID>" `
  --seller-profile-id "<seller profile UUID>" `
  --buyer-profile-id "<buyer profile UUID>" `
  --amount-jpy "100" `
  --duration-hours "12"
```

## 安全境界

- 出力は絶対path、repository外、`.json`、未作成ファイルだけを許可する。
- 排他的作成を使い、検査後から書込までに同名ファイルが作成された場合も上書きしない。
- 固定schemaを作成し、既存validatorの合格後だけ保存する。
- 売り手と購入者が同一なら停止する。
- target IDと出力pathを標準出力へ表示しない。
- Vercel、Supabase、Stripeへ接続せず、環境変数、商品、注文、決済を変更しない。

## 検証

- 集中テスト: 18/18成功
- Hub: 1107/1107成功
- dependency boundaries: error 0、既知warning 2件
- lint: 成功
- Hub／Desktop typecheck: 成功
- packages／Next.js Webpack Production build: 成功
- migration validator: 88/88成功
- RC Repository structure: READY
- `git diff --check`: 成功
- 正常な12時間・100円計画の生成とfingerprintを確認
- 不足・未知・重複optionを拒否
- 不正UUID、本人購入、不正金額、不正期間を拒否
- repository内、相対path、既存ファイルを拒否
- 新規保存後の再書込を拒否

Production、Vercel環境変数、Supabase、Stripe、商品、作品、注文、決済、返金、Provider、生成Job、credit、利用者データは変更していない。
