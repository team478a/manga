# MANGAI Cloud AI企画提案 Evaluation v1 計画

作成日: 2026-07-29
対象ブランチ: `codex/cloud-proposal-evaluation-v1`
依存ブランチ: `codex/cloud-proposal-quality-ui-v1`（Draft PR #63）

## 1. 目的

AI企画提案の品質を、外部AI、DB、ネットワーク、現在時刻に依存しない固定fixtureで継続評価する。評価結果はCI artifactとして内部保存し、利用者画面には表示しない。

## 2. 評価対象

- 6ジャンル、各4件、合計24件以上
- 読切／連載
- 24〜180Page
- 複数の想定読者、公開プラットフォーム、価格帯
- fixtureごとに異なる参考作品識別子

## 3. 品質指標

1. 企画生成成功率
2. 3方向の完全性
3. 必須項目の完全性
4. 3候補の重複なし
5. 参考作品名の流用なし
6. 入力・市場分析にない数値の追加なし
7. 内部根拠追跡の欠落なし
8. ジャンル・公開形式ごとの件数

## 4. 合格条件

- fixture 24件以上
- ジャンル6種類以上、各4件以上
- 読切／連載が各8件以上
- 全品質指標の合格率100%
- 生成失敗0件
- 同一fixtureから同一JSON reportを再生成できる

## 5. 実装

- `tests/fixtures/cloud-proposal-evaluation-golden.json`
- `src/lib/cloud-proposal-evaluation.ts`
- `scripts/evaluate-cloud-proposals.mjs`
- `npm run proposal:eval`
- Required QualityのHub tests前に独立gateとして実行
- `artifacts/test-results/cloud-proposal-evaluation.json`へ保存

## 6. 注意事項

- fixtureは挙動回帰用の合成条件であり、実市場の正しさや販売成果を保証しない。
- 評価score、失敗理由、fixture、内部識別子を利用者画面に表示しない。
- 外部Provider接続後は、別途人手評価、類似性評価、安全性評価を追加する。

## 7. 完了条件

- `npm run proposal:eval`が決定的なJSONを出力する
- 閾値未達時に終了code 1となる
- 自動テスト、lint、typecheck、Hub test、build、CIが成功する
- Draft PRでレビュー可能になっている
