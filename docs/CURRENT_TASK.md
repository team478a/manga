# MANGAI Current Task

## 基本情報

- 更新日: 2026-07-29
- 状態: `READY_FOR_REVIEW`
- リポジトリ: `team478a/manga`
- Base: `codex/cloud-adult-research-option-v1` (`a9969ac`)
- Branch: `codex/cloud-adult-planning-option-v1`
- 親Draft PR: [#66](https://github.com/team478a/manga/pull/66)
- Draft PR: 作成待ち
- Vercel Preview: 作成待ち
- 仕様: [`docs/cloud/CLOUD_ADULT_PLANNING_OPTION_SPEC.md`](cloud/CLOUD_ADULT_PLANNING_OPTION_SPEC.md)

## 現在の目的

成人向け市場分析を完了した許可利用者が、外部AIへ内容を送信せずに企画ブリーフを入力・保存・履歴表示・再表示できる縦型機能を追加する。

## 実装範囲

- `adult_planning`機能単位の追加許可
- 成人向け企画用Feature Flag
- 管理者による企画機能の許可・停止・期限設定
- 成人向け市場分析Reportからの企画条件引継ぎ
- 企画ブリーフの入力・保存・履歴・再表示
- 所有者・成人向け権限・機能権限を強制するRLS
- 管理操作の監査ログ
- migration、rollback、canonical schema、preflight、テスト、runbook

## 安全境界

- 外部AI Providerを呼び出さない。
- 成人向け文章・画像を自動生成しない。
- 一般向け企画提案画面は従来のRelease 2案内を維持する。
- 成人向け市場分析の全利用条件に加えて`adult_planning`個別許可を要求する。
- Feature Flag未設定、migration未適用、権限不足、期限切れはfail closedする。
- Stripe自動連携、作品公開・販売、Desktop、Canvasは変更しない。
- staging migration適用、本番Flag有効化、本番公開は行わない。

## 完了

- 設計文書
- migration・rollback・canonical schema・所有者RLS
- 管理者権限UIと監査
- 企画ブリーフの入力・保存・履歴・再表示
- Feature Flagと秘密値非表示preflight
- deps、lint、typecheck、Research Evaluation、Hub test（185/185）、build
- PostgreSQL 16 forward／rollback／reapply／canonical schema

## 責任者待ち

1. stacked Draft PRとVercel Previewの確認
2. 機能単位販売・付与方針の承認
3. staging migration適用
4. Preview環境Flag設定
5. 管理者許可、本人操作、権限停止の実機E2E
6. 本番公開判断

## 次担当者が最初に読むファイル

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`
4. 本ファイル
5. `docs/HANDOFF_LOG.md`
6. `docs/cloud/CLOUD_ADULT_RESEARCH_OPTION_SPEC.md`
7. `docs/cloud/CLOUD_ADULT_PLANNING_OPTION_SPEC.md`
