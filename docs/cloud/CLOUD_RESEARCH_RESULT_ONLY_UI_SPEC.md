# Cloud Research Result-only UI Specification

## 目的

市場分析の利用者画面では内部の評価方式や判定ロジックを見せず、意思決定に必要な分析結果だけを簡潔に表示する。

## 表示する情報

- 入力条件
- 分析結果の各項目名と内容
- 分析完了状態
- 次のAI企画提案への導線

## 表示しない情報

- engine version
- 根拠品質scoreとlevel
- scoreの内訳、独立domain数、分野網羅率
- 事実／利用者入力／AI推論の内部区分
- confidence
- findingごとの内部limitations
- 参照情報のタイトル、URL、事実メモ、取得日時
- source typeと内部topic分類
- MIME、byte数、SHA-256、検証状態
- 候補抽出の一致語、score、原文offset、本文hash
- 出典照合の判定理由、共通指標、共通年、confidence

## 維持する内部契約

- 保存データ、分析ロジック、品質score、根拠区分は変更しない
- 出典タイトル、URL、事実メモ、取得日時、事実と推論の区分は引き続き内部保存する
- Research Evaluation v1とCI品質gateを維持する
- 相反可能性など、利用者が判断に必要な結論labelは表示してよい
- 根拠のない市場数値を生成しない

## 非対象

- DB、migration、API契約
- 認証、Feature Flag
- 市場分析の生成・保存ロジック
- Cloud AI、Stripe、Marketplace、Desktop

## 完了条件

- Report再表示で内部ロジックが表示されない
- 候補抽出・出典照合で技術的な判定材料が表示されない
- 分析結果と次工程導線は維持される
- 参照情報は内部データに維持され、利用者向けReportには描画されない
- 回帰テスト、型検査、Lint、build、CIが成功する
