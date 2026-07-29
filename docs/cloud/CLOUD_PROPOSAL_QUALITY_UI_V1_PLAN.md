# MANGAI Cloud AI企画提案 Quality UI v1 計画

作成日: 2026-07-29
対象ブランチ: `codex/cloud-proposal-quality-ui-v1`
依存ブランチ: `codex/cloud-research-result-only-ui`（Draft PR #62）

## 1. 目的

既存のRelease 2を作り直さず、利用者が3つの企画結果を短時間で比較・採用できる画面へ改善する。生成根拠、内部識別子、engine情報、評価ロジックは利用者画面に出さず、監査と後続工程に必要な内部データは保持する。

## 2. 実装範囲

- 企画生成前画面を制作条件の確認に集中させる
- 3候補に「王道」「独自性」「読みやすさ」の用途ラベルを付ける
- 企画の核、主人公、中心対立、舞台、差別化、構成、販売方針、注意点を比較表示する
- 採用候補を明確に表示し、採用後のみシナリオ生成へ進める
- 履歴画面からengine versionを除外する
- 生成結果の品質検査を追加する

## 3. 利用者画面に表示しない情報

- `engineVersion` / `engine_version`
- `classification`
- `researchFindingKeys`
- `sourceUrls`
- 評価点、判定ロジック、内部チェック名

上記は保存・監査・将来の再評価に必要なため、型・DB・保存snapshotからは削除しない。

## 4. 品質ゲート

生成した3案について次を検査する。

1. `balanced` / `differentiated` / `focused`が1件ずつ存在する
2. タイトル、ログライン、主人公、中心対立、差別化が空でない
3. 3案のタイトル、ログライン、中心対立が重複しない
4. 参考作品名をタイトル、主人公、舞台へ流用しない
5. 入力条件または市場分析にない数値を企画本文へ追加しない
6. 市場分析の推奨条件とリスクを全候補が引き継ぐ
7. 出典参照と調査項目キーを内部データとして保持する

品質判定結果は利用者画面には表示しない。

## 5. 変更しない範囲

- Proposal Run／SelectionのDB schemaとRLS
- 市場分析、シナリオ生成の業務契約
- Supabase migration
- 外部AI Provider
- Cloud Canvas Editor
- Stripe／Marketplace
- Desktop

## 6. 完了条件

- 390pxでは1列、768pxでは2列、1280pxでは3列で比較できる
- 内部情報が企画生成・履歴・詳細画面に表示されない
- 3案の差異と採用状態が視覚的に判別できる
- 品質検査の正常・異常ケースが自動テストされる
- lint、typecheck、Hub test、production build、CIが成功する
- Draft PRでレビュー可能になっている

## 7. Merge条件

- 依存PRの関係が解消している
- Vercel Previewで390px／768px／1280pxを確認している
- 実Supabaseで生成→保存→履歴→再表示→採用を完走している
- 全CI成功と責任者承認が揃っている
