# P3-F 品質検査・部分修正 受入fixture

## 結論

外部Providerを使わない固定6コマfixtureで、P3の受入境界を決定論的に検証する。人数違い、衣装違い、文字切れを意図的に1コマずつ混入し、対象コマ、normalized region、修正案を追跡する。

## 実装

- `tests/fixtures/cloud-quality-inspection-acceptance.mjs`: 6コマ、各2 Asset／2候補、inspection run、採否・費用・時間fixture。
- `tests/cloud-quality-inspection-acceptance.test.mjs`: 3種の問題検出、`NOT_EVALUATED`保持、対象コマだけの修正準備、元Asset／候補／Job不変、作品KPIを検証。
- `quality-metrics.ts`: 既存KPIへ採用コマ当たり費用、完成時間、人物重大不一致率、明示的な`generation_failed`率を後方互換で追加。

## 安全境界

- 自動FAILからAsset、候補、Job、採否を変更しない。
- 修正準備はfixtureのsnapshotを変更せず、対象コマとfindingだけを返す。
- 視覚未評価項目は`NOT_EVALUATED`かつconfidence null。
- Production／staging、migration、Provider／Worker、Job、credit、Storage操作なし。

## 受入

- 人数違い、衣装違い、文字切れを3/3検出。
- 問題3コマを個別追跡し、全findingにnormalized regionあり。
- 誤判定を含む修正準備の前後で6コマすべてのAsset／候補／Jobが不変。
- 初回採用率、平均retry、採用コマ費用、平均完成時間、人物重大不一致率、生成失敗率を固定期待値で検証。

## 次

全ローカルゲート、Draft PR、全CI／Vercel Preview成功で停止する。staging migration適用と実Provider 1 Job受入れは責任者の別承認まで行わない。

## 検証

- 集中13/13
- Hub 889/889、Canvas 26/26、AI 48/48、Desktop 182/182
- a11y violation 0、migration 72件
- deps、lint、全型検査、Hub／Desktop build、RC structure、diff check成功
