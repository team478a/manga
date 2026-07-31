# 外部Provider APIキー管理方針

## 対象

OpenAI、Grok、Resend、および今後追加する検索・生成ProviderのAPIキーは、
管理者画面から入力、保存、差し替えできるようにする。

## 必須要件

- APIキーはServer Actionだけで受け取る。
- 保存先はSupabase Vaultとし、通常テーブルにはVaultのsecret IDだけを保持する。
- 保存後はAPIキー本体、先頭・末尾文字、fingerprintを画面や監査ログへ再表示しない。
- 管理画面では「設定済み／未設定」と更新日時だけを表示する。
- 新しいキーを保存したら、その設定を自動的に有効化する。
- 実行時の復号はservice role専用RPCからのみ行う。
- Providerのエラー本文や認証情報を利用者向け表示・ログへ露出しない。
- 設定変更は操作者、変更種別、日時を監査ログへ記録する。

## 対象外

Supabase URL・service role、Stripe webhook secret、署名鍵などの基盤秘密情報は
管理画面へ移さない。Vercelなどのデプロイ環境変数、または専用Secret Storeで管理する。
