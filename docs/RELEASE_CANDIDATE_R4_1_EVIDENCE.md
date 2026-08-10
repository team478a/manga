# MANGAI PR-R4-1 Cloud統合受入れ証跡

最終更新: 2026-08-10

状態: `PARTIAL_EXTERNAL_CONFIGURATION_REQUIRED`

対象branch: `codex/release-r4-1-cloud-acceptance`

基準commit: `ba93db0429ce1abc66a89b35deb8d1648ebc60ec`（PR #217 merge commit）

Draft PR: [#218](https://github.com/team478a/manga/pull/218)

追補: PR #218 merge後にproduction API受入れを追加実施した。BFL画像生成・Canvas保存・1ページPNGは成功し、作品バックアップmigration不足、同一タブ再読込時の編集ロック待機、Cloud Editor文章Jobの登録前拒否を確認した。詳細は[`RELEASE_CANDIDATE_R4_1B_PRODUCTION_API_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1B_PRODUCTION_API_EVIDENCE.md)を参照する。

## 1. 判定

資格情報や費用を必要としない確認は完了した。Vercel production、Hub productionの認証済み読み取り、Cloud漫画制作の既存生成結果、repository受入れ、owner isolation、100ページ長編、研究評価、migration manifestは正常だった。

一方、次の外部条件が未完了のため、R4-1と`hub-production-acceptance`、`stripe-test-e2e`はpassedにしない。

- Vercel Project／Shared Environment VariablesにStripe変数が存在しない。
- Stripe Dashboardは未ログインで、利用者がスマートフォン操作中のためtest mode決済を実施できない。
- GitHub ActionsのCloud AI SchedulerにWorker URLと認証secretがなく、定期実行は無効。
- 対象Supabase projectを現在のDashboard sessionから参照できず、適用済みmigrationとDB owner isolationを照合できない。
- 市場分析のproduction保存は送信直前まで確認したが、本番データ作成とOpenAI費用を伴うため未送信。
- 対象Cloud作品は1ページで未完成のため、8ページPDF／PNGの実出力は未実施。

この監査ではapplication code、DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktop codeを変更していない。本番書込み、Provider呼出し、決済、refundも行っていない。

## 2. Vercel／Hub production確認

- Vercel project: `mangai-hub-staging`
- Production deployment: `https://mangai-hub-staging-glfoer67m-team478as-projects.vercel.app`
- Production domain: `https://app.mang-ai.com`
- 基準commit `ba93db0`のdeploymentはReady。
- `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`はProduction／Previewに存在することだけを確認した。値は表示・記録していない。
- Project／Sharedの両方で`STRIPE`を検索し、該当するEnvironment Variableが0件であることを確認した。
- productionの認証済みsessionではサイドメニューにログイン中の表示名が表示され、`/dashboard`と`/creator`へ遷移できた。表示名そのものは個人情報として証跡へ記録しない。
- 一般向けready画面では画像Provider、Worker、pricing、mail、production originの条件がreadyだった。ただし同画面はGitHub ActionsのScheduler設定を取得しないため、Scheduler成功の証拠には使用しない。

## 3. Cloud漫画制作確認

- 既存作品`R2C Provider Image Acceptance 2026-08-06`をproductionで開いた。
- Free planは18 credits残、使用2、予約0、上限20と表示された。
- 生成履歴はbackgroundの完了1件、過去失敗3件、直近24時間の失敗0件だった。
- 生成済みassetと背景AI layerを確認した。
- コマ選択時に2／3／4候補、比較、採用、再生成、修正、layer分離のUIが表示された。
- 作品は1ページで、表紙なし、2コマ中1コマが画像なしだったため、8ページPDF／PNGの実受入れ条件を満たさない。
- productionで生成、採用、再生成、保存、exportは実行していない。

## 4. 市場分析確認

- productionの`/dashboard/research`で、対象accountの保存済みreportは0件だった。
- 新規作成画面で一般向けのgenre、theme、概要を入力し、保存buttonが有効になるところまで確認した。
- 保存は本番report作成とOpenAI呼出しを伴うため未送信。したがって「保存後の一覧表示」「再読込」「owner一致」は未確認であり、過去の保存不具合が解消済みとは判定しない。

## 5. Scheduler確認

- 直近10件のscheduled runはいずれも`skipped`だった。
- repository variableとrepository secretはともに0件だった。
- Workerへ通信しない`mode=check`を基準commitで手動実行した。
- 実行: [GitHub Actions run 31343333031](https://github.com/team478a/manga/actions/runs/31343333031)
- 結果: `failure`。`MANGAI_CLOUD_AI_WORKER_URL`と`MANGAI_CLOUD_AI_WORKER_SECRET`不足を検出した。
- Worker request、Provider request、credit消費は発生していない。

## 6. Supabase確認

- production appが利用する3つのSupabase環境変数はVercelに存在する。
- 現在のSupabase Dashboard sessionでは対象project ref `vmdsyxykcrgxcdbrwlkv`を表示できず、別projectだけが表示された。
- ローカルに対象DBの接続資格情報と`psql`がないため、適用済みmigration、RLS、RPC、Storage bucketの実DB照合は未実施。
- repository側では50件のmigrationとrollback整合性が成功した。これは実DB適用確認の代替ではない。

## 7. 自動検証

| 検証 | 結果 |
|---|---|
| `npm run cloud:manga:acceptance:repo` | PASS |
| `npm run cloud:manga:owner-isolation` | PASS |
| `npm run cloud:longform:acceptance` | 4/4 PASS |
| `npm run research:eval` | PASS（extraction／classificationともに1.0） |
| `npm run db:migrations:validate` | 50 migrations／rollbacks PASS |
| `npm run cloud:ai-worker:scheduler:preflight` | DISABLED（ローカル外部設定なし） |
| `npm run cloud:export:preflight` | EXPECTED PENDING（Worker／Supabase資格情報なし） |
| `npm run cloud:storage:preflight` | EXPECTED PENDING（Supabase資格情報なし） |
| `npm run cloud:production:routes:preflight` | EXPECTED PENDING（production確認token未指定） |
| `npm run rc:acceptance` | 2 passed／11 pending／2 blocked、schema valid |
| `npm run rc:preflight` | repository structure READY、外部設定PENDING |

## 8. 再開手順

1. PCからStripe Dashboardへログインし、test modeのsecretとwebhook signing secretをVercelの適切な環境へ登録する。値はPRやログへ残さない。
2. Preview／staging deploymentでStripe test checkout、cancel、非同期成功／失敗、Payment Intent失敗、refund、重複／順不同webhook、download認可を実施する。本番カードや本番課金は使用しない。
3. 対象Supabase projectへアクセスできるaccountで、migration、RLS、RPC、Storage、2利用者owner isolationを読み取り確認する。
4. Scheduler用URL／secretをrepository secretsへ、enable flagをrepository variableへ登録し、`mode=check`成功後に1回だけWorker実行を確認する。設定変更は責任者承認後に行う。
5. 本番市場分析の1件作成とProvider費用を承認後、保存、一覧、再読込、owner一致を確認する。
6. 8ページ以上の一般向けtest作品で生成、候補比較、採用、再生成、各画像編集、layer、一括生成、停止・再開、budget、checkpoint、diff／restore、PDF／PNG、別owner拒否を確認する。
7. 証拠を`docs/desktop/RC_ACCEPTANCE_STATUS.json`へ記録し、`npm run rc:acceptance`を再実行する。

## 9. 停止条件とrollback

- 上記外部条件が揃うまでR4-1はpartialのままとし、R4-2へ進まない。
- 未実施項目を自動検証や既存dataでpassed扱いしない。
- 本PRは文書だけのためrollbackはcommitのrevertで完了し、DB／Storage／Stripeのrollbackは不要。
- 外部設定やtest dataを変更する場合は対象環境とownerを先に読み取り確認し、個別の実施記録とrollback手順を残す。
