# MANGAI Codex ⇄ Claude Code 引継ぎ台帳

## 0. 現在の優先タスク（PR-R4-1aa 4ページ限定Production受入れ、2026-08-13）

- Branch: `codex/release-r4-1aa-four-page-acceptance`
- Base: `origin/feature/manga-canvas-mvp` @ `a5e903d`（PR #245 merge commit）
- 状態: `CREDIT_ENTITLEMENT_UI_IMPLEMENTED_LOCAL_VALIDATION`
- Draft PR: [#246](https://github.com/team478a/manga/pull/246)
- Vercel Preview: https://mangai-hub-staging-be38wgjhu-team478as-projects.vercel.app
- PR #245はmerge済み。Productionのdurable target table／4 RPC／RLS／ACL境界は16/16成功。
- Productionの一般向けモニター`test`で、19〜22ページの4ページ／16コマを1案ずつ生成する計画。
- preflightは32 credit、最大予約費用$0.48、Worker最短6回／約30分、1分Job化上限3コマ。現状は残り8 creditで24不足し、開始はfail-closed。
- 現行管理画面に個別Cloud AI Plan付与がなく、接続中のブラウザー／CLIにもProduction Supabase管理者認証がないため、正本のcredit準備を安全に実行できなかった。Provider Jobは追加していない。
- 管理者ユーザー詳細へ既存Free／Trial／Creatorの個別期間付与を追加した。Stripe管理中、予約credit、queued／running Job、停止中Planは拒否し、管理監査へ記録する。DB、全体Plan値、Provider契約は変更しない。
- 集中10/10、Hub 654/654、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y violations 0、deps、lint、全typecheck、migration 54/54、Hub／Desktop build、RC structure、diff check成功。Hub buildは短い物理worktreeで同一commitを検証した。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。最終文書commit後の全CI再確認で停止する。
- merge後、`test`へTrial 30日を付与して32 credit以上を確認し、初めて4ページ生成を開始する。R4-1aa合格前にR4-1abへ進まない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_1AA_FOUR_PAGE_PRODUCTION_ACCEPTANCE.md`

---

## 0. 現在の優先タスク（PR-R4-1z 長編一括生成 durable登録、2026-08-13）

- Branch: `codex/fix-r4-1z-durable-batch-registration`
- Base: `origin/feature/manga-canvas-mvp` @ `394707b`（PR #243 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#244](https://github.com/team478a/manga/pull/244)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-4ba5a7-team478as-projects.vercel.app
- 4〜8ページ／最大64コマの全対象を先に非公開DB targetへ原子的に保存し、Workerが既存Schedulerから1件ずつJob化する。
- 既存monitor枠、user／project rate limit、plan／作品／global予算を同一transactionで利用する。rate limit時はpendingを保持して次回Schedulerへ委ねる。
- targetのPromptはauthenticatedへ直接読取権限を与えず、画面、通常query、ログへ返さない。元revision／pricing変更はfail-closedとする。
- pause／cancel／恒久失敗の再試行、Job化待ち／済み進捗をCreator画面へ反映する。
- 公開URL／API、Storage、Provider、model、pricing値、credit、retry、timeout、Scheduler頻度、Canvas、PDF／PNG、成人向け境界、Desktop codeは変更しない。
- PostgreSQL 16で53 migrationのforward／rollback／reapplyと既存quota経由の原子的dispatchを確認。集中26/26、Hub 650/650、Canvas 26/26、AI 48/48、deps、lint、全typecheck、migration manifest、Hub／Desktop build、diff check成功。Hub buildは短い物理worktreeで完走した。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 詳細: `docs/RELEASE_CANDIDATE_R4_1Z_DURABLE_BATCH_REGISTRATION.md`
- 次: 責任者のreview／merge判断まで停止し、Production migration適用前にR4-1aaへ進まない。

---

## 0. 現在の優先タスク（PR-R4-1y 長編一括生成 合算preflight、2026-08-13）

- Branch: `codex/fix-r4-1y-longform-batch-preflight`
- Base: `origin/feature/manga-canvas-mvp` @ `cbb0d74`（PR #242 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#243](https://github.com/team478a/manga/pull/243)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-00d2ff-team478as-projects.vercel.app
- 4〜8ページ一括生成の開始前に、対象コマ、1候補、model／pricing、必要credit、最大予約費用、plan／作品／global／monitor容量、Scheduler下限、1分登録上限を表示する。
- 容量不足、現在snapshot欠損、空ページ、64コマ超、現行同期処理で登録可能な1分上限超過はbatch作成前にfail-closedで拒否する。
- 全件登録だけを成功表示し、部分登録は要求／登録／未登録件数を赤い警告にする。履歴のJob数は「登録済み」と明記する。
- DB、migration、RPC、Storage、Provider、model、pricing、rate limit、Scheduler頻度等の外部契約は変更しない。
- 集中17/17、Hub 650/650、Canvas 26/26、AI 48/48、deps、lint、全typecheck、migration 52/52、Hub／Desktop build、RC structure、diff check成功。Hub buildは元worktreeのWindows長path上限を短いworktreeで回避した。Desktop統合はElectron終了待ち、Windows CIで最終判定する。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 詳細: `docs/RELEASE_CANDIDATE_R4_1Y_LONGFORM_BATCH_PREFLIGHT.md`
- 次: 責任者のreview／merge判断まで停止し、責任者確認前にR4-1zや有料4ページ受入れへ進まない。

---

## 0. 現在の優先タスク（PR-R4-1x 長編漫画credit・段階生成成立条件監査、2026-08-13）

- Branch: `codex/audit-r4-1x-longform-credit-plan`
- Base: `origin/feature/manga-canvas-mvp` @ `96f27b6`（PR #241 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#242](https://github.com/team478a/manga/pull/242)
- Vercel Preview: https://mangai-hub-staging-git-codex-audit-r4-5dcaff-team478as-projects.vercel.app
- 現行一括生成は4〜8ページ／最大64コマを受け付けるが、全対象を同期loopで1 Jobずつ登録する。作品rate limitはFree 3、Trial 6、Creator 20件/分で、途中拒否後は部分batchを成功値として返し得る。
- 画面は要求件数と登録件数の差、必要credit、最大予約費用、残容量、Scheduler回数を開始前後に表示しない。長編Production受入れの前に修正が必要。
- 157コマをProで初回1候補なら314 credit。推奨式は全コマ初回、選択比較、選択Fillの`2P + 4C + 6F` credit。
- 次工程案はR4-1y合算preflight／表示、R4-1z durable登録、R4-1aa 4ページ限定実Provider受入れ、R4-1ab 8ページ完成原稿／販売品質受入れ。
- 本PRは文書限定で、有料Jobとapplication／外部契約変更を行わない。
- 集中20/20、deps、RC repository structure、diff check成功。RC外部設定とmanual E2Eはローカル秘密情報なしのためPENDING。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 詳細: `docs/RELEASE_CANDIDATE_R4_1X_LONGFORM_CREDIT_AND_STAGING_AUDIT.md`
- 次: 責任者のreview／merge判断まで停止し、責任者承認前にR4-1yを実装しない。

---

## 0. 現在の優先タスク（PR-R4-1w FLUX単一コマProduction受入れ、2026-08-13）

- Branch: `codex/release-r4-1w-flux-production-acceptance`
- Base: `origin/feature/manga-canvas-mvp` @ `d0091a0`（PR #240 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#241](https://github.com/team478a/manga/pull/241)
- Vercel Preview: https://mangai-hub-staging-git-codex-release-f980ec-team478as-projects.vercel.app
- Productionの`test`モニターで未生成コマ1つへ2候補を登録し、Scheduler run 31647042128は`idle requests=3 processed=2`で成功した。
- 2候補とも単一の全面モノクロ場面で、複数コマ、枠、吹き出し、文字、疑似文字なし。FLUX正方向Promptの限定実Provider受入れは合格した。
- creditは残12／使用8／予約0から、登録時残8／使用8／予約4、完了時残8／使用12／予約0へ遷移した。
- 候補1を採用し、`保存済み`、再読込後の3コマ目`AI背景レイヤー`復元を確認した。
- 本PRは文書限定。人物連続性、4〜8ページ一括生成、完成原稿、PDF／PNG、販売品質を成功扱いにしない。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 詳細: `docs/RELEASE_CANDIDATE_R4_1W_FLUX_PRODUCTION_ACCEPTANCE.md`
- 次: 責任者のreview／merge判断まで停止。責任者確認後、長編credit／候補数／段階生成の成立条件を監査する。

---

## 0. 現在の優先タスク（PR-R4-1v FLUX単一コマ正方向Prompt、2026-08-13）

- Branch: `codex/fix-r4-1v-flux-positive-panel-prompt`
- Base: `origin/feature/manga-canvas-mvp` @ `92f379e`（PR #239 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#240](https://github.com/team478a/manga/pull/240)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-b536a9-team478as-projects.vercel.app
- Productionでは2候補のcompleted、credit確定、比較、採用、保存、再読込を確認し、timeout／Scheduler復旧は合格した。
- 候補1は単一コマ・文字なし、候補2は複数コマ・吹き出し・疑似文字を含んだため、品質は2件中1件だけ合格した。
- FLUX.2はnegative prompt非対応だが、BFL adapterが共通禁止語を`Avoid:`として送信していた。BFLへは正方向Promptだけを送り、単一場面、1 camera view／1 moment、文字のない絵を指定する。
- Provider、model、pricing、credit、retry、timeout、Scheduler、DB、migration、RPC、Storage、Canvas、成人向け境界、Desktopは変更しない。
- 集中29/29、Hub 645/645、Canvas 26/26、AI 48/48、migration 52/52、deps、lint、全typecheck、Hub／Desktop build、RC preflight、diff check成功。Desktop統合／a11yのローカルElectron終了待ちはWindows CIで最終判定する。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Core初回のElectron取得HTTP 503は同一commit再実行で成功。Draft／MERGEABLE。
- 詳細: `docs/RELEASE_CANDIDATE_R4_1V_FLUX_POSITIVE_PANEL_PROMPT.md`
- 次: 責任者のreview／merge判断まで停止。merge前に有料Jobを追加せず、merge後に未生成コマ1つ・2候補を再受入れする。

---

## 0. 現在の優先タスク（PR-R4-1u 漫画画像生成timeout／Scheduler復旧、2026-08-12）

- Branch: `codex/fix-r4-1u-image-generation-recovery`
- Base: `origin/feature/manga-canvas-mvp` @ `c98e5b1`（PR #238 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#239](https://github.com/team478a/manga/pull/239)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-2e4013-team478as-projects.vercel.app
- Productionの画像2候補は約126〜128秒でfailedとなり、BFLの120秒poll上限と一致した。BFL submit拒否ではなく生成待機timeoutを根因候補として扱う。
- BFL 210秒、Scheduler request 230秒、Worker 240秒へ整合させ、`failed`を既知終端として後続Jobへ進む。PromptやProvider本文を含まないtimeout診断を追加する。
- Provider、model、request、pricing、credit、retry、Scheduler頻度、DB、migration、RPC、Storage、Canvas、成人向け境界、Desktopは変更しない。
- 検証: 集中27/27、Hub 645/645、Canvas 26/26、AI 48/48、migration 52/52、deps、lint、全typecheck、Hub／Desktop build、RC preflight、diff check成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: `docs/RELEASE_CANDIDATE_R4_1U_IMAGE_GENERATION_RECOVERY.md`
- 次: 責任者のreview／merge判断まで停止。merge後にProductionの未生成コマ1つ、2候補、比較、採用、保存、再読込を必ず再受入れする。

---

## 0. 現在の優先タスク（PR-R4-1t 販売下書き完成原稿preflight、2026-08-12）

- Branch: `codex/fix-r4-1t-marketplace-readiness-preflight`
- Base: `origin/feature/manga-canvas-mvp` @ `209d7a6`（PR #237 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#238](https://github.com/team478a/manga/pull/238)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-6729b3-team478as-projects.vercel.app
- 未完成原稿でも販売下書きを作成できた原因は、Marketplace artifact生成がdurable PDFの完成原稿preflightを使っていなかったこと。
- 販売artifact生成前に既存preflightを必須化し、全ページ確定、revision一致、再確認、生成中なし、必須修正0を満たさない場合はStorage upload前に`ValidationError`で拒否する。Creator画面も同じ条件で無効化する。
- DB、migration、RPC、Storage契約、Provider、pricing、Scheduler、Canvas、PDF形式、Stripe、Desktop codeは変更しない。
- 検証: 集中13/13、Hub 643/643、Canvas 26/26、AI 48/48、migration 52/52、deps、lint、全typecheck、Hub／Desktop build、RC preflight、diff check成功。Desktop統合はElectron終了待ちのためWindows CIで最終判定する。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: `docs/RELEASE_CANDIDATE_R4_1T_MARKETPLACE_READINESS_PREFLIGHT.md`
- 次: 責任者のreview／merge判断まで停止。merge後はProduction未完成作品で拒否を再確認し、その後に画像Provider失敗を別PRで扱う。

---

## 0. 現在の優先タスク（PR-R4-1s Production市場分析→販売E2E監査、2026-08-12）

- Branch: `codex/release-r4-1s-market-to-sale-e2e`
- Base: `origin/feature/manga-canvas-mvp` @ `2afae10`（PR #236 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#237](https://github.com/team478a/manga/pull/237)
- Vercel Preview: https://mangai-hub-staging-git-codex-release-faa8ee-team478as-projects.vercel.app
- Productionの一般モニター`test`で、市場分析、選択企画、採用シナリオ、採用32ページネーム、Creator 32ページ／157コマまでの連続性を確認した。
- merge後の画像2候補は両方failed。予約4 creditは全解放。単一コマ品質の実Provider再受入れは未合格。
- 原稿は画像1/157、完成0/32、確定0/32、必須修正267。完成PDFは正しく無効だが、販売下書きは作成できてしまう。作成物は非公開／販売停止で、公開一覧とcheckoutは安全側に閉じている。
- Workerの正規終端`failed`をSchedulerが未知状態としてworkflow failureにする。後続Job処理を妨げるため別修正が必要。
- 未生成156コマへ最低2候補を作るだけで追加624 creditが必要。残16では32ページ完成不可。
- ローカル検証: Scheduler／marketplace policy／durable export 14/14、deps、RC preflight、diff check成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 次: 文書限定Draft PRと全CI／Preview後に停止。販売準備preflight、実画像生成、Scheduler、credit成立条件を責任者確認後の別PRで修正する。
- 詳細: `docs/RELEASE_CANDIDATE_R4_1S_MARKET_TO_SALE_E2E_EVIDENCE.md`

---

## 0. 現在の優先タスク（PR-R4-1r 漫画生成Production E2E・単一コマ品質修正、2026-08-12）

- Base: `feature/manga-canvas-mvp` / `d3441a4`（PR #235 merge commit）
- Branch: `codex/fix-r4-1r-single-panel-image-quality`
- Draft PR: [#236](https://github.com/team478a/manga/pull/236)
- 状態: `READY_FOR_OWNER_REVIEW`
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-c6c81b-team478as-projects.vercel.app
- Production: `test`モニターで32ページネームを約2分で生成し、全32ページ、採用、Canvas下書き32ページ／157コマ、BFL画像2候補、4 credit確定、候補比較・採用、自動保存、再読込復元まで成功した。
- 品質問題: 2候補中1候補に複数コマ風構成と読めない疑似文字が混入した。別候補は採用可能だった。
- 修正: 共通画像Promptとnegative promptへ、単一コマ全面描画、漫画ページ／複数コマ／枠／余白禁止、文字／疑似文字／吹き出し禁止を日英で追加する。
- 不変: Provider、model、pricing、credit、retry、timeout、Scheduler、API key、DB、migration、RPC、Storage、API、URL、Feature Flag、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktop。
- 検証: 専用21/21、Hub 640/640、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 52/52、deps、lint、全typecheck、research eval、Hub／Desktop build、RC preflight、diff check成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1R_MANGA_PRODUCTION_E2E_AND_IMAGE_QUALITY.md`](RELEASE_CANDIDATE_R4_1R_MANGA_PRODUCTION_E2E_AND_IMAGE_QUALITY.md)
- 停止: 責任者のreview／merge判断まで停止し、merge前に追加の実Provider生成や次工程へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1q モニター制作阻害要因修正、2026-08-12）

