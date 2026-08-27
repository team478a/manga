# Staging durable export受入れcloseout

## 判定

- 状態: `EXTERNAL_ACCEPTANCE_PASSED / INITIAL_USER_READINESS_7_OF_7 / CLEANUP_COMPLETED`
- 実施日: 2026-08-27
- 対象: 隔離したSupabase Preview branchと、同名のVercel Preview branch
- Production、外部画像Provider、利用者実データは使用していない。Provider実行とcredit消費は0件。

## 実行条件

- private `cloud-exports` bucket、owner A／非owner B、8ページの確定済み一般向け固定ProjectをPreview branch内だけに作成した。
- Vercelの対象branchだけへSupabase接続、durable export Worker、3形式Flagを一時設定した。
- Preview保護を通すためAutomation Bypassを一時発行し、受入れ終了直後に失効した。
- 秘密値、署名URL、Storage path、利用者素材はGitへ保存していない。

## 受入れ結果

| 項目 | 結果 |
|---|---|
| PDF中断 | 4/8ページ、50%で一時停止 |
| 停止中Worker | `idle`、追加segmentなし |
| PDF再開 | 完了済み4ページを維持して8/8、100%完了 |
| PNG ZIP | 8ページ、100%完了 |
| Project JSON | schema version 1、8ページ、100%完了 |
| owner分離 | owner Aは3 Job参照可、owner Bは0件でfail closed |
| download | 短時間署名URLでHTTP 200 |
| 形式検査 | PDF magic、ZIP magic、JSON schema／ページ順を確認 |
| 整合性 | 3出力とも記録byte sizeと実体が一致 |
| queue／cleanup | segment 6件、active export Job 0、active generation Job 0、最終Worker `idle` |

## 後処理

- Supabase Preview branchを削除し、時間課金を停止した。固定Project、dummy owner、bucket、Job、segment、出力はbranchとともに削除済み。
- 一時Vercel branch限定環境変数を、実行branchと誤設定した旧runbook branchの両方から削除した。
- 一時Automation Bypassを失効し、受入れ用Git branchをlocal／remoteから削除した。
- 既存Production／Preview共通設定と通常のProduction／Preview設定は変更していない。

## 完了判断

`docs/STAGING_DURABLE_EXPORT_ACCEPTANCE_RUNBOOK_20260826.md`の合格条件をすべて満たした。これにより、P0〜P4 closeoutで定義した初期ユーザー向け7完了条件は7/7受入れ済みとなる。追加のProduction修復、Provider実行、credit予約は行わない。

## Repository検証

- 文書契約: 3/3
- Hub: 916/916
- Canvas: 26/26
- AI: 48/48
- Desktop: 182/182
- Desktop a11y: violation 0
- migration: 74件
- dependency boundary、lint、Hub／Desktop typecheck、Hub／Desktop build、RC structure、`git diff --check`: 成功
- `rc:preflight`は差分外の外部設定と手動E2Eをpendingとして正しく維持する。
