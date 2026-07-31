# Cloud Release 2 限定公開Runbook

更新日: 2026-07-30
対象: 一般向け市場分析からのAI企画提案
対象ブランチ: `codex/cloud-proposal-generation-v1`

## 1. 公開境界

- 一般向けの完了済み市場分析だけを企画生成へ送る。
- 成人向けReportはOpenAI設定取得前に拒否する。
- APIキーは管理画面からSupabase Vaultへ保存し、Vercel環境変数へ追加しない。
- 利用者画面へAPIキー、出典URL、内部評価、Providerの生エラーを表示しない。
- 本手順はPreview限定公開用であり、本番公開・PRマージを意味しない。

## 2. 適用前確認

1. Vercelの対象ProjectとGit branchが`codex/cloud-proposal-generation-v1`であることを確認する。
2. Supabaseの対象ProjectがPreview用環境であることを確認する。
3. SQL Editorで次を実行し、proposal migration適用済みか確認する。

```sql
select
  to_regclass('public.cloud_story_proposal_runs') as proposal_runs,
  to_regclass('public.cloud_story_proposal_selections') as proposal_selections;
```

両方が`null`の場合だけ、`supabase/migrations/202607300002_cloud_story_proposals.sql`を適用する。片方だけ存在する場合は追加適用せず、状態を調査する。

4. RLSを確認する。

```sql
select relname, relrowsecurity
from pg_class
where relname in (
  'cloud_story_proposal_runs',
  'cloud_story_proposal_selections'
)
order by relname;
```

2テーブルとも`relrowsecurity = true`が必須。

## 3. Vercel Preview設定

Environment Variablesで次を対象Preview branchだけに設定する。

| Key | 条件 |
| --- | --- |
| `CLOUD_RESEARCH_MVP_ENABLED` | `true` |
| `CLOUD_PROPOSAL_GENERATION_ENABLED` | `true` |
| `NEXT_PUBLIC_SUPABASE_URL` | 対象SupabaseのHTTPS URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 対象Supabaseの公開可能Key |
| `NEXT_PUBLIC_SITE_URL` | 対象Preview URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server限定。値を画面共有・文書へ記録しない |
| `CLOUD_AI_RATE_LIMIT_SECRET` | 32byte以上のServer限定秘密値 |

設定後は新しいdeploymentを作成する。Productionや他のPreview branchへ同時適用しない。

## 4. 管理設定

管理者で`/admin/research-ai`を開き、次だけを確認する。

- 接続が設定済み
- modelが選択済み
- 実行状態が有効

APIキー本体は再表示されないこと。キーをVercelへ重複登録しない。

## 5. 値を表示しないpreflight

対象環境変数を設定した安全なterminalで次を実行する。

```bash
npm run cloud:release2:preflight
```

`Release 2 environment preflight: PASS`を確認する。Supabase Vault内のAPIキーとmigration実DB状態は、このコマンドでは取得しないため、前節の確認も必要。

## 6. 縦型E2E

一般利用者で次を順番に確認する。

1. 市場分析を1件完了する。
2. Reportの「AI企画提案の準備へ」を開く。
3. 空状態と「AI企画を3案作成」を確認する。
4. 生成中表示の間、生成ボタンが無効になることを確認する。
5. 本命案・差別化案・小さく試す案が各1件表示されることを確認する。
6. 売れやすさ・作りやすさ・独自性、買われる理由、人物、対立、商品設計を比較する。
7. 1案を選び、保存中表示の間ボタンが無効になることを確認する。
8. 「シナリオ生成の準備ができました」と選択済み表示を確認する。
9. 履歴へ戻り、同じ企画を再表示できることを確認する。
10. 同じ市場分析で再選択できないことを確認する。

## 7. 安全性受入れ

| ケース | 期待結果 |
| --- | --- |
| Feature Flagなし | 認証・企画DB処理前に停止 |
| OpenAI管理設定なし／停止中 | 内部設定を見せず安全な案内 |
| Provider timeout／429／5xx | Provider本文を見せず再試行案内 |
| 成人向けReport | Providerへ送信せず既存手動企画へ分岐 |
| 不正なReport／Run UUID | not foundまたは安全なエラー |
| 別利用者のRun URL | 内容を表示せずnot found |
| 連打 | Server rate limitとbutton無効化で抑止 |

## 8. レスポンシブ受入れ

Chrome DevToolsで390px、768px、1280pxを確認する。

- ページ全体に横スクロールが発生しない。
- 390pxでは評価3項目が縦に並び、文字が切れない。
- 768pxでは操作ボタンと文章が重ならない。
- 1280pxでは3企画を横並びで比較できる。
- 200文字のタイトルと長い説明でもカード外へはみ出さない。

## 9. 停止・切戻し

異常時は最初に対象Preview branchの`CLOUD_PROPOSAL_GENERATION_ENABLED`を`false`へ変更し、redeployする。既存データを削除しない。

rollbackは、proposal runまたはselectionが存在する場合にfail closedする。データ削除・rollbackは責任者の明示承認後だけ実施する。

## 10. 限定公開完了条件

- preflight PASS
- 一般向け縦型E2E PASS
- 成人向け外部送信拒否 PASS
- 別利用者参照拒否 PASS
- 390px、768px、1280px PASS
- GitHub Core quality、Migration roundtrip、Windows build PASS
- Vercel Preview Ready
- OpenAI費用上限・プライバシー告知・限定利用者を責任者が承認