- Base: `feature/manga-canvas-mvp` / `924b833`
- Branch: `codex/fix-r4-1q-monitor-blockers`
- Draft PR: [#235](https://github.com/team478a/manga/pull/235)
- 状態: `READY_FOR_OWNER_REVIEW`
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-da7543-team478as-projects.vercel.app
- Productionで32ページAIネームtimeoutと失敗時利用回数増加、品質評価保存失敗、一般報告保存・履歴読込失敗を確認した。
- ネームは同じGPT-5.6 Terra、Responses API、`store:false`を維持する。9〜48ページは全体連続性設計後に8ページ単位を並列生成し、結合後の全体schema成功時だけ保存・利用回数消費する。8ページ以下の既存1応答契約も維持する。
- モニター保存は列不足だけ基本列へ退避し、本人履歴と管理者一覧も読める。RLS、制約、接続障害は成功扱いにしない。
- DB／migrationは変更していない。完全な構造化運用には既存`202608020002`、`202608030001`、`202608030002`のProduction適用確認が必要。
- 長編分割の集中25/25、Hub 639/639、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、deps、lint、全typecheck、research eval、migration 52/52、RC preflight、Hub／Desktop build成功。詳細は[`RELEASE_CANDIDATE_R4_1Q_MONITOR_BLOCKER_FIX.md`](RELEASE_CANDIDATE_R4_1Q_MONITOR_BLOCKER_FIX.md)。
- 長編分割実装HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 停止: Draft PRの全CI／Vercel Preview成功後に停止し、merge前にProduction再実行やR4-2を行わない。

---

## 0. 現在の優先タスク（PR-R4-1o 対象ユーザー市場分析受入れ完了、2026-08-12）

- Base: `feature/manga-canvas-mvp` / `44b99dd`（PR #232 merge commit）
- Branch: `codex/release-r4-1o-research-user-acceptance`
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#233](https://github.com/team478a/manga/pull/233)
- Vercel Preview: https://mangai-hub-staging-git-codex-release-e6ee4a-team478as-projects.vercel.app
- 本人E2E: MANGAI責任者から、対象ユーザー本人による市場分析のユーザー検証完了報告を受領した。
- 完了範囲: 既存Report表示、新規市場分析保存、詳細表示、再読込後の本人履歴再表示。PR-R4-1mの非blocking保留を解除する。
- 証拠境界: 本人操作を責任者報告で受入れる。Codexは本人session、Report本文、Prompt、件数、費用を取得しない。
- 不変: Codexによる追加の本番操作なし。製品コード、DB、Storage、Provider、credit、外部契約を変更しない。
- 残件: Cloud text実Job、AIネーム由来8ページE2E、一般ユーザー所有生成成果物・署名付き書き出しURLのowner isolation、Stripe test E2E。
- ローカル検証: `rc:acceptance`成功（2 passed／11 pending／2 blocked）、full `rc:validate`成功（Desktop 182/182、Hub 632/632、migration 52/52、Hub／Desktop production build）、diff check成功。
- CI: Draft PR初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1O_RESEARCH_USER_ACCEPTANCE_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1O_RESEARCH_USER_ACCEPTANCE_EVIDENCE.md)
- 停止: 文書限定Draft PRの全CI／Preview後に停止し、責任者確認前にR4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1n Production所有者分離受入れ、2026-08-12）

- Base: `feature/manga-canvas-mvp` / `ff9e0d5`（PR #231 merge commit）
- Branch: `codex/release-r4-1n-owner-isolation`
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#232](https://github.com/team478a/manga/pull/232)
- Vercel Preview: https://mangai-hub-staging-git-codex-release-0fef78-team478as-projects.vercel.app
- Production: read only transactionで2人の一般ユーザーclaimを再現し、市場分析Reportの双方向分離と一般向け非公開Cloud作品の所有者1件／相手0件を確認した。
- 成果物分離: 既存の非公開生成Job、Asset、`cloud-assets` objectは所有側1件／一般ユーザー側0件。ただし既存所有者はadminで、一般ユーザー所有の成果物は0件だった。
- 不変: transactionは`ROLLBACK`済み。DB／Storage／Provider／credit／利用者data／製品コード／外部契約を変更していない。
- 未実施: 非公開`works`、一般ユーザー所有生成成果物、Cloud書き出しJob／`cloud-exports`が0件のため、marketplace作品と署名付き書き出しURLの実データ比較は未実施。
- 残件: Cloud text実Job、AIネーム由来8ページE2E、一般ユーザー所有生成成果物・書き出しURLのowner isolation、Stripe test E2E。対象本人の市場分析E2Eは非blocking保留でpassedではない。
- 検証: owner isolation契約7/7、RC JSON、full `rc:validate`成功（Desktop 182/182、Hub 632/632、migration 52/52、Hub／Desktop production build）、diff check、Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。
- 証跡: [`RELEASE_CANDIDATE_R4_1N_OWNER_ISOLATION_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1N_OWNER_ISOLATION_EVIDENCE.md)
- 停止: 文書限定Draft PRの全CI／Preview後に停止し、責任者確認前にR4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1m Production反映後確認・本人E2E保留、2026-08-12）

- Base: `feature/manga-canvas-mvp` / `8fe3888`（PR #230 merge commit）
- Branch: `codex/release-r4-1m-production-closeout`
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#231](https://github.com/team478a/manga/pull/231)
- Vercel Preview: https://mangai-hub-staging-git-codex-release-a6dc7b-team478as-projects.vercel.app
- Production: 管理画面TOPとユーザー一覧は11人で一致。対象モニターはactive、13/50、期限内。Dashboard、Creator、市場分析履歴に汎用エラーなし。
- 責任者判断: 対象本人の市場分析E2Eは2026-08-12付で非blocking保留。未確認のためpassedにはしないが、本人確認だけを理由に後続を止めない。
- 不変: 読み取り専用。Provider、credit、AI利用、Report、作品、Asset、設定、注文を変更していない。製品コードと外部契約も変更しない。
- 検証: full `rc:validate`成功（Hub 632/632、Desktop 182/182、migration 52/52、Hub／Desktop production build）。Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。
- 残件: Cloud text実Job、AIネーム由来8ページE2E、2利用者owner isolation、Stripe test E2E。
- 証跡: [`RELEASE_CANDIDATE_R4_1M_PRODUCTION_CLOSEOUT_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1M_PRODUCTION_CLOSEOUT_EVIDENCE.md)
- 停止: 文書限定Draft PRの全CI／Preview後に停止し、merge後は実行可能なR4残件へ進む。

