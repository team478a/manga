# Cloud Research AI Auto UX Implementation Report

更新日: 2026-07-30

## 実装結果

- 市場分析Formをプルダウン中心へ変更
- 出典URL、取得日時、確認事実、根拠分野の利用者入力を削除
- 任意入力を参考作品だけに限定
- OpenAI Responses API、Web search、Structured OutputsをServer側へ追加
- Web引用がない応答の保存拒否
- 9種類の分析結果と最大5件の引用を既存Reportへ保存
- `store: false`とprivacy-preservingな`safety_identifier`を設定
- timeout、rate limit、Provider停止、設定不足を安全な日本語メッセージへ変換
- Provider呼出前に利用者単位で1分3回へ制限
- 管理者用`/admin/research-ai`を追加
- APIキーをSupabase Vaultへ新規保存・交換
- APIキーを再表示せず、設定済み状態だけを表示
- model選択と停止操作を追加
- 秘密値を含まない監査ログを追加
- 成人向け入力をProvider設定取得前に拒否
- ジャンルとテーマだけで実行できる「AIにおまかせ」Formへ簡略化
- 読者、販売先、形式、価格、ページ数を任意の詳細設定へ移動
- 「今、狙う作品」「買われる理由」「おすすめの商品設計」を結果の最上段へ追加
- 直近12か月、需要と競合、異なる2ドメイン以上を調査条件として追加
- 根拠が1ドメインだけの結果を保存しない品質境界を追加
- 古い9項目Reportも従来どおり表示できる後方互換を維持

## Migration

- Forward: `supabase/migrations/202607300001_cloud_research_ai_provider.sql`
- Rollback: `supabase/rollbacks/202607300001_cloud_research_ai_provider.sql`
- Canonical schema: 更新済み
- Manifest checksum: 更新済み
- 静的検証: 21/21 PASS
- Docker PostgreSQL roundtrip: ローカルDocker daemon停止中のため未実行。GitHub CIで実行する。

## 品質結果

| Gate | Result |
| --- | --- |
| `npm run deps:check` | PASS |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run research:eval` | PASS |
| `npm run hub:test` | PASS（195/195） |
| `npm run db:migrations:validate` | PASS（21/21） |
| `npm run build` | PASS |
| `git diff --check` | PASS |

## 未実施

- staging migration適用（2026-07-30、責任者申告で完了）
- 実APIキー登録（2026-07-30、責任者申告で完了。値は記録しない）
- OpenAIの有料実行
- Preview実機E2E
- 本番有効化・公開

これらは責任者の外部設定と承認を必要とするため実施していない。
