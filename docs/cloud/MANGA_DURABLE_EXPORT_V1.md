# MANGAI Cloud 永続エクスポート v1

## 目的

32〜100ページの原稿を、Webリクエストの実行時間に依存せずPDFへ出力します。4ページ単位で処理結果を保存し、中断後も完了済みページの次から再開します。

## 利用条件

- 全ページが「確定」である
- ページrevisionと確定revisionが一致している
- 制作設定変更後の再確認が完了している
- 対象作品に実行中または待機中の画像生成がない
- 同一作品に進行中のExport Jobがない

条件を満たさない場合、作品画面に理由を表示しExport開始を停止します。DB RPCでも同じ条件を再検証します。

## 処理構成

1. 利用者が作品画面からPDF出力を開始する。
2. `create_cloud_export_job`が対象ページ順を固定してJobを作成する。
3. Workerがlease付きでJobを取得し、4ページずつPNGと分割PDFを非公開Storageへ保存する。
4. 最終segmentで分割PDFをページ順に結合し、`manuscript.pdf`を保存する。
5. 所有者だけが短時間の署名URLを発行して完成PDFを取得する。

Jobは一時停止、再開、中止、失敗箇所からの再実行に対応します。同一作品のactive JobはDBのpartial unique indexで1件に制限します。

## DBとStorage

- Migration: `202608010006_cloud_durable_export.sql`（38本目）
- Tables: `cloud_export_jobs`, `cloud_export_segments`
- Private bucket: `cloud-exports`
- Rollback、canonical schema、migration assertionsを同期済み

## Worker設定

- `MANGAI_CLOUD_EXPORT_WORKER_ENABLED=true`
- `MANGAI_CLOUD_EXPORT_WORKER_SECRET`: 32文字以上の秘密値
- `MANGAI_CLOUD_EXPORT_WORKER_ID`: 任意の識別子
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`

値を表示しない確認コマンドは `npm run cloud:export:preflight` です。内部Worker endpointは `POST /api/internal/cloud-export/worker` で、Bearer secretが一致した場合だけ1segmentを処理します。

## 安全境界

- Job／segmentは所有者RLSで保護する。
- Worker RPCはservice roleだけに許可する。
- 利用者向け状態変更RPCはsecurity definerとし、関数内で所有者を再確認する。
- 出力物は公開URLにせず、所有者確認後の署名URLだけを返す。
- 内部例外、Storage path、秘密値を利用者へ露出しない。

## 適用後の確認

1. migrationをstagingへ適用する。
2. Worker環境変数をPreview対象ブランチへ設定する。
3. preflightを実行する。
4. 確定済み4ページ超の作品で開始、一時停止、再開、完成、PDFページ順を確認する。
5. 未確定、stale、生成中、別ユーザー参照が拒否されることを確認する。

外部環境へのmigration適用、Worker有効化、有料Provider実行はこの実装作業では行いません。