---

## 0. 現在の優先タスク（PR-R4-1l 管理画面ユーザー件数整合性、2026-08-11）

- Base: `feature/manga-canvas-mvp` / `3fd2d54`（PR #229 merge commit）
- Branch: `codex/fix-admin-user-count-consistency`
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#230](https://github.com/team478a/manga/pull/230)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-admi-61f545-team478as-projects.vercel.app
- Production診断: 管理画面TOPはProfile 12件、ユーザー一覧は削除済みAuthアカウントを除く11人を表示した。
- 修正: ProfileとAuth directoryの共通可視判定をapplicationへ追加し、TOPと一覧を同じ集計条件へ統一する。取得障害時は不正確な件数を表示しない。
- 変更しない範囲: DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、Scheduler、Canvas、出力、成人向け境界、Stripe、Desktop。
- 検証: 集中13/13、full `rc:validate`成功（Hub 632/632、Desktop 182/182、migration 52/52、Hub／Desktop production build）。Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。
- 証跡: [`RELEASE_CANDIDATE_R4_1L_ADMIN_USER_COUNT_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1L_ADMIN_USER_COUNT_EVIDENCE.md)
- 停止: Draft PRの全CI／Preview後に停止し、市場分析の本人確認前にR4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1k Production市場分析RLS受入れ、2026-08-11）

- Base: `feature/manga-canvas-mvp` / `acac27a`（PR #228 merge commit）
- Branch: `codex/release-r4-1k-research-acceptance`
- Draft PR: [#229](https://github.com/team478a/manga/pull/229)
- Preview: `https://mangai-hub-staging-git-codex-release-9642ee-team478as-projects.vercel.app`
- 状態: `READY_FOR_OWNER_REVIEW`（Production受入れ・全品質ゲート・Draft PR完了）
- Production: RLS再帰修正migration適用済み。definer、固定search path、authenticated EXECUTEを確認。
- 対象モニターclaim: 自profile 1件、所有Report 4件、他owner 0件、直近Report構造をRLS経由で参照できた。
- 不変確認: active、AI利用9、usage 9件、Report 4件。Provider／credit／新規Report変更なし。
- UI回帰: ユーザー管理、モニター管理、マイページ、Cloud制作画面成功。
- 検証: 集中14/14、full `rc:validate`成功（Desktop 182/182、Hub 629/629、migration 52/52、Hub／Desktop production build）。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1K_RESEARCH_ACCEPTANCE_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1K_RESEARCH_ACCEPTANCE_EVIDENCE.md)
- 停止: Draft PRの全CI／Preview後に停止し、対象本人の既存Report再表示まで市場分析受入れをpendingとする。R4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1j 市場分析RLS再帰修正、2026-08-11）

- Base: `feature/manga-canvas-mvp` / `0255968e7783c0fa6b055dd970746a72c77a42c0`（PR #227 merge commit）
- Branch: `codex/fix-profile-rls-admin-recursion`
- Draft PR: [#228](https://github.com/team478a/manga/pull/228)
- Preview: `https://mangai-hub-staging-git-codex-fix-prof-a5b7c1-team478as-projects.vercel.app`
- 状態: `READY_FOR_OWNER_REVIEW`（修正・非永続Production検証・全品質ゲート・Draft PR完了）
- Production: 対象モニターはactive／招待完了／期限内で、市場分析Report 4件が保存済み。Report JSON型も正常。
- 原因: `profiles` RLSが呼ぶinvoker版`is_admin()`が`profiles`を再参照し、認証利用者のReport readで`stack depth limit exceeded`となる。
- 修正: `is_admin()`を固定search pathの`SECURITY DEFINER`へ変更する追加migration。admin判定条件と既存RLS／外部契約は変更しない。
- 非永続検証: 対象利用者claimで所有Report 4件・直近1件を取得後にROLLBACKし、Production定義が未変更であることを確認。
- 検証: 集中14/14、full `rc:validate`成功（Desktop 182/182、Hub 629/629、migration 52/52、Hub／Desktop production build）。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1J_RESEARCH_RLS_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1J_RESEARCH_RLS_EVIDENCE.md)
- 停止: Draft PRの全CI／Vercel Preview後に停止する。merge後のmigration適用と対象本人E2Eまで市場分析受入れはpending、R4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1i Production checkpoint受入れ、2026-08-10）

