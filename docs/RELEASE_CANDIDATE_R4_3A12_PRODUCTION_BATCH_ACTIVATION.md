# PR-R4-3A-12 Production Batch Activation Acceptance

作成日: 2026-08-18
基準: `feature/manga-canvas-mvp` / PR #304 merge commit `0c6f8f9e6d380334d6605ad78ed11f64925fada8`
Branch: `codex/docs-r4-3a12-production-batch-activation`

## 目的

PR #304で実装した管理者専用の検査付きBatch有効化をProductionで受け入れ、`batch_private_01`をモニター公開前の`active`状態へ安全に進める。本PRは受入証跡の文書化だけを行い、Feature Flag、Reviewer割当、Human回答、正式Benchmark採用を変更しない。

## 実施権限

- 責任者がPR #304を`feature/manga-canvas-mvp`へmergeした。
- 責任者から管理者ログイン完了の連絡を受けた。
- 事前に明示した範囲どおり、Batch有効化だけを実施した。

## Production受入結果

1. `https://app.mang-ai.com/admin/general-monitors/quality-review`を管理者セッションで開いた。
2. `batch_private_01`が`draft`、画像28枚、担当者未割当であることを確認した。
3. Feature Flag停止中の案内、割当ボタン無効、有効化だけではモニターへ公開されないことを確認した。
4. 「Batchを検査して有効化」を1回だけ実行した。
5. Server Actionの検査が成功し、画面に「Batchを有効化しました」と表示された。
6. `batch_private_01`が`active`、画像28枚、担当者未割当であることを再確認した。

| 確認項目 | 結果 |
| --- | --- |
| Batch code | `batch_private_01` |
| Batch状態 | `active` |
| 画像数 | 28 |
| Reviewer割当 | 0 |
| Human回答 | 0 |
| Feature Flag | off |
| モニター公開 | なし |
| Human A/B | 0/56 |
| 正式Benchmark | 0/140 |

## 安全境界

- Feature Flagを有効化していない。
- Reviewer A/Bを割り当てていない。
- assignment、response、正式labelを変更していない。
- Production作品、顧客作品、モニター作品、Canvasを変更していない。
- Provider、model、pricing、credit、retry、timeout、Schedulerを変更していない。
- DB schema、migration、RPC、RLS、Storage bucket／object、API、URLを変更していない。
- PNG／PDF、成人向け境界、Desktopを変更していない。
- 秘密値、署名付きURL、画像、個人情報を文書やGitへ保存していない。

## ロールバック

- 即時停止が必要な場合は、同じ管理画面の「Batchを停止」で`active -> paused`へ変更する。
- モニター公開はFeature Flag offのため現時点では発生していない。
- assignmentやresponseの削除、migration rollback、Storage削除は行わない。

## 次工程と停止条件

- 本Docs-only Draft PRを作成し、Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsを確認する。
- 責任者がReviewer AのProduction表示名と、Aとは異なるReviewer Bを指定するまで停止する。
- 指定前にFeature Flagを有効化せず、担当割当、Human Review、R4-3B Visual Judgeへ進まない。
