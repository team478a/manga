# Cloud Release 2 Beta受入れ表

更新日: 2026-07-30

## 自動検査

| 項目 | 合格条件 | 状態 |
| --- | --- | --- |
| 企画AI契約 | 3案、一般向け限定、`store:false` | 自動テスト対象 |
| UI状態 | loading、empty、error、success | 自動テスト対象 |
| 二重送信 | 生成・選択中にbutton無効 | 自動テスト対象 |
| 内部情報秘匿 | 出典・内部評価・APIキーを非表示 | 自動テスト対象 |
| responsive構造 | 390px超の固定幅なし | 自動テスト対象 |
| Feature Flag | 認証・DB処理前にfail closed | 自動テスト対象 |
| 環境preflight | 秘密値を出力せず必須設定を確認 | 自動テスト対象 |
| migration | forward、rollback、reapply、canonical schema | GitHub Actions対象 |

## 実機受入れ

| ID | 操作 | 期待結果 | 状態 |
| --- | --- | --- | --- |
| R2-01 | 一般向け市場分析から企画生成 | 異なる3案を表示 | 責任者確認待ち |
| R2-02 | 企画を1案選択 | 選択済みと次工程準備を表示 | 責任者確認待ち |
| R2-03 | 画面を再読込 | 生成結果と選択を再表示 | 責任者確認待ち |
| R2-04 | 生成ボタンを連打 | 重複送信を抑止 | 責任者確認待ち |
| R2-05 | 別利用者のRun URLを開く | 内容を表示しない | 責任者確認待ち |
| R2-06 | 成人向けReportから開く | 外部AI生成を行わない | 責任者確認待ち |
| R2-07 | Provider停止状態で生成 | 内部情報なしの安全な案内 | 責任者確認待ち |
| R2-08 | 390px表示 | 横overflowなし | 責任者確認待ち |
| R2-09 | 768px表示 | 操作と文章の重なりなし | 責任者確認待ち |
| R2-10 | 1280px表示 | 3案を横並び比較 | 責任者確認待ち |

## 判定

自動検査の成功だけではBeta公開完了にしない。実Supabase、管理画面設定、実OpenAI接続を使うR2-01〜R2-10と責任者承認が必要。

手順の正本は[`CLOUD_RELEASE2_LIMITED_RELEASE_RUNBOOK.md`](CLOUD_RELEASE2_LIMITED_RELEASE_RUNBOOK.md)とする。
