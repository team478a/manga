# MANGAI Cloud Research Quality v2 仕様

## 出典入力

既存項目に次を追加する。

- `sourceType`: `official` / `platform` / `industry_report` / `news` / `store_ranking` / `other`
- `publishedAt`: 公開日時（任意）
- `topics`: `demand` / `competition` / `audience` / `theme` / `price` / `channel` / `risk`から1件以上

URLはHTTPS、同一URLは重複不可。公開日時は取得日時より未来にできない。

## 分析項目

各Findingは次を追加する。

- `evidenceBasis`: `source_fact` / `user_input` / `ai_inference`
- `confidence`: `low` / `medium` / `high`
- `limitations`: 根拠不足や鮮度に関する注意

利用者入力だけを根拠とする項目には出典URLを付けない。AI推論には、その推論に対応するtopicの出典URLだけを付ける。

## 品質評価

Reportに次を保存する。

- 0〜100の`score`
- `level`: `low` / `medium` / `high`
- 独立ドメイン数
- 180日以内の出典数
- 7分野の網羅率
- 不足分野
- warnings

scoreは市場の正しさではなく「登録された根拠の調査品質」を表す。市場規模や売上予測ではない。

## 互換性

- 新規Report: `research-rules-v2`
- 既存`research-rules-v1` Reportは変更しない。
- 後続企画は既存の9 finding keyとReport全出典を引き続き利用できる。

## 次工程ゲート

今回は低品質でも保存可能とするが、Reportで警告する。検索Provider導入後に、企画提案を許可する最低品質を責任者と決定する。
