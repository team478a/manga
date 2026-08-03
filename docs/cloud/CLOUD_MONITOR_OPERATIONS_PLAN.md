# MANGAI Cloud モニター運用ハブ

## 目的

一般向けモニター運用で、更新情報の周知、利用者からの報告受付、修正候補の安全な自動処理を一つの流れで扱います。

## 実装範囲

### 更新情報

- 管理者が `/admin/product-updates` で下書き、公開、公開停止、アーカイブを行います。
- 公開日時を持ち、アーカイブされていない情報だけを利用者のダッシュボードに表示します。
- 種類はリリース、改善、不具合修正、メンテナンスです。

### モニター報告

- `/dashboard/monitor` から感想、不具合、改善依頼、機能リクエストを送信できます。
- タイトル、工程、影響度、利用環境、発生ページ、詳細を保存します。
- 管理者は従来のモニター管理画面と `/admin/monitor-issues` で確認できます。

### 修正候補の自動処理

1. 報告時に内容・工程・ページから指紋を作成します。
2. 同じ指紋の報告は一つのタスクへ集約し、件数と優先度を更新します。
3. 管理者が「自動修正を許可」したタスクだけを `queued` にします。
4. 認証済みWorkerが内部APIからタスクを取得し、再現確認、関連テスト、修正案を作成します。
5. WorkerはGitHub IssueまたはDraft PRのURLと検証結果を保存します。
6. 人がレビュー、承認、マージ、デプロイを行います。

自動マージ、Feature Flag変更、DB migration適用、本番デプロイは行いません。

## 環境変数

| キー | 用途 | 初期値 |
| --- | --- | --- |
| `MANGAI_MONITOR_OPS_WORKER_ENABLED` | 外部Workerによるタスク取得を許可 | 未設定（停止） |
| `MANGAI_MONITOR_OPS_WORKER_SECRET` | Worker内部APIのBearer認証。32文字以上 | 未設定 |

両方が正しく設定されるまで内部APIはfail closedします。

## 内部Worker API

`POST /api/internal/monitor-ops/worker`

- `Authorization: Bearer <MANGAI_MONITOR_OPS_WORKER_SECRET>` が必須です。
- `action: claim` は管理者が許可した次のタスクを取得します。
- `action: complete` は `fix_ready`、`review_required`、`failed` のいずれかと検証結果を記録します。
- APIレスポンスへユーザーIDやメールアドレスを含めず、報告本文と技術情報だけを渡します。

## 導入手順

1. `202608030001_cloud_monitor_operations_hub.sql` を対象Supabaseへ適用します。
2. `/admin/product-updates` で更新情報を登録し、ダッシュボード表示を確認します。
3. `/dashboard/monitor` から各種類の報告を一件ずつ送信します。
4. `/admin/monitor-issues` で集約・優先度・状態を確認します。
5. Workerを導入するまでは環境変数を未設定にし、管理画面で手動対応します。
6. Worker導入時はPreview限定で秘密鍵と有効フラグを設定し、Draft PR作成までを確認します。

## 受入条件

- 公開済み更新だけがダッシュボードに表示される。
- 4種類の報告を送信し、管理画面で内容を確認できる。
- 同種報告が一タスクへ集約され、件数が増える。
- 管理者が許可していないタスクをWorkerが取得できない。
- Worker停止時、秘密鍵不正時、migration未適用時に安全に停止する。
- 修正結果はDraft PRまたは要レビューとなり、自動マージ・本番反映されない。
