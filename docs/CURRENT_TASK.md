# MANGAI Current Task

## 基本情報

- 更新日: 2026-07-30
- 状態: `READY_FOR_PREVIEW_ACCEPTANCE`
- リポジトリ: `team478a/manga`
- Base: `codex/cloud-research-ai-auto-ux-v1` (`a21fd94`)
- Branch: `codex/cloud-proposal-generation-v1`
- 仕様: [`docs/cloud/CLOUD_PROPOSAL_GENERATION_V1.md`](cloud/CLOUD_PROPOSAL_GENERATION_V1.md)

## 現在の目的

完了した一般向け市場分析をもとにAIが異なる3つの漫画企画を作成し、利用者が比較・選択・保存して次のシナリオ生成へ進める状態にする。

## 実装範囲

- 市場分析から本命案・差別化案・小さく試す案をStructured Outputsで3件生成
- 売れやすさ・作りやすさ・独自性と、買われる理由・主人公・対立・商品設計を比較
- 選択した企画を不変snapshotとして保存し再表示
- 市場分析AI用の管理画面設定とVault API keyを再利用
- Web検索を再実行せず、保存済み市場分析だけを企画へ変換
- Feature Flag、rate limit、所有者RLS、UUID検証、内部エラー秘匿
- migration、rollback、canonical schema、テスト、公開前手順

## 安全境界

- APIキーを通常テーブル、Client、URL、ログ、監査ログへ保存・表示しない。
- 一般向け市場分析だけをOpenAIへ送信する。
- 成人向けは外部AIへ送信せず、既存の許可制手動企画ブリーフを維持する。
- 市場分析にない市場数値を生成せず、売上を保証しない。
- migration適用、APIキー登録、有効化、本番公開は責任者が実施する。
- Desktop、Canvas、Stripe、Marketplace、DB既存業務ロジックは変更しない。

## 責任者待ち

1. 市場分析AI Provider migrationとAPIキー設定は2026-07-30に責任者が実施済み（秘密値は記録しない）
2. proposal migration `202607300002`の対象Preview DB適用状態確認
3. 対象Preview branchだけの`CLOUD_PROPOSAL_GENERATION_ENABLED=true`確認
4. Previewで3案生成・再表示・選択の実機E2E
5. OpenAI利用料金・rate limit・プライバシー告知の承認
6. 成人向け外部Provider送信を許可する場合の別途明示同意設計
7. PRレビューと公開判断

## 限定公開前ハードニング

- 生成・選択buttonのpending状態と二重送信防止
- 企画未作成Empty State
- 企画提案専用のloading、error、not found境界と内部情報を出さない案内
- 390pxで評価項目を縦並びにし、AI生成文を折り返す構造
- Release 2専用preflight（秘密値非表示）
- 不正UUID、所有者外Run、selection snapshot、RLS契約の集中テスト
- 限定公開RunbookとBeta受入れ表

## 検証結果

- Release 2集中テスト: PASS（15/15）
- deps:check: PASS
- lint: PASS
- typecheck: PASS（Hub + Desktop）
- research:eval: PASS
- hub:test: PASS（210/210）
- db:migrations:validate: PASS（22/22）
- build: PASS
- git diff --check: PASS
- 実OpenAI生成: 未実施（有料実行・責任者実機受入れ）
- GitHub CI: PASS（Core quality、Migration roundtrip、Windows build）
- Vercel Preview: Ready
- Preview未ログイン画面: 390px／768px／1280pxで横overflowなし
- 企画画面の実ブラウザresponsive: PreviewドメインでMANGAIログインが必要なため`BLOCKED_EXTERNAL_ENVIRONMENT`

## 次担当者が最初に読むファイル

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`
4. 本ファイル
5. `docs/HANDOFF_LOG.md`
6. `docs/cloud/CLOUD_RESEARCH_AI_AUTO_UX_SPEC.md`
7. `docs/cloud/CLOUD_PROPOSAL_GENERATION_V1.md`
8. `docs/cloud/CLOUD_RELEASE2_LIMITED_RELEASE_RUNBOOK.md`
9. `docs/cloud/CLOUD_RELEASE2_BETA_ACCEPTANCE.md`
