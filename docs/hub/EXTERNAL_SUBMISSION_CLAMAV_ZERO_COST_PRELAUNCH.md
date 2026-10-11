# External Submission ClamAV Zero-cost Prelaunch

更新日: 2026-10-11
状態: `ZERO_MONTHLY_CAP / NO_HOSTING_CREATED / PRODUCTION_DISABLED / WORKER_NOT_RUN`

## 決定

正式稼働前は、ClamAV gatewayと`clamd`を常設しない。月額固定費の上限を**0円**とし、hosting、
DNS、証明書、Secret Store、監視、schedulerを新規作成・有効化しない。既存の外部作品応募Workerも停止したままにする。

この決定は、Productionの受入れを完了扱いにするものではない。応募
`906ff7c3-c00a-42ed-aa9f-20d330233911`のJobは`queued`のまま保持し、scan、Job claim、page変換、
Storage page生成へ進めない。

## 現在の安全な停止状態

- topology B（認証付きHTTPS scan gateway）とportable gateway実装はPR #663、#664で基準ブランチへ統合済み。
- gateway、private `clamd`、公開URL、DNS、証明書、secretは未作成。
- Vercel ProductionのWorker Feature Flag、ClamAV接続設定は未設定で、fail closedを維持する。
- GitHub Actionsのscheduled Workerは無効のままにする。
- Production、GitHub設定、network、Storage、応募状態、公開、販売、Stripe、決済を変更しない。

## 稼働前の費用境界

次を満たす間だけ「月額0円維持」と扱う。

1. ClamAV用の常設compute、disk、load balancer、固定IP、有料監視を作成しない。
2. 無料枠を理由に本番相当のClamAVを常設しない。無料枠の変更、停止、resource不足を前提にしない。
3. `minimum instances = 0`等のscale-to-zero候補も、resource作成、cold start、signature更新、実費上限を
   別途確認するまでは配置しない。
4. 運用者のローカルPCをProduction gatewayとして公開しない。
5. 費用が発生する可能性のあるtrial、credit、外部resourceは、金額上限と削除条件を提示した実行時承認なしに作成しない。

参考として、Google Cloud Runはrequest-based billingかつminimum instance 0でidle instanceを課金しない構成を
提供するが、現在のgateway imageはClamAV engineとsignature DBを含まない。そのため、scale-to-zero候補を選ぶ場合も
`clamd`同居方式、signature取得時間、ephemeral storage、起動待ち、memory実測を先に設計する。

- [Cloud Run billing settings](https://docs.cloud.google.com/run/docs/configuring/billing-settings)
- [Cloud Run minimum instances](https://docs.cloud.google.com/run/docs/configuring/min-instances)

## 将来の一時受入れ手順

一時受入れは次の順で分割し、各段階を別のaction-time承認単位とする。承認は後続段階を自動的に許可しない。

### Gate 0: 費用と対象の提示

- provider、account、region、resource種別、最大稼働時間、最大実費、課金停止方法、削除対象を提示する。
- 上限超過時の自動停止方法を示す。自動停止を保証できない構成は採用しない。
- 対象は一般向けfixture 1応募、Worker request 1回、追加retryなしに固定する。
- Production設定変更、resource作成、secret登録、Worker実行の承認を分離する。

### Gate 1: isolated environmentでの検証

1. disposableな非Production環境にgatewayとprivate `clamd`を1組だけ起動する。
2. signature更新完了時刻、engine version、memory、disk、cold start時間を記録する。
3. EICARとclean fixtureで`infected`／`clean`、過大入力、timeout、認証失敗、ClamAV停止時の
   fail-closedを確認する。実利用者原稿は使わない。
4. gateway instance数1、同時scan数1を維持し、scale-outしない。
5. 検証終了直後にresourceを停止または削除し、残存課金対象がないことを確認する。

### Gate 2: Production readinessだけの確認

1. Production Feature Flagをfalseのまま、承認済み接続先とsecretを設定してredeployする。
2. 非通信`check`を1回実行する。
3. 認証済みreadiness `probe`を1回だけ実行する。
4. 対象Jobが`queued`のままであること、Storageと応募状態が変わっていないことを確認して停止する。
5. gateway／`clamd`を停止し、Production設定を残すか戻すかを別承認で決定する。

### Gate 3: 1 Job canary

Gate 2成功後にだけ、Feature Flag有効化とWorker POSTを別々に承認する。対象Job 1件、request 1回、
追加retryなしで停止し、結果にかかわらず定期schedulerは有効化しない。公開、販売、Stripe、決済は行わない。

## 即時停止条件

次のいずれかで後続操作を行わず停止する。

- 見積上限、課金停止方法、削除対象のいずれかが不明。
- `clamd`またはsignatureがreadyでない、signature更新時刻を確認できない。
- 512 MiB等の小容量枠を含め、memory／diskが実測前提を満たさない。
- gatewayがTLS、Bearer認証、private `clamd`、instance 1、scan 1を保証できない。
- readiness、scan、cleanupのいずれかが失敗またはtimeoutする。
- 対象外Job、追加retry、Production公開、販売、決済へ進む可能性がある。

## 次の判断点

当面はGate 0より前で停止する。実行を再開する場合、責任者は最低限、provider候補、region、最大一時実費、
最大稼働時間、操作担当を決める。月額0円方針のままでは、resource作成を伴うGate 1以降へは進まない。
