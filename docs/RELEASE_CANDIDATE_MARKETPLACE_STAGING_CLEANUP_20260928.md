# Marketplace隔離Staging終了記録

作成日: 2026-09-28
対象: Marketplace外部E2E用の短期検証環境

## 結果

| 対象 | 実行前確認 | 終了結果 |
| --- | --- | --- |
| Stripe webhook | test mode、有効、Vercel Preview、正規path、Protection Bypass | 対象endpoint 1件を削除 |
| Vercel Preview | Marketplace／Staging用として追加されたPreview限定9変数 | 9件削除、再監査で不在 |
| Supabase Branch | 非default、親Productionと別ref、Healthy、Production data非複製 | `marketplace-staging`削除 |
| Production | 別scope／mainのみ | 変更なし |

## 終了順序

1. Stripe test webhook endpointをread-only取得し、`livemode=false`と対象Preview URL条件を確認した。
2. 対象endpointだけを削除し、対象ID一致と`deleted=true`を確認した。
3. Vercel Preview scopeからStripe、checkout mode、Staging ref、Staging Supabase 3資格情報の計9変数を削除した。
4. Vercel Previewの対象変数が不在で、ProductionのSupabase URL、anon key、service-role key、Cancel Secretが残ることを確認した。
5. Supabase Branch一覧で対象Branch ID、ref、親ref、非defaultを再確認して削除した。
6. Branch一覧がHealthyなProduction main 1件だけであることを確認した。

## 削除されたデータ

- 隔離Branchの合成seller／buyer。
- 合成作品、商品、pending／failed／refunded test注文。
- 隔離BranchのMarketplace Storage object。
- 隔離Branch固有のschema／seed／Auth／Storage設定。

これらは外部E2E専用であり、削除後は復元しない。必要な検証証跡はGit文書とPR履歴に保持している。

## 変更していない対象

- Supabase Production main、Production DB／Auth／Storage。
- Stripe live endpoint、live key、実請求、本番売上、振込。
- Vercel Production環境変数。
- Cloud AI／Desktop用の既存Preview環境変数。
- 実利用者、Provider、生成Job、Asset、credit。

## 参考

- [Supabase branch deletion](https://supabase.com/docs/reference/api/v1-delete-a-branch)
- [Supabase branching usage](https://supabase.com/docs/guides/platform/manage-your-usage/branching)
- [Vercel environment variable CLI](https://vercel.com/docs/cli/env)
