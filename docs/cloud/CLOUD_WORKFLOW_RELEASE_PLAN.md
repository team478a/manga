# MANGAI Cloud 制作ワークフロー Release計画

作成日: 2026-07-29  
対象ブランチ: `codex/cloud-research-mvp`

## 1. 公開順

MANGAI Cloudは、次の制作ワークフローを縦に完成させてから後続工程へ進む。

1. 市場分析
2. AI企画提案
3. シナリオ生成
4. マンガ生成
5. 作品管理
6. 販売準備
7. 収益ダッシュボード

広範なUI刷新や後続工程の先行実装は行わない。

## 2. Release定義

### Release 0: 最小Cloud共通シェル

- ワークフロー順の左サイドバー
- Dashboard
- 現在の制作進行
- `CLOUD_RESEARCH_MVP_ENABLED` Feature Flag
- 未実装工程のdisabled表示
- 既存機能への互換導線

### Release 1: 市場分析MVP

- 必須条件入力
- 利用者が確認した出典URL、取得日時、事実メモの登録
- 出典に基づく定性的分析の実行
- Reportの永続保存
- 履歴一覧
- Report再表示
- 完了Reportからだけ有効になる「AI企画提案へ進む」導線

AI企画提案そのものはRelease 2で実装する。Release 1では引継ぎ条件の表示までとする。

## 3. 後続Release

| Release | 対象 | 開始条件 |
| --- | --- | --- |
| 2 | AI企画提案 | Release 1の入力・保存・再表示E2E合格 |
| 3 | シナリオ生成 | 企画の採用・版管理契約確定 |
| 4 | マンガ生成 | シナリオからPageへの契約確定 |
| 5 | 作品管理 | 生成成果物の公開前管理が完走 |
| 6 | 販売準備 | 作品・商品差分確認が完走 |
| 7 | 収益Dashboard | 実決済データの集計契約確定 |

### 2026-07-29 進行順の例外

Release 1の実環境E2Eは、対象Supabase／Vercelへ接続できないため未完了のまま保持する。責任者の指示により、Release 2は`codex/cloud-proposal-mvp`のstacked branchで先行実装する。これはRelease 1の完了判定や公開許可を意味せず、両Releaseの外部受入れと承認が終わるまでmergeしない。

## 4. 安全境界

- Cloud Canvas Editor、Cloud AI Worker、Stripe、Marketplace、Desktopは変更しない。
- 市場数値は出典に存在する値だけを事実として扱う。
- 推論は必ず`ai_inference`として保存・表示する。
- 出典なしの分析は実行しない。
- 成人向け区分は入力として受け付けるが、既存境界によりCloud実行をfail closedで停止する。
- Feature Flag無効時は画面とServer Actionの両方で実行を拒否する。
- Feature Flagは未設定時falseとし、migration適用前の環境ではfail closedにする。

## 5. Release 1完了条件

- 入力 → 実行 → 保存 → 履歴 → 再表示が同じ利用者で完走する。
- RLSにより別利用者のReportを参照できない。
- 全Reportに出典URL、取得日時、事実メモが保存される。
- 全分析項目に`fact`または`ai_inference`区分がある。
- 根拠のない市場数値を生成しない回帰テストが成功する。
- 市場分析完了前はAI企画提案導線が無効である。
- lint、typecheck、Hub test、migration検証、production build、CIが成功する。

公開・受入れ・停止・rollbackの実施手順は
[`CLOUD_RESEARCH_RELEASE_RUNBOOK.md`](CLOUD_RESEARCH_RELEASE_RUNBOOK.md)
に従う。
