# MANGAI Current Task

## 基本情報

- 更新日: 2026-07-29
- 状態: `IN_PROGRESS`（Release 4ローカル実装・品質ゲート完了、外部E2E待ち）
- リポジトリ: `team478a/manga`
- Base: `codex/cloud-scenario-mvp`（Draft PR #52）
- Branch: `codex/cloud-manga-mvp`
- Release 1 Draft PR: [#50](https://github.com/team478a/manga/pull/50)
- Release 2 Draft PR: [#51](https://github.com/team478a/manga/pull/51)
- Release 3 Draft PR: [#52](https://github.com/team478a/manga/pull/52)
- Release 4 Draft PR: [#53](https://github.com/team478a/manga/pull/53)
- 計画: [`docs/cloud/CLOUD_MANGA_RELEASE_PLAN.md`](cloud/CLOUD_MANGA_RELEASE_PLAN.md)
- 仕様: [`docs/cloud/CLOUD_MANGA_MVP_SPEC.md`](cloud/CLOUD_MANGA_MVP_SPEC.md)

## 目的

確定済みの一般向けシナリオから、マンガのページ・コマ割り下書きを生成し、Cloud Creatorの編集可能なProjectとして保存・履歴・再表示できるRelease 4の縦型機能を完成させる。

## 実装済み

- `CLOUD_MANGA_MVP_ENABLED`（未設定時fail closed）
- 所有者本人の確定シナリオ・採用企画・市場分析ReportをServer側で再取得
- `manga-layout-rules-v1`で各ページの役割、対象シーン、コマ数、コマ割りを生成
- 最大200ページ、全年齢、右開き、1600×2400px／300dpiへ限定
- 成人向け、不正ページ数、シーン範囲外、trace不一致の拒否
- 1シナリオ確定につき1生成・1Cloud Projectへ固定した冪等RPC
- Project、Episode、全Page、編集可能なCanvas snapshot、Project versionの原子的作成
- マンガ生成履歴、詳細、ページ設計、Cloud Creator編集画面への導線
- シナリオ確定後だけマンガ生成を有効化
- Generationの所有者RLSとDB側snapshot照合
- migration／rollback／canonical schema／manifest
- 計画・仕様文書

## 重要な設計判断

- Release 4初期engineは外部Provider非依存の`manga-layout-rules-v1`。確定シナリオから編集可能な構造下書きを作る。
- 生成結果は全体を`ai_inference`として扱い、画像生成済み作品ではないことを画面に明示する。
- DB advisory lockと一意制約により、同じシナリオ確定からProjectを重複生成しない。
- 作成されるCanvasは既存Editor契約を利用し、Editor本体のロジックは変更しない。
- Cloud AI Queue／Worker／Provider Gatewayは今回使用しない。
- Release 1〜3の外部E2E未完了は解除せず、Release 4をstacked branchで先行している。

## 検証

- Hub全テスト: PASS（160/160）
- マンガfocused test: PASS（8/8）
- deps:check: PASS
- lint: PASS
- typecheck: PASS（Hub + Desktop、Desktop変更なし）
- migration検証: PASS（20件）
- PostgreSQL migration往復／canonical schema検査: PASS
- production build: PASS
- 外部環境E2E: 未実施

## 外部環境待ち

1. Release 1〜4 migrationを対象Supabaseへ順番に適用
2. Vercelで`CLOUD_RESEARCH_MVP_ENABLED=true`
3. Vercelで`CLOUD_PROPOSAL_MVP_ENABLED=true`
4. Vercelで`CLOUD_SCENARIO_MVP_ENABLED=true`
5. Vercelで`CLOUD_MANGA_MVP_ENABLED=true`
6. 市場分析 → 企画生成・採用 → シナリオ初稿・改稿・確定 → マンガ下書き生成 → Creator編集の実ブラウザE2E
7. 別利用者RLS、重複生成の冪等性、200ページ上限の確認
8. 390px／768px／1280px受入れ
9. 全CIと責任者承認

## 禁止事項

- `feature/manga-canvas-mvp`への直接push／merge
- Draft PR #50〜#53の外部ゲート未完了扱いの解除
- 既存migrationの変更
- Cloud AI Queue／Worker／Provider Gateway、Canvas Editor本体、Stripe、Marketplace、Desktopへの変更
- 成人向けコンテンツのCloud処理
- 全CI・外部E2E・責任者承認前のmerge

## 次担当者が最初に読むファイル

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`
4. 本ファイル
5. `docs/HANDOFF_LOG.md`
6. `docs/cloud/CLOUD_MANGA_RELEASE_PLAN.md`
7. `docs/cloud/CLOUD_MANGA_MVP_SPEC.md`
