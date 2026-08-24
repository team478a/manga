# 採用画像Visual Judge連続性証跡監査

作成日: 2026-08-24
Branch: `codex/audit-r4-3-visual-judge-evidence`
Base: `e0e8aae`（PR #326 merge commit）

## 結論

既存品質評価は生成Job IDを主キーとし、採用画像layerの`sourceJobId`へ決定的に結び付けられる。ただしrule-based評価は未観測項目へ中立75点を保存するため、数値列だけではVisual Judgeが連続性を評価した証拠にならない。

今回、`evaluation_details.continuityMatch`が現行Evidence schemaを満たす場合だけ、採用画像の参考証跡として表示する。旧形式、中立点だけの記録、不正形式は非表示とする。

## 表示契約

- 採用中かつ`sourceJobId`を持つ生成画像だけを対象にする。
- 同じ生成Job IDの`cloud_manga_quality_evaluations`だけを参照する。
- statusは`ok / unknown / not_evaluated`、sourceは`vlm / embedding / detector / rule`だけを許可する。
- `ok`は0〜1のscore必須、それ以外はscoreを持たない。
- confidenceは0〜1だけを許可する。
- 適合したscore、confidence、sourceとページ導線だけを表示する。

## 安全境界

- `continuity_hint_score=75`だけでは証跡にしない。
- 完成判定、履歴警告、自動不採用、自動再生成、品質記録更新へ接続しない。
- Visual JudgeやProviderを新規実行しない。
- DB、migration、RPC、Storage、Canvas、PNG／PDF、creditを変更しない。
- 人間レビューや設定版・参照画像の履歴監査を代替しない。

## 検証

- 集中7/7、deps error 0（既存warning 2件）。
- lint、Hub／Desktop型検査成功。
- Hub 832/832、Canvas 26/26、AI 48/48、Desktop 182/182成功。
- migration 61件、Hub／Desktop build、RC structure、`git diff --check`成功。

## Productionと費用

Production接続、作品・Canvas・DB・Storageへの書込み、Provider実行、credit予約・消費は0件。

## 次の判断

Visual Judge evidenceの実データ作成やProvider実行は別承認とする。Production修復、read-only再集計、Pilot生成も個別の明示承認後にのみ行う。
