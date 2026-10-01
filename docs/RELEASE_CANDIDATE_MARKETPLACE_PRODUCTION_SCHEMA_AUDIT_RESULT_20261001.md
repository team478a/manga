# Marketplace Production schema監査結果（2026-10-01）

## 結論

- 状態: `PRODUCTION_READ_ONLY_AUDIT_COMPLETE / 1_READY / 3_NOT_APPLIED_OR_INCOMPLETE`
- Branch: `codex/cloud-marketplace-production-schema-audit-20261001`
- Base: `4a4f48d6c5e9e54e11d21539d7565f0655e07930`（PR #583 merge commit）
- ProductionのMarketplace schemaは4契約中1契約だけがREADYだった。公開function、公開停止function、作者表示functionは存在確認と権限確認の両方がfalseであり、未適用または不完全である。
- 読み取り専用SELECTを1回実行しただけで、DB、schema、RLS、作品、商品、注文、決済、Stripe、Storage、Provider、Job、credit、利用者データは変更していない。

## 対象環境

- Organization表示: `stockbusiness's Org`
- Supabase Project表示: `mangai-hub-staging`
- Project ref: `vmdsyxykcrgxcdbrwlkv`
- Branch表示: `main`
- 環境badge: `PRODUCTION`
- Role表示: `postgres`

Project名に`staging`を含むが、Project ref、Branch、環境badgeを画面上で二重確認した。アクセス権がない別Chrome profileではOrganization一覧へ戻されたためSQLを入力・実行せず、対象Projectへアクセスできる既存profileだけで監査した。

## 実行した監査

- repository原本: `supabase/audits/marketplace_production_schema_readiness.sql`
- 正規化後文字数: 3,711
- 行数: 90（末尾改行を含む）
- SHA-256: `e1ee7c13636008f9e06a389b8ea3abfe090f62a29ef48f26fd7743b6484be69d`
- 実行回数: 1回
- 結果行数: 4行

Monaco Editorへの初回DOM入力は全文にならなかったため、Run前に停止した。Editor全文を選択置換し、clipboardへ一時コピーした内容の文字数、行数、SHA-256がrepository原本と完全一致した後にだけRunを押した。部分入力は一度も実行しておらず、DB操作はない。SQL Editorのprivate autosaveには非機密の監査SQLが`Untitled query`として保存された可能性があるが、application DBと設定は変更していない。

## Production結果

| migration                                             | readiness                   | primary | access | auxiliary |
| ----------------------------------------------------- | --------------------------- | ------: | -----: | --------: |
| `202609290001_cloud_marketplace_listing_publish`      | `NOT_APPLIED_OR_INCOMPLETE` |   false |  false |      true |
| `202609290002_cloud_marketplace_listing_withdrawal`   | `NOT_APPLIED_OR_INCOMPLETE` |   false |  false |      true |
| `202609300001_cloud_marketplace_product_edit_guard`   | `APPLIED_CONTRACT_READY`    |    true |   true |      true |
| `202609300002_public_marketplace_creator_attribution` | `NOT_APPLIED_OR_INCOMPLETE` |   false |  false |      true |

3件はprimary functionが見つからず、必要なfunction access契約も成立していない。商品編集guardはfunction、access判定、`BEFORE INSERT OR UPDATE FOR EACH ROW` triggerのすべてがREADYであるため再適用対象にしない。

## Local検証

- `npm run marketplace:production:schema-audit:bundle`: 4/4 READY
- `node --test tests/marketplace-production-schema-audit.test.mjs`: 3/3成功
- `npm run db:migrations:validate`: 92 migration／rollback成功
- `npm run rc:preflight`: repository structure READY。外部設定と手動E2Eは未投入のためPENDING／REQUIRED（想定どおり）
- `git diff --check`: 成功

## 適用候補と安全境界

不足を解消する場合は、次の3 migrationだけをこの順に検討する。

1. `202609290001_cloud_marketplace_listing_publish`
   - bytes: 3,819
   - normalized characters: 3,746
   - SHA-256: `7cf041d4add68a08f994abb8a287159226574abb64da09d103ab7e085b959701`
2. `202609290002_cloud_marketplace_listing_withdrawal`
   - bytes: 2,534
   - normalized characters: 2,483
   - SHA-256: `d16d53adb97bf255d6202b362182d1c0548e5f5a09ec953121a90c1fa7c5ea27`
3. `202609300002_public_marketplace_creator_attribution`
   - bytes: 798
   - normalized characters: 763
   - SHA-256: `bdf4525991da2a180604be80b80d077e481919fd2c0eb4dfa9f5851cd4415d8f`

この監査結果だけでは適用しない。3 migrationのID、SHA-256、順序を含む責任者の実行時明示承認が必要である。承認後も各原本を全文1回だけ実行し、各回の成功を確認してから次へ進む。`202609300001_cloud_marketplace_product_edit_guard`はREADYのため再実行しない。適用後は同じ監査SELECTを再実行し、4行すべての`APPLIED_CONTRACT_READY`を確認する。

作品公開、publication選択、商品active化、購入、決済、返金、一般販売開始は別の承認単位である。
