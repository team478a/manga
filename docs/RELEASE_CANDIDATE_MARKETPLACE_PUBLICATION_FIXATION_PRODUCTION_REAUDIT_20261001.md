# Marketplace Cloud完成版固定 Production再監査

## 実施概要

- 実施日: 2026-10-01
- Branch: `codex/cloud-marketplace-production-fixation-reaudit-20261001`
- Base: `bb06bb4123c0669caf3ef0045d2e064f280176d1`（PR #587 merge commit）
- 対象: Production Project `mangai-hub-staging` / `main PRODUCTION`
- 方法: Supabase SQL Editorで、既存管理画面と同じ完成版固定条件を個人情報・内部IDなしの集計SELECTとして再確認

## 匿名集計

| 項目                                 | 件数 |
| ------------------------------------ | ---: |
| 確認したCloud作品                    |    1 |
| 未公開・未固定の作品                 |    1 |
| 作品とProjectの所有者が一致          |    1 |
| paused商品に紐づく作品               |    1 |
| release checkpoint                   |    0 |
| ページ構成が完全なrelease checkpoint |    0 |
| 完成版固定可能な作品                 |    0 |
| 完成版固定後に更新するpaused商品     |    0 |

## 判定

- `READY`: 監査対象のCloud作品を確認できる。
- `READY`: 作品は一般向け、draft、非公開、完成版未固定である。
- `READY`: 作品所有者とCloud Project所有者が一致する。
- `READY`: 所有者一致のpaused商品が1件ある。
- `PENDING`: 対象Projectにrelease checkpointがない。
- `PENDING`: 完全なcheckpointがないため、固定対象の作品と商品は0件である。

2026-09-29の監査結果から阻害条件は変わっていない。作品、Project、paused商品の対応は成立しているが、完成原稿の固定点を示すrelease checkpointが存在しない。任意の最新状態を完成版と推測して固定してはならない。

## 承認可能な実行順序

1. 作品所有者がCloud制作画面で全ページを完成状態にし、実行中の生成Jobがないことを確認する。
2. 同じ所有者sessionで、対象Projectに`kind='release'`のcheckpointを1件作成する。これはcheckpoint、ページ対応、重複排除バックアップをProductionへ保存する変更であり、実行前に対象工程の明示承認を得る。
3. 匿名readinessを再実行し、release checkpoint 1件以上、完全なcheckpoint 1件以上、固定可能な作品1件、更新対象paused商品1件を確認する。
4. 既存のCloud出品準備導線から、checkpointに対応する固定publication、ページ画像、PDFを同期する。Storage object、publication、作品の固定publication参照、paused商品のfile／表示情報を更新するため、checkpoint作成とは分けて明示承認を得る。
5. 同じ匿名readinessと商品監査を再実行し、作品が完成版固定済み、商品がpausedのまま、価格・ファイル・所有者が正常であることを確認する。
6. 公開・active化は`publish_cloud_marketplace_listing`の既存契約で同時に行う。公開開始は別のProduction変更として承認を得て、実行後に公開作品、active商品、販売者権限を再監査する。
7. checkout runtimeは現在`disabled`で、Stripe本番設定と限定canary設定も未投入である。作品公開・商品active化だけでは購入できないため、決済開始前にVercel Production設定を別承認・別工程で行う。

## 安全境界

- 成功した監査はSELECTだけで、Production DBへのDML、DDL、RPCは0件。
- 最初のEditor実行は置換前の断片が残り構文エラーになった。DML、DDL、RPCを含まず、データ変更は0件。全文置換後の集計SELECTが成功した。
- 利用者、作品、商品、Project、checkpointの内部ID、名称、メール、Storage path、秘密値を取得・記録していない。
- release checkpoint、バックアップ、publication、作品公開、商品active化、注文、決済、Stripe、Vercel環境変数は変更していない。
- Provider、生成Job、Asset、credit、利用期限、通知設定は変更していない。

## 検証

- 完成版固定readiness集中テスト: 6/6成功
- Supabase migration／rollback静的検証: 92/92成功
- RC repository structure: `READY`
- 新規監査文書Prettier: 成功
- `git diff --check`: 成功
- 外部設定: `PENDING`
- 手動E2E: `REQUIRED`

## 次工程

本PRは監査記録だけを提出する。全CIとVercel Preview成功で停止する。merge後に行う最初の変更はrelease checkpoint作成であり、Productionへ保存される対象と影響を示した責任者の明示承認を得るまで実行しない。
