# APIキー管理画面方針

## 対象

管理者または利用者が外部Providerで取得し、運用中に交換するAPIキーを対象とする。

- 一般向けテキストAI: OpenAI
- 成人向けテキストAI: xAI / Grok
- 今後追加する検索、生成、翻訳等の外部Provider

## 必須UX

1. 管理画面でAPIキーを入力する。
2. 「APIキーを保存して利用開始」を押す。
3. 暗号化secret storeへ保存し、Providerを自動的に利用可能にする。
4. 変更時は同じ画面へ新しいキーを入力して保存する。
5. 保存済みキーは画面、Client、URL、通常テーブル、ログ、監査ログへ再表示しない。

モデル、endpoint、timeout等はServer側の安全な推奨値を使用し、通常の管理者に技術設定を要求しない。

## 対象外

以下はアプリ基盤credentialであり、管理画面へ入力させない。

- Supabase URL、anon key、service role key
- Stripe secret、Webhook署名鍵
- アプリ内署名secret、DB接続情報

これらはVercel等のデプロイ環境secretとして管理する。

## 安全要件

- APIキーの復号はServerのservice roleだけに許可する。
- 保存操作は管理者権限、入力形式、CSRF対策、rate limitを維持する。
- APIキー未設定、復号失敗、Provider停止時は外部送信前にfail closedする。
- Providerエラー本文や秘密値を利用者へ返さない。
- 成人向けはAPIキー設定だけでは許可せず、年齢確認、本人同意、個別許可、安全審査を別途要求する。
