# Cloud成人向けGrok Provider v1

## 目的

一般向けテキストAIのOpenAI接続を変更せず、許可済み成人向け市場分析・企画・シナリオ・ネームをxAI/Grokへ分離する。成人向け画像生成、一般公開、販売は対象外。

## 境界

- 一般向け: OpenAI、既存Vault設定、既存engine versionを維持
- 成人向け: xAI Responses API、専用Vault secret、専用engine version
- 実行条件: 各工程Feature Flag、成人向け権限、18歳以上確認、本人同意、DB Kill Switch、限定モニター枠、`CLOUD_ADULT_GROK_ENABLED=true`、Grok設定済み
- 禁止: 未成年・年齢不詳・実在人物・非同意・搾取的内容
- 保存前後: `reviewAdultGenerationPrompt`で入力と出力を審査
- 秘密: APIキー、prompt、成人向け生成内容を画面・監査ログ・アプリログへ残さない

## 実装

- `/admin/adult-grok`: xAI APIキー、モデル、DB側実行状態
- Supabase Vault secret: `mangai_cloud_adult_xai`
- 対応モデル: `grok-4.5`、`grok-4.20`
- 成人向けengine:
  - `xai-adult-web-research-v1`
  - `xai-adult-proposal-v1`
  - `xai-adult-scenario-v1`
  - `xai-adult-storyboard-v1`
- migration: `202607310001_cloud_adult_grok_provider`

## 非対象

- 成人向け画像生成
- Providerへの有料実リクエスト
- migration適用
- Feature Flag有効化
- 本番公開・既存PRのマージ

## 受入条件

- 一般向けはOpenAI endpointだけを使う
- 成人向けはxAI endpointだけを使う
- 成人向け環境Flag未設定時はDB・Providerアクセス前に停止
- 不正入力はProvider前、不正出力は保存前に拒否
- Provider内部エラーとAPIキーを利用者へ露出しない
- migration forward/rollback/canonical schemaが一致
