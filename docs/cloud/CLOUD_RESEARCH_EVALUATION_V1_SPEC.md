# Cloud Research Evaluation v1 Specification

## 評価対象

### Claim extraction

入力:

- topic
- 正規化済みsource text
- 期待候補に含まれる文字列
- 候補へ含めてはいけない文字列

評価:

- 期待文字列がTop-3候補内に存在するか
- 禁止文字列が全候補に漏出していないか
- 分野別件数

### Corroboration

入力:

- 2つの原文候補
- 各候補の分野signal
- 期待relation

relation:

- `corroborates`
- `potential_conflict`
- `related`
- `insufficient`

評価:

- confusion matrix
- relation別TP、FP、FN
- relation別Precision、Recall、F1
- accuracy
- macro F1

## 指標定義

```text
precision = TP / (TP + FP)
recall    = TP / (TP + FN)
F1        = 2 * precision * recall / (precision + recall)
accuracy  = 正解件数 / 全件数
```

分母が0の場合、Precisionは予測が存在しなければ1、Recallは期待caseが存在しなければ1とする。ただしfixture検証により各relationの期待caseを5件以上必須とする。

## Fixture契約

- IDはfixture内で一意
- 空文字禁止
- Claim extractionは7分野を各3件以上含む
- Corroborationは4分類を各5件以上含む
- 実利用者データ、著作物本文、秘密値を含めない
- 数値・年・単位・指標の境界caseを含む
- 期待値変更はルール変更と同じreview対象

## Command

```bash
npm run research:eval
```

処理:

1. 2つのfixtureを読み込む
2. schemaと網羅数を検証する
3. 現行のproduction ruleを実行する
4. 指標JSONを標準出力する
5. 閾値を1つでも下回れば終了code 1

外部network、環境変数、現在日時、DBを使用しない。同じcommitでは常に同じ結果になる。

## CI

Required QualityのHub tests前に実行し、出力を
`artifacts/test-results/cloud-research-evaluation.json`
へ保存する。失敗しても既存の`Upload test results`によりlogを確認できる。

## 解釈上の制約

固定fixtureでの合格は実Web上の精度を保証しない。v1は決定的ルールの回帰防止を目的とする。実allowlist出典による匿名化済み誤判定caseは、権利・privacyを確認したうえで将来fixtureへ追加する。
