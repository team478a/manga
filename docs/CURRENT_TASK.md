# MANGAI Current Task

## 基本情報

- 更新日: 2026-07-30
- 状態: `IMPLEMENTED_LOCAL`
- リポジトリ: `team478a/manga`
- Base: `codex/cloud-adult-planning-option-v1` (`58a18b9`)
- Branch: `codex/cloud-research-ai-auto-ux-v1`
- 仕様: [`docs/cloud/CLOUD_RESEARCH_AI_AUTO_UX_SPEC.md`](cloud/CLOUD_RESEARCH_AI_AUTO_UX_SPEC.md)
- 実装記録: [`docs/cloud/CLOUD_RESEARCH_AI_AUTO_UX_IMPLEMENTATION_REPORT.md`](cloud/CLOUD_RESEARCH_AI_AUTO_UX_IMPLEMENTATION_REPORT.md)

## 現在の目的

一般向け市場分析を、選択式の制作条件からOpenAIのWeb検索付き分析として実行し、利用者へ出典入力を要求せず結果だけを保存・表示する。APIキーは管理者が画面から設定し、Supabase Vaultへ暗号化保存する。

## 実装範囲

- ジャンル、読者、公開先、テーマ、価格帯、形式、ページ数の選択式Form
- 任意の参考作品だけを自由入力
- OpenAI Responses API、Web search、Structured Outputs
- 引用URLがない応答の保存拒否
- 管理者用APIキー・model・停止設定
- Vault保存、service-role限定復号、設定監査
- Providerエラー・未設定・timeout・rate limitの安全な利用者表示
- migration、rollback、canonical schema、テスト、runbook

## 安全境界

- APIキーを通常テーブル、Client、URL、ログ、監査ログへ保存・表示しない。
- 一般向けだけをOpenAIへ送信する。
- 成人向け本文は外部AIへ送信せず、AI選択肢を準備中として停止する。
- 引用のないAI応答と、根拠のない市場数値を保存しない。
- migration適用、APIキー登録、有効化、本番公開は責任者が実施する。
- Desktop、Canvas、Stripe、Marketplace、DB既存業務ロジックは変更しない。

## 責任者待ち

1. migration `202607300001_cloud_research_ai_provider.sql` のstaging適用
2. `/admin/research-ai` でAPIキー、model、実行状態を登録
3. Previewで一般向け市場分析の実機E2E
4. OpenAI利用料金・rate limit・プライバシー告知の承認
5. 成人向け外部Provider送信を許可する場合の別途明示同意設計
6. PRレビューと公開判断

## 次担当者が最初に読むファイル

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`
4. 本ファイル
5. `docs/HANDOFF_LOG.md`
6. `docs/cloud/CLOUD_RESEARCH_AI_AUTO_UX_SPEC.md`
