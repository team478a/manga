# Marketplace Production canary対象 read-only preflight

作成日: 2026-09-28
対象: 一般向けMarketplaceのProduction 1件canary候補

## 結論

承認fingerprintを持つ固定canary計画について、対象商品・作品・売り手・買い手・既存注文をProductionで変更なしに照合するpreflightを追加した。

実際の計画には商品・売り手・買い手の確定が必要であり、現時点では外部実行していない。Productionの環境変数、DB、Storage、Stripe、商品、注文、決済、返金は変更していない。

## 判定

| 項目 | 条件 |
| --- | --- |
| 接続先 | Hosted Production Supabase、正規site origin、Staging markerなし、checkout `disabled`または`live` |
| 商品 | 計画IDと完全一致、計画売り手所有、`active`、計画JPY価格、file pathあり |
| 作品 | 売り手所有、`published`、公開、一般向け、Cloud由来なら完成版固定済み |
| 参加者 | 計画した売り手と買い手のProfileが存在し、売り手はcreatorまたはadmin |
| 重複防止 | 同じ商品・売り手・買い手の`pending`／`paid` live注文が0件 |

## データ最小化

- HTTP methodはGETだけ。
- 商品名、作品名、氏名、メール、Payment Intentをselectしない。
- 販売ファイル本体をdownloadしない。
- 結果へ商品・参加者ID、file path、Supabase URL、秘密値を含めない。
- Stripe APIへ接続しない。

## コマンド

```powershell
npm run marketplace:production:canary-plan:validate -- "C:\secure\marketplace-canary.json"
vercel.cmd env run -e production -- npm.cmd run marketplace:production:canary-target:preflight -- "C:\secure\marketplace-canary.json"
```

計画不合格時はProductionへ接続する前に停止する。対象照合がPENDINGなら、商品公開や購入へ進まない。

## 現在位置

- ローカルの合成応答による集中テストは17/17成功。
- 実Production照合は、責任者が商品・売り手・買い手・金額を確定し、repository外計画を作成した後に行う。
- live設定、商品状態変更、実購入、返金は別の明示承認単位であり、本preflightは実行しない。
