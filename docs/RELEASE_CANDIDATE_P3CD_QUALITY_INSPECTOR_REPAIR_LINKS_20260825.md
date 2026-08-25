# P3-C+D 品質Inspector・修正準備導線

## 実装

- owner workspace確認とRLSを通るpage finding読込
- migration未適用時のfail-closed
- 選択コマ別のstatus、category、理由、confidence、normalized region表示
- `NOT_EVALUATED`を合格表示しない
- suggestionからpanel design、references、revision preset、inpainting dialogへの明示導線

## 実行境界

- 「修正候補を準備」だけでは生成Jobを作らない。
- 生成は既存欄の候補数、残credit、利用可否を確認して別ボタンで実行する。
- 文字修正は画像生成不要と案内する。
- 自動採用、不採用、Asset／layer削除を行わない。
- Provider／Worker経路、migration、DB schemaを変更しない。

## 検証

- P3-A〜D集中6/6、Hub 882/882、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 71件。
- deps、lint、全型検査、Hub／Desktop build、RC structure、diff check成功。
- npm auditの既知5件、module boundaryの既知警告2件、外部設定／手動E2E pendingは既存状態を維持する。
