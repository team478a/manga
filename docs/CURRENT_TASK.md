# MANGAI Current Task

## 基本情報

- 更新日: 2026-07-29
- 状態: `IN_PROGRESS`（Release 3ローカル実装・品質ゲート完了、外部E2E待ち）
- リポジトリ: `team478a/manga`
- Base: `codex/cloud-proposal-mvp`（Draft PR #51）
- Branch: `codex/cloud-scenario-mvp`
- Release 1 Draft PR: [#50](https://github.com/team478a/manga/pull/50)
- Release 2 Draft PR: [#51](https://github.com/team478a/manga/pull/51)
- 計画: [`docs/cloud/CLOUD_SCENARIO_RELEASE_PLAN.md`](cloud/CLOUD_SCENARIO_RELEASE_PLAN.md)
- 仕様: [`docs/cloud/CLOUD_SCENARIO_MVP_SPEC.md`](cloud/CLOUD_SCENARIO_MVP_SPEC.md)

## 目的

採用済みの一般向け企画から、シナリオ初稿の生成・保存・履歴・再表示・方針別改稿・確定まで完走できるRelease 3の縦型機能を完成させる。

## 実装済み

- `CLOUD_SCENARIO_MVP_ENABLED`（未設定時fail closed）
- 所有者本人の採用企画・市場分析ReportをServer側で再取得
- `scenario-rules-v1`で登場人物、三幕構成、1〜8シーン、ページ配分を生成
- 出典URLと採用候補・市場分析Reportへのtraceを結果へ固定
- 成人向け・出典なし・不正ページ数の拒否
- 初稿／改稿Runのimmutable保存と原子的な版番号採番
- テンポ／人物変化／分かりやすさの改稿方針
- シナリオ履歴、詳細、版履歴、レスポンシブ表示
- 1採用企画につき1つの確定snapshot
- 確定後だけRelease 4引継ぎ準備完了を表示
- Run／Confirmationの所有者RLSとDB側snapshot照合
- migration／rollback／canonical schema／manifest
- 計画・仕様文書

## 重要な設計判断

- Release 3初期engineは外部Provider非依存の`scenario-rules-v1`。保存・改稿・確定契約を先に固定する。
- シナリオは全体を`ai_inference`として扱い、市場の事実ではないことを画面に明示する。
- 初稿と改稿は上書きせず、Runをimmutableに追加する。
- 版番号はDB advisory lockを使ったRPCで原子的に採番する。
- 確定snapshotは1採用企画につき1つに固定し、確定後の改稿を禁止する。
- Cloud AI Queue／Worker／Provider Gatewayは今回使用しない。
- Release 1／2の外部E2E未完了は解除せず、Release 3をstacked branchで先行している。

## 検証

- Hub全テスト: PASS（152/152）
- シナリオfocused test: PASS（10/10）
- deps:check: PASS
- lint: PASS
- typecheck: PASS（Hub + Desktop、Desktop変更なし）
- migration検証: PASS（19件）
- production build: PASS
- 外部環境E2E: 未実施

## 外部環境待ち

1. Release 1／2／3 migrationを対象Supabaseへ順番に適用
2. Vercelで`CLOUD_RESEARCH_MVP_ENABLED=true`
3. Vercelで`CLOUD_PROPOSAL_MVP_ENABLED=true`
4. Vercelで`CLOUD_SCENARIO_MVP_ENABLED=true`
5. 市場分析 → 企画生成・採用 → シナリオ初稿 → 改稿 → 確定の実ブラウザE2E
6. 別利用者RLSと確定後の改稿拒否確認
7. 390px／768px／1280px受入れ
8. 全CIと責任者承認

## 禁止事項

- `feature/manga-canvas-mvp`への直接push／merge
- Draft PR #50／#51の外部ゲート未完了扱いの解除
- 既存migrationの変更
- Cloud AI Queue／Worker／Provider Gateway、Canvas、Stripe、Marketplace、Desktopへの変更
- 成人向けコンテンツのCloud処理
- 全CI・外部E2E・責任者承認前のmerge

## 次担当者が最初に読むファイル

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`
4. 本ファイル
5. `docs/HANDOFF_LOG.md`
6. `docs/cloud/CLOUD_SCENARIO_RELEASE_PLAN.md`
7. `docs/cloud/CLOUD_SCENARIO_MVP_SPEC.md`
