# MANGAI Current Task

## 基本情報

- 更新日: 2026-07-29
- 状態: `READY_FOR_REVIEW`
- リポジトリ: `team478a/manga`
- Base: `codex/cloud-release1-integration-v1` (`6491a7d`)
- Branch: `codex/cloud-adult-research-option-v1`
- 親Draft PR: [#65](https://github.com/team478a/manga/pull/65)
- Draft PR: [#66](https://github.com/team478a/manga/pull/66)
- 仕様: [`docs/cloud/CLOUD_ADULT_RESEARCH_OPTION_SPEC.md`](cloud/CLOUD_ADULT_RESEARCH_OPTION_SPEC.md)

## 現在の目的

成人向け市場分析を、購入済みまたは管理者許可済みユーザーへ早期提供できる許可制Cloudオプションとして追加する。一般向けRelease 1、成人向けDesktop生成、既存PRを変更しない。

## 実装範囲

- 環境Feature FlagとDB Kill Switch
- 管理者による個別利用許可・停止・期限・許可理由
- 既存購入者を示す`legacy_purchase`
- 利用者本人の18歳以上確認・専用規約同意・同意解除
- 成人向けReportの作成・履歴・再表示
- RLSによる作成・再表示の強制拒否
- 管理操作と本人同意の監査ログ
- migration、rollback、canonical schema、preflight
- 管理者UI・利用者UI・テスト・runbook

## 安全境界

- 一般向け市場分析は成人向け権限に依存しない。
- 成人向けは環境Flag、DB Kill Switch、個別許可、有効期限、本人同意の全条件でfail closedする。
- 管理者権限更新はService Role専用RPCで監査ログと原子的に保存する。
- 成人向け画像・本文生成、Stripe自動連携、作品公開・販売は行わない。
- 外部APIの有料実行、本番Feature Flag有効化、staging migration適用、本番公開は行わない。

## migration

- `202607290008_cloud_adult_research_option.sql`
- 対応rollbackあり
- manifestは19件へ更新

## 検証状況

- 成人向け権限集中テスト: PASS
- Release 1 preflightテスト: PASS
- `deps:check`: PASS
- lint／typecheck／build: PASS
- Research Evaluation: PASS
- Hub test: PASS（180/180）
- migration静的検証: PASS（19/19）
- migration forward／rollback／reapply／canonical schema: PASS（PostgreSQL 16）
- `git diff --check`: PASS

## 未完了

1. Previewでの管理者許可・本人同意・作成・停止後拒否の実機確認
2. Supabase stagingへのmigration適用（責任者作業）
3. Vercel環境変数設定とDB Kill Switch有効化（責任者作業）
4. 成人向け専用規約本文と運用対象者の責任者承認
5. CI・Vercel Previewの確認

## 次担当者が最初に読むファイル

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`
4. 本ファイル
5. `docs/HANDOFF_LOG.md`
6. `docs/cloud/CLOUD_ADULT_RESEARCH_OPTION_SPEC.md`
7. `docs/cloud/CLOUD_RESEARCH_RELEASE_RUNBOOK.md`
