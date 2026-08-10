# MANGAI PR-R4-1e Production Scheduler受入れ証跡

最終更新: 2026-08-10

状態: `READY_FOR_OWNER_REVIEW`

対象branch: `codex/release-r4-1e-scheduler-acceptance`

基準commit: `2e3a1d5350ae2db3d1c0f158020e573e6f6267d5`（PR #222 merge commit）

Draft PR: [#223](https://github.com/team478a/manga/pull/223)

Preview: `https://mangai-hub-staging-git-codex-release-47537d-team478as-projects.vercel.app`

## 1. 判定

ProductionのCloud AI Worker Schedulerに必要なGitHub Actions設定を、秘密値を文書、ログ、commitへ残さず設定した。VercelのSensitive変数は作成後に読めないため、責任者承認に基づいてWorker secretを新しい値へローテーションし、Production／PreviewとGitHub Actionsへ同値登録した。Productionは基準commitを再deployし、`Ready`を確認した。

通信なし`check`は成功した。本番管理画面でQueueが処理待ち0件、実行中0件、稼働状態正常、24時間以内の失敗0件であることを確認してからSchedulerを有効化した。限定`run`は`idle`、request 1件、processed 0件で成功し、Provider生成とcredit消費は発生していない。

R4-1全体は完了扱いにしない。checkpoint migration、Cloud text、市場分析、AIネーム由来8ページE2E、2利用者実owner isolation、Stripe test E2Eが残るため、`hub-production-acceptance`はpending、R4-2は未着手を維持する。

## 2. 外部設定

| 対象 | 変更 | 値の記録 |
|---|---|---|
| Vercel `MANGAI_CLOUD_AI_WORKER_SECRET` | Production／PreviewのSensitive値をローテーション | なし |
| Vercel Production | `2e3a1d5`を再deployし`Ready` | deployment IDだけ記録 |
| GitHub Actions secret `MANGAI_CLOUD_AI_WORKER_SECRET` | Vercelと同値で登録 | なし |
| GitHub Actions secret `MANGAI_CLOUD_AI_WORKER_URL` | Production Worker URLを登録 | secret値は記録しない |
| GitHub Actions variable `MANGAI_CLOUD_AI_SCHEDULER_ENABLED` | `true` | 非秘密の有効状態だけ記録 |

最初の通信なし`check` [31358227421](https://github.com/team478a/manga/actions/runs/31358227421)は、Vercelの変数名コピーUIを秘密値コピーと誤認したため最小長検査で安全停止した。Worker requestは送信されず、Scheduler variableも未設定だった。中間値は使用せず、最終値へ再ローテーションしてProduction反映前に破棄した。

Production再deploy:

- Vercel deployment: `2XhreeWPr9ZEdZrEhQn93ZH8hA2a`
- Source: `feature/manga-canvas-mvp` / `2e3a1d5`
- Environment: Production
- 結果: `Ready`
- Duration: 1分32秒

## 3. Scheduler受入れ

### 3.1 通信なしcheck

| 項目 | 結果 |
|---|---|
| Run | [31359117746](https://github.com/team478a/manga/actions/runs/31359117746) |
| Head | `2e3a1d5350ae2db3d1c0f158020e573e6f6267d5` |
| Job | `Check scheduler settings without a worker request` |
| 結果 | SUCCESS |
| Worker request | 0件 |

### 3.2 実行前Production Queue

| 指標 | 結果 |
|---|---:|
| 処理待ち | 0 |
| 実行中 | 0 |
| 過去の失敗 | 3 |
| 24時間以内の失敗 | 0 |
| 期限切れ処理 | 0 |
| 稼働状態 | 正常 |

過去の失敗3件は4日前の既存BFL検証Jobであり、今回のScheduler実行によるものではない。

### 3.3 限定run

| 項目 | 結果 |
|---|---|
| Run | [31359171708](https://github.com/team478a/manga/actions/runs/31359171708) |
| Head | `2e3a1d5350ae2db3d1c0f158020e573e6f6267d5` |
| 結果 | SUCCESS |
| Worker status | `idle` |
| Requests | 1 |
| Processed | 0 |
| Provider生成／credit消費 | なし |

### 3.4 定期run

| 項目 | 結果 |
|---|---|
| Run | [31359786321](https://github.com/team478a/manga/actions/runs/31359786321) |
| Event | `schedule` |
| Head | `2e3a1d5350ae2db3d1c0f158020e573e6f6267d5` |
| 結果 | SUCCESS |
| Worker status | `idle` |
| Requests | 1 |
| Processed | 0 |
| 実行後Queue | 処理待ち0、実行中0、稼働状態正常、24時間以内の失敗0 |

cron起動は指定時刻より遅延したが、GitHub Actionsの`event=schedule`で自動起動し、同じProduction Worker認証と安全停止条件が機能した。

## 4. 変更しなかったもの

- application code、DB、migration、RPC、Storage、API、URL、Feature Flag
- Provider、model、pricing、retry、timeout、Scheduler workflow／頻度／上限
- Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktop
- Production作品、Page、Canvas、Asset、credit、Provider価格

## 5. 残件

1. 対象Supabase projectのcheckpoint migration適用と作成・差分・復元の再受入れ。
2. Cloud text外部構成適用と文章Job 1件の再受入れ。
3. 対象一般モニター本人sessionで市場分析の保存・一覧・再読込・フィードバック送信。
4. AIネーム由来8ページ以上の制作、候補操作、画像編集、一括生成、checkpoint、復元、PDF／PNG。
5. 2利用者実owner isolationとStripe test E2E。

上記が揃うまでR4-1と`hub-production-acceptance`をpendingとし、R4-2へ進まない。

## 6. Rollback

1. 緊急停止はGitHub repository variable `MANGAI_CLOUD_AI_SCHEDULER_ENABLED`を`false`または削除し、次のcronからWorker requestを停止する。
2. 必要ならGitHub ActionsのWorker URL／secretを削除する。VercelのProduction Workerは管理画面の単発診断用として維持できる。
3. Worker secret自体を再ローテーションする場合は、Vercel Production／PreviewとGitHub Actionsを同値更新してからProductionを再deployする。片側だけを更新しない。
4. 本PRの文書変更はcommit revertで戻せるが、外部設定はGit revertでは戻らないため上記手順で個別停止する。

## 7. 自動検証

| 検証 | 結果 |
|---|---|
| `npm run rc:acceptance` | PASS。2 passed／11 pending／2 blocked、schema valid |
| `npm run rc:preflight` | PASS。repository structure READY。外部資格情報と手動E2Eは既知のpending |
| `npm run db:migrations:validate` | PASS。migration／rollback 50件 |
| `npm run rc:validate` | PASS。Hub 624/624、Desktop 182/182、Canvas 26/26、AI 48/48、migration 50/50、Hub／Desktop build |
| `git diff --check` | PASS |
