# Marketplace Production schema監査バンドル（2026-10-01）

## 結論

- 状態: `IMPLEMENTED / LOCAL_ALL_GATES_PASSED / PRODUCTION_UNCHANGED`
- Branch: `codex/cloud-marketplace-schema-readiness-20261001`
- Base: `eb842a454a0b4c266cb53b6051c6bf8535a9b251`（PR #582 merge commit）
- Cloud Marketplaceの公開、公開停止、商品編集guard、作者表示に必要な4 migrationについて、正本SQLのSHA-256を固定し、Production SQL Editorで実行できる読み取り専用schema監査を用意した。
- この変更ではProductionへ接続していない。migration、schema、RLS、商品、作品、注文、決済、Stripe、Provider、Job、creditは変更していない。

## 固定したmigration

| migration                                             | SHA-256                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `202609290001_cloud_marketplace_listing_publish`      | `7cf041d4add68a08f994abb8a287159226574abb64da09d103ab7e085b959701` |
| `202609290002_cloud_marketplace_listing_withdrawal`   | `d16d53adb97bf255d6202b362182d1c0548e5f5a09ec953121a90c1fa7c5ea27` |
| `202609300001_cloud_marketplace_product_edit_guard`   | `307f35ca1e08e0232164c79a8b2206c487748046eec65a95fccd9f98c5fd644d` |
| `202609300002_public_marketplace_creator_attribution` | `bdf4525991da2a180604be80b80d077e481919fd2c0eb4dfa9f5851cd4415d8f` |

`npm run marketplace:production:schema-audit:bundle`は、各SQLの実SHA、migration manifestのSHA、この文書で固定したSHAが完全一致する場合だけ成功する。改行コードはrepositoryのmigration validatorと同じくLFへ正規化して計算する。

## 読み取り専用監査

- 監査SQL: `supabase/audits/marketplace_production_schema_readiness.sql`
- SHA-256: `e1ee7c13636008f9e06a389b8ea3abfe090f62a29ef48f26fd7743b6484be69d`
- 1つの`WITH ... SELECT`だけで構成し、`pg_proc`、`pg_trigger`、`pg_class`、`pg_namespace`、`to_regprocedure`、`has_function_privilege`だけを参照する。
- 利用者、作品、商品、注文、決済、ファイル、メール等のapplication dataは参照しない。
- DDL、DML、RPC、設定変更は行わない。
- 4行を返し、各migrationを`APPLIED_CONTRACT_READY`または`NOT_APPLIED_OR_INCOMPLETE`として判定する。
- functionの存在だけでなく、`SECURITY DEFINER`、必要roleの実行権限、商品編集guardの有効な`BEFORE INSERT OR UPDATE FOR EACH ROW` triggerまで確認する。

GitHub Actionsの`Migration roundtrip`は、PostgreSQL 16へ全migrationを適用した`current_schema`上でこの監査SQLを実行する。これにより、監査SQL自体の構文と正本schemaの期待契約をPRごとに検査する。

## 検証

- 監査focused test: 3/3
- Hub: 1201/1201
- Canvas: 26/26
- AI: 50/50
- Desktop: 407/407
- Desktop accessibility: 29画面、blocking violation 0
- lint: 成功
- typecheck（Hub / Desktop）: 成功
- migration静的検証: 92/92
- dependency boundary: error 0（既知の`APP_ADMIN_CLIENT` warning 2）
- Web build / Desktop build: 成功
- RC repository structure: READY
- `git diff --check`: commit前に再確認する

ローカルのDocker Desktop daemonが停止中のため、ローカルPostgreSQL 16での実行だけは`LOCAL_BLOCKED_EXTERNAL_ENVIRONMENT`である。PRの`Migration roundtrip`が同じ監査SQLをPostgreSQL 16で実行するため、CI成功を必須条件とする。

## merge後に残る実環境確認

1. Production対象Projectを確認する。
2. Production SQL Editorへ、repositoryの監査SQLを改変せず貼り付ける。
3. 1回だけ実行し、4行すべての`readiness`を記録する。
4. 4行すべてが`APPLIED_CONTRACT_READY`なら、schema監査を完了とする。
5. `NOT_APPLIED_OR_INCOMPLETE`が1行でもあれば、その場でmigrationを適用しない。結果を保存し、対象migrationとSHAを示して別途明示承認を得る。

このSELECT実行はProductionを変更しないが、Production migration適用は別の承認単位である。
