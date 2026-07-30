# MANGAI Cloud 一般向け限定モニター計画

## 目的

一般向け制作フローを1〜3名へ無料・招待制で公開し、市場分析からコマ画像生成までの完走可否と改善点を確認する。

## 対象

- 市場分析
- AI企画提案
- シナリオ生成・修正・採用
- ネーム生成・修正・採用
- Canvas下書き
- 一般向けコマ画像生成
- フィードバック

Stripe、販売、Marketplace、成人向け機能は対象外とする。

## 公開制御

1. `CLOUD_GENERAL_MONITOR_BETA_ENABLED` は未設定時に停止する。
2. 管理者が対象Profile、期限、累計AI上限を設定する。
3. AI ProviderまたはQueueの呼出直前に、招待状態・期限・累計上限を原子的に確認する。
4. 停止操作は即時にAI実行を拒否する。Stripeや成人向け権限は変更しない。
5. PreviewのShareable Linkは個別に案内し、一般公開しない。

## データ

- `cloud_general_monitor_enrollments`
- `cloud_general_monitor_ai_usage`
- `cloud_general_monitor_feedback`
- `cloud_general_monitor_audit_logs`

所有者RLS、管理者監査、Service Role限定RPCを使用する。
