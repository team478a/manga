# Cloud Marketplace 公開クリエイター表示 Release Candidate

作成日: 2026-09-30

対象ブランチ: `codex/cloud-marketplace-public-creator-attribution-20260930`

基点: `5701819b07a66f803e2b2d901532bae03cbdc709`（PR #573 merge commit）

## 目的

公開作品一覧、作品詳細、購入準備で販売者を確認できるようにする。従来の購入準備画面は`profiles`を直接joinしていたが、一般利用者と匿名利用者はプロフィールRLSを通過できないため、表示名が`不明`になる可能性があった。

## 実装

- migration `202609300002_public_marketplace_creator_attribution`で、公開中の一般作品IDに対して`work_id`と`display_name`だけを返す`list_public_work_creator_attributions(uuid[])`を追加した。
- 関数は`security definer`と固定`search_path`を使用し、`content_class='general'`かつ`is_public=true`の作品だけを返す。
- `profiles`の既存RLSは変更しない。メール、Auth user ID、プロフィール本文、画像、権限、内部監査情報は返さない。
- 匿名・認証済み利用者には専用関数の実行権限だけを付与する。
- 公開作品一覧のカードへ`作：表示名`、作品詳細と購入準備へ`クリエイター：表示名`を追加した。
- migration未適用または一時的なRPC障害時も購入画面全体を停止させず、個人を推測しない`クリエイター`表記へfail closedする。
- 購入準備の直接`profiles:creator_id(display_name)`参照を削除し、3画面を同じ公開境界へ統一した。

## 変更しない境界

- 公開作品以外の販売者名は公開しない。
- プロフィールテーブルのRLS、管理者画面の参照、Creator本人のプロフィール編集は変更しない。
- 購入可否、指定購入者canary、自己購入禁止、注文、Stripe、Webhook、ダウンロード、作品公開状態は変更しない。
- Production接続、migration適用、作品・商品・注文・利用者データ変更、Provider実行、生成Job、credit消費は行わない。

## migration

- forward: `supabase/migrations/202609300002_public_marketplace_creator_attribution.sql`
- rollback: `supabase/rollbacks/202609300002_public_marketplace_creator_attribution.sql`
- SHA-256: `fa696a176c437dffd3b18deaa850fc203448eba731c9bfb5e6875fa6199ecbcd`
- Production適用はmerge後の別承認単位とする。

## 検証

- focused: 6/6
- Hub: 1179/1179
- Canvas: 26/26
- AI: 50/50
- Desktop: 407/407
- Desktop accessibility: 29画面、blocking violation 0
- dependency/module/code-size: error 0、既知warning 2
- lint、Hub/Desktop typecheck、Web build、Desktop build成功
- migration静的検査: 92/92 forward/rollback成功
- RC repository structure: READY。外部設定と手動E2Eは既知PENDING
- `git diff --check`: 成功
- ローカルPostgreSQL 16 roundtripはDocker Desktop Linux Engineの一時的な500で環境起因中断。SQLエラーは未観測だが成功扱いにせず、GitHub Actionsの`Migration roundtrip`成功を必須とする。

## 停止条件

Draft PR作成後、全GitHub CIとVercel Previewが成功した時点で停止する。Production migration適用、一般購入解禁、実購入・実決済は実施しない。
