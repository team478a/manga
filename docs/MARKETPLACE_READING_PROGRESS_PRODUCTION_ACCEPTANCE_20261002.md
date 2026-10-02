# Marketplace 続きから読む Production migration受入れ

作成日: 2026-10-02
対象: Supabase Production Project `vmdsyxykcrgxcdbrwlkv`
状態: `MIGRATION_APPLIED / POSTFLIGHT_PASSED / INITIAL_ROWS_ZERO`

## 1. 承認と適用

- 責任者はmigration `202610020003_marketplace_reading_progress`をProductionへ1回適用することを明示承認した。
- 適用前に原本SHA-256を再計算し、承認値`34c5c316060910aa7531ad4ac50d11b144b9a51714d1c558740e75010d7d959a`との完全一致を確認した。
- Supabase SQL Editorの対象がProject `vmdsyxykcrgxcdbrwlkv`、branch `main`、`PRODUCTION`であることを画面で照合し、責任者が原本を1回実行した。

## 2. Postflight

読み取り専用SQLで次を確認した。

- table: `marketplace_reading_progress`
- RLS: 有効
- primary key: `marketplace_reading_progress_pkey`
- index: `marketplace_reading_progress_profile_updated_idx`
- owner read policy: `marketplace_reading_progress_owner_read`
- RPC: `save_marketplace_reading_progress(uuid,uuid,integer)`
- authenticated: table SELECTのみ、RPC EXECUTEあり
- authenticatedの追加write権限: なし
- anon: table権限なし、RPC EXECUTEなし
- 初期row数: 0

## 3. 変更境界

- 変更したのは承認済みmigrationによるtable、index、RLS policy、RPC、権限だけである。
- 作品、商品、publication、注文、決済、Storage、Provider、生成Job、credit、利用期限、通知設定は変更していない。
- 実作品でのReader保存・復帰E2Eは未実施であり、Productionデータmutationを伴う別の受入れ工程とする。

## 4. 判定

Production schema受入れは合格。Marketplaceの既存機能を維持したまま「続きから読む」の保存基盤を利用可能な状態にした。
