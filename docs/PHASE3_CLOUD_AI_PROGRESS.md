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
- secret認証された内部worker endpointと、開発・自動テスト専用mock画像／文章Provider
- 生成画像のdecode、PNG再エンコードによるmetadata除去、SHA-256・寸法再検証、private Asset保存
- Editor内の一般向け画像Job登録、進捗・費用履歴、cancel、完成AssetのPanel layer配置
- 一般向け文章Job登録、生成結果の履歴表示、Canvas縦書きテキストへの追加
- 期限切れworker leaseの再claimと、古いleaseによる完了拒否
- 画像／文章の実Provider差分をServer内へ閉じ込めるMANGAI Cloud AI Gateway adapter
- HTTPS、redirect拒否、timeout、30MB上限、429／5xx限定retry、idempotency header
- Provider moderationの必須化と、送信前preflight・Provider判定の二重記録
- 明示的なWorker kill switchと、Queue／失敗／期限切れleaseの認証付き監視endpoint

## 検証

- ai-core: 38/38
- Hub単体テスト: 27/27
- canvas-core: 26/26、Desktop統合: 83/83
- Web／Desktop production build: 成功
- TypeScript、ESLint、migration静的検査7件: 成功
- PostgreSQL 16: forward、RLS権限、重複登録防止、moderation拒否、cancel、claim、完了、全rollback、正規schema二重適用に成功

## デプロイ時の受入れ

1. 契約済み画像Provider／文章ProviderをGatewayへ設定
2. stagingの実credentialで画像・文章fixtureを1件ずつ生成
3. Gateway access logで成人向けfixtureが送信されないことを確認
4. 定期起動と費用alertをデプロイ環境へ設定

リポジトリ側のPhase 3実装は完了。実credential、契約モデル、価格、schedulerは秘密値を伴うデプロイ設定として[Cloud AI Worker運用手順](CLOUD_AI_WORKER_OPERATIONS.md)のstaging受入れで確認する。

状態: **実装完了（2026-07-18）／実Gateway staging受入れ待ち**
