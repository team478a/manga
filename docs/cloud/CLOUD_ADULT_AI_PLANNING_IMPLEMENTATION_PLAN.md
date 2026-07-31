# Cloud成人向けAI企画 実装計画

## 目的

一般向け企画生成を変更せず、許可された成人利用者だけに成人向けAI企画を提供する。

## 境界

- 一般向け: `content_class=general`。既存の市場分析→企画→シナリオ導線を維持する。
- 成人向け: `content_class=adult`。市場分析→AI企画3案→比較→選択まで。
- 成人向けシナリオ、ネーム、Canvas、画像生成は本フェーズでは実行しない。
- OpenAI設定は既存の管理画面とSupabase Vaultを共有し、APIキーを画面・ログ・DB通常列へ表示しない。

## 利用条件

1. `CLOUD_ADULT_AI_PLANNING_ENABLED=true`
2. 成人向け市場分析の利用条件が有効
3. DB Kill Switchが有効
4. `adult_ai_planning`の個別許可が有効
5. 18歳以上、架空の成人、合意・非搾取、実在人物禁止、OpenAI送信への同意
6. 入力とAI出力の安全検査に合格

## 完了条件

- 一般／成人がDBとUIで区別される
- 成人向け3案の生成、保存、履歴、比較、選択が完走する
- 権限失効後はRLSで成人向け結果を読めない
- 成人向け企画から一般向けシナリオへ進めない
- migration、rollback、canonical schema、preflight、テストが揃う
