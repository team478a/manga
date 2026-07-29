# MANGAI Cloud Research Quality v2 実装計画

作成日: 2026-07-29

## 目的

市場分析の根拠を分析項目ごとに追跡し、出典の種類・鮮度・独立性・分野網羅率を明示する。外部検索やLLMを導入する前に、根拠の薄い結論を検出して利用者へ伝える品質ゲートを作る。

## 現状の課題

- 9項目すべてへ全出典URLを一律に付けている。
- 利用者が入力した制作条件と、出典で確認した事実の表示区分が同じである。
- 出典の種類、公開日時、独立ドメイン数、必要分野の不足を評価していない。
- 根拠が不足していても分析完了として次工程へ進める。

## 段階

### Phase A: 構造化根拠と品質評価

- 出典種別、公開日時、根拠分野を入力
- 分析項目ごとのclaim-level URL
- `source_fact`／`user_input`／`ai_inference`の根拠区分
- 出典鮮度、独立ドメイン、分野網羅、注意事項
- 項目別confidenceと全体quality score
- v1 Reportとの読み取り互換

### Phase B: 取得・検証基盤

- allowlistまたは検索Provider経由のServer-side取得
- URL正規化、redirect・private IP・容量・MIME制限
- 本文snapshot hash、取得失敗、robots・利用規約記録
- 同一主張の複数出典照合と相反情報検出

### Phase C: AI統合

- 検証済み本文だけを検索対応LLMへ渡す
- 構造化出力schemaと引用必須化
- claimごとのentailment検査
- 根拠なし数値、古い出典、単一出典依存の自動拒否
- 人手評価用golden setと回帰eval

## 今回の範囲

Phase Aを実装する。外部URL取得、検索API、LLM、課金処理は変更しない。

## 完了条件

- 新規Reportが`research-rules-v2`で保存される。
- 各分析項目に根拠区分、confidence、対応URLがある。
- 出典品質と不足分野がReport上で確認できる。
- v1 Reportを引き続き再表示・企画引継ぎできる。
- 根拠のない市場数値を生成しない。
