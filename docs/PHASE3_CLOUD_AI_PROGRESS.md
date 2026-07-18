# MANGAI 一般向けCloud AI Phase 3 進捗

開始日: 2026-07-18

## 今回完了した基盤

- Cloud専用`CloudImageGenerationProvider`／`CloudTextGenerationProvider`契約
- Provider capability、policy version、pricing version、model IDのregistry
- 画像／文章Job種別と入力schema。種類が一致しない要求は拒否
- 成人向け、未成年、不同意、違法内容を送信前にblockし、実在人物・曖昧入力をreviewへ送る一般向けpreflight
- 一時障害だけを最大試行回数内で再試行する純粋判定
- `cloud_generation_jobs`による入力、状態、進捗、試行、費用、出力、エラー、worker leaseの永続化
- 利用者単位idempotency key、Project／Page所有権再確認、一般向けProject制約
- 利用者向けJob登録・履歴・キャンセルAPI
- service roleだけが利用できる`FOR UPDATE SKIP LOCKED` claimとlease一致必須の完了RPC
- Provider未設定時は生成だけを停止し、編集・保存・書き出しを継続できるfail-closed registry

## 検証

- ai-core: 38/38
- TypeScript、ESLint、migration静的検査7件: 成功
- PostgreSQL 16: forward、RLS権限、重複登録防止、moderation拒否、cancel、claim、完了、全rollback、正規schema二重適用に成功

## 次の実装

1. Provider adapter実装と秘密値をServer環境だけで読むworker
2. timeout、429、5xx、cancel、lease期限切れ回収のworker統合テスト
3. 生成画像のdecode・metadata除去・private Asset保存
4. 生成結果をCanvas Panel layerへ配置するUI
5. 文章生成結果、生成履歴、実費表示

実Providerの選定とAPI credential設定が必要になるまでは、mock adapterを使ってworker全体を検証する。
