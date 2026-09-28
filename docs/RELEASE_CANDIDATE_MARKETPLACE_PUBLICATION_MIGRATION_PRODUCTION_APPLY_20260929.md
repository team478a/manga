# Marketplace Cloud完成版migration Production適用証跡

作成日: 2026-09-29
対象: 一般向けMarketplace Cloud完成版固定
状態: 適用済み／postflight成功／作品・商品・販売状態は未変更

## 対象

- Supabase project表示: `mangai-hub-staging`
- Branch表示: `main`
- 環境表示: `Production`
- Base: PR #556 merge commit `37daed0646a37b67c4784a74e9f02ce155a375e3`
- migration: `202608140004_cloud_work_publications`
- SHA-256: `eaf9d6af5febdad9c8e78c3de80c2181a30afac60f3572a6758d82e1e247b7aa`

Production環境は表示名に`staging`を含むが、画面上のBranchと環境badgeを含めてProduction対象であることを確認した。別Project、Preview Branch、`mailsend`は操作していない。

## 承認と実行

責任者から対象migration IDとSHA-256を含むProduction適用の明示承認を受けた。適用直前にrepository原本のSHA-256を再照合し、Supabase SQL Editorへ入力した全文を原本と比較した。

- repository原本: 12,853 bytes
- SQL Editor上の文字列: 12,825 characters
- 改行を含む全文比較: 一致
- 実行回数: 1回
- Supabase結果: `Success. No rows returned`

Migrationは`begin`／`commit`で囲まれた原本をそのまま実行した。migration履歴への別insert、再実行、SQLの部分変更は行っていない。

## Postflight

読み取り専用SELECTで次を確認した。

- `cloud_work_publications` table: 存在
- `cloud_work_publication_pages` table: 存在
- `works.current_publication_id`: 存在
- `works.published_version`: 存在
- `works.published_at`: 存在
- `sync_cloud_marketplace_release_draft(...)`: 存在
- `select_cloud_work_publication(uuid,uuid)`: 存在
- `works_cloud_publication_gate`: 存在
- `digital_products_cloud_publication_gate`: 存在
- migrationで定義する3 index: すべて存在
- 2つのread policy: すべて存在
- 2つのpublication tableのRLS: いずれも有効
- publication rows: 0
- publication page rows: 0
- `current_publication_id`設定済み作品: 0
- active Cloud商品: 0

2回目のread-only確認ではSQL Editorの旧SELECTが残り、最初の実行が構文エラーで停止した。データ変更は発生していない。全文を選択して正規化後の完全一致を確認し、同じread-only SELECTを再実行して上記結果を得た。

Production管理画面`/admin/marketplace-canary`でも次を確認した。

- schema状態: `already-applied`
- 確認したCloud作品: 1件
- 確認したactive商品: 0件
- 公開済みCloud作品: 0件
- active Cloud商品: 0件
- 重複Project mapping: 0件

## 変更していないもの

- 作品の公開状態とpublication固定
- 商品状態と価格
- 注文、Stripe、決済、返金、download
- Storage object
- Cloud AI Provider、生成Job、Asset、credit
- 利用者profile、Auth、Vercel環境変数

Repository側はRC repository structureと`git diff --check`が成功した。外部サービス設定と手動E2Eは、資格情報をrepositoryへ注入していない既知の`PENDING`を維持する。この証跡PRは文書だけを変更し、製品コードとmigration原本は変更しない。

この適用だけでは一般向け商品を販売開始しない。次の工程は対象Cloud作品の完成版固定、作品公開、paused商品のactive化、1件canary購入であり、それぞれ既存の安全確認と責任者の明示承認を別に必要とする。
