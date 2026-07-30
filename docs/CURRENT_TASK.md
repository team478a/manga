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

一般向け市場分析を、ジャンルとテーマだけでも実行できるOpenAI Web検索付き分析とし、「今、どんな漫画が買われる可能性が高いか」を最優先の結論として表示する。APIキーは管理者画面からSupabase Vaultへ保存する。

## 実装範囲

- ジャンルとテーマだけを表に出した簡単入力
- 読者、公開先、価格帯、形式、ページ数は折りたたみ内でAIおまかせを標準化
- 任意の作品イメージだけを自由入力
- OpenAI Responses API、Web search、Structured Outputs
- 異なる2ドメイン以上の引用がない応答の保存拒否
- 売れ筋の作品像、購入理由、商品設計を最上段へ表示
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

1. migrationとAPIキー設定は2026-07-30に責任者が実施済み（秘密値は記録しない）
2. 更新Previewで「AIにおまかせ」市場分析の実機E2E
3. OpenAI利用料金・rate limit・プライバシー告知の承認
4. 成人向け外部Provider送信を許可する場合の別途明示同意設計
5. PRレビューと公開判断

## 次担当者が最初に読むファイル

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`
4. 本ファイル
5. `docs/HANDOFF_LOG.md`
6. `docs/cloud/CLOUD_RESEARCH_AI_AUTO_UX_SPEC.md`
