# MANGAI Cloud Storage Lifecycle v1

## 目的

32〜100ページ作品の一覧を軽量に表示しながら、制作を続けるほどStorageへ残る派生物を安全に整理します。元の生成画像、採用済みレイヤー、完成原稿PDFは対象外です。

## 実装

- Canvas snapshot保存後、同じpage revisionのサムネイルJobを自動登録
- 現在revisionのCanvasと非公開Assetを共通Compositorで描画
- 最大320×480px、WebP品質78のprivate cacheを生成
- 作品一覧は表紙、制作ボードは各ページを10分期限の署名URLで表示
- 描画中にページが更新された場合、古い成果物を公開せず再Queue
- 差し替え済み／競合サムネイルだけをcleanup Queueへ登録
- 完成Exportのpage PNG／segment PDFは24時間後に削除候補へ登録
- 中止／最終失敗Exportの中間物は7日後に削除候補へ登録
- 完成した`manuscript.pdf`は削除対象へ登録しない

既存の生成画像については、`cloud_generation_storage_cleanup`が未採用・DB未確定の孤立Assetだけを処理します。本機能は`cloud-assets`を削除しません。

## DB・Storage

- migration: `202608010007_cloud_storage_lifecycle.sql`
- private bucket: `cloud-cache`
- tables: `cloud_page_thumbnails`、`cloud_storage_cleanup`
- owner RLSとStorage read policyを設定
- claim／complete／fail RPCは`service_role`だけが実行可能

## Worker

- endpoint: `POST /api/internal/cloud-storage/worker`
- `MANGAI_CLOUD_STORAGE_WORKER_ENABLED=true`
- `MANGAI_CLOUD_STORAGE_WORKER_SECRET`: 32文字以上
- `MANGAI_CLOUD_STORAGE_WORKER_ID`: 任意の識別子
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`

値を表示しない確認は`npm run cloud:storage:preflight`を使用します。1リクエストでサムネイル1件を優先処理し、待機Jobがなければcleanupを1件処理します。

## 安全境界

- cache rowが`ready`のときだけ署名URLを発行
- page revisionとclaim revisionをDB完了時にも比較
- Worker lease tokenが一致しない完了・失敗更新を拒否
- cleanup bucketは`cloud-cache`と`cloud-exports`だけに限定
- completed Exportの最終`output_storage_path`はQueueへ入れない
- migration未適用時は従来のプレースホルダー表示へ自動fallback

## 適用順

1. 親PR #108までを先に統合
2. migration #39をSupabase stagingへ適用
3. Storage Worker環境変数を設定（既定は停止）
4. Workerを起動し、ページ保存後にサムネイルが表示されることを確認
5. 24時間経過したExportの完成PDFが残り、中間物だけが整理されることを確認

本作業ではstaging migration、環境変数設定、外部Provider実行、マージを行いません。
