# Cloud成人向けAI企画 v1

成人向け市場分析Reportから、売れる理由・読者体験・主人公・対立・商品設計の異なる3案をAIが提案します。一般向けと成人向けは`content_class`で保存時から区別します。

## 安全・権限

- 初期状態は環境Flag・DB Kill Switchとも停止です。
- 管理者は成人向け市場分析とは別に成人向けAI企画を個別許可します。
- 利用者は外部AI送信を含む専用条件へ同意します。
- 未成年・年齢不詳、実在人物、非同意・搾取的な入力はProvider呼出前に拒否します。
- AI出力も同じ規則で検査し、不適合なら保存しません。
- `store:false`でOpenAI Responses APIを呼び出し、既存のSupabase Vault設定を使います。

## 管理手順

1. migration `202607300006_cloud_adult_ai_planning.sql`を適用
2. Vercel Previewの`CLOUD_ADULT_AI_PLANNING_ENABLED`を`true`に設定
3. 管理画面「成人向け市場分析の運用」で成人向けAI企画のDB設定を有効化
4. ユーザー詳細で「成人向けAI企画機能」を許可
5. 利用者が企画画面で専用条件へ同意

本番有効化とmigration適用は責任者作業です。
