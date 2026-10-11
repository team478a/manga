# External Submission ClamAV Production Topology

更新日: 2026-10-11  
状態: `DECISION_REQUIRED / PRODUCTION_DISABLED`

## 目的

外部作品応募Workerが、応募原稿を第三者に公開せずClamAVへ送信できるProduction接続方式を固定する。
この文書は構成判断だけを扱い、環境変数、GitHub Secret、network、ClamAV、Worker、queued Jobを変更しない。

## 現在の確認結果

- PR #662はmerge commit `b6a4fa6d736284986959c93c3bc8c0cb0d9d208b`で基準ブランチへ統合済み。
- merge後のRequired Quality run `38098015722`、Desktop Windows run `38098015764`、Production deployment `6988788173`は成功した。
- Productionのreadiness endpointへcredentialなしでGETすると`401`となり、ClamAV接続やJob claimへ進まない。
- GitHub Actionsには外部作品Worker用secretとscheduler有効化variableが未登録。Cloud AI Worker用設定だけが存在する。
- repositoryにはClamAV host、VPC、VPN、TLS gatewayを作成するIaCがない。
- 既存応募`906ff7c3-c00a-42ed-aa9f-20d330233911`のqueued JobはWorker未実行のまま。

## 変更できない安全条件

- `clamd`のTCP socketは認証も暗号化も行わないため、untrusted networkや公開Internetへ直接露出しない。
- 応募原稿のbyte列、scan応答、Storage path、利用者情報、secretを通常ログへ出さない。
- Feature Flagは疎通確認完了までfalseとし、設定欠損・timeout・不明応答はfail closedを維持する。
- Production設定、redeploy、readiness probe、Worker POSTは別々のaction-time承認単位とする。
- 1回のcanary Worker実行は対象Job 1件、request 1回、追加retryなしで停止する。

根拠:

- [ClamD protocol: TCP is not encrypted or authenticated](https://docs.clamav.net/manual/Usage/ClamdProtocol.html)
- [ClamAV scanning guidance: do not expose clamd TCP to the Internet](https://docs.clamav.net/manual/Usage/Scanning.html)

## 選択肢

### A. Vercel Secure Compute + private VPC ClamAV（推奨）

Vercel FunctionとClamAVをVPC peeringまたはVPNでprivate接続する。現在のNode.js raw TCP clientを変更せず、
`MANGAI_EXTERNAL_CLAMAV_HOST`をprivate addressへ向けられる。原稿byte列は公開Internetを通らない。

- 長所: 現行コードとの整合が最も高く、ClamAV TCPをprivate network内に閉じられる。
- 前提: Vercel EnterpriseのSecure Compute、接続先cloud/VPC、region/CIDR、firewall、運用担当、費用承認。
- 公式資料: [Vercel Secure Computeによるprivate backend接続](https://vercel.com/kb/guide/hosting-backend-apis)、[Secure Computeのself-service管理](https://vercel.com/changelog/secure-compute-is-now-self-serve)

### B. 認証付きHTTPS scan gateway（代替。別実装が必要）

TLS終端と強いservice-to-service認証を持つ専用gatewayだけをVercelから呼び、gatewayと`clamd`は同一private
networkまたは同一hostに置く。Vercel側はraw TCP clientではなくHTTPS adapterへ変更する。

- 長所: Vercel Secure Computeを前提にせず、標準HTTPSで認証・暗号化・timeoutを制御できる。
- 前提: gatewayの設計・hosting・認証方式・request上限・streaming・監視・key rotation・費用承認。
- 現在のコードは未対応。設計承認前に推測実装しない。

### 不採用: 公開clamd TCP + Vercel Static IP allowlistだけ

Static IPは接続元を絞れるが、`clamd` protocol自体へ認証・暗号化を追加しない。応募原稿をraw TCPで公開networkへ
送る構成になるため採用しない。Vercel Static IPの利用可否だけで安全条件を満たしたとは扱わない。

参考: [Vercel Static IPsとSecure Computeの使い分け](https://vercel.com/kb/guide/how-to-allowlist-deployment-ip-address)

## 決定に必要な責任者入力

1. A（Secure Compute）またはB（HTTPS gateway）の選択。
2. 利用可能なVercel planと月額費用上限。
3. ClamAVを置くcloud/account、region、運用担当。
4. 障害通知先、signature更新監視、保持しないことの運用確認。

これらが未決定の間は`BLOCKED_TOPOLOGY_DECISION`とし、Production設定とqueued Jobを変更しない。

## 選択後の段階ゲート

1. 選択方式の最小IaC／adapterを別PRで実装し、isolated environmentでEICARとclean fixtureを検証する。
2. Production Feature Flag=falseのままClamAV接続先とWorker secretを設定し、redeployする。
3. GitHub ActionsへWorker URL／secretを設定する。scheduler variableは未設定のままにする。
4. 非通信`check`を1回、readiness `probe`を1回実行し、Jobがqueuedのままであることを確認する。
5. Feature Flag=trueを反映後、対象Job 1件へWorker POSTを1回だけ実行する。
6. 結果と停止条件を確認後にのみ、定期scheduler有効化を別判断する。

各Production変更と実行は、対象・変更値の種類・件数・停止条件を提示したaction-time承認を必要とする。
実決済、公開、販売開始は本工程に含めない。
