# Cloud AI Worker lease heartbeat

## 設定

- lease: 300秒（`MANGAI_CLOUD_AI_WORKER_LEASE_SECONDS`、150〜900）
- heartbeat: 60秒（`MANGAI_CLOUD_AI_WORKER_HEARTBEAT_SECONDS`、30〜120）
- heartbeat失敗許容: 1回
- 2回連続失敗: Provider AbortSignalを中断

Worker状態APIは現在のlease秒数、heartbeat秒数、失敗許容数を返します。

## RPC契約

`extend_cloud_generation_job_lease(job_id, lease_token, lease_seconds)`はService Role専用です。以下をすべて満たす場合だけ期限を延長します。

1. Jobが`running`
2. 現在のlease tokenと一致
3. 現在の`lease_expires_at`が未来
4. 延長秒数が150〜900

期限切れtokenは延長できません。別Workerは従来どおり`claim_cloud_generation_job`でstale Jobを再取得し、新しいtokenを得ます。

## Worker処理

ProviderにはJobに保存された同じidempotency keyとAbortSignalを渡します。heartbeatに加え、Provider応答後、画像upload後、完了RPC直前に同期検証します。leaseを失ったWorkerはAsset確定、Job完了、課金確定、失敗状態更新を行いません。

画像をStorageへ保存した後にleaseを失った場合は、Storage objectを削除します。削除に失敗した場合は既存の`cloud_generation_storage_cleanup`へ記録します。

## 手動確認

1. Worker状態APIでlease 300秒、heartbeat 60秒を確認します。
2. 60秒を超えるmock Provider処理中に`lease_expires_at`が延長されることを確認します。
3. Jobのlease tokenまたは期限を変更し、Providerが中断されAssetと課金が確定されないことを確認します。
4. Workerを強制終了し、期限後に別Workerが同じJobを新tokenで取得できることを確認します。

## Rollback

アプリをheartbeat導入前の版へ戻した後、次を適用します。

`supabase/rollbacks/202607240003_cloud_ai_worker_heartbeat.sql`

rollbackは延長RPCだけを削除します。Job表、既存lease、生成結果には変更を加えません。
