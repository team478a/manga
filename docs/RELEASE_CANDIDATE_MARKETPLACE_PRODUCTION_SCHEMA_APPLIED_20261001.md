# Marketplace Production schema適用結果（2026-10-01）

## 結論

- 状態: `PRODUCTION_MIGRATIONS_APPLIED / POST_AUDIT_4_OF_4_READY`
- Branch: `codex/cloud-marketplace-production-schema-applied-20261001`
- Base: `1aac60852abb7306453f8d840b9f5fc7a186ac03`（PR #584 merge commit）
- 責任者がmigration ID、SHA-256、順序を明記して承認した3 migrationを、Productionへ承認順に各1回だけ適用した。
- 各実行は`Success. No rows returned`で完了した。適用後の読み取り専用監査は4行すべて`APPLIED_CONTRACT_READY`で、primary／access／auxiliaryもすべて`true`だった。
- 既にREADYだった`202609300001_cloud_marketplace_product_edit_guard`は再適用していない。

## 対象環境

- Organization表示: `stockbusiness's Org`
- Supabase Project表示: `mangai-hub-staging`
- Project ref: `vmdsyxykcrgxcdbrwlkv`
- Branch表示: `main`
- 環境badge: `PRODUCTION`
- Role表示: `postgres`

Project名に`staging`を含むが、Organization、Project名、Project ref、Branch、環境badge、Roleを画面上で確認してから実行した。

## 適用したmigration

次の順序で、各原本を正規化した文字数とSHA-256が承認値に一致すること、さらにSQL Editorへ入力した全文が同じ文字数とSHA-256であることを確認してから、各1回だけRunした。

1. `202609290001_cloud_marketplace_listing_publish`
   - normalized characters: 3,746
   - SHA-256: `7cf041d4add68a08f994abb8a287159226574abb64da09d103ab7e085b959701`
   - 結果: `Success. No rows returned`
2. `202609290002_cloud_marketplace_listing_withdrawal`
   - normalized characters: 2,483
   - SHA-256: `d16d53adb97bf255d6202b362182d1c0548e5f5a09ec953121a90c1fa7c5ea27`
   - 結果: `Success. No rows returned`
3. `202609300002_public_marketplace_creator_attribution`
   - normalized characters: 763
   - SHA-256: `bdf4525991da2a180604be80b80d077e481919fd2c0eb4dfa9f5851cd4415d8f`
   - 結果: `Success. No rows returned`

Supabaseにはtechnical issueのstatus bannerが表示されていたが、3実行はいずれもtransaction commit後にSuccessを返し、後続監査でも契約成立を確認した。

## 適用後監査

- repository原本: `supabase/audits/marketplace_production_schema_readiness.sql`
- 正規化後文字数: 3,711
- 行数: 90（末尾改行を含む）
- SHA-256: `e1ee7c13636008f9e06a389b8ea3abfe090f62a29ef48f26fd7743b6484be69d`
- 実行回数: 1回

| migration                                             | readiness                | primary | access | auxiliary |
| ----------------------------------------------------- | ------------------------ | ------: | -----: | --------: |
| `202609290001_cloud_marketplace_listing_publish`      | `APPLIED_CONTRACT_READY` |    true |   true |      true |
| `202609290002_cloud_marketplace_listing_withdrawal`   | `APPLIED_CONTRACT_READY` |    true |   true |      true |
| `202609300001_cloud_marketplace_product_edit_guard`   | `APPLIED_CONTRACT_READY` |    true |   true |      true |
| `202609300002_public_marketplace_creator_attribution` | `APPLIED_CONTRACT_READY` |    true |   true |      true |

## 変更境界

- 変更したのは承認済みfunction定義と実行権限だけである。
- 公開・公開停止function内には呼び出し時の作品・商品更新処理があるが、今回はfunctionを定義しただけで呼び出していない。
- 作品、publication、商品、価格、購入者、注文、決済、Stripe、Storage、Provider、生成Job、credit、利用期限、通知設定は変更していない。
- 商品のactive化、実購入、実決済、返金、一般販売開始は実施していない。
- SQL Editorのprivate queryへ非機密SQLが一時保存される可能性はあるが、application dataではない。

## Local検証

- `npm run marketplace:production:schema-audit:bundle`: 4/4 READY
- `node --test tests/marketplace-production-schema-audit.test.mjs`: 3/3成功
- `npm run db:migrations:validate`: 92 migration／rollback成功
- `npm run rc:preflight`: repository structure READY。外部設定と手動E2Eは未投入のためPENDING／REQUIRED（想定どおり）
- `npx prettier --check docs/RELEASE_CANDIDATE_MARKETPLACE_PRODUCTION_SCHEMA_APPLIED_20261001.md`: 成功
- `git diff --check`: 成功

## 次の境界

Production schemaはCloud Marketplaceの公開・公開停止・商品編集guard・作者表示について4/4 READYになった。次は限定販売のcanary readinessを再確認できるが、商品公開、商品active化、購入、決済、返金、一般販売開始はそれぞれ別の明示承認単位とする。
