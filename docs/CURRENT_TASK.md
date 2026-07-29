# MANGAI Current Task

## 基本情報

- 更新日: 2026-07-29
- 状態: `IN_PROGRESS`（Release 6ローカル実装・品質ゲート完了、外部E2E待ち）
- リポジトリ: `team478a/manga`
- Base: `codex/cloud-work-management-mvp`（Draft PR #54）
- Branch: `codex/cloud-sales-preparation-mvp`
- Release 1 Draft PR: [#50](https://github.com/team478a/manga/pull/50)
- Release 2 Draft PR: [#51](https://github.com/team478a/manga/pull/51)
- Release 3 Draft PR: [#52](https://github.com/team478a/manga/pull/52)
- Release 4 Draft PR: [#53](https://github.com/team478a/manga/pull/53)
- Release 5 Draft PR: [#54](https://github.com/team478a/manga/pull/54)
- Release 6 Draft PR: [#55](https://github.com/team478a/manga/pull/55)
- 計画: [`docs/cloud/CLOUD_SALES_PREPARATION_RELEASE_PLAN.md`](cloud/CLOUD_SALES_PREPARATION_RELEASE_PLAN.md)
- 仕様: [`docs/cloud/CLOUD_SALES_PREPARATION_MVP_SPEC.md`](cloud/CLOUD_SALES_PREPARATION_MVP_SPEC.md)

## 目的

Release 5で承認された一般向けCloud Projectを、非公開作品・販売停止商品として安全かつ冪等に販売準備へ同期できるRelease 6の縦型機能を完成させる。

## 実装済み

- `CLOUD_SALES_PREPARATION_MVP_ENABLED`（未設定時fail closed）
- 販売準備一覧・詳細と、Dashboard／作品管理／Creatorからの段階導線
- Release 5で現行revisionが`approved`の一般向けProjectだけを同期
- 既存のCloud PDF／表紙exportを再利用
- 1 Projectにつき非公開`works` 1件・`paused`商品1件へ冪等同期
- 同期済みrevision・価格・作品／商品ID・同期日時の保存
- 未同期／同期済み／要再同期／販売中の状態表示
- Project再編集で承認が失効した場合の再同期拒否
- 公開済み作品または販売中商品の自動上書き禁止
- 所有者RLS、利用者の同期記録table直接更新禁止
- 旧Marketplace RPCの認証ユーザー直接実行を廃止し、承認ゲート付きRPCへ集約
- PostgreSQL実動作テストをCI migration roundtripへ追加
- migration／rollback／canonical schema／manifest
- 計画・仕様文書

## 重要な設計判断

- Release 6は既存Cloud Project、Release 5承認、既存Marketplace下書きを正本として再利用する。
- 同期は単一transaction内で承認とrevisionを再検証し、二重送信でも重複作成しない。
- Cloudからは公開・販売開始を自動実行せず、既存Dashboardで人が最終確認する。
- 公開済み／販売中のデータはCloud再同期で上書きしない。
- Canvas Editor、Cloud AI、Stripe決済、Marketplace公開業務、Desktopは変更しない。
- Release 1〜5の外部E2E未完了は解除せず、Release 6をstacked branchで先行している。

## 検証

- Hub全テスト: PASS（170/170）
- 販売準備focused test: PASS（6/6）
- deps:check: PASS
- lint: PASS
- typecheck: PASS（Hub + Desktop、Desktop変更なし）
- migration検証: PASS（22件）
- PostgreSQL migration往復／canonical schema検査: PASS
- PostgreSQL販売準備同期・冪等性・承認失効動作テスト: PASS
- production build: PASS
- 外部環境E2E: 未実施

## 外部環境待ち

1. Release 1〜6 migrationを対象Supabaseへ順番に適用
2. Vercelで`CLOUD_RESEARCH_MVP_ENABLED=true`
3. Vercelで`CLOUD_PROPOSAL_MVP_ENABLED=true`
4. Vercelで`CLOUD_SCENARIO_MVP_ENABLED=true`
5. Vercelで`CLOUD_MANGA_MVP_ENABLED=true`
6. Vercelで`CLOUD_WORK_MANAGEMENT_MVP_ENABLED=true`
7. Vercelで`CLOUD_SALES_PREPARATION_MVP_ENABLED=true`
8. 市場分析 → 企画 → シナリオ → マンガ下書き → Creator編集 → Page確認 → 承認 → 販売準備同期の実ブラウザE2E
9. 別利用者RLS、revision失効、二重送信、公開済み／販売中上書き拒否の確認
10. 390px／768px／1280px受入れ
11. 全CIと責任者承認

## 禁止事項

- `feature/manga-canvas-mvp`への直接push／merge
- Draft PR #50〜#55の外部ゲート未完了扱いの解除
- 既存migrationの変更
- Cloud AI Queue／Worker／Provider Gateway、Canvas Editor本体、Stripe決済、Marketplace公開業務、Desktopへの変更
- 成人向けコンテンツのCloud処理
- 全CI・外部E2E・責任者承認前のmerge

## 次担当者が最初に読むファイル

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`
4. 本ファイル
5. `docs/HANDOFF_LOG.md`
6. `docs/cloud/CLOUD_SALES_PREPARATION_RELEASE_PLAN.md`
7. `docs/cloud/CLOUD_SALES_PREPARATION_MVP_SPEC.md`
