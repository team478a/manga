# MANGAI Current Task

## 基本情報

- 更新日: 2026-07-29
- 状態: `IN_PROGRESS`（Release 1統合・公開前ハードニング中。merge・本番反映は禁止）
- リポジトリ: `team478a/manga`
- Base: `origin/feature/manga-canvas-mvp` (`7615d06`)
- Branch: `codex/cloud-release1-integration-v1`
- 統合元: PR #50、#56、#57、#58、#59、#60、#61、#62
- 除外: PR #48〜#49、#51〜#55、#63〜#64
- Draft PR: [#65](https://github.com/team478a/manga/pull/65)
- 計画: [`docs/cloud/CLOUD_WORKFLOW_RELEASE_PLAN.md`](cloud/CLOUD_WORKFLOW_RELEASE_PLAN.md)
- 仕様: [`docs/cloud/CLOUD_RESEARCH_MVP_SPEC.md`](cloud/CLOUD_RESEARCH_MVP_SPEC.md)
- 統合報告: [`docs/cloud/CLOUD_RELEASE1_INTEGRATION_REPORT.md`](cloud/CLOUD_RELEASE1_INTEGRATION_REPORT.md)
- 受入れ: [`docs/cloud/CLOUD_RELEASE1_BETA_ACCEPTANCE.md`](cloud/CLOUD_RELEASE1_BETA_ACCEPTANCE.md)
- 公開手順: [`docs/cloud/CLOUD_RESEARCH_RELEASE_RUNBOOK.md`](cloud/CLOUD_RESEARCH_RELEASE_RUNBOOK.md)

## 現在の目的

新機能追加を停止し、市場分析だけを先に限定公開できる独立したRelease 1統合状態を作る。既存PRは変更せず、必要なcommitだけを最新の正式基点へ安全に取り込む。

## 統合範囲

- Release 0の最小Cloud Shell、Dashboard、制作進行、Feature Flag
- 市場分析の入力、実行、保存、履歴、再表示
- Research Quality v2
- 安全な出典Server検証
- 検索候補収集
- 事実候補抽出
- 複数出典照合
- Research Evaluation v1
- 分析結果だけを表示する利用者UI
- Release 1公開前ハードニング、preflight、runbook

## 公開前の安全境界

- `CLOUD_RESEARCH_MVP_ENABLED`が未設定または`false`なら、認証・DB照会より前にfail closedする。
- 検索APIが無効または未設定でも、手動出典入力を継続できる。
- 出典検証が無効または未設定なら、安全な手動確認案内を表示する。
- 成人向け市場分析はCloudで拒否する。
- 不正UUIDはDB照会前に拒否する。
- DB／Providerの内部詳細を利用者へ返さない。
- Reportは所有者だけが参照できる。
- loading、empty、error、not foundを明示する。
- 390px、768px、1280pxで画面幅を超える固定幅を持たない。

## 今回変更しない範囲

- PR #48〜#49、#51〜#55、#63〜#64
- Desktop
- Cloud Canvas Editor
- Cloud AI Queue／Worker
- Stripe
- Marketplace
- AI企画提案本体
- シナリオ生成
- マンガ生成
- 作品管理
- 販売準備
- 収益ダッシュボード

## 現在の検証

- 市場分析集中テスト: PASS（28/28）
- migration manifest: 18件を正規化
- migration静的検証: PASS（18/18）
- deps、lint、typecheck、research eval、Hub test（174/174）、build: PASS
- migration roundtrip: PASS（ローカルDocker PostgreSQL 16）
- GitHub CI、Vercel Preview: Draft PR作成後に確認

## 停止条件

Draft PRとVercel Previewを作成し、全CI結果を確認した時点で停止する。次は実施しない。

- PRのmerge、既存PRのClose・rebase・force push
- Feature Flagの本番有効化
- Supabase stagingへのmigration適用
- 外部APIの有料実行
- 本番公開

## 未完了

1. Draft PR #65の全CI確認
2. Vercel Preview確認
3. 責任者によるPreview受入れ
4. 責任者管理下でのmigration適用・preflight・限定公開判断

## 履歴の参照

PR #50単体でのRelease 0＋1実装記録、およびそれ以前のDesktop作業記録は
[`docs/HANDOFF_LOG.md`](HANDOFF_LOG.md)に保持している。統合元PRはClose・履歴改変していない。

## 次担当者が最初に読むファイル

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`
4. 本ファイル
5. `docs/HANDOFF_LOG.md`
6. `docs/cloud/CLOUD_RELEASE1_INTEGRATION_REPORT.md`
7. `docs/cloud/CLOUD_RELEASE1_BETA_ACCEPTANCE.md`
8. `docs/cloud/CLOUD_RESEARCH_RELEASE_RUNBOOK.md`
