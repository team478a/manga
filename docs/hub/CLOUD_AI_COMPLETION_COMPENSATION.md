# Cloud AI画像Job確定とStorage補償

## 目的

Provider画像、Supabase Storage、`cloud_assets`、Job状態、credit、costの途中失敗による不整合を防ぎます。StorageとPostgreSQLは同一transactionにできないため、Storageを先に一時的な未確定状態で保存し、DB確定失敗時に補償削除します。

## 正常系

1. WorkerがJobをlease付きで取得する
2. Provider画像を検証・PNG再生成する
3. Job所有者・Project・Asset IDの正式pathへStorage保存する
4. `complete_cloud_generation_image_job`を呼ぶ
5. RPC内の同一transactionでAsset登録、Job完了、credit/cost確定を行う
6. notification更新は従来どおりWorker処理後に行う

`cloud_assets.source_generation_job_id`には部分unique indexがあり、1 Jobから複数Assetが登録されません。完了済みJobへの同じRPC再実行は既存Asset IDを返し、課金を再計上しません。

## 失敗と補償

- DB確定失敗: Workerがアップロード済みStorageを削除する
- DB応答喪失: Jobを再取得し、同じAssetで完了済みなら削除せず成功として扱う
- Storage削除失敗: `cloud_generation_storage_cleanup`へ理由とエラーを記録する
- 次回Worker起動: pending cleanupを古い順に1件再試行する
- DB孤立Asset: `queue_orphan_cloud_generation_assets`が1回最大100件をsoft deleteし、Storage cleanupへ登録する

cleanup表と3つのRPCはService Role専用です。Desktop、renderer、一般ユーザーには公開しません。

## 確認

```powershell
npm run db:migrations:validate
node --experimental-strip-types --test tests/cloud-ai-worker.test.mjs
npm run hub:test
```

DB往復試験ではforward、全rollback、再適用に加え、二重完了、canceled Job拒否、課金一回、孤立Asset検出を確認します。

## Rollback

`202607240002_cloud_ai_completion_compensation.sql`のrollbackを逆順で適用します。cleanup表、専用RPC、Job参照列とunique indexを除去します。Storage object自体はrollbackで削除しません。
