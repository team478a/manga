# Cloud Research Claim Extraction Plan

## 目的

検証済みの出典ページから、市場分析の「確認した事実」へ転記できる原文候補を抽出する。検索snippetを事実として扱わず、利用者が原文を確認して明示的に採用する流れを作る。

## 実装範囲

1. 既存の安全な出典取得処理から、正規化した一時本文snapshotを作る
2. 選択した根拠分野に対応する原文を決定的ルールで抽出・順位付けする
3. 抽出候補を画面に表示し、利用者の操作で出典1の事実メモへ転記する
4. Server Actionの認証、Feature Flag、利用制限を整備する
5. 本文非保存・人手確認・原文位置のテストを追加する

## 非対象

- LLMによる要約、数値生成、真偽判定
- 出典本文のDB保存、ログ出力、ブラウザへの全文返却
- Supabase migration
- 検索Providerや市場分析ロジックの変更
- Desktop、Canvas、Stripe、Marketplace

## 完了条件

- 許可済みHTTPS出典だけを取得できる
- HTMLのscript、navigation、footer等を候補本文から除外できる
- 選択分野と一致する20〜500文字の候補を最大8件返せる
- 候補が原文位置、原文hash、取得元hashを持つ
- 候補は自動保存されず、人が原文確認後に採用できる
- 型検査、Lint、Hubテスト、production buildが成功する
