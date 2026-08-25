# P3-A+B 品質finding基盤・決定論的rule検査

## 実装

- 既存品質評価を維持したappend-only inspection run／finding
- `PASS / WARNING / FAIL / NOT_EVALUATED`
- category、理由、normalized region、confidence、修正案、evidence
- evaluator ID／version／kind／data handling
- panel設計revision、Asset、generation Job provenance
- owner read RLS、service-role限定の原子的記録RPC
- 利用開始後の情報損失を止めるrollback guard

## rule検査

- Asset欠落、空コマ、低解像度
- 文字切れ、不自然な短い縦書き
- continuity／参照不足
- 他コマissueの非干渉
- runtime evaluator未実行項目は`NOT_EVALUATED`、confidence null

## 非破壊境界

- 既存`cloud_manga_quality_evaluations`と採否ログを変更しない。
- 自動採用、不採用、Asset削除、Job作成を行わない。
- UI、Provider adapter、Worker実行経路を変更しない。
- Production、Storage、credit予約・消費を行わない。

## 検証

- 集中4/4、Hub 880/880、Canvas 26/26、AI 48/48、Desktop 182/182成功。
- a11y violation 0、migration 71件、deps、lint、全型検査、Hub／Desktop build、RC structure、diff check成功。
- 既知の非差分事項はnpm audit 5件（moderate 1、高4）とmodule boundary warning 2件。RC外部設定／手動E2Eはpending。
- CI／Vercel Preview結果はPR証跡へ同期する。
