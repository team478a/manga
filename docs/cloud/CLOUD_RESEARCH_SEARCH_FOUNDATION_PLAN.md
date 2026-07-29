# MANGAI Cloud 検索候補収集基盤 実装計画

作成日: 2026-07-29
依存: Draft PR #57 出典Server検証基盤

## 目的

市場分析の入力前にWeb検索から出典候補を収集し、利用者が原文を確認して採用できるようにする。検索snippetを事実として自動保存せず、安全な出典検証と人による確認を必須境界として維持する。

## 今回の範囲

- Provider中立の検索interface
- Brave Web Search API adapter
- 日本向け、strict safe search、Web結果だけの検索
- timeout、応答容量、schema、URL、重複結果の検証
- 検索語をURLや通常ログへ出さないPOST Server Action
- 認証、Feature Flag、API key未設定時のfail closed
- 既存DB RPCを再利用した全体・利用者単位のrate limit
- 出典検証allowlist適合状況の表示
- 候補タイトル・URL・根拠分野を市場分析Formへ引き継ぐ導線
- 検索snippetを事実メモへ自動転記しない

## 今回変更しないもの

- 検索結果本文の自動取得
- 検索snippetからの事実抽出
- LLM生成
- 主張の含意・矛盾判定
- 検索履歴のDB保存
- Supabase migration
- Cloud AI Worker、Canvas、Stripe、Marketplace、Desktop

## 完了条件

- API keyやFeature Flagがない場合に外部検索しない。
- 全体300回/分、利用者10回/分を検索Provider呼出前に制限する。
- 検索語をGET URLへ含めない。
- Providerの異常応答、rate limit、timeout、容量超過をDomain Errorへ変換する。
- HTTPS以外、IP literal、認証情報付きURLを候補から除外する。
- 候補採用後も事実メモは空欄で、原文確認なしに分析を実行できない。
- allowlist外の候補は検証対象外であることを画面へ明示する。
