# Cloud Release 2 Beta受入れ表

更新日: 2026-07-30

## 自動検査

| 項目 | 合格条件 | 状態 |
| --- | --- | --- |
| 企画AI契約 | 一意な3案、一般向け限定、`store:false`、出力上限 | PASS |
| UI状態 | loading、empty、error、not found、success | PASS |
| 二重送信 | 生成・選択中にbutton無効 | PASS |
| 内部情報秘匿 | 出典・内部評価・APIキー、内部例外を非表示 | PASS |
| responsive構造 | 390px超の固定幅なし | PASS |
| Feature Flag | 認証・DB処理前にfail closed | PASS |
| 環境preflight | 秘密値を出力せず必須設定を確認 | PASS |
| migration | forward、rollback、reapply、canonical schema | GitHub Actions対象 |

2026-07-30再検証:

- Release 2集中テスト: 19/19 PASS
- Hubテスト: 214/214 PASS
- dependency境界、lint、Hub/Desktop typecheck、Research Evaluation: PASS
- Supabase migration検査: 22/22 PASS
- 企画提案配下に専用のloading／error／not found境界を追加
- error／not foundはProvider、DB、所有者判定の内部情報を表示しない
- timeout、429、不正JSON、過大応答、重複案を保存前に安全なエラーへ変換
- OpenAI出力を8,000 token、受信Responseを512 KiBに制限
- 同じ企画の同時選択は冪等に成功し、別企画との競合は選択済みとして案内

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
