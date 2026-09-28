# Marketplace Cloud完成版migration適用前readiness

## 目的

Productionで未適用と確認された`202608140004_cloud_work_publications`を、既存作品・商品を壊さず適用できる状態か読み取り専用で判定する。これはmigrationを適用する機能ではなく、適用判断の前提を匿名集計で固定するpreflightである。

## 対象migration

- ID: `202608140004_cloud_work_publications`
- SHA-256: `eaf9d6af5febdad9c8e78c3de80c2181a30afac60f3572a6758d82e1e247b7aa`
- forward: `supabase/migrations/202608140004_cloud_work_publications.sql`
- rollback: `supabase/rollbacks/202608140004_cloud_work_publications.sql`

## 判定

`npm run marketplace:production:publication-migration:preflight`はProduction identity guardを通過した場合だけ、Supabase RESTへGETを行う。次をすべて満たす場合だけ適用準備済みとする。

1. `works`、`digital_products`、`profiles`、Cloud Project／checkpoint関連の依存schemaが存在する。
2. publication 2 tableと`works`のpublication 3列がすべて未適用であり、部分適用状態ではない。
3. Cloud-linked作品とactive商品が各100件以内で、全件を監査できる。
4. publication固定前の公開済み／published Cloud作品がない。
5. Cloud-linked作品に紐づくactive商品がない。
6. 同一Cloud Projectに複数作品が紐づいていない。

既に全artifactが存在する場合も再適用せず停止する。部分適用、101件以上、schema不整合、危険な既存データはfail closedである。

## 情報境界

- 出力するのはschema状態と件数だけである。
- 作品、商品、Project、利用者のID、名称、メール、file path、環境値、秘密値を出力しない。
- 個人情報列をselectしない。
- Storage download、Stripe request、Provider実行、生成Job、credit操作を行わない。
- migration、作品公開、Cloud完成版固定、商品有効化、環境変数変更を行わない。

## 実行方法

Production候補envをrepository外に置く場合:

```powershell
npm run marketplace:production:publication-migration:preflight -- --candidate C:\absolute\outside-repository\production.env
```

候補envは既存のProduction identity guardにより、`https://app.mang-ai.com`、hosted Supabase、service role、Staging markerなし、checkout mode `disabled`または`live`に限定される。

## 適用時の別承認

preflightがREADYでもmigrationは自動適用しない。Production適用には、対象IDとSHA-256を含む実行時の明示承認、直前のread-only再確認、SQL Editorまたは承認済み手段による1回の適用、postflightが別途必要である。作品公開、publication作成、商品active化、live canary購入も別承認単位とする。
