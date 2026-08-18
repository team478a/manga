# PR-R4-3A-15 Production Panel Rollout Guard

## 目的

ProductionのBenchmark専用Human Reviewを5名へ安全に公開する前に、開始前Batchの割当拒否を管理者へ正確に案内し、期間外と重複を混同しないようにする。

## Production確認

- 基準: PR #307 merge commit `5f37817c681b6a8592aee4d5c485b09c46dd1606`
- Feature Flag: `MANGAI_MONITOR_QUALITY_REVIEW_ENABLED=true`（Productionのみ）
- Vercel deployment: `FyCvjRpzXDuxsTKq9yU5S5Ntv91U`、Ready、`app.mang-ai.com`割当済み
- Batch: `batch_private_01`、active、`PILOT_INTRINSIC_ONLY`、28画像、目標5名
- 期間: 2026-08-20 00:00 JST〜2026-09-20 00:00 JST
- assignment: 0
- response: 0
- 正式Benchmark採用: 0/140

## 原因と修正

Reviewer A=`test`の割当時、Batch／enrollmentの取得は成功したが、開始前のためapplicationがINSERT前に拒否した。これは`docs/quality-benchmark-monitor-review.md`の「Batch開始時刻より前は割当を拒否する」契約どおりである。

一方、Server Actionが期間外を一意制約エラーと同じ文言へ変換していたため、管理画面では重複と誤表示された。以下を修正する。

- 開始前または終了後のactive Batchでは割当フォームを表示しない。
- 日本時間の開始日時を管理画面に表示する。
- `monitor_quality_review_assignment_unavailable`を期間外メッセージへ分離する。
- 同一枠／同一利用者の重複メッセージは維持する。

Batch期間、割当拒否条件、DB保存契約は変更しない。

## Reviewer割当計画

開始時刻と本PRのmerge後、Production管理画面から次の順で割り当てる。

| Slot | モニター | 用途 |
| --- | --- | --- |
| Primary Reviewer A | test | 正式Benchmark比較候補 |
| Primary Reviewer B | 青木隆康 | 正式Benchmark比較候補 |
| Panel Reviewer C | なっかん | 補助票 |
| Panel Reviewer D | 加藤周星 | 補助票 |
| Panel Reviewer E | 松浦周平 | 補助票 |

A/B回答とC〜E回答はschemaと集計を混在させない。割当後は390×844相当で同意、画像表示、下書き再開、画像確定、最終送信を確認する。

## ロールバック

- 即時停止: Productionの`MANGAI_MONITOR_QUALITY_REVIEW_ENABLED=false`へ戻して再デプロイする。
- 個別停止: 対象assignmentを`revoked`にする。
- Batch停止: 管理画面からBatchを`paused`へ変更する。
- 本PRのUI修正はrevert可能であり、DB rollbackは不要。

## 不変条件

DB、migration、RPC、Storage、Benchmark画像、作品、Canvas、Provider、credit、API、URL、PNG／PDF、成人向け境界、Desktopは変更しない。Productionの開始日時を前倒しせず、開始前割当を行わない。

## 停止条件

- 集中テストと全品質ゲート成功
- Draft PR作成
- GitHub Actions全チェック成功
- Vercel Preview Ready
- Production assignment 0、response 0を維持
- 責任者確認と開始時刻前にA〜Eを割り当てない

## ローカル検証結果

- 集中テスト: 11/11
- Dependency boundary: error 0（既知warning 2件）
- lint／全型検査: 成功
- Hub: 808/808
- Canvas: 26/26
- AI: 48/48
- Desktop: 182/182
- Desktop accessibility: violation 0
- migration roundtrip: 61件成功
- Hub build／Desktop build: 成功
- RC preflight: Repository structure READY。外部設定と手動E2Eの既存pendingは差分外
- `git diff --check`: 成功