- Base: `feature/manga-canvas-mvp` / `f9544035a82256ce2128f4ec1c6b4473cd4b9404`（PR #226 merge commit）
- Branch: `codex/release-r4-1i-checkpoint-acceptance`
- Draft PR: [#227](https://github.com/team478a/manga/pull/227)
- 状態: `READY_FOR_OWNER_REVIEW`（checkpoint受入れ合格、R4-1全体はpending）
- Production migration: `202608100001_cloud_project_checkpoint_digest_schema.sql`を対象Supabaseへ適用し、`extensions.digest`、RPC契約、権限を確認した。
- Production実機: checkpoint作成、作品基本設定の差分、復元前自動checkpoint、復元、再読込後の元説明復帰に成功した。
- DB: checkpoint 2件、restore 1件、checkpoint page 16行。生成Job／cost ledgerは受入れ中に変更なし。Asset内容と有効状態はcheckpoint manifestと一致した。
- 検証: AI単独30/30とfull `rc:validate`再実行成功（Desktop 182/182、Hub 627/627、migration 51/51、Hub／Desktop production build）。初回Desktop 181/182のtimeout mock競合は再現しなかった。
- 証跡: [`RELEASE_CANDIDATE_R4_1I_CHECKPOINT_ACCEPTANCE_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1I_CHECKPOINT_ACCEPTANCE_EVIDENCE.md)
- 残件: Cloud text実Job、対象モニター本人の市場分析、AIネーム由来8ページE2E、2利用者実owner isolation、Stripe test E2E。
- 停止: 文書限定Draft PRの全CI／Vercel Previewを確認し、責任者確認前にR4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1h Production checkpoint digest修正、2026-08-10）

- Base: `feature/manga-canvas-mvp` / `c1660e21b13d5e9a11e1f2a56e9df9329e828ab5`（PR #225 merge commit）
- Branch: `codex/fix-r4-checkpoint-digest-schema`
- Draft PR: [#226](https://github.com/team478a/manga/pull/226)
- Preview: `https://mangai-hub-staging-git-codex-fix-r4-c-7d4b6b-team478as-projects.vercel.app`
- 状態: `READY_FOR_OWNER_REVIEW`（R4-1全体はpending）
- Production: checkpoint作成が42883で失敗し、checkpoint、Provider Job、Asset、credit、費用は増加していない。
- 診断: 対象DBにはRPC／table／RLS／権限が存在し、Production作品も同じDBに存在する。ROLLBACK付き実行で`digest(bytea,unknown)`未解決を確定した。
- 修正: 追加migrationで2箇所を`extensions.digest`へ明示修飾し、canonical schemaとmigration assertionを同期する。RPC signature、権限、固定search path、hash仕様は変更しない。
- 検証: Production DBのROLLBACK付き修正後RPC成功、永続変更0、集中21/21、migration manifest 51件、full `rc:validate`成功（Hub 627/627、Hub／Desktop production build）。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1H_CHECKPOINT_DIGEST_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1H_CHECKPOINT_DIGEST_EVIDENCE.md)
- 停止: Draft PRの最終HEADで全CI／Vercel Previewを確認し、merge後のProduction migration適用とcheckpoint作成・差分・復元を未完了としてR4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1g Cloud Canvas編集lease確認ゲート、2026-08-10）

- Base: `feature/manga-canvas-mvp` / `0f704d80095edcac41d7279e2f5236489f52e1f0`（PR #224 merge commit）
- Branch: `codex/fix-page-edit-lock-checking-gate`
- Draft PR: [#225](https://github.com/team478a/manga/pull/225)
- Preview: `https://mangai-hub-staging-git-codex-fix-page-aa7b79-team478as-projects.vercel.app`
- 状態: `READY_FOR_OWNER_REVIEW`（R4-1全体はpending）
- Production: ページ遷移直後のlease `checking`中も編集UIが操作できるfail-openと、確認通知消失時のレイアウト移動を再現した。一時変更したコマ名は元へ戻して保存済み。
- 修正: `acquired`以外は編集UIを`inert`化し、Undo／Redo／削除のwindow shortcutも遮断する。`checking`／`locked`／`unavailable`を固定overlayで案内する。
- 外部契約: API、DB、migration、RPC、Storage、Feature Flag、lease token／時間、Canvas schema、Provider、model、pricing、retry、timeout、Scheduler、PDF／PNG、成人向け境界、Stripe、Desktopを変更しない。
- 検証: 集中15/15、lint、Hub／Desktop typecheck、deps、research eval、full `rc:validate`成功（Hub 626/626、Desktop 182/182、Canvas 26/26、AI 48/48、migration 50/50、Hub／Desktop build）。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1G_PAGE_LOCK_GATE_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1G_PAGE_LOCK_GATE_EVIDENCE.md)
- 停止: Draft PRの最終HEADで全CI／Vercel Previewを確認し、R4-1はpending、R4-2は未着手を維持する。

---

## 0. 現在の優先タスク（PR-R4-1f 一括生成開始拒否の本番再現・修正、2026-08-10）

- Base: `feature/manga-canvas-mvp` / `0754e0b09b7b530fb6de64974d5d1e1099c6887a`（PR #223 merge commit）
- Branch: `codex/fix-empty-generation-batch-on-rejection`
- Draft PR: [#224](https://github.com/team478a/manga/pull/224)
- Preview: `https://mangai-hub-staging-juvn34ftl-team478as-projects.vercel.app`
- 状態: `READY_FOR_OWNER_REVIEW`（R4-1全体はpending）
- Production: 既存一般向け検証作品を8ページ／9コマへ拡張。手動作品からの7コマ一括生成はAIネーム関連境界でJob登録前に拒否され、Provider、Asset、credit、外部費用の増加なし。
- 検出: 拒否前にBatchだけが作成され、「処理中0/0」が残る。検証Batchは製品UIで中止済み。
- 修正: 最初のQueue拒否時にBatchを`canceled`へ補償し、未紐付けJobをキャンセルする。Job 0件のcanceled Batchは利用者履歴から除外し、DB記録は保持する。
- 市場分析: 現sessionは一般モニター資格境界で拒否され、保存・Provider呼出し・費用なし。対象モニター本人session待ち。
- 検証: 集中15/15、lint、Hub／Desktop typecheck、full `rc:validate`成功（Hub 625/625、Desktop 182/182、Canvas 26/26、AI 48/48、migration 50/50、Hub／Desktop build）。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1F_BATCH_REJECTION_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1F_BATCH_REJECTION_EVIDENCE.md)
- 停止: Draft PRの全CI／Vercel Previewを確認し、checkpoint、Cloud text、市場分析、AIネーム由来8ページE2E、2利用者owner isolation、Stripe test E2Eを未完了としてR4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1e Production Scheduler受入れ、2026-08-10）

- Base: `feature/manga-canvas-mvp` / `2e3a1d5350ae2db3d1c0f158020e573e6f6267d5`（PR #222 merge commit）
- Branch: `codex/release-r4-1e-scheduler-acceptance`
- Draft PR: [#223](https://github.com/team478a/manga/pull/223)
- Preview: `https://mangai-hub-staging-git-codex-release-47537d-team478as-projects.vercel.app`
- 状態: `READY_FOR_OWNER_REVIEW`（R4-1全体はpending）
- 外部設定: Vercel Production／PreviewとGitHub ActionsのWorker secretを同値ローテーションし、Worker URL secretとScheduler enabled variableを設定。値は記録しない。
- Production: `2e3a1d5`を再deployしReady。通信なしcheck成功後、Queue 0件／Worker正常を確認してSchedulerを有効化した。
- 限定run: [31359171708](https://github.com/team478a/manga/actions/runs/31359171708)は`idle`、requests 1、processed 0。Provider生成・credit消費なし。
- 定期run: [31359786321](https://github.com/team478a/manga/actions/runs/31359786321)が`event=schedule`で成功。`idle`、requests 1、processed 0。実行後もQueue 0件／Worker正常。
- 検証: RC台帳2 passed／11 pending／2 blocked、full `rc:validate`成功（Hub 624/624、Desktop 182/182、Canvas 26/26、AI 48/48、migration 50/50、Hub／Desktop build）。
- 証跡: [`RELEASE_CANDIDATE_R4_1E_SCHEDULER_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1E_SCHEDULER_EVIDENCE.md)
- 停止: 文書限定Draft PRの最終HEADで全CI／Vercel Previewを確認し、残るcheckpoint、Cloud text、市場分析、8ページE2E、2利用者owner isolation、Stripe test E2Eを未完了としてR4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1d Production外部構成照合、2026-08-10）

- Base: `feature/manga-canvas-mvp` / `84773f75c9f42715a33b540dd96dcde4fe6e74cd`（PR #221 merge commit）
- Branch: `codex/release-r4-1d-checkpoint-acceptance`
- Draft PR: [#222](https://github.com/team478a/manga/pull/222)
- Preview: `https://mangai-hub-staging-git-codex-release-68a981-team478as-projects.vercel.app`
- 状態: `EXTERNAL_CONFIGURATION_REQUIRED`
- checkpoint: 対象Supabase project `vmdsyxykcrgxcdbrwlkv`は現在のDashboard accountから参照できず、別projectだけが表示される。SQLや本番DBは変更していない。
- Cloud text: Vercelにはenabledだけがあり、model、pricing version、Gateway endpoint/keyがProject／Sharedともにない。Production価格台帳はBFL画像13行だけでtext価格0行。
- 境界: OpenAI市場分析設定は設定済み・有効だがCloud text Gatewayとは別経路。Provider呼出し、Job、credit、課金、外部設定変更なし。
- 証跡: [`RELEASE_CANDIDATE_R4_1D_EXTERNAL_CONFIGURATION_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1D_EXTERNAL_CONFIGURATION_EVIDENCE.md)
- 停止: 文書限定Draft PRの最終HEADで全CI／Vercel Previewを確認し、外部構成の責任者確認前に値を推測設定しない。R4-1はpendingを維持し、R4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1c Production編集ロック再受入れ、2026-08-10）

- Base: `feature/manga-canvas-mvp` / `d40d8d4f4e30ff57fcb160f7842afb7b780069d5`（PR #220 merge commit）
- Branch: `codex/release-r4-1c-page-lock-acceptance`
- Draft PR: [#221](https://github.com/team478a/manga/pull/221)
- Preview: `https://mangai-hub-staging-git-codex-release-61ff0c-team478as-projects.vercel.app`
- 状態: `READY_FOR_OWNER_REVIEW`
- Production合格: 同一タブ即時再読込、作品画面からの再入場、別タブ排他、元タブ継続、保存済み表示、既存生成Asset表示。
- Production変更: 編集lease取得のみ。ページ内容、Canvas、Asset、作品状態、Provider、credit、課金、外部設定は変更していない。
- 証跡: [`RELEASE_CANDIDATE_R4_1C_PAGE_LOCK_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1C_PAGE_LOCK_EVIDENCE.md)
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 残件: checkpoint migration、Cloud text readiness、対象モニター本人の市場分析、8ページE2E、Scheduler、2利用者owner isolation、Stripe test E2E。
- 停止: 文書限定Draft PRの最終HEADで全CI／Vercel Previewを確認し、R4-1はpendingを維持する。R4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1b Production API追加受入れ、2026-08-10）

- Base: `feature/manga-canvas-mvp` / `7a304834fd1ccea553590f922f132b4d99b7be01`（PR #218 merge commit）
- Branch: `codex/release-r4-1b-production-api-acceptance`
- Draft PR: [#219](https://github.com/team478a/manga/pull/219)
- 状態: `PARTIAL_EXTERNAL_CONFIGURATION_REQUIRED`
- 完了: production BFL背景画像1件、Queue／credit／手動Worker／cost settlement、private Asset、Canvas配置・保存・再読込、1ページPNG。
- 判明: productionは作品checkpoint migration不足。同一タブ再読込後のpage lock待機、Cloud Editor文章Job登録前拒否も再現。市場分析は対象モニター本人sessionがなく未確認。
- 検証: RC台帳、Cloud漫画repository、migration 50/50、全`rc:validate`成功。Desktop初回一時失敗は単独／全体再実行で182/182成功、Hub 620/620、production build成功。
- 証跡: [`RELEASE_CANDIDATE_R4_1B_PRODUCTION_API_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1B_PRODUCTION_API_EVIDENCE.md)
- 停止: 文書限定Draft PRと最終HEADの全CI／Vercel Preview後に停止する。R4-1はpartialを維持し、責任者確認前に修正PRやR4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1 Cloud統合受入れ、2026-08-10）

- Base: `feature/manga-canvas-mvp` / `ba93db0429ce1abc66a89b35deb8d1648ebc60ec`（PR #217 merge commit）
- Branch: `codex/release-r4-1-cloud-acceptance`
- Draft PR: [#218](https://github.com/team478a/manga/pull/218)
- 状態: `PARTIAL_EXTERNAL_CONFIGURATION_REQUIRED`
- 完了: production Vercel／Hubの読み取り実機確認、既存Cloud生成結果、repository受入れ、owner isolation、100ページ、研究評価、migration manifest。
- 外部不足: Stripe変数0件・Dashboard未ログイン、Scheduler Worker URL／secretなし、対象Supabase projectへDashboard accessなし。本番市場分析保存、8ページexport、2利用者実owner isolationは未実施。
- 証跡: [`RELEASE_CANDIDATE_R4_1_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1_EVIDENCE.md)
- 制限: secret、外部設定、本番data、Provider、決済を変更／実行せず、未実施をpassedにしない。
- 停止: 文書限定Draft PRと最終HEADの全CI／Vercel Preview確認後に停止し、責任者確認前にR4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-0 Release Candidate統合監査・計画、2026-08-10）

- Base: `feature/manga-canvas-mvp` / `78f4503f6ca235c1c949cddc33c91e7efcc34fa3`（PR #216 merge commit）
- Branch: `codex/release-r4-0-acceptance-plan`
- Draft PR: [#217](https://github.com/team478a/manga/pull/217)
- Preview: `https://mangai-hub-staging-git-codex-release-e49113-team478as-projects.vercel.app`
- R3: PR-R3-1〜R3-5bはすべてマージ済みで、実装残件は0。
- 今回: `docs/RELEASE_CANDIDATE_R4_PLAN.md`を作成し、現在地、RC台帳、実環境受入れ、証拠、rollback、停止条件を統合する文書限定PR。
- 後続: R4-1へHub／Supabase／Vercel／Stripe、R4-2へDesktop実AI／アクセシビリティ／Windows署名・更新／最終RCをまとめる。
- RC状態: 2 passed、11 pending、2 blocked。資格情報、費用承認、実端末、信頼された証明書がない項目を成功扱いしない。
- 対象外: 成人向けDezgo production接続、依存更新、旧PR整理、新機能、UI redesign。
- 検証: 完全ローカルRCゲート、補助受入れ、初回HEADのCore quality／Migration roundtrip／Windows build／Vercel／Vercel Preview Comments成功。
- 停止: 最終文書同期後のHEADでも全CI／Vercel Previewを再確認して停止し、責任者確認前にR4-1へ進まない。

---

## 0. 現在の優先タスク（M6-1 限定モニター品質フィードバック、2026-08-02）

- Branch: `codex/manga-monitor-quality-feedback-v1`
- Base: `codex/manga-100-page-acceptance-v1`（Draft PR #120）
- 実装: Editor内のページ／コマ評価、生成Job由来の品質・費用指標、管理者集計
- migration: `202608020002_cloud_general_monitor_quality_feedback.sql`（未適用）
- 環境変数／外部Provider実行: 追加なし
- 詳細: `docs/cloud/MANGA_MONITOR_QUALITY_FEEDBACK_V1.md`
- 状態: 実装と静的検証済み。Supabase適用、認証済みPreview、実モニター試験、責任者承認待ち

---

## 0. 現在の優先タスク（M5-11 100ページ決定的受入れfixture、2026-08-02）

- Branch: `codex/manga-100-page-acceptance-v1`
- Base: `codex/manga-longform-readiness-v1`（Draft PR #119）
- Draft PR: [#120](https://github.com/team478a/manga/pull/120)
- Preview: `https://mangai-hub-staging-git-codex-manga-10-9b7089-team478as-projects.vercel.app`
- Fixture: 100ページ、10章、10話、20シーン、100コマ・100素材、全ページ確定済み
- 検査: 長編集約、24ページ段階表示、原稿preflight、制作進捗、固定版差分、4ページ×25分割PDF結合
- migration／環境変数／外部Provider: 追加なし
- 詳細: `docs/cloud/MANGA_100_PAGE_ACCEPTANCE_V1.md`
- 状態: 専用受入れ4/4、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。実ブラウザ、実画像、実DB復元訓練、責任者承認待ち

---

## 0. 現在の優先タスク（M5-10 長編完成準備チェック、2026-08-02）

- Branch: `codex/manga-longform-readiness-v1`
- Base: `codex/manga-checkpoint-diff-preview-v1`（Draft PR #118）
- Draft PR: [#119](https://github.com/team478a/manga/pull/119)
- Preview: `https://mangai-hub-staging-git-codex-manga-lo-109f0d-team478as-projects.vercel.app`
- 実装: 原稿確定、復旧用固定版、完成版固定、完成PDFの4段階判定と次アクションUI
- migration／環境変数／外部Provider: 追加なし
- DB: `202608020001`はSupabase staging適用・table／function／RLS確認済み
- 詳細: `docs/cloud/MANGA_LONGFORM_READINESS_V1.md`
- 状態: 実装、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。実ブラウザ、100ページfixture、責任者承認待ち

---

## 0. 現在の優先タスク（M5-9 復元前の差分確認、2026-08-02）

- Branch: `codex/manga-checkpoint-diff-preview-v1`
- Base: `codex/manga-checkpoint-restore-v1`（Draft PR #117）
- Draft PR: [#118](https://github.com/team478a/manga/pull/118)
- Preview: `https://mangai-hub-staging-git-codex-manga-ch-52453e-team478as-projects.vercel.app`
- 実装: ページrevision、構成ID、素材ID、作品基本設定の決定的な差分集計と日本語UI
- 情報境界: manifest、ハッシュ、Canvas、Storage path、Provider情報は非表示
- migration／環境変数／外部Provider: 追加なし
- 詳細: `docs/cloud/MANGA_CHECKPOINT_DIFF_PREVIEW_V1.md`
- 状態: 実装、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。実ブラウザ、100ページ実データ、責任者承認待ち

---

## 0. 現在の優先タスク（M5-8 チェックポイント復元、2026-08-02）

- Branch: `codex/manga-checkpoint-restore-v1`
- Base: `codex/manga-version-freeze-v1`（Draft PR #116）
- Draft PR: [#117](https://github.com/team478a/manga/pull/117)
- Preview: `https://mangai-hub-staging-git-codex-manga-ch-e4a0cd-team478as-projects.vercel.app`
- 実装: 復元前自動バックアップ、作品構造／Canvas復元、復元監査、明示確認UI
- 安全条件: 生成中／編集中は拒否、別作品拒否、revision単調増加、復元ページは要再確認
- migration: `202608020003_cloud_project_checkpoint_restore.sql`（旧ファイル名`202608020001`でSupabase staging適用・構造確認済み。招待追跡とのID競合解消のためリポジトリ上で改番）
- 詳細: `docs/cloud/MANGA_PROJECT_CHECKPOINT_RESTORE_V1.md`
- 状態: 実装、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。Supabase staging、実ブラウザ、責任者承認待ち

---

## 0. 現在の優先タスク（M5-7 増分バックアップと完成版固定、2026-08-01）

- Branch: `codex/manga-version-freeze-v1`
- Base: `codex/manga-cost-budget-v1`（Draft PR #115）
- Draft PR: [#116](https://github.com/team478a/manga/pull/116)
- Preview: `https://mangai-hub-staging-git-codex-manga-ve-2950ce-team478as-projects.vercel.app`
- 実装: Canvas SHA-256重複排除、作品manifest、作業バックアップ、完成版固定、固定履歴
- 完成版条件: 生成停止中、全ページsnapshot、全ページ確定、revision／Context一致
- migration: `202608010011_cloud_project_checkpoints.sql`（Supabase staging適用・構造確認済み）
- 詳細: `docs/cloud/MANGA_PROJECT_CHECKPOINTS_V1.md`
- 状態: 実装、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI、Supabase staging適用成功。実ブラウザ、責任者承認待ち

---

## 0. 現在の優先タスク（M5-6 作品別リソース予算、2026-08-01）

- Branch: `codex/manga-cost-budget-v1`
- Base: `agent/manga-chapter-production-plans-v1`（Draft PR #114）
- Draft PR: [#115](https://github.com/team478a/manga/pull/115)
- Preview: `https://mangai-hub-staging-git-codex-manga-co-1eab8d-team478as-projects.vercel.app`
- 実装: 作品別月間クレジット・概算費用・容量上限、警告割合、生成停止、コックピット集計
- DB: owner/admin保存RPC、owner read RLS、JobとAssetへの強制上限trigger
- migration: `202608010010_cloud_project_resource_budgets.sql`（Supabase staging適用済み）
- DB確認: table／RPC／RLS／生成Job trigger／Storage trigger／既存作品backfillがすべて正常
- 表示境界: 利用者には合計だけを表示し、Provider／モデル／料金計算ロジックを公開しない
- 詳細: `docs/cloud/MANGA_PROJECT_RESOURCE_BUDGET_V1.md`
- 状態: 全ローカル品質ゲート、Draft PR、Preview、全GitHub CI、Supabase staging適用成功。実Provider・実ブラウザ・責任者承認待ち

---

## 0. 現在の優先タスク（M5-5 章単位の制作計画、2026-08-01）

- Branch: `agent/manga-chapter-production-plans-v1`
- Base: `agent/manga-cockpit-navigation-v1`（Draft PR #113）
- Draft PR: [#114](https://github.com/team478a/manga/pull/114)
- Preview: `https://mangai-hub-staging-git-agent-manga-ch-9a2d97-team478as-projects.vercel.app`
- 実装: 章ごとの優先度・担当名・期限・メモ、期限超過、優先章数、次着手章
- migration: `202608010009_cloud_chapter_production_plans.sql`（Supabase staging適用・構造確認済み）
- DB適用: 長編制作関連の未適用10項目を一括監査し、すべて正常。`202608010002`は既適用
- 利用者マニュアル: `/dashboard/monitor/guide`とMarkdown版へ、短編試作から100ページ制作・PDF出力までの実操作手順を反映
- 状態: 実装、DB適用、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。実ブラウザ・Worker実行・責任者承認待ち

---

## 0. 現在の優先タスク（M5-4 100ページナビゲーション、2026-08-01）

- Branch: `agent/manga-cockpit-navigation-v1`
- Base: `agent/manga-longform-cockpit-v1`（Draft PR #112）
- Draft PR: [#113](https://github.com/team478a/manga/pull/113)
- Preview: `https://mangai-hub-staging-git-agent-manga-co-4977d4-team478as-projects.vercel.app`
- 目的: 長編コックピットのDOMと認知負荷を100ページ規模で抑える
- 実装: 章／状態絞り込み、未割当抽出、折りたたみ、24ページ段階表示
- migration／環境変数／外部Provider: 追加なし
- 詳細: `docs/cloud/MANGA_COCKPIT_NAVIGATION_V1.md`
- 状態: 実装、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。100ページ実データ確認と責任者承認待ち

---


## 0. 現在の優先タスク（M5-3 長編作品コックピット、2026-08-01）

- Branch: `agent/manga-longform-cockpit-v1`
- Base: `agent/manga-continuity-suggestions-v1`（Draft PR #111）
- Draft PR: [#112](https://github.com/team478a/manga/pull/112)
- Preview: `https://mangai-hub-staging-git-agent-manga-lo-7b90ee-team478as-projects.vercel.app`
- 目的: 32〜100ページ作品の構成、進捗、伏線、人物関係を横断確認する
- 実装: `/creator/[projectId]/cockpit` と決定的な集計helper
- 安全境界: 既存の保存済み情報だけを集計し、Providerや外部AIは利用しない
- migration／環境変数: 追加なし
- 詳細: `docs/cloud/MANGA_LONGFORM_COCKPIT_V1.md`
- 状態: 実装、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。実作品確認と責任者承認待ち

---


## 0. 現在の優先タスク（M5-2 連続性設定候補、2026-08-01）

- Branch: `agent/manga-continuity-suggestions-v1`
- Base: `agent/manga-continuity-foundation-v1`（Draft PR #110）
- Draft PR: [#111](https://github.com/team478a/manga/pull/111)
- Preview: `https://mangai-hub-staging-git-agent-manga-co-2eb954-team478as-projects.vercel.app`
- 目的: 確定済みの構造化設定を候補化し、利用者が確認した項目だけM5-1台帳へ保存する
- 実装: キャラクター／場所／小物／ページ割当済みシーン候補、登録済み除外、確認登録UI
- 安全境界: Promptや画像を解析せず、外部AIを呼ばず、候補は未確認のまま保存しない
- migration／環境変数: 追加なし
- 詳細: `docs/cloud/MANGA_CONTINUITY_SUGGESTIONS_V1.md`
- 状態: 実装、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。実作品確認と責任者承認待ち

---

## 0. 現在の優先タスク（M5-1 物語の連続性台帳、2026-08-01）

- Branch: `agent/manga-continuity-foundation-v1`
- Base: `agent/manga-storage-lifecycle-v1`（Draft PR #109）
- Draft PR: [#110](https://github.com/team478a/manga/pull/110)
- Preview: `https://mangai-hub-staging-git-agent-manga-co-654703-team478as-projects.vercel.app`
- 目的: 長編の事実と伏線をページ範囲付きで管理し、決定的に検出できる矛盾を表示する
- 実装: `cloud_continuity_facts`、`cloud_plot_threads`、owner-only RPC、事実・伏線UI、矛盾・回収漏れ評価
- migration: `202608010008_cloud_narrative_continuity.sql`、rollback、canonical schema同期
- 詳細: `docs/cloud/MANGA_NARRATIVE_CONTINUITY_V1.md`
- 状態: 実装、migration実DB往復、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。外部環境適用と責任者承認待ち

---


## 0. 現在の優先タスク（M4 Storageライフサイクル、2026-08-01）

- Branch: `agent/manga-storage-lifecycle-v1`
- Base: `agent/manga-durable-export-v1`（Draft PR #108）
- Draft PR: [#109](https://github.com/team478a/manga/pull/109)
- Preview: `https://mangai-hub-staging-git-agent-manga-st-723bbf-team478as-projects.vercel.app`
- 目的: 長編作品のページサムネイル生成と不要な派生ファイルの安全な整理を追加する
- 実装: `cloud-cache`、ページrevision別WebP、署名URL、thumbnail／cleanup Queue、lease Worker
- 保護対象: 採用済み生成画像、Canvas保存データ、完成`manuscript.pdf`はcleanup対象外
- migration: `202608010007_cloud_storage_lifecycle.sql`、rollback、canonical schema同期
- 詳細: `docs/cloud/MANGA_STORAGE_LIFECYCLE_V1.md`
- 状態: 実装、ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。外部環境適用と責任者承認待ち

---


## 0. 現在の優先タスク（M4 永続PDFエクスポート、2026-08-01）

- Branch: `agent/manga-durable-export-v1`
- Base: `agent/manga-production-status-v1`（Draft PR #107）
- Draft PR: [#108](https://github.com/team478a/manga/pull/108)
- Preview: `https://mangai-hub-staging-git-agent-manga-du-4a6dbe-team478as-projects.vercel.app`
- 目的: 32〜100ページ原稿を4ページsegmentで永続処理し、完成PDFへ安全に結合する
- 実装: Export Job／segment、停止・再開・中止・retry、private Storage、署名download、厳格preflight
- migration: `202608010006_cloud_durable_export.sql`、rollback、canonical schema同期
- 詳細: `docs/cloud/MANGA_DURABLE_EXPORT_V1.md`
- 状態: 実装、ローカル検証、Draft PR、Preview完了。GitHub CI確認中

---


## 0. 現在の優先タスク（M4制作管理 ページ状態・確定ロック、2026-08-01）

- Branch: `agent/manga-production-status-v1`
- Base: `agent/manga-batch-production-v1`（Draft PR #106）
- Draft PR: [#107](https://github.com/team478a/manga/pull/107)
- Preview: `https://mangai-hub-staging-git-agent-manga-pr-7ff6fc-team478as-projects.vercel.app`
- 目的: 長編制作のページ状態、全体進捗、確認・修正・確定を制作ボードで管理する
- 実装: 5状態、Job連動、確定編集ロック、設定変更revision、絞り込み、migration未適用fallback
- migration: `202608010005_cloud_production_status.sql`、rollback、canonical schema同期
- 詳細: `docs/cloud/CLOUD_PRODUCTION_STATUS_V1.md`
- 検証: deps、lint、Hub 363/363、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y、migration forward／rollback／reapply／canonical、build成功
- 状態: 実装・Draft PR・Preview完了。Supabase staging適用、実ブラウザ確認、責任者承認待ち

---


## 0. 現在の優先タスク（M4後半 一括生成・編集ロック、2026-08-01）

- Branch: `agent/manga-batch-production-v1`
- Base: `agent/manga-32page-foundation-v1`（Draft PR #105）
- Draft PR: [#106](https://github.com/team478a/manga/pull/106)
- Preview: `https://mangai-hub-staging-git-agent-manga-ba-fd5369-team478as-projects.vercel.app`
- 目的: 4〜8ページ単位の永続生成Queueと、Canvas同時編集の安全境界を追加する
- 実装: Batch永続化、Job紐付け、進捗集計、停止／再開／中止、失敗分retry、120秒の編集lease
- migration: `202608010004_cloud_batch_production.sql`、rollback、canonical schema同期済み
- 詳細: `docs/cloud/MANGA_BATCH_PRODUCTION_V1.md`
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 状態: コード、DB往復、Draft PR、Preview完了。Supabase staging適用、実Provider、実ブラウザ、責任者承認待ち

---

## 0. 現在の優先タスク（M4前半 32ページ制作基盤、2026-08-01）

- Branch: `agent/manga-32page-foundation-v1`
- Base: `agent/manga-transparent-layers-v1`（Draft PR #104）
- Draft PR: [#105](https://github.com/team478a/manga/pull/105)
- Preview: `https://mangai-hub-staging-git-agent-manga-32-fc91ac-team478as-projects.vercel.app`
- 目的: 32ページ読切を章・話・シーン単位で整理し、ページ一覧のDOM負荷を制限する
- 実装: Chapter／Scene schemaとRLS、既存作品backfill、階層追加、同一話内drag reorder、単ページ／見開き、12ページずつ追加表示
- fallback: migration未適用時は旧画面を継続し、構造編集だけ停止
- migration: `202608010003_cloud_longform_structure.sql`、rollbackとcanonical schema同期済み
- 詳細: `docs/cloud/MANGA_32_PAGE_FOUNDATION_V1.md`
- 検証: deps、lint、Hub/Desktop typecheck、Hub 354/354、Canvas 26/26、AI 48/48、Desktop 182/182、migration往復、production build成功
- CI: Core quality、Migration roundtrip、Windows accessibility/build、Vercel成功
- 状態: 実装・全自動検証・Preview完了。Supabase staging適用、実ブラウザ確認、責任者承認待ち

---

## 0. 現在の優先タスク（M3-8 人物・効果レイヤー白背景透明化、2026-08-01）

- Branch: `agent/manga-transparent-layers-v1`
- Base: `agent/manga-layered-generation-v1`（Draft PR #103）
- Draft PR: [#104](https://github.com/team478a/manga/pull/104)
- Preview: `https://mangai-hub-staging-git-agent-manga-tr-46b68e-team478as-projects.vercel.app`
- 目的: 分離生成した人物・効果を白い矩形ではなく透明PNGレイヤーとして保存する
- 実装: `outputAlphaMode`の許可値検証、人物・効果Jobへの固定、Sharpによる白地除去、Worker保存前変換
- 互換性: 既定値は`preserve`。完成コマ、背景、修正、既存Jobは変更しない
- migration / Feature Flag / Provider / 料金: 追加なし
- 詳細: `docs/cloud/MANGA_TRANSPARENT_LAYER_OUTPUT_V1.md`
- 検証: deps、lint、Hub/Desktop typecheck、Hub 350/350、Canvas 26/26、AI 48/48、Desktop 182/182、migration 34/34、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 状態: 実装・全自動検証・Preview完了。実Provider、実ブラウザ確認、責任者承認待ち

---

## 0. 現在の優先タスク（M3-7 背景・人物・効果の分離生成、2026-08-01）

- Branch: `agent/manga-layered-generation-v1`
- Base: `agent/manga-composition-control-v1`（Draft PR #102）
- Draft PR: [#103](https://github.com/team478a/manga/pull/103)
- Preview: `https://mangai-hub-staging-git-agent-manga-la-a0ee14-team478as-projects.vercel.app`
- 目的: 通常のコマ生成を完成コマ、背景、人物、効果へ分け、非破壊レイヤーとして採用する
- 実装: 対象選択UI、対象別Job・Prompt・参照分離、背景の下層配置、人物・効果の乗算合成
- 互換性: `generationTarget`未指定時は完成コマ。既存の修正生成は変更しない
- migration / Feature Flag / Provider / 料金: 追加なし
- 詳細: `docs/cloud/MANGA_LAYERED_GENERATION_V1.md`
- 検証: deps、lint、Hub/Desktop typecheck、Hub 348/348、Canvas 26/26、AI 47/47、Desktop 182/182、migration 34/34、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 状態: 実装・全自動検証・Preview完了。実Provider、実ブラウザ確認、責任者承認待ち

---

## 0. 現在の優先タスク（M3-6 ポーズ・構図制御、2026-08-01）

- Branch: `agent/manga-composition-control-v1`
- Base: `agent/manga-smart-mask-v1`（Draft PR #101）
- Draft PR: [#102](https://github.com/team478a/manga/pull/102)
- Preview: `https://mangai-hub-staging-git-agent-manga-co-048dc2-team478as-projects.vercel.app`
- 目的: 通常のコマ画像生成で、画角・カメラ位置・人物配置・視線方向を選択可能にする
- 実装: 4項目の選択UI、500文字以内の追加指定、API enum検証、生成Promptへの構図調整追加
- 互換性: すべて「ネームどおり」が初期値。修正生成には自動適用しない
- migration / Feature Flag / Provider / 料金: 追加なし
- 詳細: `docs/cloud/MANGA_COMPOSITION_CONTROL_V1.md`
- 検証: deps、lint、Hub/Desktop typecheck、Hub 345/345、Canvas 26/26、AI 47/47、Desktop 182/182、migration 34/34、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 状態: 実装・自動検証完了。実ブラウザ確認と責任者承認待ち

---

## 0. 現在の優先タスク（M3-5 修正領域おすすめ、2026-08-01）

- Branch: `agent/manga-smart-mask-v1`
- Base: `agent/manga-revision-comparison-v1`（Draft PR #100）
- Draft PR: [#101](https://github.com/team478a/manga/pull/101)
- 目的: Inpaintingの修正範囲を修正内容からワンタップ提案し、手描き調整を残す
- 実装: 顔・表情・手・衣装・背景・全体の比率ベース初期マスク、候補切替、手動補正
- 境界: v1は画像認識ではなく目安。外部Vision API、DB、Provider、料金の変更なし
- 詳細: `docs/cloud/MANGA_SMART_MASK_V1.md`
- 状態: ローカル全品質ゲート成功。Draft PR、GitHub CI、Vercel、責任者確認待ち
- 未実施: 実ブラウザのマウス・タッチ確認、責任者承認、親PR #100後のマージ

---

## 0. 現在の優先タスク（M3-4 修正前後の比較表示、2026-08-01）

- Branch: `agent/manga-revision-comparison-v1`
- Base: `agent/manga-panel-outpainting-v1`（Draft PR #99）
- Draft PR: [#100](https://github.com/team478a/manga/pull/100)
- 目的: 修正候補を採用する前に元画像との差分を視覚的に確認する
- 実装: range比較スライダー、Outpainting方向・寸法に応じた元画像位置補正、比較からの非破壊採用
- API: private inputは返さず、本人所有Jobの比較用Asset IDと拡張方向だけを安全に公開
- migration / Feature Flag: 追加なし
- 詳細: `docs/cloud/MANGA_REVISION_COMPARISON_V1.md`
- 注意: 一般向けCloudの表示機能のみ。成人向け、Desktop、生成Providerは対象外
- 状態: ローカル全品質ゲート成功。GitHub CI、Vercel、責任者確認待ち
- 未実施: 実ブラウザ確認、責任者承認、親PR #99後のマージ

---

## 0. 現在の優先タスク（M3-3 コマ画角拡張、2026-08-01）

- Branch: `agent/manga-panel-outpainting-v1`
- Base: `agent/manga-panel-inpainting-v1`（Draft PR #98）
- Draft PR: [#99](https://github.com/team478a/manga/pull/99)
- Preview: `https://mangai-hub-staging-git-agent-manga-pa-f7bc01-team478as-projects.vercel.app`
- 目的: 採用済みコマを非破壊で左・右・上・下・全方向へ延長する
- 実装: 方向UI、Outpainting operation、Worker内余白・白黒マスク生成、BFL Fill、correction layer採用
- Feature Flag: `CLOUD_PANEL_OUTPAINTING_ENABLED`。未設定時は認証・DB・Providerより前に停止
- migration: なし。既存Fill Providerと価格設定を再利用
- 詳細: `docs/cloud/MANGA_PANEL_OUTPAINTING_V1.md`
- 注意: 一般向けCloudのみ。成人向け、Desktop、自動マスクは対象外
- 状態: ローカル全品質ゲート、GitHub全CI、Vercel成功。責任者確認待ち
- 未実施: 実Provider有料生成、実ブラウザ確認、責任者承認、親PR #98後のマージ

---

## 0. 現在の優先タスク（M3-2 マスク付きコマ部分修正、2026-08-01）

- Branch: `agent/manga-panel-inpainting-v1`
- Base: `agent/manga-panel-revision-v1`（Draft PR #97）
- Draft PR: [#98](https://github.com/team478a/manga/pull/98)
- Preview: `https://mangai-hub-staging-jnew2urfq-team478as-projects.vercel.app`
- 目的: 採用画像の利用者が塗った範囲だけを修正候補として生成する
- 実装: タッチ対応マスク、専用inpainting operation、BFL Fill、private Asset再検証、correction layer採用
- Feature Flag: `CLOUD_PANEL_INPAINTING_ENABLED`。未設定時はUI・サーバー・Provider registryで停止
- migration: `202608010002_cloud_panel_inpainting.sql`
- 詳細: `docs/cloud/MANGA_PANEL_INPAINTING_V1.md`
- 注意: 一般向けCloudのみ。Outpainting、自動マスク、成人向け、Desktopは対象外
- 状態: ローカル全品質ゲート、GitHub全CI、Vercel成功。責任者確認待ち
- 未実施: staging migration、実Provider有料生成、実ブラウザ確認、責任者承認、親PR #97後のマージ

---

## 0. 現在の優先タスク（M3-1 コマ修正候補生成、2026-08-01）

- Branch: `agent/manga-panel-revision-v1`
- Base: `agent/manga-continuity-review-v1`（Draft PR #96）
- Draft PR: [#97](https://github.com/team478a/manga/pull/97)
- Preview: `https://mangai-hub-staging-git-agent-manga-pa-2b4a4e-team478as-projects.vercel.app`
- 目的: 採用済みコマ画像を残したまま、気になる部分の修正候補を生成する
- 実装: 6修正preset、任意追加要望、元画像先頭参照、設定version継承、2〜4候補、非破壊レイヤー採用
- DB: 新規migrationなし
- 詳細: `docs/cloud/MANGA_PANEL_REVISION_V1.md`
- 注意: マスク付きInpaintingではなく、参照画像を使うガイド付きImage-to-Image
- 未実施: 実Provider生成、実ブラウザ確認、責任者承認、親PR #96後のマージ

---

## 0. 現在の優先タスク（M2-4 生成履歴の一貫性チェック、2026-08-01）

- Branch: `agent/manga-continuity-review-v1`
- Base: `agent/manga-reference-assets-v1`（Draft PR #95）
- Draft PR: [#96](https://github.com/team478a/manga/pull/96)
- Preview: `https://mangai-hub-staging-git-agent-manga-co-df707f-team478as-projects.vercel.app`
- 目的: 採用済み生成画像が人物・衣装・場所・小物・画風の現在設定と参照画像を継続使用しているか確認する
- 実装: 設定版・参照asset・Job追跡の照合、混在警告、ページ／設定修正導線
- DB: 新規migrationなし
- 詳細: `docs/cloud/MANGA_CONTINUITY_REVIEW_V1.md`
- 注意: v1は画像ピクセルを解析せず、見た目の一致を保証しない
- 状態: ローカル全品質ゲート、GitHub全CI、Vercel成功。責任者確認待ち
- 変更しない範囲: 成人向け、Desktop、Provider、Worker、Stripe、Marketplace

---

## 0. 現在の優先タスク（M2-3 参照画像・コマ明示割当、2026-08-01）

- Branch: `agent/manga-reference-assets-v1`
- Base: `agent/manga-generation-integration-v1`（Draft PR #94）
- 目的: 人物・画風・場所・小物の参照画像と明示割当を一般向けコマ生成へ安全に反映する
- 実装: 非公開asset関連付け、コマ割当、Job監査入力、短時間署名URL、BFL FLUX.2 multi-reference
- migration: `202608010001_cloud_visual_references.sql`
- 詳細: `docs/cloud/MANGA_VISUAL_REFERENCES_V1.md`
- 変更しない範囲: 成人向け、Desktop、Stripe、Marketplace、自動参照昇格

---

## 0. 現在の優先タスク（一般向け漫画生成の統合、2026-07-31）

- Branch: `agent/manga-generation-integration-v1`
- Base: `feature/manga-canvas-mvp` (`ae1279e`)
- Draft PR: [#94](https://github.com/team478a/manga/pull/94)
- Preview: `https://mangai-hub-staging-git-agent-manga-ge-907c74-team478as-projects.vercel.app`
- 目的: PR #87〜#90の一般向け漫画生成機能を最新Cloud基盤へ安全に統合する
- 範囲: FLUXコマ生成、候補比較、レイヤー合成、原稿検査、作品進捗、
  キャラクター設定、画風・場所・小物設定
- 状態: ローカル品質ゲート、GitHub全CI、Vercel Preview成功。責任者確認待ち
- 詳細: `docs/cloud/MANGA_GENERATION_INTEGRATION_REPORT.md`
- 未実施: migration適用、実Provider有料生成、実ブラウザ確認、マージ
- 変更しない範囲: 成人向け、Desktop、Stripe、Marketplace

---

## 0. 現在の優先タスク（一般向けモニターWebマニュアル同期、2026-07-31）

- Branch: `codex/cloud-monitor-guide-sync-v1`
- Base: `feature/manga-canvas-mvp` (`ee6e2ca`、PR #92 merge後)
- 目的: モニターが現在の8工程と利用可能範囲を迷わず理解し、制作画面からいつでもマニュアルを開けるようにする
- 対象: `/dashboard/monitor/guide`、`/admin/general-monitors/guide`、Cloud共通サイドバー
- Draft PR: [#93](https://github.com/team478a/manga/pull/93)
- Preview: `https://mangai-hub-staging-git-codex-cloud-mo-eaf18e-team478as-projects.vercel.app`
- 状態: 実装・ローカル全品質ゲート・実装commitの全CI・Vercel成功、責任者確認待ち
- 変更しない範囲: DB、migration、認証、AI生成・保存ロジック、Feature Flag、成人向け境界、Desktop

---

## 0. 現在の優先タスク（一般向け制作工程の利用入口修正、2026-07-31）

- Branch: `codex/cloud-workflow-entrypoints-v1`
- Base: `feature/manga-canvas-mvp` (`38c1481`、PR #91 merge後)
- 目的: 市場分析以外の実装済み工程を、共通メニューから実際に利用可能にする
- 対象: Cloud共通サイドバー、工程入口Route、利用者本人の進行先解決
- Draft PR: [#92](https://github.com/team478a/manga/pull/92)
- 状態: 実装・ローカル主要品質ゲート完了、CI・Vercel Preview確認中
- 変更しない範囲: DB、migration、AI生成・保存ロジック、成人向け境界、Desktop

---

## 0. 現在の優先タスク（一般向け制作工程の表示整理、2026-07-31）

- Branch: `codex/cloud-workflow-labels-v1`
- Base: `feature/manga-canvas-mvp` (`7eb783f`)
- 目的: 一般向けモニターへ、実装済み工程と準備中工程を誤解なく案内する
- 対象: Cloud共通サイドバー、Dashboard、`/creator`、シナリオ採用画面
- 状態: 実装・ローカル主要品質ゲート完了、Draft PR作成前
- 変更しない範囲: DB、API、認証、制作・保存ロジック、Feature Flag、Desktop

---

## 0. 現在の優先タスク（クラウド制作の日本語化・初回ガイド、2026-07-31）

- Branch: `codex/cloud-creator-ja-guide-v1`
- Base: `feature/manga-canvas-mvp` (`3d16839`)
- 目的: モニターが英語の内部用語に迷わず、新しい紫基調UI上で
  最初の制作操作を理解できるようにする
- 対象: `/creator`と関連する作品作成・構成・ゴミ箱・ページ編集
- 状態: 実装とローカル主要品質ゲート完了、Draft PR #85で確認中
- 変更しない範囲: DB、API契約、認証、制作・保存ロジック、Desktop

---

## 0. 現在の優先タスク（招待メール文面編集、2026-07-31）

- Branch: `codex/cloud-monitor-email-template-v1`
- Base: `feature/manga-canvas-mvp` (`506cf2b`)
- 目的: 管理画面からモニター招待メールの件名・本文を安全に変更する
- 管理画面: `/admin/general-monitors/email`
- migration: `202607310003_cloud_general_monitor_email_template.sql`
- 状態: 実装とローカル主要品質ゲート完了、Draft PR準備中

---

## 0. 現在の優先タスク（モニター操作の処理中表示、2026-07-31）

- Branch: `codex/cloud-action-pending-feedback-v1`
- Base: `feature/manga-canvas-mvp` (`6ebdbaa`)
- 目的: ボタンクリック直後に処理中表示を出し、無反応に見える状態と二重送信を防ぐ
- 対象: モニター招待・運用・設定・フィードバック・初回開始
- 変更範囲: 表示層のみ。Server Action、認証、DB、API、Desktopは変更しない
- Draft PR: [#83](https://github.com/team478a/manga/pull/83)
- Preview:
  `https://mangai-hub-staging-hvbsecmo4-team478as-projects.vercel.app`
- 状態: 実装、ローカル品質ゲート、全CI、Vercel Preview成功。責任者確認待ち

---

## 0. 現在の優先タスク（一般向けモニター本番統合、2026-07-31）

- Branch: `codex/cloud-monitor-production-v1`
- Base: `feature/manga-canvas-mvp`
- 本番URL: `https://app.mang-ai.com`
- 目的: 一般向けRelease 1〜6を約10名へ本番招待制で段階公開する
- 除外: Stripe、販売、Marketplace、成人向け公開、Desktop
- 状態: 統合済み、品質ゲートとDraft PR作成中
- 正本:
  [`cloud/CLOUD_GENERAL_MONITOR_PRODUCTION_INTEGRATION.md`](cloud/CLOUD_GENERAL_MONITOR_PRODUCTION_INTEGRATION.md)

成人向け市場分析・企画のコードが統合履歴に含まれても、Productionの成人向け
Feature Flagは未設定または`false`を必須とする。本番マージ、migration適用、
Feature Flag有効化、redeploy、実招待はDraft PRの全CIと責任者承認後に行う。

---

## 0. 現在の優先タスク（Release 2 AI企画提案・限定公開準備、2026-07-30）

- Branch: `codex/cloud-proposal-generation-v1`
- Base: `codex/cloud-research-ai-auto-ux-v1` (`a21fd94`)
- Draft PR: [#69](https://github.com/team478a/manga/pull/69)
- 目的: 完了した一般向け市場分析から3企画を生成・比較・選択し、シナリオ生成へ引き継ぐ
- 状態: 実装・限定公開前ハードニング・ローカル品質ゲート完了。更新Preview CIと責任者実機受入れ待ち
- 正本: `docs/CURRENT_TASK.md`、`docs/cloud/CLOUD_PROPOSAL_GENERATION_V1.md`、`docs/cloud/CLOUD_RELEASE2_LIMITED_RELEASE_RUNBOOK.md`

管理画面で設定済みのOpenAI接続とSupabase Vaultを再利用する。APIキーをローカル・Vercelへ複製しない。成人向けReportを外部AIへ送信しない。

---

## 0. 現在の優先タスク（売れ筋優先・AIおまかせ市場分析、2026-07-30）

- Branch: `codex/cloud-research-ai-auto-ux-v1`
- Base: `codex/cloud-adult-planning-option-v1` (`58a18b9`)
- 目的: 簡単な希望だけで「今、どんな漫画が買われる可能性が高いか」を具体的に提示する
- 状態: local実装済み。migrationと管理者キー登録は責任者申告で完了。更新Preview実機E2E、責任者承認待ち
- 正本: `docs/CURRENT_TASK.md`、`docs/cloud/CLOUD_RESEARCH_AI_AUTO_UX_SPEC.md`

成人向け内容は外部AIへ送信しない。APIキーは通常テーブル、Client、URL、ログ、監査へ出さない。既存stacked PRをrebase、force push、Close、mergeしない。

---

## 0. 現在の優先タスク（成人向け企画ブリーフ、2026-07-29）

本節を、直後に残る成人向け市場分析と一般向けRelease 1統合記録より優先する。

- Branch: `codex/cloud-adult-planning-option-v1`
- Base: `codex/cloud-adult-research-option-v1` (`a9969ac`)
- 親Draft PR: [#66](https://github.com/team478a/manga/pull/66)
- Draft PR: [#67](https://github.com/team478a/manga/pull/67)
- 目的: 成人向け市場分析を完了した許可利用者へ、外部AIを使わない企画ブリーフを機能単位権限付きで提供する
- 状態: 実装・全CI完了、Vercel Preview Ready、責任者の実機受入れ待ち
- Preview: `https://mangai-hub-staging-git-codex-cloud-ad-95f9df-team478as-projects.vercel.app`
- 正本: `docs/CURRENT_TASK.md`、`docs/cloud/CLOUD_ADULT_PLANNING_OPTION_SPEC.md`、`docs/cloud/CLOUD_ADULT_PLANNING_IMPLEMENTATION_REPORT.md`

この段階では利用者入力の保存・履歴・再表示だけを提供する。成人向け文章・画像の自動生成、外部Provider送信、Stripe自動許可、作品公開・販売は行わない。migration適用とFeature Flag有効化は責任者承認まで禁止する。

---

## 0. 現在の優先タスク（成人向け市場分析オプション、2026-07-29）

本節を、直後に残る一般向けRelease 1統合記録より優先する。

- Branch: `codex/cloud-adult-research-option-v1`
- Base: `codex/cloud-release1-integration-v1` (`6491a7d`)
- 親Draft PR: [#65](https://github.com/team478a/manga/pull/65)
- Draft PR: [#66](https://github.com/team478a/manga/pull/66)
- 目的: 成人向け市場分析を購入者・管理者許可利用者へ提供できる許可制Cloudオプション
- 状態: 実装・全CI完了、Vercel Preview Ready、責任者の実機受入れ待ち
- Preview: `https://mangai-hub-staging-git-codex-cloud-ad-7158e2-team478as-projects.vercel.app`
- 正本: `docs/CURRENT_TASK.md`、`docs/cloud/CLOUD_ADULT_RESEARCH_OPTION_SPEC.md`、`docs/cloud/CLOUD_ADULT_RESEARCH_IMPLEMENTATION_REPORT.md`

一般向け市場分析は成人向け権限に依存させない。成人向けの画像・本文生成、Stripe自動連携、作品公開・販売は対象外。migration適用、Feature Flag有効化、DB Kill Switch有効化、本番公開は責任者承認まで行わない。

---

## 0. 現在の優先タスク（2026-07-29）

過去の引継ぎ記録より本節を優先する。

- Branch: `codex/cloud-release1-integration-v1`
- Base: `origin/feature/manga-canvas-mvp` (`7615d06`)
- Draft PR: [#65](https://github.com/team478a/manga/pull/65)
- 目的: 市場分析だけを限定公開できるRelease 1統合
- 統合元: PR #50、#56〜#62
- 除外: PR #48〜#49、#51〜#55、#63〜#64
- 状態: 公開前ハードニングと全品質ゲートを実行中。merge・本番反映は禁止
- 正本: `docs/CURRENT_TASK.md`、`docs/cloud/CLOUD_RELEASE1_INTEGRATION_REPORT.md`、`docs/cloud/CLOUD_RELEASE1_BETA_ACCEPTANCE.md`

既存PRは統合元としてそのまま保持し、rebase、force push、Closeを行わない。以下の節は保守性改善・Desktop作業時点の履歴として残す。

## 1. 引継ぎ情報

- 更新日: 2026-07-26
- リポジトリ: `team478a/manga`
- デフォルトブランチ: `feature/manga-canvas-mvp`
- デフォルト最新コミット: `c99a96b172fd1b45c8e8b3c4f4b2417347a0e62e`（`Merge pull request #32 from team478a/codex/creator-workflow`）
- 保守性改善統合ブランチ: `integration/maintenance-stack-20260726`
- 統合PR: **#34**（`integration/maintenance-stack-20260726` → `feature/manga-canvas-mvp`、Draft、mergeable、責任者レビュー待ち）
- デザイン仕様PR: **#33**（`design/mangai-ui-refresh` → `handoff/codex-to-claude-20260725`、Draft、文書のみ）
- 現在状態: `READY_FOR_REVIEW`（PR #34のレビュー・マージ判断待ち）

**この文書が正本です。会話履歴・過去のセッション要約を正本として扱わないでください。**

## 2. 製品構成

| 製品 | 主な配置 | 責務 |
| --- | --- | --- |
| MANGAI Hub / Cloud | リポジトリルート、`src/` | 一般漫画制作、Project/Canvas、認証、公開、販売、Stripe、管理 |
| MANGAI Desktop | `apps/desktop/` | Windowsローカル制作、成人向け制作、Ollama、ComfyUI、書き出し、更新 |
| 共通Domain | `packages/` | Canvas、AI、Project、Export、IPC schema等の共通処理 |
| Hub DB | `supabase/` | PostgreSQL、RLS、Storage、migration |

製品方針は、一般漫画をCloud、成人向け漫画をDesktopで扱う分離構成です。成人向け処理と人物・参照画像・完成Pageはローカル優先・fail-closedを維持します。

## 3. 現在のブランチ構造

```text
feature/manga-canvas-mvp (デフォルト)
  ├─ PR #30〜#32: Vercel workspace package build修正、パスワード確認・再設定フロー、
  │                Creatorプロフィール・作品アップロード安全性強化（merge済み）
  │
  ├─ integration/maintenance-stack-20260726 (Draft PR #34)
  │    保守性改善PR #14〜#28（15コミット、stacked）をcherry-pickし、
  │    PR #30〜#32の機能と統合済み。責任者レビュー・マージ判断待ち。
  │
  └─ handoff/codex-to-claude-20260725
       └─ design/mangai-ui-refresh (Draft PR #33)
            「MANGAI Creative Studio」デザイン仕様（docs/design/配下、文書のみ）
            責任者が方向性を承認済み。画面別「デザイン承認条件」は未了。
```

PR #14〜#28（元のstacked Draft PR、`codex/pr-09-desktop-migration-runner`〜`codex/pr-23-hub-structured-logging`）は、PR #34への統合作業の元データとしてそのまま残存しています。個別にmerge・rebase・closeはしていません。

## 4. 保守性改善スタックの統合状況（PR #34）

2026-07-24時点で完了していた保守性改善PR-01〜PR-23（GitHub Draft PR #14〜#28）を、2026-07-26に`feature/manga-canvas-mvp`の最新状態へ統合しました。

- 統合方法: 古い順に1コミットずつ`git cherry-pick`（一括cherry-pickではない）
- 競合: 3件（`src/app/actions.ts`＝PR#19、`package.json`＝PR#20、`src/app/actions/{auth,profile,work}-actions.ts`＝PR#27）。いずれも分割構造（薄い互換entrypoint＋機能別ファイル）を採用しつつ、PR #30〜#32由来の新機能（パスワード確認、sharp画像形式検証、旧画像Storage削除等）を保持する形で解決
- 品質ゲート: lint/typecheck/deps:check/hub:test(116/116)/canvas:test(26/26)/ai:test(44/44)/desktop:test(98/98)/migration検証/Hub build/Desktop build/rc:preflight/git diff --check、すべてPASS
- CI（PR #34）: Required Quality PASS、Migration roundtrip PASS、Desktop Windows PASS（Accessibility testsを含む）、Vercel Preview Ready

詳細・競合解決の判断根拠は[`docs/integration/MAINTENANCE_STACK_INTEGRATION_20260726.md`](../docs/integration/MAINTENANCE_STACK_INTEGRATION_20260726.md)を参照してください。

## 5. Claude Code / Codexが最初に行うこと

```bash
git fetch origin
git checkout integration/maintenance-stack-20260726
git pull origin integration/maintenance-stack-20260726

git status --short
git log --oneline --decorate -15
git diff feature/manga-canvas-mvp...HEAD --stat
```

その後、以下を読みます。

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`（本ファイル）
4. `docs/CURRENT_TASK.md`
5. `docs/HANDOFF_LOG.md`
6. 対象機能の設計文書

## 6. 現在の次工程

1. PR #34の責任者レビュー・マージ判断を待つ（本ブランチでの新規変更は、レビュー指摘への対応以外は行わない）。
2. PR #34が`feature/manga-canvas-mvp`へmergeされたら、PR #33（`docs/design/DESKTOP_CREATIVE_STUDIO_SPEC.md`）のビジュアル仕様承認（§4各画面末尾・§8）が揃っているか確認する。
3. 上記2点が揃った時点で、**merge後の最新`feature/manga-canvas-mvp`から新しい実装ブランチを作成**し、Phase D1（デザイントークン導入）へ着手する。`design/mangai-ui-refresh`をそのまま実装ブランチとして流用しない。
4. hosting環境決定後、Hub Structured Loggingのlog sink、alert通知先、保持期間、担当者を設定する。
5. Supabase stagingへmigrationを適用し、Desktop端末認証を確認する。
6. Stripe test決済、失敗、返金、download E2Eを実施する。
7. 実Ollama、実ComfyUI、承認済みDezgo safe素材試験を実施する。
8. Windowsコード署名、署名済み自動更新、クリーンPC受入れを実施する。

外部環境や契約が必要な作業を、mockや静的確認だけで完了扱いにしないでください。

## 7. 外部環境待ち・責任者判断待ち

| 項目 | 状態 | 必要条件 |
| --- | --- | --- |
| Desktop Accessibility（ローカル） | LOCAL_BLOCKED_EXTERNAL_ENVIRONMENT | Xサーバー（ディスプレイ）を持つ実行環境。GitHub ActionsのDesktop Windows workflowでは`npm run test:a11y`が成功済み |
| Vercel Preview deployment | PASS（CI確認済み） | ― |
| Vercel本番環境の通し受入れ | BLOCKED_EXTERNAL_ENVIRONMENT | Vercel/Supabase/Stripe本番設定 |
| Windows実署名 | BLOCKED_EXTERNAL_ENVIRONMENT | 信頼されたコード署名証明書 |
| 署名付き更新E2E | BLOCKED_EXTERNAL_ENVIRONMENT | 署名済み2version、公開更新URL |
| クリーンWindows受入れ | BLOCKED_EXTERNAL_ENVIRONMENT | Windows VMまたは新規PC |
| Ollama実環境E2E | BLOCKED_EXTERNAL_ENVIRONMENT | Ollama、対象モデル |
| ComfyUI実環境E2E | BLOCKED_EXTERNAL_ENVIRONMENT | ComfyUI、モデル、workflow JSON |
| Dezgo実API E2E | BLOCKED_EXTERNAL_ENVIRONMENT | BYOK key、課金承認、safe素材条件 |
| Supabase staging | BLOCKED_EXTERNAL_ENVIRONMENT | staging DB、接続情報、`psql` |
| Stripe E2E | BLOCKED_EXTERNAL_ENVIRONMENT | Stripe test、Webhook endpoint |
| log sink/alert | DECISION_REQUIRED | hosting、通知先、保持期間、担当者 |
| Desktopブランドカラー・テーマ・Tailwind非移行 | 確定済み（責任者指示、2026-07-26） | ― |
| Hubの配色・ダークモード方針 | DECISION_REQUIRED | Desktopデザイン確定後に判断（`docs/design/DESIGN_SYSTEM.md`§5） |

## 8. 壊してはいけない境界

- `feature/manga-canvas-mvp`へ直接pushしない。
- PR #34、PR #33を無断でrebase、force push、squashしない。
- 既存migrationを書き換えない。
- API responseの互換フィールドを削除しない。
- Desktop IPC schema、backup version、Project保存形式を無断変更しない。
- `MangaiDatabase`、`service.ts`、`actions.ts`等の互換entrypointを利用箇所確認前に削除しない。
- Domain Errorを生のError message判定へ戻さない。
- 未知例外、Supabase error詳細、Stripe error、token、Prompt、画像、メールをクライアントやlogへ露出しない。
- 成人向け、人物、参照画像、完成Pageの外部送信制限を緩和しない。
- `design/mangai-ui-refresh`（PR #33）でUIコード・CSS・Reactコンポーネントを変更しない。

## 9. 標準品質ゲート

```bash
npm run deps:check
npm run lint
npm run typecheck
npm run hub:test
npm run canvas:test
npm run ai:test
npm run desktop:test
npm run desktop:test:a11y
npm run db:migrations:validate
npm run build
npm run desktop:build
npm run rc:preflight
git diff --check
```

環境依存で実行できない項目は、コマンド、error、必要環境を`docs/CURRENT_TASK.md`へ記録します。`desktop:test:a11y`はローカルの実行可否とGitHub Actions Windows CIの結果を区別して記録してください。

## 10. Codex ⇄ Claude Code間で引き継ぐ場合

利用上限または作業区切りで引き継ぐ場合:

1. 新規変更を開始しない。
2. `docs/CURRENT_TASK.md`を更新する。
3. `docs/HANDOFF_LOG.md`へ追記する。
4. テスト結果と未完了項目を記録する。
5. 小さなcheckpoint commitを作成し、現在branchへpushする。
6. 次の担当者へ以下の指示を渡す。

```text
AGENTS.md、CLAUDE.md、docs/AI_HANDOFF.md、docs/CURRENT_TASK.md、
docs/HANDOFF_LOG.mdを読み、git status、直近15コミット、
feature/manga-canvas-mvpとの差分を確認してください。
CURRENT_TASK.mdの未完了項目から継続し、完了済み変更を作り直さないでください。
```
