# MANGAI Current Task

## 基本情報

- 更新日: 2026-07-29
- 状態: `IN_PROGRESS`（Release 2ローカル実装・品質ゲート完了、外部E2E待ち）
- リポジトリ: `team478a/manga`
- Base: `codex/cloud-research-mvp`（Draft PR #50）
- Branch: `codex/cloud-proposal-mvp`
- Release 1 Draft PR: [#50](https://github.com/team478a/manga/pull/50)
- 計画: [`docs/cloud/CLOUD_PROPOSAL_RELEASE_PLAN.md`](cloud/CLOUD_PROPOSAL_RELEASE_PLAN.md)
- 仕様: [`docs/cloud/CLOUD_PROPOSAL_MVP_SPEC.md`](cloud/CLOUD_PROPOSAL_MVP_SPEC.md)

## 目的

完了した市場分析Reportから、一般向け漫画の企画候補を生成・保存・比較・再表示・採用できるRelease 2の縦型機能を完成させる。

## 実装済み

- `CLOUD_PROPOSAL_MVP_ENABLED`（未設定時fail closed）
- 完了済み・所有者本人・一般向けの市場分析Reportだけを入力に使用
- `proposal-rules-v1`で方向性の異なる3候補を生成
- 企画Runのimmutable保存、履歴、再表示
- 3候補のレスポンシブ比較
- Reportごとに1候補だけをsnapshotとして採用
- 採用後のRelease 3引継ぎ条件表示
- Run／Selectionの所有者RLSとDB側候補snapshot照合
- migration／rollback／canonical schema／manifest
- 計画・仕様文書

## 重要な設計判断

- 既存Cloud AI QueueはProject作成後の文章・画像生成契約であるため、市場分析直後の企画保存には流用しない。
- Release 2初期engineは外部Provider非依存の`proposal-rules-v1`。保存・履歴・採用契約を先に固定する。
- 全候補を`ai_inference`として表示し、市場の事実や販売予測として扱わない。
- 根拠のない市場数値を生成しない。
- 外部Provider実装は将来、生成interfaceの差し替えとして追加する。
- Release 1の外部E2E未完了は解除せず、Release 2をstacked branchで先行している。

## 検証

- Hub proposal／researchを含む単体テスト: PASS（142/142）
- deps:check: PASS
- lint: PASS
- typecheck: PASS（Hub + Desktop、Desktop変更なし）
- migration検証: PASS（18件）
- production build: PASS
- 外部環境E2E: 未実施

## 外部環境待ち

1. Release 1 migrationを対象Supabaseへ適用
2. Release 2 migrationを対象Supabaseへ適用
3. Vercelで`CLOUD_RESEARCH_MVP_ENABLED=true`
4. Vercelで`CLOUD_PROPOSAL_MVP_ENABLED=true`
5. 入力 → 市場分析保存 → 企画3案生成 → 履歴 → 比較 → 採用の実ブラウザE2E
6. 別利用者RLS確認
7. 390px／768px／1280px受入れ
8. 責任者承認

## 禁止事項

- `feature/manga-canvas-mvp`への直接push／merge
- Draft PR #50の外部ゲート未完了扱いの解除
- 既存migrationの変更
- Cloud AI Queue／Worker／Provider Gateway、Canvas、Stripe、Marketplace、Desktopへの変更
- 根拠のない市場数値の生成
- 全CI・外部E2E・責任者承認前のmerge

## 次担当者が最初に読むファイル

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`
4. 本ファイル
5. `docs/HANDOFF_LOG.md`
6. `docs/cloud/CLOUD_PROPOSAL_RELEASE_PLAN.md`
7. `docs/cloud/CLOUD_PROPOSAL_MVP_SPEC.md`
