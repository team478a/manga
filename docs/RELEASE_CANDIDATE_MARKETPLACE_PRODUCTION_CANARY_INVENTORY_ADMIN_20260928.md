# Marketplace Production canary候補管理画面

作成日: 2026-09-28
対象: 一般向けMarketplace Production 1件canary候補
状態: 管理者向け件数監査実装済み／ローカル検証完了／live販売無効

## 目的

Vercel Sensitiveとして登録されたProduction Supabase資格情報をoperator端末やチャットへ取り出さず、Production runtime内で候補商品と販売者の有無を確認する。

## 画面

- URL: `/admin/marketplace-canary`
- `requireAdmin()`を通過した管理者だけが表示できる。
- `VERCEL_ENV=production`かつ`NEXT_PUBLIC_SITE_URL=https://app.mang-ai.com`の場合だけDBを読む。
- Preview、local、誤origin、DB読取り失敗では件数を表示せず安全側に停止する。
- 表示する集計は確認したactive商品数、候補商品数、候補販売者数だけである。

## 判定条件

- active商品は最大100件。101件以上は部分集計をREADYにしない。
- 価格は50〜1,000円の整数。
- 販売fileが登録済み。
- 作品は公開、published、一般向けで、商品と同じ販売者に属する。
- Cloud由来作品はcurrent publicationが固定済み。
- 販売者roleはcreatorまたはadmin。

条件は前段CLIと同じ共有domain判定を使用する。

## データ最小化と安全境界

- 商品名、作品名、氏名、表示名、メールをselectしない。
- IDとfile pathは判定にのみ使用し、画面またはreportへ含めない。
- DBはselectだけで、insert、update、delete、upsertを行わない。
- Storage file、注文、Payment Intentを取得しない。
- Stripe APIへ接続しない。
- 販売開始、環境更新、決済、返金を行わない。
- 成人向けDesktopとCloud AI生成は対象外。

## 次工程

候補件数が1件以上でも、対象商品・販売者・購入者の確定、計画作成、Production live設定、実決済は自動で行わない。それぞれ既存runbookに従う別の明示承認単位とする。

## 検証

- 集中テスト: 12/12成功
- Hub test: 1119/1119成功
- lint、full typecheck: 成功
- 依存境界: error 0、既知warning 2
- packages build、Webpack Production build: 成功
- migration検証: 88/88成功
- RC preflight: repository structure READY

Production、Vercel環境変数、Supabaseデータ、Stripe、商品、作品、注文、決済、返金、Provider、生成Job、credit、利用者データは変更していない。
