# Marketplace Production canary候補inventory

作成日: 2026-09-28
対象: 一般向けMarketplace Production 1件canary候補
状態: GET専用inventory実装済み／ローカル検証完了／外部資格情報注入PENDING／live販売無効

## 目的

商品・売り手・買い手を確定する前に、Productionへcanary条件を満たし得る販売商品と売り手が存在するかを、個人情報と内部IDを出さず件数だけで確認する。

## READY条件

- active商品の総数が1回の監査上限100件以内である。
- 価格が50〜1,000円の整数である。
- 販売file pathが存在するが、ファイル本体は取得しない。
- 紐づく作品が公開、published、一般向けで、商品と同じ売り手に属する。
- Cloud由来作品はcurrent publicationが固定済みである。
- 売り手Profileのroleがcreatorまたはadminである。

## コマンド

```powershell
vercel.cmd env run -e production -- npm.cmd run marketplace:production:canary-inventory
```

Sensitive値をCLIへ注入できない場合だけ、repository外候補envを明示する。

```powershell
npm run marketplace:production:canary-inventory -- --candidate "C:\secure\marketplace-production.env"
```

## データ最小化

- HTTP methodはGETだけ。
- 商品・作品・売り手の名称、氏名、メールをselectしない。
- IDとfile pathは判定にのみ使い、reportへ含めない。
- Storage file、注文、Payment Intentを取得しない。
- Stripe APIへ接続しない。
- 結果は確認したactive商品数、候補商品数、候補売り手数だけとする。

## 現在の外部結果

`vercel env run -e production`では、Production-only Sensitiveとして登録済みのSupabase 3変数がprocessへ値として注入されず、`NEXT_PUBLIC_SUPABASE_URL`欠落を接続前に検出して停止した。metadataのキー名・型・scopeだけを再確認し、値は表示していない。

したがって候補件数は未確定であり、ローカル合成テストをProduction inventoryの代替にはしない。

## 検証

- 集中テスト: 19/19成功
- Hub test: 1112/1112成功
- 依存境界: error 0、既知warning 2
- lint、full typecheck: 成功
- packages build、Webpack Production build: 成功
- migration検証: 88/88成功
- RC preflight: repository structure READY
- 一般向け公開作品、少額、file、適格売り手の正常集計
- 価格、file、作品区分、売り手role不一致の除外
- Cloud publication未固定の除外
- 100件超の部分集計拒否
- requestとreportへの個人情報・ID非混入

Production、Vercel環境変数、Supabase、Stripe、商品、作品、注文、決済、返金、Provider、生成Job、credit、利用者データは変更していない。
