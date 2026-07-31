# MANGAI Cloud Release 1 限定公開受入れ

作成日: 2026-07-29

責任者が戻った後に実施する。チェックが揃うまでDraft解除・merge・本番公開を行わない。

Draft PR: [#65](https://github.com/team478a/manga/pull/65)

Preview: `https://mangai-hub-staging-git-codex-cloud-re-7ae648-team478as-projects.vercel.app`

PreviewにはVercel Deployment Protectionが設定されている。責任者のVercel sessionで認証してから確認する。

## 1. 統合内容

- [ ] Draft PRのbaseが`feature/manga-canvas-mvp`である。
- [ ] 統合対象がPR #50、#56〜#62の市場分析だけである。
- [ ] PR #48〜#49、#51〜#55、#63〜#64と後続制作工程が含まれない。
- [ ] 既存PRがClose・rebase・force pushされていない。
- [x] Required Quality、Migration roundtrip、Windows build、Vercelがすべて成功している。

## 2. DB適用前

- [ ] 対象Supabase Project名とProject Refを二者確認した。
- [ ] バックアップまたは復元手段を確認した。
- [ ] `CLOUD_RESEARCH_MVP_ENABLED`が未設定または`false`である。
- [ ] Flag停止中は市場分析RouteがDB照会前に停止する。
- [ ] `npm run db:migrations:validate`が成功する。

## 3. migration

次の順で、責任者管理下でだけ適用する。

1. `202607290001_cloud_market_research.sql`
2. `202607290007_cloud_research_quality_v2.sql`

- [ ] 2本ともforward適用に成功した。
- [ ] owner RLSと`authenticated`の`SELECT`／`INSERT`だけを確認した。
- [ ] `research-rules-v2` constraintを確認した。
- [ ] rollbackはデータ件数とバックアップ確認なしに実行しない。

## 4. Vercel設定

- [ ] 値を画面共有・記録せず環境変数を設定した。
- [ ] `npm run cloud:release1:preflight`がPASSした。
- [ ] 検索を使用しない場合、`CLOUD_RESEARCH_SEARCH_ENABLED=false`で手動入力が継続できる。
- [ ] 出典検証を使用しない場合、`CLOUD_RESEARCH_SOURCE_VERIFICATION_ENABLED=false`で安全案内が出る。
- [ ] DB適用確認後にだけPreviewの`CLOUD_RESEARCH_MVP_ENABLED=true`へ変更した。
- [ ] 本番環境のFlagは変更していない。

## 5. 縦型E2E

- [ ] 一般向け入力を実行できる。
- [ ] Reportを保存できる。
- [ ] 履歴に表示される。
- [ ] 履歴から同じReportを再表示できる。
- [ ] 利用者画面に内部評価ロジックと参照URLが表示されない。
- [ ] 完了Reportだけに次工程への導線が出る。
- [ ] AI企画提案本体は実行されない。
- [ ] 成人向け入力はCloudで拒否される。
- [ ] 不正UUIDは安全なnot foundになる。
- [ ] DB／Providerの内部エラーが画面や通常ログへ露出しない。

## 6. 所有者分離

- [ ] 利用者AがReportを作成した。
- [ ] 利用者BはAのReport URLを開けない。
- [ ] 利用者Bの履歴にAのReportが表示されない。
- [ ] Service RoleやSQL Editorでの確認を利用者RLS試験の代替にしていない。

## 7. 表示

各幅で横Page overflow、文字切れ、操作不能がないことを実ブラウザで確認する。

- [ ] 390px
- [ ] 768px
- [ ] 1280px
- [ ] loading
- [ ] empty
- [ ] error
- [ ] not found

## 8. 承認記録

```text
Draft PR:
Vercel Preview:
Supabase Project:
migration適用日時:
Feature Flag有効化日時:
縦型E2E:
別利用者RLS:
390px / 768px / 1280px:
内部情報秘匿:
未解決事項:
実施者:
責任者承認:
```

失敗時は最初にFeature Flagを`false`へ戻し、DB rollbackは
[`CLOUD_RESEARCH_RELEASE_RUNBOOK.md`](CLOUD_RESEARCH_RELEASE_RUNBOOK.md)の停止順に従って別途判断する。
