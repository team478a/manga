# Cloud Research Evaluation v1 Plan

## 目的

事実候補抽出と複数出典照合の品質を固定データで継続測定し、ルール変更による誤検出・見逃しの増加をCIで検知する。

## 実装範囲

1. 7分野を網羅する事実候補抽出golden setを追加する
2. 一致・相反可能性・関連・根拠不足を網羅する照合golden setを拡張する
3. 抽出Top-3命中率と禁止文漏出率を計算する
4. 照合4分類のconfusion matrix、Precision、Recall、F1を計算する
5. fixture件数・分野・分類の最低網羅数を検証する
6. 閾値未達で終了code 1を返す評価commandを作る
7. Required Quality workflowへ評価commandを追加する

## 品質基準

### 事実候補抽出

- fixture: 21件以上
- 各分野: 3件以上
- Top-3 expected hit rate: 95%以上
- forbidden sentence leak rate: 0%

### 複数出典照合

- fixture: 28件以上
- 各分類: 5件以上
- accuracy: 95%以上
- macro F1: 90%以上
- `potential_conflict` Precision: 100%
- `potential_conflict` Recall: 90%以上
- `corroborates` Precision: 95%以上
- `corroborates` Recall: 90%以上

相反可能性のfalse positiveを最も重大な回帰として扱う。

## 非対象

- 実Webデータ収集
- LLM judge、埋め込み、外部AI API
- 市場予測の正確性評価
- 出典の権威性や調査方法の自動評価
- DB、Storage、migration、公開UIの変更

## 完了条件

- 合計49件以上の固定評価ケースを持つ
- 評価結果が人間可読JSONとして出力される
- 閾値未達・fixture不足・不正fixtureでcommandが失敗する
- CI artifactへ評価logを保存する
- 全既存テスト、型検査、Lint、build、CIが成功する
