# MANGAI Cloud 制作ワークフロー Release計画

作成日: 2026-07-29  
対象ブランチ: `codex/cloud-release1-integration-v1`

Release 1はPR #50、#56〜#62の市場分析機能だけを最新の正式基点へ統合する。
PR #48〜#49、#51〜#55、#63〜#64は依存せず、後続Releaseの機能も先行実装しない。

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

一般向けのAI企画提案そのものはRelease 2で実装する。Release 1では引継ぎ条件の表示までとする。

成人向けはRelease 1.2の許可制オプションとして、利用者が自分で入力する企画ブリーフだけを先行提供する。外部AIへの送信、自動文章生成、画像生成は行わず、Release 2の一般向けAI企画提案とは分離する。

## 3. 後続Release

| Release | 対象 | 開始条件 |
| --- | --- | --- |
| 2 | AI企画提案 | Release 1の入力・保存・再表示E2E合格 |
| 3 | シナリオ生成 | 企画の採用・版管理契約確定 |
| 4 | マンガ生成 | シナリオからPageへの契約確定 |
| 5 | 作品管理 | 生成成果物の公開前管理が完走 |
| 6 | 販売準備 | 作品・商品差分確認が完走 |
| 7 | 収益Dashboard | 実決済データの集計契約確定 |

## 4. 安全境界

- Cloud Canvas Editor、Cloud AI Worker、Stripe、Marketplace、Desktopは変更しない。
- 市場数値は出典に存在する値だけを事実として扱う。
- 推論は必ず`ai_inference`として保存・表示する。
- 出典なしの分析は実行しない。
- 成人向け区分は一般公開ではfail closedで停止する。専用Flag、DB Kill Switch、個別許可、18歳以上確認、専用規約同意が揃う限定オプションだけ市場分析を許可する。
- 成人向け企画ブリーフはさらに`adult_planning`の機能許可を要求し、外部Providerを呼び出さない。
- Feature Flag無効時は画面とServer Actionの両方で実行を拒否する。
- Feature Flagは未設定時falseとし、migration適用前の環境ではfail closedにする。

## 5. Release 1完了条件

- 入力 → 実行 → 保存 → 履歴 → 再表示が同じ利用者で完走する。
- RLSにより別利用者のReportを参照できない。
- 全Reportに出典URL、取得日時、事実メモが保存される。
- 全分析項目に`fact`または`ai_inference`区分がある。
- 根拠のない市場数値を生成しない回帰テストが成功する。
- 市場分析完了前はAI企画提案導線が無効である。
- 検索・出典検証が未設定でも手動出典入力が完走する。
- loading、empty、error、not found、所有者外参照拒否が確認できる。
- Release 1 preflightが秘密値を出力せず設定状態だけを判定する。
- lint、typecheck、Hub test、migration検証、production build、CIが成功する。

公開・受入れ・停止・rollbackの実施手順は
[`CLOUD_RESEARCH_RELEASE_RUNBOOK.md`](CLOUD_RESEARCH_RELEASE_RUNBOOK.md)
に従う。
