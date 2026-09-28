# Marketplace Production限定販売 readiness preflight

作成日: 2026-09-28
対象: 一般向けMarketplaceのProduction限定販売準備

## 結論

隔離Stagingでは、テスト購入、購入履歴、署名download、売上除外、改ざんcancel拒否、署名URL失効、決済失敗、全額返金まで完了した。次の段階として、Productionの設定を変更せず、live販売を開始できる条件だけを秘密値非表示で判定するpreflightを追加した。

現行Productionは販売開始前の安全な状態を維持している。`NEXT_PUBLIC_SITE_URL`だけがREADYで、Production限定scope、Supabase identity、live checkout mode、Stripe live資格情報はPENDINGである。したがって本PRでは販売を有効化しない。

## 追加した判定

| 判定 | 条件 |
| --- | --- |
| Production-only Vercel scope | Supabase、site URL、checkout mode、Stripe、cancel secretがProductionだけに割り当てられている |
| Production Supabase identity | HTTPSの正規Supabase URL、anon／service-role分離、Staging marker不在 |
| Production checkout origin | `https://app.mang-ai.com`のorigin完全一致 |
| Marketplace live checkout mode | `MANGAI_MARKETPLACE_CHECKOUT_MODE=live` |
| Stripe live credentials | `sk_live_`、`whsec_`、独立した16文字以上のcancel secret |

設定値、秘密値、Project refは結果へ含めない。通常のVercel pullでSensitive値を取得できない場合は、`vercel env run`でprocessへ一時注入するか、repository外の絶対パスに置いた候補envを検証する。

## コマンド

```powershell
npm run marketplace:production:preflight
vercel.cmd env run -e production -- npm.cmd run marketplace:production:preflight:injected
npm run marketplace:production:candidate:validate -- "C:\secure\marketplace-production.env"
```

候補envはrepository内、相対パス、不存在を接続前に拒否する。通常preflightはPENDINGでも診断用に終了でき、strict／candidate検証は全項目READYでなければ失敗する。

## 実環境のread-only結果

- `Production checkout origin`: READY。
- `Production-only Vercel scope`: PENDING。Marketplace live mode／Stripe live変数がProductionに未設定。
- `Production Supabase identity`: PENDING。3変数のProduction限定metadataは存在するがSensitive値をCLIで取得できず、正確な接続先照合は未完了。
- `Marketplace live checkout mode`: PENDING。
- `Stripe live credentials`: PENDING。

preflight実行中にProduction環境変数、Supabase、Stripe、注文、決済、Provider、生成Job、credit、利用者データは変更していない。

## 販売開始前に残る外部判断

1. Stripe liveアカウント、入金先、特商法・利用規約・返金方針・税務運用を責任者が確定する。
2. Production migration適用状態は照合・適用・postflight済み。`payment_mode`境界とlive重複購入防止indexが有効で、重複0件を確認した。
3. live webhook endpointと購読eventをread-only照合する。
4. Production専用のlive資格情報を候補preflightへ通す。
5. 別の明示承認後だけVercel Productionへ設定し、1商品・少額・限定購入者でcanary販売する。

本PRは上記の設定、live endpoint作成、商品公開、購入、決済、返金を実行しない。
