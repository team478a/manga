# MANGAI Current Task

## 2026-08-09 PR-R3-3b 一般モニター運営repository境界

- 状態: `LOCAL_VERIFIED_DRAFT_PR_PENDING`
- Branch: `codex/refactor-r3-3b-monitor-repositories`
- Base: `origin/feature/manga-canvas-mvp`（`aa8b127`、PR #196 merge後）
- 現在: PR-R3-3bだけを実施する。Q0〜Q2は完了・マージ済み。R3-3aに続き、一般モニター運営管理の機能完結sliceをrepositoryへ移す。
- 実装: モニター一覧、feedbackレビュー、招待メール監査、CSV用読取、招待／再送／停止のservice-role DB・Auth Admin・Storage署名URL操作を`src/modules/general-monitor/infrastructure/admin-monitor-repository.ts`へ集約する。App Routerは認証、Feature Flag、validation、redirect、表示、メール送信調停を維持する。
- 契約維持: `requireAdmin`をrepository呼出しより前に維持し、actor／target profile ID、RPC名・引数、query、並び順、100件上限、署名URL TTL 600秒、CSV status／header、redirect文言を変更しない。
- 警告: `src/app/**`のadmin-client直接利用warningを27件から22件へ削減する。monitor worker、利用者feedback送信、issue task、Cloud AI、Desktop、checkoutは本PRに含めない。
- 不変条件: DB、RLS、migration、RPC、Storage bucket／path／TTL、URL、API、Auth／admin順序、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktopを変更しない。
- 検証: focused 40/40、deps（0 errors／既知22 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 565/565、Canvas／AI／Desktop／a11y、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、diff check成功。
- 外部環境: release preflightのSupabase／Stripe／staging資格情報と手動E2Eはローカル環境外の既存pendingであり、R3-3bの失敗ではない。本PRはDB、migration、Provider、実利用画面を変更しない。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。確認前に次のR3 slice、R3-4、R3-5、R4へ進まない。

## 2026-08-09 PR-Q2 Character Identity／人物一貫性基盤

- 状態: `MERGED`
- Branch: `codex/manga-quality-q2`
- Base: `origin/feature/manga-canvas-mvp`（`fd4365d`、PR #195 merge commit `fd4365dc5ea413770e3029789bb3d1b04a758ab7`）
- Draft PR: [#196](https://github.com/team478a/manga/pull/196)
- Merge: `aa8b127012615f2d557281ff8cc41e26a0410e8f`
- Preview: `https://mangai-hub-staging-git-codex-manga-qu-78fb5f-team478as-projects.vercel.app`
- 指示書: `MANGAI_漫画生成品質向上_実装指示書_Q0-Q2_20260807.docx`
- 現在: PR-Q2だけを実施する。PR-Q0、Q1は完了・マージ済み。責任者確認前にQ2より先へ進まない。
- 実装: 既存の版管理済みCharacter Profileとprivate参照画像asset IDからCharacter Identityスナップショットを組み立て、`lockedAttributes`とともにPanel Specificationへ付加する。Profile／参照画像を編集正本として再利用し、重複DBや新規UIを追加しない。
- Judge: 固定属性に対する観測済み証拠だけを人物一致スコアへ反映し、不一致を`face_mismatch`／`continuity_break`へ分類する。意味解析証拠がない属性は従来どおり中立75点で、実画像解析Providerは追加しない。
- 参照画像: 現行データに用途分類がないため、全てidentity referenceとしてasset UUIDを保存する。表情／全身用途をラベル等から推測しない。
- 不変条件: DB、migration、RPC、Storage、既存URL／API、Canvas schema、生成Prompt、Provider入力、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、課金、PDF／PNG、成人向け境界、Stripe、Desktopを変更しない。
- 検証: Q1／Q2／画像生成focused 30/30、deps（0 errors／既知27 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 563/563、Canvas／AI／Desktop／a11y、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、diff check成功。
- 外部環境: release preflightのSupabase／Stripe／staging資格情報と手動E2Eはローカル環境外の既存pending。Q2では実Providerを呼び出さず、生成Prompt／Provider入力不変を回帰テストで確認する。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。PRはDraft／MERGEABLE。
- 停止条件: Draft PRと全CI／Vercel Preview成功後に停止する。責任者確認前に次工程へ進まない。

## 2026-08-08 PR-Q1 Panel Specification／初期品質Judge

- 状態: `MERGED`
- Branch: `codex/manga-quality-q1`
- Merge: PR #195、`fd4365dc5ea413770e3029789bb3d1b04a758ab7`
- Base: `origin/feature/manga-canvas-mvp`（`c8ec95d`、PR #194 merge後）
- 指示書: `MANGAI_漫画生成品質向上_実装指示書_Q0-Q2_20260807.docx`
- 現在: PR-Q1だけを実施する。PR-Q0は完了済み。Q2のCharacter Identity／参照画像強化へ進まない。
- 実装: ネーム由来のPanel Specificationを生成Promptと分離してJob単位で保存し、生成完了後に初期ルールベースJudgeで8スコア、failure category、表示帯を内部記録する。90以上／75以上／75未満の閾値を固定する。
- 候補方針: 初期段階では候補を自動除外しない。同一コマの候補を内部overall scoreで並べるだけとし、評価未記録候補も表示対象に残す。
- Judge境界: 実画像の意味解析Providerは追加しない。画像内容の証拠がない人物・表情等は中立75点とし、Asset存在と寸法比など観測可能な情報だけで初期評価する。評価保存障害は完了済み生成Jobを失敗・retryへ戻さない。
- DB: 所有者RLS付きPanel Specification／品質評価テーブルと、所有者を検証するSpecification保存RPC、service-role限定評価保存RPCを追加する。既存Job、Q0追記ログ、課金契約は変更しない。
- 不変条件: Provider、model、pricing、retry、timeout、Scheduler、既存URL／API、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktopを変更しない。
- 検証: focused 36/36、deps（0 errors／既知27 warnings）、lint、Hub／Desktop typecheck、research eval、Hub全件、Canvas 26、AI 48、Desktop 182、migration 50/50、Hub build、Cloud漫画repository／owner isolation／100ページ4/4、diff check成功。Desktop Vite buildは実行sandboxがドライブ上位を読めず停止したため、Desktop無変更を前提にWindows CIで確認する。
- 停止条件: Draft PRと全CI／Vercel Preview成功後に停止する。責任者確認前にPR-Q2へ進まない。

## 2026-08-08 PR-Q0 漫画品質評価ログ基盤

- 状態: `READY_FOR_OWNER_REVIEW`
- Branch: `codex/manga-quality-q0`
- Base: `origin/feature/manga-canvas-mvp`（`3c09650`、PR #193 merge後）
- Draft PR: [#194](https://github.com/team478a/manga/pull/194)
- Preview: `https://mangai-hub-staging-git-codex-manga-qu-3b65fc-team478as-projects.vercel.app`
- 指示書: `MANGAI_漫画生成品質向上_実装指示書_Q0-Q2_20260807.docx`
- 現在: PR-Q0だけを実施する。Q1のPanel Specification／品質Judge、Q2のCharacter Identityへ進まない。
- 実装: `src/modules/manga-quality/`へfailure category、品質ログ契約、候補イベント記録application／repository、KPI純粋集計を追加した。候補表示・採用を既存Canvasへbest-effort接続し、ログ障害で制作を停止しない。
- DB: `202608080001_cloud_manga_quality_logs`で所有者RLS付き追記型イベントログと、所有者・Job整合を検証する`record_cloud_manga_quality_event` RPCを追加した。既存generation job、課金、Canvas、Provider契約は変更しない。
- KPI: 初回候補採用率、平均retry、平均部分修正、failure category、Provider／model別採用率、ページ平均AI費用の最小集計関数を追加した。
- 不変条件: Provider、model、pricing、retry、timeout、Scheduler、既存URL／API、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktopを変更しない。
- 検証済み: focused 10/10、deps（0 errors／既知27 warnings）、lint、Hub／Desktop typecheck、research eval、Hub（Q0 3件を含む）／Canvas 26／AI 48／Desktop／a11y、migration manifest 49/49、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、release structure、diff check成功。
- 外部環境: ローカルに`psql`とstaging資格情報がないためmigration roundtrip実行はGitHub Actionsで確認する。release preflightの外部Provider／Stripe／staging／手動E2E pendingは既存環境条件でありQ0の失敗ではない。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。PRはDraft／MERGEABLE。
- 未完了: 責任者レビューとmerge。migrationの環境適用は本PRでは実施しない。
- 注意: PR #193は`3c09650`でマージ済み。通常mergeで最新基準を取り込み、Q0差分とのコード競合がないことを確認した。
- 停止条件: Draft PRと全CI／Vercel Preview成功後に停止する。責任者確認前にPR-Q1へ進まない。

## 2026-08-07 本番実機受入れ案内の修正

- 状態: `LOCAL_VERIFIED_DRAFT_PR_PENDING`
- Branch: `codex/fix-production-acceptance-guidance`
- Base: `origin/feature/manga-canvas-mvp`（PR #192 merge後、`1d32024`）
- 実機事象: モニター利用枠を取得できない場合に、招待メール完了状況と無関係に「招待が必要です」と断定していた。また、採用ネーム由来でないテスト作品の画像生成は安全に拒否されたが、利用者が生成可能な作品の作成手順を判断できなかった。
- 修正: 未登録・確認失敗時の表示を「モニター利用設定を確認」へ変更し、招待メールとは別に管理画面の利用枠が必要と案内する。AI画像生成対象外では、AIシナリオからネームを採用し、そのネームから本人の作品を作る手順を案内する。
- 安全境界: モニター利用枠、所有者照合、採用ネーム由来条件、編集ロック、DB、migration、RPC、Storage、URL、API、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Desktopを変更しない。
- 検証: focused、deps（error 0、warning 27）、lint、Hub／Desktop typecheck、research eval、Hub 550/550、Canvas／AI／Desktop／a11y、migration 48/48、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ受入れ、release structure、diff check成功。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。実Providerの追加実行は、採用ネーム由来の一般向け作品を用意してから別工程で行う。

## 2026-08-06 PR-R3-3a 成人向け研究・更新情報admin repository境界

- 状態: `LOCAL_VERIFIED_DRAFT_PR_PENDING`
- Branch: `codex/refactor-r3-3a-admin-repositories`
- Base: `origin/feature/manga-canvas-mvp`（PR #191 merge後、`4675d17`）
- 目的: PR-R3-3を安全な小PRへ分割し、成人向け研究管理と更新情報管理のApp Router／Server Actionに残るservice-role DB操作をmodule infrastructure repositoryへ移す。
- 実装: admin認証をpresentation入口に維持し、成人向け研究設定・entitlement集計・設定RPCと、更新情報の一覧・取得・重複確認・作成・更新を各module repositoryへ集約した。既存query、filter、order、limit、redirect、message、例外処理を維持するcharacterization testを更新した。
- 不変条件: DB、RLS、migration、RPC名・引数、Storage、URL、API、Auth／admin順序、owner条件、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向けProvider境界、Desktopを変更しない。
- 分割理由: 監査対象32ファイル・4,449行はR3上限（50 files／1,500 churn）を超えるため、認可とdata accessを機能単位で完結させる。本PR完了時のadmin client直接利用警告見込みは32件から27件。
- 検証: focused 11/11、deps（error 0、admin client warning 27）、lint、Hub／Desktop typecheck、research eval、Hub 548/548、Canvas／AI／Desktop／a11y、migration 48/48、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ受入れ、release structure、diff check成功。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。責任者確認前にPR-R3-3b、PR-R3-4、PR-R4へ進まない。

## 2026-08-06 PR-R3-2 Auth／owner／Feature Flag共通契約

- 状態: `LOCAL_VERIFIED_DRAFT_PR_PENDING`
- Branch: `codex/refactor-r3-2-auth-feature-flags`
- Base: `origin/feature/manga-canvas-mvp`（PR #190 merge後、`ca9ef20`）
- 目的: Auth／admin／owner判定を純粋guardで固定し、監査済み21個のFeature Flag名と既存解釈をregistryへ集約する。
- 責任者判断: `CLOUD_PANEL_INPAINTING_ENABLED`と`CLOUD_PANEL_OUTPAINTING_ENABLED`の解釈不一致は、小文字`true`だけを許可するfail-closed契約へ統一する。他の`CLOUD_*`の大文字小文字非依存、`MANGAI_*`の厳密比較は維持する。
- 実装: profile/admin redirect、owner ID完全一致判定を純粋化した。研究、企画、シナリオ、ネーム、Canvas、画像、成人向け、monitor、Worker、Provider、legacyのFlag判定をregistryへ移した。
- 不変条件: redirect先、Auth／admin／owner順序、DB、RLS、migration、RPC、Storage、URL、API、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向けProvider境界、Desktopを変更しない。
- 検証: focused、deps（error 0）、lint、Hub／Desktop typecheck、research eval、Hub／Canvas／AI／Desktop／a11y、migration 48/48、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ受入れ、release structure、diff check成功。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。責任者確認前にPR-R3-3またはPR-R4へ進まない。

## 2026-08-06 PR-R3-1 Action／redirect／validation共通契約

- 状態: `LOCAL_VERIFIED_DRAFT_PR_PENDING`
- Branch: `codex/refactor-r3-1-action-contracts`
- Base: `origin/feature/manga-canvas-mvp`（PR #189 merge後、`030c25b`）
- 目的: R3-0台帳に従い、ActionのUUID、FormData文字列、message/error redirect、内部redirect allowlistの共通primitiveとcharacterization testを追加する。
- 実装: raw/trim済みFormDataの意味を分離し、代表的なCreator／管理者Actionへ適用した。UUID schemaを5経路で共有し、Auth callbackは完全一致allowlist helper、管理Actionは既存query encodingを維持するfeedback helperを使用する。
- 不変条件: URL、query名、message/error文言、encoding、invalid時の遷移、API、DB、migration、RPC、Storage、Auth／owner、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Desktopを変更しない。
- 検証: focused 16/16、deps（error 0）、lint、Hub／Desktop typecheck、research eval、Hub／Canvas／AI／Desktop／a11y、migration 48/48、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ受入れ、release structure、diff check成功。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。責任者確認前にPR-R3-2またはPR-R4へ進まない。

## 2026-08-06 PR-R3-0 共通処理重複監査・分割計画

- 状態: `LOCAL_VERIFIED_DRAFT_PR_PENDING`
- Branch: `codex/refactor-r3-0-shared-platform-audit`
- Base: `origin/feature/manga-canvas-mvp`（PR #188 merge後、`b2dfb1b`）
- 完了済み: PR-R0、PR-R1、PR-R2A、PR-R2B、PR-R2C。実Provider本番受入れも完了済み。
- 現在: PR-R3-0だけを実施し、共通処理の重複監査、service-role利用台帳、R3分割計画を文書化する。PR-R3の実装は未開始。
- 履歴整理: 旧PR #178はPR #182で置換済みのため追加merge不要。旧漫画制作PRはPR #126へ統合済みのため追加merge不要。
- 非対象: このPRでは旧PR、branch、文書履歴を削除・archiveしない。application code、React component、DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Desktopを変更しない。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。責任者確認前にPR-R3-1またはPR-R4へ進まない。

## 2026-08-06 PR-R2C 実Provider本番受入れ完了

- 状態: `PRODUCTION_ACCEPTED_AWAITING_OWNER_REVIEW`
- Branch: `codex/r2c-provider-acceptance-complete`
- Base: `origin/feature/manga-canvas-mvp`（PR #187 merge後、`fd87cfb`）
- 実Provider: Black Forest Labs `flux-2-pro`の一般向け背景画像Jobを1件だけ本番実行し、completed 100%を確認した。
- 利用量: 予約2クレジットを確定し、FREEプランは使用2／予約0／残り18。追加再実行は行っていない。
- Storage: 生成画像をprivate Asset `AI-de96a4d6-8f76-4500-a685-6c27e7e639a4.png`として保存し、Creator候補と画像素材で表示できた。
- Canvas: PR #187反映後、既存Assetをコマ1へ配置し、AI背景レイヤー、自動保存、タブ終了、ロック期限切れ後の再オープンで画像とレイヤーが復元された。
- 合格範囲: Provider送信、poll、download、credit確定、private Storage、候補表示、コマ採用、Canvas保存・再表示。
- 不変条件: Provider、model、pricing、retry、timeout、API、DB、migration、RPC、Storage契約、Feature Flag、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Desktopを変更していない。
- 停止条件: PR-R2Cと実Provider受入れは完了。責任者確認前にPR-R3へ進まない。

## 2026-08-06 生成画像のコマ採用永続化修正

- 状態: `LOCAL_VERIFIED_DRAFT_PR_PENDING`
- Branch: `codex/fix-generated-panel-adoption-persistence`
- Base: `origin/feature/manga-canvas-mvp`（PR #186 merge後、`f8c8525`）
- 実機結果: BFL生成、2クレジット確定、private Asset保存は成功した。生成Assetの配置直後は「保存済み」と表示されたが、ページ再オープン後にコマ画像が白紙へ戻った。
- 原因: 背景候補を最背面へ追加する際に`orderIndex=-1`を作成し、0以上を要求するCanvas schemaが変更を拒否していた。Editorは拒否結果を確認せず成功表示していた。
- 修正: 背景レイヤーを0、既存レイヤーを表示順を保った1以降へ正規化する。Canvas変更がschema不適合で拒否された場合は成功表示しない。
- 不変条件: API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Desktopを変更しない。
- 検証: focused 4/4、deps、lint、Hub／Desktop typecheck、Hub／Canvas／AI／Desktop／a11y、migration 48/48、Hub／Desktop build、release structure preflight、diff check成功。
- 次: Draft PR、全CI／Vercel Preview成功後に停止する。merge／本番反映後、既存生成Assetだけを再配置して保存・再表示を確認し、追加の実Provider生成は行わない。

## 2026-08-06 BFL poll待機応答の互換修正

- 状態: `LOCAL_VERIFIED_DRAFT_PR_PENDING`
- Branch: `codex/fix-bfl-poll-null-result`
- Base: `origin/feature/manga-canvas-mvp`（PR #185 merge後、`02251dc`）
- 実機診断: BFL送信は成功し、`poll / response_invalid`で失敗した。BFL OpenAPIでは待機中の`result`はnullを許可するが、adapter schemaがobjectだけを許可していた。
- 修正: poll待機中の`result: null`を正規応答として継続し、Ready後の画像取得へ進める。Provider、model、pricing、retry、timeout、API、DB、migration、RPC、Storage、成人向け境界は変更しない。
- 検証: BFL focused 7/7、deps、lint、Hub／Desktop typecheck、research eval、Hub／Canvas／AI／Desktop／a11y、migration 48/48、Hub／Desktop build、release structure preflight、diff check成功。
- 停止条件: Draft PRと全CI／Vercel Preview成功後に停止する。merge／本番反映前に実Providerを再実行しない。

## 2026-08-06 BFL実Provider拒否の安全な診断

- 状態: `LOCAL_VERIFIED_DRAFT_PR_PENDING`
- Branch: `codex/fix-bfl-provider-rejection-diagnostics`
- Base: `origin/feature/manga-canvas-mvp`（PR #184 merge後、`3c2073f`）
- 事象: BFL credits追加後も実背景画像Jobが`provider_rejected`となり、従来ログでは送信、poll、画像取得のどこで拒否されたか判別できない。
- 変更: BFL adapterから固定された失敗段階、結果区分、HTTP statusだけを診断callbackへ渡し、本番では`cloud_ai_bfl_provider_rejected`として記録する。
- 秘密境界: API key、Prompt、画像、Provider response body、polling URL、Job ID、利用者情報は診断へ含めない。利用者向けerror code、retry、timeout、Provider request、DB、migration、RPC、Storage、価格は変更しない。
- 検証: BFL focused 6/6、deps、lint、Hub／Desktop typecheck、research eval、AI 48/48、Hub／Canvas／Desktop／a11y、migration 48/48、Hub／Desktop build、release structure preflight、diff check成功。Draft PR／CI／Vercel Previewを確認中。
- 次: merge／本番反映後に新規Jobを1件だけ実行し、診断eventで原因を特定する。責任者確認前に追加の実Provider再試行やPR-R3へ進まない。

## 2026-08-06 PR-R2C-4 PDF／PNG出力application／infrastructure境界

- 状態: `LOCAL_VERIFIED_DRAFT_PR_PENDING`
- Branch: `codex/refactor-r2c4-export-boundary`
- Base: `origin/feature/manga-canvas-mvp`（PR #182 merge後、`c7a4719`）
- 目的: 同期PDF／PNG／販売package出力と長編分割Workerを、純粋なexport plan、application調停、repository、Storageへ分離する。
- 実装: 4ページsegment、ページ名・Storage path、表示Asset選択を純粋planへ移した。長編WorkerのDB／RPCをrepository、private Storage入出力をStorage adapter、描画・PDF結合・完了／失敗調停をapplicationへ分離した。同期Export実体もapplication入口へ移し、旧lib入口は互換再exportとして維持する。
- 互換性: URL、API、DB、migration、RPC名・引数、Storage bucket／path／content type、署名URL、Worker secret／300秒、lease／retry、4ページ分割、PNG／PDF／package内容を変更しない。
- 変更量: 1,367行（追加870／削除497）で1,500行上限内。
- 検証: focused 17/17、deps（module error 0）、lint、Hub／Desktop typecheck、research eval、Hub／Canvas／AI／Desktop／a11y、migration 48/48、Hub／Desktop build、Cloud漫画repository受入れ、owner isolation、100ページ4/4、diff check成功。
- 実Provider: R2C-4 merge後の別工程で実施するため、このPRでは呼び出さない。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。R2C完了承認前にPR-R3へ進まない。

## 2026-08-06 PR-R2C-3 一括・制作状態・長編application境界

- 状態: `LOCAL_VERIFIED_DRAFT_PR_PENDING`
- Branch: `codex/refactor-r2c3-longform-application`
- Base: `origin/feature/manga-canvas-mvp`（PR #181 merge後、`2edacba`）
- 目的: 一括生成、ページ制作状態、長編制作、連続性、作品予算、checkpoint、差分・復元の純粋判断とapplication調停を、既存Supabase／Auth adapterから分離する。
- 実装: 一括対象4〜8ページ・64コマ上限・履歴集計、制作状態とcontext revision判定をManga domainへ移した。長編cockpitの部分失敗調停、完成版preflight後のcheckpoint作成、復元commandをManga applicationへ移した。
- 互換性: 既存`cloud-creator` serviceをrepository／infrastructure adapterとして維持し、Server Action、DB query、RPC名・引数、4〜8ページ、途中enqueue、pause／cancel／retry補償、production revision、continuity／budget表示、checkpoint diff／restore errorを変更しない。
- 不変条件: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Desktopを変更しない。
- 変更量: 1,500行上限内。checkpointをR2C-3bへ分割する必要なし。
- 検証: focused 73/73、新規境界5/5、deps（module error 0）、lint、Hub／Desktop typecheck、research eval、Hub 535/535、Canvas 26/26、AI 48/48、Desktop／a11y、migration 48/48、Hub／Desktop build、Cloud漫画repository受入れ、owner isolation、100ページ4/4、diff check成功。
- 外部確認: release structureはREADY。Supabase／Stripe／staging秘密値と手動E2Eはローカル未設定のためPENDING。実ProviderはR2C-4完了後まで呼び出さない。

## 2026-08-06 管理者向け外部API設定の集約

- 状態: `LOCAL_VERIFIED_DRAFT_PR_PENDING`
- Branch: `codex/admin-provider-settings-hub`
- Base: `origin/feature/manga-canvas-mvp`（PR #180 merge後、`74c0faf`）
- 目的: OpenAI、Black Forest Labs、ResendのAPIキー入力、設定状態、公式取得手順を単一の管理画面へ集約する。
- 実装: `/admin/provider-settings`を追加し、旧市場分析AI URLは集約画面へ転送する。Cloud AI運用と招待メール設定はAPIキー入力を撤去し、既存の運用情報・メール文面編集を残して集約画面へ案内する。
- Security: 管理者認証、Supabase Vault、非再表示、監査、一般向け／成人向け境界を維持する。キーを環境変数、通常テーブル、ログへ追加しない。
- 不変条件: DB、migration、RPC、Storage、Provider、model選択肢、pricing、retry、timeout、Scheduler、API、既存URLを変更しない。
- 検証: 専用3/3、関連10/10、Hub全体530/530、deps:check、Hub／Desktop typecheck、lint、production build、diff check成功。Draft PR、CI／Vercelは確認中。

## 2026-08-06 モニター市場分析・報告保存のServer境界修正

- 状態: `LOCAL_VERIFIED_DRAFT_PR_PENDING`
- Branch: `codex/fix-monitor-persistence-r2`
- Base: `origin/feature/manga-canvas-mvp`（PR #179 merge後、`7ca64c4`）
- 事象: activeモニターでAI利用数は増える一方、市場分析Reportとモニター報告が保存できない。
- 原因境界: 招待確認と利用数加算は信頼済みServer経路だが、Report／報告INSERTだけがブラウザーのRLSセッションへ依存していた。
- 修正: Server Actionで本人プロフィールとactiveモニターを確認した後、市場分析Reportとモニター報告をSupabase Server管理経路で保存する。所有者IDは認証済みプロフィールからのみ設定する。
- 不変条件: DB、migration、RPC、URL、API、Feature Flag、Provider、model、pricing、成人向け境界は変更しない。
- 検証: 関連12/12、Hub全体527/527、deps:check、Hub／Desktop typecheck、lint、production build、diff check成功。Draft PR、CI／Vercelは確認中。

## 2026-08-06 マイページ導線・ログイン中アカウント表示

- 状態: `VERIFIED_AWAITING_OWNER_REVIEW`
- Branch: `codex/fix-account-navigation-identity`
- Base: `origin/feature/manga-canvas-mvp`（PR #177 merge後、`4a62a53`）
- 目的: マイページへの導線をサイドメニューで明示し、ログイン中アカウントの表示名をDashboard／Creator全画面で確認できるようにする。
- 実装: 共通サイドメニュー上部へ「ログイン中」と`profiles.display_name`を表示し、先頭導線を「ダッシュボード」から「マイページ」へ明確化した。表示名未設定時は安全な代替文言を表示する。
- 不変条件: 認証、DB、migration、API、URL、Feature Flag、Provider、Canvas、Desktopは変更しない。
- 検証: 専用2/2、deps:check、Hub／Desktop typecheck、lint、Hub全体、production build、diff check成功。
- Draft PR: [#179](https://github.com/team478a/manga/pull/179)
- GitHub CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。PRはDraft、MERGEABLE。
- 未完了: 認証済みPreviewでのPC／スマートフォン実機確認、責任者レビュー。

## 2026-08-05 PR-R2C-2 候補比較・採用・再生成境界

- 状態: `VERIFIED_AWAITING_OWNER_REVIEW`
- Branch: `codex/refactor-r2c2-panel-candidate-boundary`
- Base: `origin/feature/manga-canvas-mvp`（PR #176 merge後、`e709f08`）
- 目的: 2〜4候補の比較、候補採用、再生成、Image-to-Image、Inpainting、Outpainting、構図制御、マスク提案、背景／人物／効果の分離生成、透明レイヤーの純粋判断をManga domain／application境界へ集約する。
- 実装: 候補の対象コマ解決とlayer分類、比較frame、Canvas採用patch、再生成request組立、マスク提案を `src/modules/manga` へ移す。Editorは既存UI状態と副作用の調停だけを維持する。
- 互換性: 旧比較／マスクserviceは再exportとして維持し、request payload、候補数、採用先、元画像、layer順／表示／透明合成、undo／redo、snapshotを変更しない。
- 不変条件: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Desktopを変更しない。
- 回帰: left／right／overlay比較、2〜4候補、対象コマ採用、背景／人物／prop／effect／correction layer、元画像保持、mask／outpainting、undo／redo、snapshot payloadを確認する。
- 検証: focused 11/11、deps（5 packages／21 files、module error 0）、lint、Hub／Desktop typecheck、research eval、Hub 523/523、Canvas 26/26、AI 48/48、Desktop 182/182、a11y、migration 48/48、Hub／Desktop build、Cloud漫画repository受入れ、owner isolation 7/7、100ページ長編4/4、diff checkに成功した。
- 実Provider: R2C完了後に実施するため、このPRでは呼び出さない。
- Draft PR: [#177](https://github.com/team478a/manga/pull/177)
- Preview: `https://mangai-hub-staging-git-codex-refactor-3cebd4-team478as-projects.vercel.app`
- GitHub CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。PRはDraft、MERGEABLE。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。承認前にPR-R2C-3へ進まない。

## 2026-08-05 PR-R2C-1 コマ生成受付application境界

- 状態: `VERIFIED_AWAITING_OWNER_REVIEW`
- Branch: `codex/refactor-r2c1-panel-generation-boundary`
- Base: `origin/feature/manga-canvas-mvp`（PR #175 merge後、`a7b4bfb`）
- 目的: コマ画像生成、2〜4候補、Image-to-Image、Inpainting、Outpainting、構図制御、背景／人物／効果分離の受付をManga application境界へ集約する。
- 実装: 既存orchestrator実体を `src/modules/manga/application/enqueue-panel-candidates.ts` へ移し、App Routeはpresentation入口、公開schemaはcontracts入口を参照する。
- 互換性: `src/lib/cloud-panel-image-generation-server.ts` は旧import向け再exportとして維持し、一括生成からの既存経路も維持する。
- 不変条件: request／response、202、rate limit、Feature Flag順、候補部分成功、所有者分離、moderation、monitor上限、Provider、model、pricing、retry、timeout、DB、migration、RPC、Storage、Canvas、PDF／PNG、成人向け境界、Desktopを変更しない。
- 回帰: 専用module、既存コマ生成、UI、一括生成、monitor、制作進捗testで入口と契約を固定する。
- 検証: focused 53/53、deps（5 packages／21 files、module error 0）、lint、Hub／Desktop typecheck、research eval、Hub／Canvas／AI／Desktop／a11y test、migration 48/48、Hub／Desktop build、Cloud漫画repository受入れ、owner isolation 7/7、100ページ長編4/4、diff checkに成功した。
- 実Provider: R2C完了後に実施するため、このPRでは呼び出していない。
- Draft PR: [#176](https://github.com/team478a/manga/pull/176)
- Preview: `https://mangai-hub-staging-git-codex-refactor-b2d5c6-team478as-projects.vercel.app`
- GitHub CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。PRはDraft、MERGEABLE。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。承認前にPR-R2C-2へ進まない。

## 2026-08-05 PR-R2C-0 Cloud漫画生成module監査・分割計画

- 状態: `VERIFIED_AWAITING_OWNER_REVIEW`
- Branch: `codex/refactor-r2c0-manga-module-plan`
- Base: `origin/feature/manga-canvas-mvp`（`f3fc11f`、PR #174 merge後）
- 完了済み: PR #168〜#174は正本へmerge済み。PR-R0、PR-R1、PR-R2A、PR-R2B-1〜R2B-4は完了した。
- 目的: Cloud漫画生成の現行ファイル、関数、依存、外部契約、責務混在を監査し、application責務を外部挙動なしで分離するR2C-1〜R2C-4計画を作成する。
- 文書: `docs/architecture/MANGA_MODULE_REFACTOR_PLAN.md`
- 分割: R2C-1はコマ生成受付、R2C-2は比較／採用／再生成、R2C-3は一括／制作状態／長編、R2C-4はPDF／PNG出力境界を扱う。各PRは1,500行以下とする。
- 不変条件: application code、DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、DesktopをR2C-0では変更しない。
- 旧漫画制作PR: 必要機能は正本へ統合済みであり、追加mergeは不要。既存PRのClose、コメント、rebase、force push、mergeを行わない。
- 実Provider受入れ: R2C-1〜R2C-4完了後に別工程で実施し、途中PRでは有料Providerを呼ばない。
- Draft PR: [#175](https://github.com/team478a/manga/pull/175)
- Preview: `https://mangai-hub-staging-git-codex-refactor-976381-team478as-projects.vercel.app`
- 検証: deps（5 packages／21 files、module error 0）、lint、Hub／Desktop typecheck、research eval、Hub／Canvas／AI／Desktop／a11y test、migration 48/48、Hub／Desktop build、Cloud漫画repository受入れ、owner isolation 7/7、100ページ長編4/4、diff checkに成功した。
- GitHub CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。PRはDraft、MERGEABLE。
- 外部確認: release preflightはrepository structure READY。Supabase／Stripe／staging秘密値と手動E2Eはローカル未設定のためPENDINGであり、成功扱いにしない。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。承認前にPR-R2C-1へ進まない。

## 2026-08-05 PR-R2B-4 Cloud AI infrastructure境界完成

- 状態: `VERIFIED_AWAITING_OWNER_REVIEW`
- Branch: `codex/refactor-r2b4-cloud-ai-completion`
- Base: `origin/feature/manga-canvas-mvp`（PR #173 merge後、`aef996c`）
- 目的: 生成物Storage、完了／失敗repository、Gateway実体、管理設定compatibility entrypointをCloud AI moduleへ集約する。
- 実装: 画像sanitization・private upload・補償削除・cleanup、完了／失敗RPCをinfrastructureへ分離し、旧importを再exportで維持した。
- Route: Scheduler App Routeは既にapplicationへ委譲しているため、1,500行上限内で物理移動せずHTTP境界として維持する。
- 不変条件: Provider、model、pricing、retry、timeout、Scheduler頻度、API key保存、DB、migration、RPC、成人向け境界は変更しない。
- Draft PR: [#174](https://github.com/team478a/manga/pull/174)
- Preview: `https://mangai-hub-staging-g30bqhc69-team478as-projects.vercel.app`
- 検証: 全ローカル品質ゲート、Core quality、migration roundtrip、Windows build、Vercel成功。責任者承認前にPR-R2Cへ進まない。

## 2026-08-05 PR-R2B-3 Cloud AI Provider境界分離

- 状態: `VERIFIED_AWAITING_OWNER_REVIEW`
- Branch: `codex/refactor-r2b3-cloud-ai-providers`
- Base: `origin/feature/manga-canvas-mvp`（PR #172 merge後、`983e2a7`）
- 目的: Provider capability選択、BFL／Gateway／Mock adapter、Worker用Provider構築をCloud AI infrastructureへ分離する。
- 実装: Worker routeから具体Provider生成を除去し、`provider-registry`だけを参照する構造へ変更した。
- 互換性: 旧Registry、BFL、Mock entrypointを再exportとして維持し、Gatewayは新module入口から既存実装へ委譲する。
- 安全性: Gateway moderation、HTTPS制約、idempotency header、BFL URL検証、120秒timeout、原価情報を変更しない。
- 変更しない範囲: Provider、model、pricing、retry回数、timeout、Scheduler頻度、API key保存方式、DB、migration、RPC、環境変数、成人向け境界。
- 後続: 生成物Storage、管理操作、互換entrypoint完成はPR-R2B-4で扱う。
- Draft PR: [#173](https://github.com/team478a/manga/pull/173)（Preview作成済み）
- 検証: Provider／Worker 23/23、Hub 515/515、全ローカル品質ゲート、Core quality、migration roundtrip、Windows build、Vercel成功。責任者レビュー待ちで停止する。

## 2026-08-05 PR-R2B-2 Cloud AI Worker lifecycle分離

- 状態: `VERIFIED_AWAITING_OWNER_REVIEW`
- Branch: `codex/refactor-r2b2-cloud-ai-worker`
- Base: `origin/feature/manga-canvas-mvp`（PR #171 merge後、`2d112fc`）
- Draft PR: [#172](https://github.com/team478a/manga/pull/172)
- Preview: `https://mangai-hub-staging-git-codex-refactor-e43dc2-team478as-projects.vercel.app`
- 目的: Workerのclaim、lease heartbeat、lease喪失、失敗分類、retry判定、監視をCloud AI moduleへ分離する。
- 実装: Worker routeをapplication entrypointへ切り替え、lifecycle policy、Worker health、claim repositoryを責務別ファイルへ分離した。
- 互換性: 旧Worker／health entrypointを維持し、既存Provider実行、生成物Storage、Job完了／失敗、credit処理を変更しない。
- 後続: Provider registry／adapterはPR-R2B-3、生成物Storage／管理操作／互換entrypoint完成はPR-R2B-4で扱う。
- 変更しない範囲: Provider、model、pricing、retry回数、timeout、Scheduler頻度、API key保存方式、DB、migration、RPC、環境変数、成人向け境界。
- 文書: `docs/architecture/CLOUD_AI_MODULE_PIPELINE.md`
- 検証済み: deps（5 packages／21 files、module error 0）、lint、Hub／Desktop typecheck、市場分析評価、Worker focused 27/27、Hub 514/514、Canvas 26/26、AI 48/48、Desktop 182/182、migration 48/48、Hub／Desktop build、Cloud漫画repository受入れ、所有者分離7/7、100ページ受入れ4/4、diff check成功。
- GitHub CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。
- 未完了: 責任者レビュー。承認前にPR-R2B-3へ進まず、このPRはマージしない。

## 2026-08-05 PR-R2B-1 Cloud AI Creator Queue API分離

- 状態: `VERIFIED_AWAITING_OWNER_REVIEW`
- Branch: `codex/refactor-r2b1-cloud-ai-queue`
- Base: `origin/feature/manga-canvas-mvp`（PR #170 merge後、`842bd6b`）
- Draft PR: [#171](https://github.com/team478a/manga/pull/171)
- Preview: `https://mangai-hub-staging-git-codex-refactor-6bd0eb-team478as-projects.vercel.app`
- 目的: 正本の1,500行上限を守り、最初にCreator Queue API、生成要求契約、enqueue／cancel application entrypointを分離する。
- 実装: 生成Job一覧・受付・取消routeをCloud AI presentationへの薄いadapterにし、既存generation serviceへのapplication委譲を追加した。
- 互換性: URL、HTTP method、request／response、status、認証、所有者分離、rate limit、idempotency、credit予約、budget kill switchを維持する。
- 後続: Worker lifecycle、Provider、Storage、監視、管理操作、旧lib互換entrypointはPR-R2B-2以降で分離する。
- 変更しない範囲: Provider、model、pricing、retry回数、timeout、Scheduler頻度、API key保存方式、DB、migration、RPC、環境変数、成人向け境界。
- 文書: `docs/architecture/CLOUD_AI_MODULE_PIPELINE.md`
- 検証済み: deps（5 packages／21 files、module error 0）、lint、Hub／Desktop typecheck、市場分析評価、Hub 510/510、Canvas 26/26、AI 48/48、Desktop 182/182、migration 48/48、Hub／Desktop build、Cloud漫画repository受入れ、所有者分離7/7、100ページ受入れ4/4、diff check成功。
- GitHub CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。
- 未完了: 責任者レビュー。承認前にPR-R2B-2へ進まず、このPRはマージしない。

## 2026-08-05 PR-R2A 市場分析モジュール分離

- 状態: `VERIFIED_AWAITING_OWNER_REVIEW`
- Branch: `codex/refactor-r2a-research-module`
- Base: `origin/feature/manga-canvas-mvp`（PR #169 merge後、`2385a7c`）
- Draft PR: [#170](https://github.com/team478a/manga/pull/170)
- Preview: `https://mangai-hub-staging-git-codex-refactor-22745e-team478as-projects.vercel.app`
- 目的: 市場分析を `domain/application/infrastructure/presentation/contracts` に分離し、既存entrypointを互換アダプターへ縮小する。
- 実装: 検索、出典検証、候補抽出、複数出典照合、Report生成、評価、所有者限定永続化をmodule境界へ移した。
- Action: Report生成と出典検索をApplication Serviceへ委譲し、Feature Flag、一般向け境界、利用枠、Provider、保存の順序を明示した。
- 互換性: 旧 `src/lib/cloud-research*.ts` のexportを維持し、URL、Form、DB、migration、環境変数、Provider契約、成人向け境界は変更しない。
- 文書: `docs/architecture/RESEARCH_MODULE_PIPELINE.md`
- 検証済み: npm ci、deps（5 packages／21 files、module error 0）、lint、Hub／Desktop typecheck、市場分析評価、focused 58、Hub 507、Canvas 26、AI 48、Desktop 182、migration 48/48、Hub／Desktop build、Cloud漫画repository受入れ、所有者分離7、100ページ受入れ4、diff check成功。
- GitHub CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。
- 外部確認: Release 1/2 preflightはローカルに本番環境値を置かないためfail closed。秘密値は表示していない。
- 未完了: 責任者レビュー。承認前にPR-R2Bへ進まず、このPRはマージしない。

## 2026-08-04 PR-R1 モジュール境界の固定

- 状態: `VERIFIED_AWAITING_OWNER_REVIEW`
- Branch: `codex/refactor-r1-module-boundaries`
- Base: `origin/feature/manga-canvas-mvp`（PR #168 merge後、`dd483c0`）
- Draft PR: [#169](https://github.com/team478a/manga/pull/169)
- Preview: `https://mangai-hub-staging-git-codex-refactor-44ab32-team478as-projects.vercel.app`
- 目的: 既存コードを一括移動せず、domain/application/infrastructure/presentation/contractsの依存方向をCIで固定する。
- 実装: module境界、module循環、Client秘密値、成人向けProvider経路、App Routerのadmin client、未使用Feature Flagを検査するscriptを追加した。
- 肥大化防止: merge base以降の新規source fileについて800行超を失敗、500行超と明示的`any`を警告する。
- CI: Required Qualityのcheckoutを全履歴取得へ変更し、既存`deps:check`へ3検査を統合した。
- 文書: `docs/architecture/MODULE_BOUNDARY_POLICY.md`
- 変更しない範囲: 既存moduleの一括移動、DB、migration、環境変数、API契約、Provider、Feature Flag値、成人向け境界。
- 現在の警告: `src/app/**`からSupabase admin clientを直接利用する既存33ファイル。後続PRで段階移行し、このPRでは挙動を変更しない。
- 検証: npm ci、deps（5 packages／21 files、module 0 error／33 warning）、lint、Hub／Desktop typecheck、市場分析評価、Hub 502、Canvas 26、AI 48、Desktop 182、migration 48/48、Hub／Desktop build、Cloud漫画repository受入れ、所有者分離7、100ページ受入れ4、diff check成功。
- 既知の非失敗警告: npm audit 1 moderate／2 high、Desktop renderer chunk 500kB超、App Router admin client直接利用33件。
- GitHub CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。
- 未完了: 責任者レビュー。PR-R2には進まず、マージしない。

## 2026-08-04 MANGAI Cloud 本番公開ルート smoke 検査

- 状態: `VERIFIED_LOCAL_AND_PRODUCTION_READ_ONLY`
- Branch: `codex/cloud-production-route-smoke-v1`
- Base: `origin/feature/manga-canvas-mvp`（PR #166 merge後）
- Draft PR: [#167](https://github.com/team478a/manga/pull/167)
- `https://app.mang-ai.com`の公開5ページと認証必須4ページを、Cookieなし・読み取り専用GETで検査するCLIを追加した。
- 公開ページは2xx、認証必須ページは同一originの`/login`への3xxだけを合格とし、5xx、外部redirect、通信失敗を拒否する。
- 明示確認値がない場合はHTTPアクセス前にfail closedする。ログイン、フォーム送信、DB更新、有料Provider実行は行わない。
- 本番実行結果: 9/9成功（`/`、`/login`、`/signup`、`/forgot-password`、`/works`、`/dashboard`、`/creator`、`/dashboard/monitor/welcome`、`/admin`）。
- 手順書: `docs/cloud/CLOUD_PRODUCTION_ROUTE_SMOKE.md`
- 検証: 専用4/4、deps:check、lint、Hub typecheck、Hub 494/494、migration 48/48、production build、git diff check成功。
- 未完了: 認証済み実ブラウザの390px／768px／1280px表示確認、実作品操作、責任者レビュー。

## 2026-08-04 Cloud漫画制作 2ユーザー所有者分離受入れ

- 状態: `VERIFIED_LOCAL / BLOCKED_EXTERNAL_ENVIRONMENT`
- Branch: `codex/cloud-manga-owner-isolation-e2e-v1`
- Base: `origin/feature/manga-canvas-mvp`（PR #165 merge後）
- Draft PR: [#166](https://github.com/team478a/manga/pull/166)
- ステージングの2アカウントを使い、非公開作品、生成Job、書き出し、品質フィードバックについて、所有者は1件・別ユーザーは0件となることを読み取り専用で検証するCLIを追加した。
- 認証情報は環境変数だけで受け取り、メールアドレス、パスワード、UUID、秘密値を出力しない。
- `MANGAI_DB_ENV=staging`と明示確認値が揃わない場合はfail closedとし、データの作成、更新、削除、外部Provider実行は行わない。
- 必要な受入れデータが存在しない場合は自動作成せず、準備不足として安全に停止する。
- 手順書: `docs/cloud/CLOUD_MANGA_OWNER_ISOLATION.md`
- 検証: 専用4/4、既存所有者分離7/7、Cloud漫画repository preflight、deps:check、lint、Hub typecheck、Hub 490/490、migration 48/48、production build、git diff check成功。
- 未完了: ステージング2ユーザー実行、署名URL・生成キャンセル・共同編集者の実ブラウザ確認、Preview、CI、責任者レビュー。

## 2026-08-04 Cloud漫画制作 所有者分離の強化

- 状態: `VERIFIED_AWAITING_REVIEW`
- Branch: `codex/cloud-manga-owner-isolation-v1`
- Base: `origin/feature/manga-canvas-mvp`（PR #164 merge後）
- Draft PR: [#165](https://github.com/team478a/manga/pull/165)
- 非公開作品、生成Job、書き出し、品質フィードバックの所有者境界を横断監査した。
- 書き出し履歴と署名URL発行に、RLSに加えてJob作成者本人の明示条件を追加した。
- 所有者分離の専用repository checkを追加し、Cloud漫画制作の受入れpreflightへ統合した。
- 手順書: `docs/cloud/CLOUD_MANGA_OWNER_ISOLATION.md`
- migration、DB、Feature Flag、Provider、Worker、成人向け処理は変更しない。
- 検証: 所有者分離7/7、Cloud漫画repository preflight、deps:check、lint、Hub typecheck、Hub 486/486、migration 48/48、production build、git diff check成功。
- 未完了: Preview、CI、ステージング2ユーザー実機確認、責任者レビュー、マージ。

## 2026-08-04 Cloud漫画制作 受入れ自動化

- 状態: `VERIFIED_AWAITING_REVIEW`
- Branch: `codex/cloud-manga-acceptance-automation-v1`
- Base: `origin/feature/manga-canvas-mvp`（PR #163 merge後）
- Draft PR: [#164](https://github.com/team478a/manga/pull/164)
- 一般向け漫画制作に必要なmigration、Worker、生成API、Editor、候補比較、8ページ出力テストの存在を専用preflightで一括確認する。
- Creator主要画面に390pxを超える固定pixel幅が混入していないことを構造検査する。
- 環境込み検査とrepository-only検査を分離し、秘密値は出力しない。
- 実Provider、PDF／PNG目視、実ブラウザ3幅、別ユーザー分離は手動受入れとして明示する。
- DB、migration、Feature Flag、Provider処理は変更しない。
- 検証: 専用3/3、repository preflight、deps:check、lint、Hub typecheck、Hub 485/485、migration 48/48、production build、git diff check成功。
- 未完了: Preview、CI、手動受入れ。

## 2026-08-04 一般向け画像生成 受入れ基盤

- 状態: `VERIFIED_AWAITING_REVIEW`
- Branch: `codex/general-image-acceptance-v1`
- Base: `origin/feature/manga-canvas-mvp`（PR #162 merge後）
- Draft PR: [#163](https://github.com/team478a/manga/pull/163)
- 公開チェックへCloud AI全体の生成受付、選択中BFLモデルの必須価格、画像Jobの待機・実行・24時間失敗件数を追加。
- 管理画面から1コマ生成、Worker実行、候補採用・再生成、保存、PDF／PNG確認まで進められる受入れ導線を追加。
- 手順書: `docs/cloud/CLOUD_GENERAL_IMAGE_ACCEPTANCE.md`
- APIキー、DB、migration、Feature Flagは変更しない。外部APIの有料実行は行わない。
- 検証: 専用2/2、deps:check、lint、Hub typecheck、Hub 482/482、migration 48/48、production build、git diff check成功。
- 未完了: Preview、CI、実Provider 1コマ受入れ。

## 2026-08-04 一般向けCloud漫画制作 正本統合監査

- 状態: `VERIFIED_AWAITING_REVIEW`
- Branch: `codex/cloud-manga-canonical-audit-v1`
- Base: `origin/feature/manga-canvas-mvp` (`a813a56`)
- Draft PR: [#162](https://github.com/team478a/manga/pull/162)
- PR #94が旧PR #87〜#90の必要機能を統合し、PR #126がPR #94〜#121の一般向け漫画制作スタックを正本へ統合済みであることを確認。
- PR #95〜#121の各head commitは現在の正本branchの祖先であり、追加マージは不要。
- migration、実装、テスト、100ページfixtureの存在を確認し、残作業を実Provider・8ページ出力・レスポンシブ・長編実データ受入れへ限定。
- 監査結果: `docs/cloud/CLOUD_MANGA_CANONICAL_INTEGRATION_AUDIT.md`
- 既存PRのrebase、force push、Close、マージは行っていない。
- 検証: deps:check、lint、Hub typecheck、Hub 482/482、migration 48/48、git diff check成功。
- 未完了: CI／Preview確認、文書レビュー、実Provider・実ブラウザ・実作品受入れ。

## 2026-08-04 更新情報保存後の遷移修正

- 状態: `VERIFIED_AWAITING_REVIEW`
- Branch: `codex/product-update-save-redirect-fix`
- Base: `origin/feature/manga-canvas-mvp`（PR #155 merge後）
- 更新情報の保存・公開状態変更後に、日本語メッセージを未エンコードで遷移URLへ渡していた問題を修正。
- 成功時と失敗時の全遷移を共通の安全なURL生成へ統一し、入力内容やDB内部情報は露出しない。
- DB、migration、環境変数、既存の更新情報データは変更しない。
- 検証: 専用4/4、Hub 479/479、deps:check、Hub typecheck、lint、migration 48本、production build、git diff --check成功。
- 未完了: Draft PR、Vercel Preview、CI、本番での更新情報掲載、責任者レビュー、マージ。

## 2026-08-04 一般向けモニター操作フィードバック第2弾

- 状態: `VERIFIED_AWAITING_REVIEW`
- Branch: `codex/general-monitor-action-feedback-v2`
- Base: `origin/feature/manga-canvas-mvp`（PR #154 merge後）
- Draft PR: [#155](https://github.com/team478a/manga/pull/155)
- Preview: `https://mangai-hub-staging-git-codex-general-f1aea6-team478as-projects.vercel.app`
- ログアウト、通知の既読化、作品登録・更新、デジタル商品登録・更新、グッズ申請、Desktop端末承認・解除を共通`PendingSubmitButton`へ統一。
- 処理中は用途別メッセージとスピナーを表示し、ボタンを無効化して二重送信を防止。
- Stripe、成人向け機能、認証処理、DB、migration、環境変数は変更しない。
- 検証: 専用3/3、Hub 478/478、deps:check、typecheck、lint、migration 48本、production build、git diff --check成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功。
- 未完了: 責任者レビュー、マージ。

## 2026-08-04 認証ボタンの操作フィードバック

- 状態: `VERIFIED_AWAITING_REVIEW`
- Branch: `codex/auth-action-feedback-v1`
- Base: `origin/feature/manga-canvas-mvp`（PR #152 merge後）
- ログイン、新規登録、再設定メール送信、パスワード更新を共通`PendingSubmitButton`へ統一。
- 送信中はスピナーと用途別メッセージを表示し、ボタンを無効化して二重送信を防止。
- 認証処理、Supabase設定、migration、環境変数の変更はない。
- 検証: 専用1/1、Hub 477/477、deps:check、Hub typecheck、lint、production build、git diff --check成功。
- 未完了: Draft PR、Vercel Preview、CI、責任者レビュー、マージ。

## 2026-08-04 Cloud制作ワークフロー全体の耐障害化

- 状態: `VERIFIED_AWAITING_REVIEW`
- Branch: `codex/cloud-workflow-runtime-hardening-v1`
- Base: `codex/cloud-research-runtime-recovery`（Draft PR #152）
- Draft PR: [#153](https://github.com/team478a/manga/pull/153)
- Preview: `https://mangai-hub-staging-git-codex-cloud-wo-520cdc-team478as-projects.vercel.app`
- 目的: 市場分析後の企画提案、シナリオ、ネーム、原稿編集、モニター報告でも、一部のDB読込失敗をページ全体の停止へ波及させない。
- 共通化: 安全な補助データloader、部分障害Notice、Creator配下の日本語回復画面を追加。
- 企画・シナリオ・ネーム: 本文と履歴・採用状態を分離して読み込み、補助状態を確認できない間は既存内容を表示したまま重複生成・採用だけを停止。
- 原稿編集: 一時的なDB障害を「作品が存在しない」と誤判定せず、安全な再試行画面へ送る。キャラクター、世界観、参照資料は部分的に利用可能な内容を維持。
- モニター: 報告履歴を取得できない場合も新しい報告フォームは利用可能。
- 利用者へDB・Providerの内部エラー内容は表示しない。migration、環境変数、外部API実行は追加なし。
- 検証: 専用回帰5/5、Hub 476/476、deps:check、Hub typecheck、lint、migration 48本、production build、git diff --check成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功。
- 未完了: 責任者レビュー、PR #152との順序確認、本番ブラウザ確認、マージ。

## 2026-08-04 市場分析・モニター添付の本番障害復旧

- 状態: `VERIFIED_AWAITING_REVIEW`
- Branch: `codex/cloud-research-runtime-recovery`
- Base: `origin/feature/manga-canvas-mvp` (`36a1e5b`、PR #150 merge後)
- Draft PR: [#152](https://github.com/team478a/manga/pull/152)
- Preview: `https://mangai-hub-staging-git-codex-cloud-re-f40b12-team478as-projects.vercel.app`
- 市場分析履歴のDB読込失敗をページ全体へ波及させず、画面内案内と新規分析への導線を残す。
- 使い方画面の「市場分析を開始」は履歴画面を経由せず`/dashboard/research/new`へ直接進む。
- モニター画像添付は、本人認証とモニター認可の後だけ管理Storage経由で保存し、DB所有者RLSは維持する。
- AI市場分析はWeb Searchのsources一覧も出典として取得し、110秒で安全に中断する。失敗したProvider実行ではモニター利用回数を消費しない。
- APIキー、migration、DB schema、環境変数の変更はない。外部AIの有料実行は未実施。
- 検証: 専用回帰テスト17/17、Hub 471/471、deps:check、lint、Hub typecheck、research:eval、48 migration静的検査、production build、git diff --check成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功。
- 未完了: 責任者レビュー、本番ブラウザでの3経路再確認、マージ。

## 2026-08-04 クラウド制作の操作フィードバック統一

- 状態: `VERIFIED_AWAITING_REVIEW`
- Branch: `codex/cloud-creator-action-feedback-v2`
- Draft PR: [#150](https://github.com/team478a/manga/pull/150)
- Preview: `https://mangai-hub-staging-gpoj52kun-team478as-projects.vercel.app`
- Base: `origin/feature/manga-canvas-mvp` (`4542398`、PR #149 merge後)
- 目的: クラウド制作で保存・追加・移動・削除を押した後に反応が分からず、再クリックされる問題を防ぐ
- 実装: 作品作成、名称変更、話・章・ページ・シーン追加、並べ替え、表紙設定、販売下書き、削除、復元を共通`PendingSubmitButton`へ統一
- 表示: 操作ごとのスピナーと`作成中…`、`保存中…`、`追加中…`、`移動中…`、`設定中…`、`削除中…`、`復元中…`を表示し、処理中はボタンを無効化
- migration／環境変数／外部API: 追加・実行なし
- 検証: 専用回帰テストを含むHub 466/466、deps:check、Hub typecheck、lint、migration validate（48本）、production build、git diff --check成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 未完了: 責任者確認・マージ

## 2026-08-04 一貫性台帳の操作フィードバック

- 状態: `VERIFIED_AWAITING_REVIEW`
- Branch: `codex/cloud-continuity-action-feedback`
- Draft PR: [#149](https://github.com/team478a/manga/pull/149)
- Preview: Vercel check成功（PR #149）
- Base: `origin/feature/manga-canvas-mvp` (`32ccfb4`、PR #148 merge後)
- 目的: 長編制作の一貫性候補登録、事実・伏線の保存、更新、削除で二重送信と操作結果の分かりにくさを防ぐ
- 実装: 一貫性台帳の全送信操作へスピナー、用途別の処理中表示、送信中の無効化を追加
- migration／環境変数／外部API: 追加・実行なし
- 検証: 専用テストを含むHub 465/465、deps:check、Hub typecheck、lint、production build、git diff --check成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 完了: PR #149は`4542398`でマージ済み

## 2026-08-04 Cloud AI Scheduler安全確認導線

- 状態: `VERIFIED_AWAITING_REVIEW`
- Branch: `codex/cloud-ai-scheduler-readiness`
- Draft PR: [#148](https://github.com/team478a/manga/pull/148)
- Base: `origin/feature/manga-canvas-mvp` (`483ef8b`、PR #146 merge後)
- 目的: Scheduler設定確認で誤って有料Jobを実行することを防ぎ、管理画面から確認手順へ直接進めるようにする
- 実装: Actions手動実行の既定を通信なし`check`とし、明示的な`run`と有効化変数が揃った場合だけWorkerを実行
- UI: `/admin/cloud-ai`にScheduler確認導線、check／runの説明、本番公開チェック導線を追加
- migration／環境変数／外部Provider実行: 追加・実行なし
- 検証: 専用11/11、Hub 464/464、deps:check、lint、Hub typecheck、migration validate（48本）、production build、git diff --check成功
- 未完了: Vercel Preview、責任者確認

## 2026-08-04 Cloud AI Worker定期実行

- 状態: `VERIFIED_AWAITING_REVIEW`
- Branch: `codex/cloud-ai-worker-scheduler`
- Draft PR: [#146](https://github.com/team478a/manga/pull/146)
- Preview: `https://mangai-hub-staging-git-codex-cloud-ai-65a675-team478as-projects.vercel.app`
- Base: `origin/feature/manga-canvas-mvp` (`280cb4c`、PR #145 merge後)
- 目的: 一般向けCloud AI Queueを管理者の手動操作なしで安全に少量ずつ処理する
- 実装: GitHub Actionsから5分間隔、1回最大3件、直列・重複なしで既存Worker endpointを実行
- Fail closed: Repository variable未設定、Secret不足、不正URLでは外部通信前に停止
- 回復: idle／retrying／lease_lostで即停止し、Provider応答本文や秘密値をログへ出さない
- migration／Vercel Cron／外部Provider実行: 追加・実行なし
- 検証: Scheduler専用7/7、Hub 463/463、deps:check、lint、Hub typecheck、migration validate（48本）、production build、git diff --check成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 未完了: 責任者によるActions Secrets設定と限定E2E、承認、マージ

## 2026-08-04 Cloud AI Worker稼働監視

- 状態: `VERIFIED_AWAITING_REVIEW`
- Branch: `codex/cloud-ai-worker-health`
- Draft PR: [#145](https://github.com/team478a/manga/pull/145)
- Preview: `https://mangai-hub-staging-git-codex-cloud-ai-ebbdd4-team478as-projects.vercel.app/admin/cloud-ai`
- 目的: Worker自動運転前に、Queue滞留・期限切れlease・直近失敗を管理者が画面上で検知できるようにする
- 実装: `/admin/cloud-ai`へ停止中、要対応、滞留あり、失敗あり、処理中、正常の決定的な稼働判定を追加
- 判定: 期限切れlease、24時間内3件以上の失敗、10分以上の最古queued Jobを警告し、確認対象を日本語で案内
- 安全性: DBの件数と時刻だけを利用し、Prompt、画像、Provider応答、秘密値は取得・表示しない
- migration／環境変数／外部API: 追加・実行なし
- 検証: 専用4/4、Hub test 456/456、deps:check、lint、Hub typecheck、migration validate（48本）、production build、git diff --check成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 未完了: 責任者によるPreview画面確認・承認・マージ

## 2026-08-04 Cloud AI Job運用改善

- 状態: `VERIFIED_AWAITING_REVIEW`
- Branch: `codex/cloud-ai-job-operations`
- Draft PR: [#144](https://github.com/team478a/manga/pull/144)
- Preview: `https://mangai-hub-staging-git-codex-cloud-ai-50aa87-team478as-projects.vercel.app/admin/cloud-ai`
- 目的: 管理者がCloud AIの処理待ち・実行中・失敗Jobを安全に把握し、不要な待機／実行中Jobを取り消せるようにする
- 実装: `/admin/cloud-ai`へ作品名、利用者名、状態、試行回数、経過時間、管理用ID、取消操作と処理中表示を追加
- 安全性: 取消は既存の課金補償RPCを認証済み管理者として実行し、予約credit／原価を解放する。Providerの生error message、Prompt、秘密値は表示・監査しない
- 再生成: 失敗Jobは管理者が所有者を代行して再登録せず、利用者が作品編集画面から対象だけを再生成する既存境界を維持
- migration／環境変数／外部API: 追加・実行なし
- 検証: 専用2/2、Hub 452/452、deps、lint、Hub typecheck、migration 48本、production build、diff check成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 未完了: 認証済み管理画面での表示・取消確認、責任者承認、マージ

## 2026-08-04 一般向け画像生成Worker運用診断

- 状態: `VERIFIED_AWAITING_REVIEW`
- Branch: `codex/cloud-ai-worker-operations`
- 目的: 一般向け画像生成を自動運転へ進める前に、管理者がQueue状態とWorkerの実行可否を秘密値なしで確認できるようにする
- 実装: `/admin/cloud-ai`へ待機中・実行中・失敗Job件数、公開チェック導線、管理者限定の1件手動実行、処理中・完了・失敗案内を追加
- 安全性: Worker署名Secretをブラウザーへ返さず、実行先は現在のVercel deploymentまたは設定済み本番originへ固定する
- migration／外部API: 追加なし。手動実行時だけ設定済みProviderでCloud AI Jobを最大1件処理する
- 検証: 専用3/3、Hub 450/450、deps、Hub typecheck、lint、migration 48本、production build、diff check成功
- 未完了: Draft PR、Vercel Preview、実Providerを使わないQueue空状態の実ブラウザ確認

## 2026-08-03 管理画面全体の耐障害化

- 状態: `VERIFIED_AWAITING_REVIEW`
- Branch: `codex/admin-resilience-v1`
- 目的: 更新情報管理と同種のDB／Storage／Auth接続失敗が、ほかの管理画面で黒い汎用エラー画面になる問題を横断的に防ぐ
- 実装: Admin共通error boundary、安全なデータ取得、主要更新操作の例外変換、添付署名URLの部分失敗許容、CSVの503応答
- 対象: 成人向け市場分析、Cloud AI、モニター管理、招待メール、報告キュー、市場分析AI、ユーザー一覧・詳細・権限操作
- 安全性: 内部Providerエラー本文を画面へ露出せず、操作失敗時は日本語案内と再試行・管理画面TOP導線を表示
- migration／環境変数／外部API: 追加なし
- 検証: 専用4/4、Hub 446/446、deps、Hub/Desktop typecheck、lint、migration 48本、production build、diff check成功
- 未完了: Draft PR、Vercel Preview、本番管理画面の再読み込み確認

## 2026-08-03 更新情報管理の耐障害化

- 状態: `VERIFIED_AWAITING_REVIEW`
- Branch: `codex/fix-admin-product-updates-v1`
- 目的: `/admin/product-updates`のDB接続・取得失敗で黒い汎用エラー画面になる問題を解消する
- 実装: 読み込み、保存、公開状態変更の例外を安全な日本語案内へ変換し、利用不可時は入力を停止
- UI: 予期しない描画失敗にも専用の再読み込み・管理画面TOP導線を表示
- migration／環境変数／外部API: 追加なし
- 検証: 専用3/3、Hub 442/442、deps、Hub typecheck、lint、production build、diff check成功
- 未完了: Draft PR、Vercel Preview、本番確認

## 2026-08-03 管理画面共通TOP導線

- 状態: `VERIFIED_AWAITING_REVIEW`
- Branch: `codex/admin-home-navigation-v1`
- 目的: ユーザー管理を含むすべての管理画面から管理者ダッシュボードへ迷わず戻れるようにする
- 実装: `src/app/admin/layout.tsx`に共通ナビゲーションを追加し、Admin配下へ一括適用
- UI: 「管理画面TOPへ」をアイコン付きで常時表示し、キーボードfocusとスマートフォン幅に対応
- migration／環境変数／外部API: 追加なし
- 検証: 専用1/1、Hub 439/439、deps、Hub typecheck、lint、production build、diff check成功
- 未完了: Draft PR、Vercel Preview、本番確認

## 2026-08-03 モニター開始後ダッシュボード安定化

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `codex/fix-dashboard-after-monitor-start-v1`
- 目的: モニター開始完了後の`/dashboard`で、一部データ取得失敗により画面全体がServer Errorになる問題を解消する
- 実装: 市場分析、モニター状態、更新情報、通知の取得を独立化し、取得可能な情報だけで描画する
- UI: 開始成功メッセージを表示し、想定外の描画失敗にも日本語のroute error boundaryを提供
- migration／環境変数／外部API: 追加なし
- 未完了: 品質ゲート、Draft PR、Vercel Preview、本番確認

## 2026-08-03 モニター開始API化

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `codex/fix-monitor-start-api-v3`
- 目的: 本番のモニター開始時にNext.jsの予期しないServer Action応答で画面全体がエラーになる問題を解消する
- 実装: Server Actionを廃止し、認証済み同一origin API、処理中表示、画面内エラー、成功時遷移へ置換
- 安全性: APIは未ログイン、権限不足、別origin、DB失敗を日本語の安全なJSON応答へ変換し、内部エラーを表示しない
- migration／環境変数／外部API: 追加なし
- 未完了: 品質ゲート、Draft PR、Vercel Preview、本番での開始確認

## 2026-08-02 一般向けCloud漫画制作スタック統合

- 状態: `INTEGRATING`
- Branch: `codex/cloud-manga-integration-v2`
- Base: `origin/feature/manga-canvas-mvp` (`d8571b7`、PR #125 merge後)
- 統合対象: Draft PR #94〜#121の一般向け漫画生成・長編制作・限定モニター品質フィードバック
- 方針: 既存Draft PRをrebase／force push／Closeせず、最新の管理者運用改善を保持して非破壊統合する
- migration: 既存の招待追跡`202608020001`を保持し、重複していたcheckpoint restoreを`202608020003`へ改番する
- 変更しない範囲: 成人向け、Desktop、Stripe、Marketplace、既存認証・市場分析・企画・シナリオの業務契約
- 未完了: 文書・migration台帳同期、全品質ゲート、Draft PR、Vercel Preview、責任者確認

## 2026-08-02 管理者ユーザー運用改善（統合元ベース）

- PR #123〜#125で、一般ユーザーの停止・再開・安全な削除、削除済み非表示、招待送信状況・ログイン状況、検索・絞り込みを実装済み
- `codex/cloud-manga-integration-v2`では上記の最新管理画面を保持する

## 2026-08-02 長編マンガ制作 M6-1: 限定モニター品質フィードバック

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `codex/manga-monitor-quality-feedback-v1`
- Base: `codex/manga-100-page-acceptance-v1`（Draft PR #120）
- 目的: ページ／コマ評価と生成品質・費用指標を漫画Editorから収集する
- 実装: 採用／要修正／作り直し、問題種別、影響度、コメント、生成回数、Provider／model、概算費用、時間の保存と管理集計
- migration: `202608020002_cloud_general_monitor_quality_feedback.sql`（未適用）
- 環境変数／外部Provider実行: 追加なし
- 検証: 専用4/4、Hub 418/418、deps、Hub typecheck、lint、migration 45本、production build、公開画面390／768／1280px overflowなし
- 未実施: Supabase適用、認証済みPreviewでの保存、実モニター試験、責任者承認
- 詳細: `docs/cloud/MANGA_MONITOR_QUALITY_FEEDBACK_V1.md`

## 2026-08-02 長編マンガ制作 M5-11: 100ページ決定的受入れfixture

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `codex/manga-100-page-acceptance-v1`
- Base: `codex/manga-longform-readiness-v1`（Draft PR #119）
- Draft PR: [#120](https://github.com/team478a/manga/pull/120)
- Preview: `https://mangai-hub-staging-git-codex-manga-10-9b7089-team478as-projects.vercel.app`
- 目的: 100ページ長編の構造、preflight、進捗、固定版差分、分割PDFを外部環境なしで横断検査する
- Fixture: 100ページ、10章、10話、20シーン、全ページ確定済み
- 実装: `cloud:longform:acceptance`とHub testへ4件の決定的受入れを追加
- migration／環境変数／外部Provider: 追加なし
- 検証: 専用受入れ4/4、deps、lint、Hub 414/414、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y、Hub/Desktop typecheck、migration 44本、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 未実施: 実ブラウザ、実画像、実DB復元訓練、責任者承認
- 詳細: `docs/cloud/MANGA_100_PAGE_ACCEPTANCE_V1.md`

## 2026-08-02 長編マンガ制作 M5-10: 長編完成準備チェック

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `codex/manga-longform-readiness-v1`
- Base: `codex/manga-checkpoint-diff-preview-v1`（Draft PR #118）
- Draft PR: [#119](https://github.com/team478a/manga/pull/119)
- Preview: `https://mangai-hub-staging-git-codex-manga-lo-109f0d-team478as-projects.vercel.app`
- 目的: 原稿確定、復旧用固定版、完成版、PDFの順に次の操作を一画面で案内する
- 実装: 4段階の決定的な完成判定、最初の未完了工程への日本語導線、完成用preflight表示の統一
- migration／環境変数／外部Provider: 追加なし
- 検証: deps、lint、Hub 410/410、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y、Hub/Desktop typecheck、migration 44本、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 未実施: 実ブラウザ、100ページfixture、責任者承認
- 詳細: `docs/cloud/MANGA_LONGFORM_READINESS_V1.md`

## 2026-08-02 長編マンガ制作 M5-9: 復元前の差分確認

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `codex/manga-checkpoint-diff-preview-v1`
- Base: `codex/manga-checkpoint-restore-v1`（Draft PR #117）
- Draft PR: [#118](https://github.com/team478a/manga/pull/118)
- Preview: `https://mangai-hub-staging-git-codex-manga-ch-52453e-team478as-projects.vercel.app`
- 目的: 固定版復元前に現在の作品から変わる内容を漫画制作上の件数で確認する
- 実装: 戻すページ、外れるページ、章／話／シーン、素材、作品基本設定の決定的な差分集計と日本語表示
- 情報境界: manifest、Canvas JSON、SHA-256、Storage path、Provider情報は利用者へ表示しない
- migration／環境変数／外部Provider: 追加なし
- 検証: deps、lint、Hub 406/406、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y、Hub/Desktop typecheck、migration 44本、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- DB適用: 旧ファイル名`202608020001_cloud_project_checkpoint_restore.sql`をSupabase stagingへ適用し、table／function／RLSがすべてtrue。リポジトリ上ではID競合解消のため`202608020003_cloud_project_checkpoint_restore.sql`へ改番
- 未実施: 実ブラウザ、100ページ実データ、責任者承認
- 詳細: `docs/cloud/MANGA_CHECKPOINT_DIFF_PREVIEW_V1.md`

## 2026-08-02 長編マンガ制作 M5-8: チェックポイント復元

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `codex/manga-checkpoint-restore-v1`
- Base: `codex/manga-version-freeze-v1`（Draft PR #116）
- Draft PR: [#117](https://github.com/team478a/manga/pull/117)
- Preview: `https://mangai-hub-staging-git-codex-manga-ch-e4a0cd-team478as-projects.vercel.app`
- 目的: 作業バックアップ／完成版から作品構造とCanvasを安全に復元する
- 実装: 復元前自動バックアップ、所有権検査、生成／編集ロック検査、復元監査、明示確認UI、処理中表示
- 安全条件: revision単調増加、復元ページは要再確認、欠損blob時は全rollback、別作品checkpoint拒否
- migration: `202608020003_cloud_project_checkpoint_restore.sql`（旧ファイル名`202608020001`でSupabase staging適用・構造確認済み）
- 検証: deps、lint、Hub 403/403、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y、Hub/Desktop typecheck、migration 44本の静的検査とforward／rollback／reapply、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 未実施: 実ブラウザ、100ページ実データ、責任者承認
- 詳細: `docs/cloud/MANGA_PROJECT_CHECKPOINT_RESTORE_V1.md`

## 2026-08-01 長編マンガ制作 M5-7: 増分バックアップと完成版固定

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `codex/manga-version-freeze-v1`
- Base: `codex/manga-cost-budget-v1`（Draft PR #115）
- Draft PR: [#116](https://github.com/team478a/manga/pull/116)
- Preview: `https://mangai-hub-staging-git-codex-manga-ve-2950ce-team478as-projects.vercel.app`
- 目的: 32〜100ページ作品を変更ページ分だけバックアップし、原稿確認後の完成版を不変の履歴として固定する
- 実装: SHA-256重複排除Canvas blob、作品manifest、作業バックアップ、完成版固定、現在revision一致表示、作成中表示
- 安全条件: 実行中生成なし、全ページsnapshotあり、完成版は全ページ確定・最新Context確認済みの場合だけDBで作成
- migration: `202608010011_cloud_project_checkpoints.sql`（Supabase staging適用・構造確認済み）
- 検証: deps、lint、Hub 398/398、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y、Hub/Desktop typecheck、migration 43本、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 未実施: 実ブラウザ、100ページ実データ、責任者承認
- 詳細: `docs/cloud/MANGA_PROJECT_CHECKPOINTS_V1.md`

## 2026-08-01 長編マンガ制作 M5-6: 作品別リソース予算

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `codex/manga-cost-budget-v1`
- Base: `agent/manga-chapter-production-plans-v1`（Draft PR #114）
- Draft PR: [#115](https://github.com/team478a/manga/pull/115)
- Preview: `https://mangai-hub-staging-git-codex-manga-co-1eab8d-team478as-projects.vercel.app`
- 目的: 32〜100ページ制作で作品ごとの生成クレジット、概算費用、Storage使用量を把握し、上限超過をDBで停止する
- 実装: 月間クレジット／費用／容量上限、警告割合、作品別停止スイッチ、コックピット集計、owner/admin保存RPC、Job／Asset強制停止trigger
- 表示境界: 利用者には集計値だけを表示し、Provider、モデル、API単価、内部計算式を表示しない
- migration: `202608010010_cloud_project_resource_budgets.sql`（Supabase staging適用済み）
- DB確認: table、使用量RPC、保存RPC、RLS、生成Job trigger、Storage trigger、既存作品backfillがすべて正常
- 検証: deps、lint、Hub 394/394、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y、Hub/Desktop typecheck、migration 42本、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 未実施: 実Providerでの上限停止、100ページ実データ、実ブラウザ、責任者承認
- 詳細: `docs/cloud/MANGA_PROJECT_RESOURCE_BUDGET_V1.md`

## 2026-08-01 長編マンガ制作 M5-5: 章単位の制作計画

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `agent/manga-chapter-production-plans-v1`
- Base: `agent/manga-cockpit-navigation-v1`（Draft PR #113）
- Draft PR: [#114](https://github.com/team478a/manga/pull/114)
- Preview: `https://mangai-hub-staging-git-agent-manga-ch-9a2d97-team478as-projects.vercel.app`
- 目的: 32〜100ページ制作で章ごとの優先度・担当名・期限・作業メモを管理する
- 実装: 章制作計画、期限超過、優先章数、次着手章、所有者限定RLS/RPC、未適用時の安全な縮退表示
- migration: `202608010009_cloud_chapter_production_plans.sql`（Supabase staging適用・テーブル／RPC／RLS／index確認済み）
- DB適用: `202607310005`、`202607310006`、`202608010001`、`202608010003`〜`202608010009`を一括監査し、全10項目が正常。`202608010002`は既適用
- 利用者マニュアル: `/dashboard/monitor/guide`と`docs/cloud/CLOUD_GENERAL_MONITOR_USER_GUIDE.md`へ、4〜8ページの試作から人物・画風・参照設定、一括生成、連続性確認、最大100ページ、完成原稿PDFまでの手順を追加
- 検証: deps、lint、Hub 391/391、Canvas 26/26、AI 48/48、Hub/Desktop typecheck、migration 41本静的検査、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 未実施: 実ブラウザでの長編制作フロー確認、Worker実行、責任者承認、親PR後のマージ
- 詳細: `docs/cloud/MANGA_CHAPTER_PRODUCTION_PLANS_V1.md`

## 2026-08-01 長編マンガ制作 M5-4: 100ページナビゲーション

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `agent/manga-cockpit-navigation-v1`
- Base: `agent/manga-longform-cockpit-v1`（Draft PR #112）
- Draft PR: [#113](https://github.com/team478a/manga/pull/113)
- Preview: `https://mangai-hub-staging-git-agent-manga-co-4977d4-team478as-projects.vercel.app`
- 目的: 100ページ作品でもコックピットを軽く、迷わず確認できるようにする
- 実装: 章／制作状態フィルター、シーン未割当抽出、章折りたたみ、24ページ段階表示、件数読み上げ
- データ境界: 保存済みデータのブラウザー内フィルターだけを使用
- migration／環境変数: 追加なし
- 検証: deps、lint、Hub 388/388、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y、Hub/Desktop typecheck、migration 40本静的検査、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 未実施: 実ブラウザ、100ページ実データの操作確認、責任者承認、親PR後のマージ
- 詳細: `docs/cloud/MANGA_COCKPIT_NAVIGATION_V1.md`

## 2026-08-01 長編マンガ制作 M5-3: 長編作品コックピット

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `agent/manga-longform-cockpit-v1`
- Base: `agent/manga-continuity-suggestions-v1`（Draft PR #111）
- Draft PR: [#112](https://github.com/team478a/manga/pull/112)
- Preview: `https://mangai-hub-staging-git-agent-manga-lo-7b90ee-team478as-projects.vercel.app`
- 目的: 章・シーン・ページ制作状態・伏線・人物関係を一画面へ集約する
- 実装: 作品別コックピット、制作状態集計、章／シーン進捗、警告／伏線、人物／関係時系列表示
- データ境界: 保存済み構造化データだけを表示し、推測・外部AI呼び出しは行わない
- migration／環境変数: 追加なし
- 検証: deps、lint、Hub 386/386、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y、Hub/Desktop typecheck、migration 40本静的検査、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 未実施: 実ブラウザ、100ページ実データの表示確認、責任者承認、親PR後のマージ
- 詳細: `docs/cloud/MANGA_LONGFORM_COCKPIT_V1.md`

## 2026-08-01 長編マンガ制作 M5-2: 連続性設定候補

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `agent/manga-continuity-suggestions-v1`
- Base: `agent/manga-continuity-foundation-v1`（Draft PR #110）
- Draft PR: [#111](https://github.com/team478a/manga/pull/111)
- Preview: `https://mangai-hub-staging-git-agent-manga-co-2eb954-team478as-projects.vercel.app`
- 目的: 確定済み設定から未登録の連続性候補を提示し、確認したものだけ事実台帳へ登録する
- 抽出元: キャラクター設定、場所・小物設定、ページ割当済みシーン要約
- 除外: Provider用Prompt、画像推測、未確定の本文解析、外部AI
- migration／環境変数: 追加なし
- 検証: deps、lint、Hub 383/383、Canvas 26/26、AI 48/48、Desktop、Desktop a11y、Hub/Desktop typecheck、migration 40本静的検査、production build成功
- 詳細: `docs/cloud/MANGA_CONTINUITY_SUGGESTIONS_V1.md`
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 未実施: 実ブラウザ、実作品語彙調整、責任者承認、親PR後のマージ

## 2026-08-01 長編マンガ制作 M5-1: 物語の連続性台帳

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `agent/manga-continuity-foundation-v1`
- Base: `agent/manga-storage-lifecycle-v1`（Draft PR #109）
- Draft PR: [#110](https://github.com/team478a/manga/pull/110)
- Preview: `https://mangai-hub-staging-git-agent-manga-co-654703-team478as-projects.vercel.app`
- 目的: 100ページ制作で衣装、居場所、人物関係、時系列、小物、口調・呼称、伏線を見失わないようにする
- 実装: ページ範囲付き事実台帳、伏線台帳、重複範囲の矛盾検出、回収漏れ警告、保存・削除・状態更新UI
- 判定境界: 登録済みの構造化事実だけを決定的に比較し、画像や本文から未確認の事実を推測しない
- migration: `202608010008_cloud_narrative_continuity.sql`（40本目）
- 検証: deps、lint、Hub 379/379、Canvas 26/26、AI 48/48、Desktop、Desktop a11y、Hub/Desktop typecheck、migration往復、canonical二重適用、production build成功
- 詳細: `docs/cloud/MANGA_NARRATIVE_CONTINUITY_V1.md`
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 未実施: Supabase staging適用、実ブラウザ、実作品語彙調整、責任者承認、親PR後のマージ

## 2026-08-01 長編マンガ制作 M4完成: Storageサムネイル・派生物整理

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `agent/manga-storage-lifecycle-v1`
- Base: `agent/manga-durable-export-v1`（Draft PR #108）
- Draft PR: [#109](https://github.com/team478a/manga/pull/109)
- Preview: `https://mangai-hub-staging-git-agent-manga-st-723bbf-team478as-projects.vercel.app`
- 目的: ページ一覧の軽量表示と、完成原稿を保護した安全な派生ファイル整理を提供する
- 実装: private WebPサムネイル、revision追従Queue、署名URL、期限付きExport中間物cleanup、lease Worker
- 安全性: 採用済み画像と完成`manuscript.pdf`は削除対象外。保存競合時は古いサムネイルを公開せず再生成
- migration: `202608010007_cloud_storage_lifecycle.sql`（39本目）
- 検証: deps、lint、Hub 374/374、Canvas 26/26、AI 48/48、Desktop、Desktop a11y、Hub/Desktop typecheck、migration往復、production build、GitHub Core quality／Migration roundtrip／Windows build／Vercel成功
- 詳細: `docs/cloud/MANGA_STORAGE_LIFECYCLE_V1.md`
- 未実施: Supabase staging適用、Worker環境設定、実ブラウザ、責任者承認、親PR後のマージ

## 2026-08-01 長編マンガ制作 M4完成: 永続PDFエクスポート

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `agent/manga-durable-export-v1`
- Base: `agent/manga-production-status-v1`（Draft PR #107）
- Draft PR: [#108](https://github.com/team478a/manga/pull/108)
- Preview: `https://mangai-hub-staging-git-agent-manga-du-4a6dbe-team478as-projects.vercel.app`
- 目的: 32〜100ページを4ページ単位で処理し、中断・再開できる完成PDF出力を提供する
- 実装: 永続Job、lease Worker、一時停止／再開／中止／再試行、非公開Storage、分割PDF結合、署名download
- 安全性: 全ページ確定・staleなし・生成JobなしをUIとDBで二重検査し、同一作品のactive Exportを1件へ制限
- migration: `202608010006_cloud_durable_export.sql`（38本目）
- 検証: deps、lint、Hub 369/369、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y、Hub/Desktop typecheck、migration往復、production build成功
- 詳細: `docs/cloud/MANGA_DURABLE_EXPORT_V1.md`
- 未実施: Supabase staging適用、Worker環境設定、実ブラウザ、責任者承認、親PR後のマージ

## 2026-08-01 長編マンガ制作 M4制作管理: ページ状態・確定ロック

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `agent/manga-production-status-v1`
- Base: `agent/manga-batch-production-v1`（Draft PR #106）
- Draft PR: [#107](https://github.com/team478a/manga/pull/107)
- Preview: `https://mangai-hub-staging-git-agent-manga-pr-7ff6fc-team478as-projects.vercel.app`
- 目的: 32ページ制作の未着手、生成中、要確認、要修正、確定を永続管理する
- 実装: 完成率、状態フィルター、生成Job連動、設定変更後の再確認警告、確定ページの編集・再生成DB拒否
- fallback: migration未適用時は全ページを未着手表示とし、従来の編集・生成を継続
- migration: `202608010005_cloud_production_status.sql`（37本目）
- 検証: deps、lint、Hub 363/363、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y、Hub/Desktop typecheck、migration往復、production build成功
- 詳細: `docs/cloud/CLOUD_PRODUCTION_STATUS_V1.md`
- 未実施: Supabase staging適用、実Provider、実ブラウザ、責任者承認、親PR後のマージ

## 2026-08-01 長編マンガ制作 M4後半: 4〜8ページ一括生成・編集ロック

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `agent/manga-batch-production-v1`
- Base: `agent/manga-32page-foundation-v1`（Draft PR #105）
- Draft PR: [#106](https://github.com/team478a/manga/pull/106)
- Preview: `https://mangai-hub-staging-git-agent-manga-ba-fd5369-team478as-projects.vercel.app`
- 目的: 4〜8ページ単位で永続Queueへ登録し、進捗・停止・再開・中止・失敗分再実行と同時編集防止を提供する
- 実装: Batch／Job対応、停止中claim除外、進捗UI、部分retry、期限付きCanvas編集lease
- 互換性: migration未適用時はBatch履歴と編集lockだけをfallback。既存Queue、quota、Provider、Canvas保存契約は維持
- migration: `202608010004_cloud_batch_production.sql`（36本目、rollback・canonical同期済み）
- 検証: deps、lint、Hub/Desktop typecheck、Hub 359/359、Canvas 26/26、AI 48/48、Desktop 182/182、migration forward/rollback/reapply/canonical、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 詳細: `docs/cloud/MANGA_BATCH_PRODUCTION_V1.md`
- 未実施: Supabase staging適用、有料Provider実行、実ブラウザ確認、責任者承認、マージ

## 2026-08-01 長編マンガ制作 M4前半: 32ページ制作基盤

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `agent/manga-32page-foundation-v1`
- Base: `agent/manga-transparent-layers-v1`（Draft PR #104）
- Draft PR: [#105](https://github.com/team478a/manga/pull/105)
- Preview: `https://mangai-hub-staging-git-agent-manga-32-fc91ac-team478as-projects.vercel.app`
- 目的: 章・話・シーン・ページの階層と、32ページを一括展開しない制作ボードを追加する
- 実装: Chapter／Scene永続化、既存作品backfill、単ページ／見開き、同一話内drag並べ替え、12件単位の遅延表示
- 互換性: migration未適用時は既存の話・ページ画面へfallback。Canvas、Provider、料金、成人向け、Desktop契約は変更しない
- migration: `202608010003_cloud_longform_structure.sql`（35本目、rollback・canonical同期済み）
- 検証: deps、lint、Hub/Desktop typecheck、Hub 354/354、Canvas 26/26、AI 48/48、Desktop 182/182、migration forward/rollback/reapply/canonical、production build成功
- CI: Core quality、Migration roundtrip、Windows accessibility/build、Vercel成功
- 詳細: `docs/cloud/MANGA_32_PAGE_FOUNDATION_V1.md`
- 未実施: Supabase staging適用、実ログインブラウザ確認、責任者承認、親PR #104後のマージ

## 2026-08-01 長編マンガ制作 M3-8: 人物・効果レイヤー白背景透明化

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `agent/manga-transparent-layers-v1`
- Base: `agent/manga-layered-generation-v1`（Draft PR #103）
- Draft PR: [#104](https://github.com/team478a/manga/pull/104)
- Preview: `https://mangai-hub-staging-git-agent-manga-tr-46b68e-team478as-projects.vercel.app`
- 目的: 人物・効果の白地素材を、背景へ自然に重ねられる透明PNGとして保存する
- 実装: Jobごとのalpha mode、白〜薄灰色除去、線・網点濃度のalpha化、Worker保存前変換
- 互換性: 未指定、完成コマ、背景、修正生成は`preserve`で無加工
- migration / Feature Flag / Provider / 料金: 追加なし
- 検証: deps、lint、Hub/Desktop typecheck、Hub 350/350、Canvas 26/26、AI 48/48、Desktop 182/182、migration 34/34、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 詳細: `docs/cloud/MANGA_TRANSPARENT_LAYER_OUTPUT_V1.md`
- 未実施: 実Provider生成、実ブラウザ合成確認、責任者承認、親PR #103後のマージ

## 2026-08-01 長編マンガ制作 M3-7: 背景・人物・効果の分離生成

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `agent/manga-layered-generation-v1`
- Base: `agent/manga-composition-control-v1`（Draft PR #102）
- Draft PR: [#103](https://github.com/team478a/manga/pull/103)
- Preview: `https://mangai-hub-staging-git-agent-manga-la-a0ee14-team478as-projects.vercel.app`
- 目的: 完成コマを作り直さず、背景・人物・効果を別々に生成・採用する
- 実装: 4対象の選択、対象別Prompt・参照分離、背景／人物／効果レイヤー採用、人物・効果の乗算合成
- 互換性: 未指定時は従来どおり完成コマ。修正、Inpainting、Outpaintingは変更しない
- migration / Feature Flag / Provider / 料金: 追加なし
- 検証: deps、lint、Hub/Desktop typecheck、Hub 348/348、Canvas 26/26、AI 47/47、Desktop 182/182、migration 34/34、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 詳細: `docs/cloud/MANGA_LAYERED_GENERATION_V1.md`
- 未実施: 実Provider生成、実ブラウザ合成確認、責任者承認、親PR #102後のマージ

## 2026-08-01 長編マンガ制作 M3-6: ポーズ・構図制御

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `agent/manga-composition-control-v1`
- Base: `agent/manga-smart-mask-v1`（Draft PR #101）
- Draft PR: [#102](https://github.com/team478a/manga/pull/102)
- Preview: `https://mangai-hub-staging-git-agent-manga-co-048dc2-team478as-projects.vercel.app`
- 目的: ネームを作り直さず、コマ生成時の画角・カメラ位置・人物配置・視線方向を選択する
- 実装: 4種類の選択式コントロール、任意の追加指定、許可値検証、生成Promptへの明示反映
- 互換性: 初期値はネームどおり。既存の修正、Inpainting、Outpaintingは変更しない
- migration / Feature Flag / Provider / 料金: 追加なし
- 検証: deps、lint、Hub/Desktop typecheck、Hub 345/345、Canvas 26/26、AI 47/47、Desktop 182/182、migration 34/34、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 詳細: `docs/cloud/MANGA_COMPOSITION_CONTROL_V1.md`
- 未実施: 実Provider生成、実ブラウザ確認、責任者承認、親PR #101後のマージ

## 2026-08-01 長編マンガ制作 M3-5: 修正領域おすすめ

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `agent/manga-smart-mask-v1`
- Base: `agent/manga-revision-comparison-v1`（Draft PR #100）
- Draft PR: [#101](https://github.com/team478a/manga/pull/101)
- 目的: 部分修正で白いマスクを毎回ゼロから描く負担を減らす
- 実装: 修正preset別の初期範囲自動配置、顔・表情・両手／左右の手・衣装・背景・全体候補、手動補正
- 正確性: v1は画像認識ではなく比率ベースの目安。検出済みとは表示せず、利用者が元画像上で確認する
- migration / Feature Flag / Provider / 料金: 追加なし
- 検証: deps、lint、Hub/Desktop typecheck、Hub 342/342、Canvas 26/26、AI 47/47、Desktop 182/182、migration 34/34、production build成功
- 詳細: `docs/cloud/MANGA_SMART_MASK_V1.md`
- 未実施: 実ブラウザでのマウス・タッチ確認、責任者承認、親PR #100後のマージ

## 2026-08-01 長編マンガ制作 M3-4: 修正前後の比較表示

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `agent/manga-revision-comparison-v1`
- Base: `agent/manga-panel-outpainting-v1`（Draft PR #99）
- Draft PR: [#100](https://github.com/team478a/manga/pull/100)
- 目的: Image-to-Image、Inpainting、Outpainting候補を採用前に修正前画像と比較する
- 実装: タッチ・キーボード対応比較スライダー、Outpainting方向別の元画像位置補正、比較画面からの非破壊採用
- 公開データ: private Job inputは除外したまま、本人の`source_asset_id`と`outpainting_direction`だけを返す
- migration / Feature Flag: 追加なし
- 検証: deps、lint、Hub/Desktop typecheck、Hub 337/337、Canvas 26/26、AI 47/47、Desktop 182/182、migration 34/34、production build成功
- 詳細: `docs/cloud/MANGA_REVISION_COMPARISON_V1.md`
- 未実施: 実ブラウザでの3方式比較、責任者承認、親PR #99後のマージ

## 2026-08-01 長編マンガ制作 M3-3: コマ画角拡張

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `agent/manga-panel-outpainting-v1`
- Base: `agent/manga-panel-inpainting-v1`（Draft PR #98）
- Draft PR: [#99](https://github.com/team478a/manga/pull/99)
- Preview: `https://mangai-hub-staging-git-agent-manga-pa-f7bc01-team478as-projects.vercel.app`
- 目的: 採用画像を維持したまま、左・右・上・下・全方向へ背景と構図を延長する
- 実装: 方向選択、Worker内の余白・マスク生成、BFL Fill、元画像の所有権・コマ配置検証、2〜4案比較、correction layer採用
- Feature Flag: `CLOUD_PANEL_OUTPAINTING_ENABLED`（未設定時fail closed）
- migration: なし。既存Fill価格行を再利用
- 検証: deps、lint、Hub/Desktop typecheck、Hub 333/333、Canvas 26/26、AI 47/47、Desktop 182/182、migration 34/34、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 詳細: `docs/cloud/MANGA_PANEL_OUTPAINTING_V1.md`
- 未実施: 実Provider有料生成、実ブラウザ確認、責任者承認、親PR #98後のマージ

## 2026-08-01 長編マンガ制作 M3-2: マスク付きコマ部分修正

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `agent/manga-panel-inpainting-v1`
- Base: `agent/manga-panel-revision-v1`（Draft PR #97）
- Draft PR: [#98](https://github.com/team478a/manga/pull/98)
- Preview: `https://mangai-hub-staging-jnew2urfq-team478as-projects.vercel.app`
- 目的: 採用画像の選択範囲だけをFill Providerで描き直し、元画像を保持して採用する
- 実装: タッチ対応マスク描画、Fill専用operation、所有権・コマ・PNG・寸法検証、private署名URL、2〜4案比較、correction layer採用
- Provider: BFL `flux-pro-1.0-fill`。管理画面に保存済みの一般向けBFL APIキーを再利用
- Feature Flag: `CLOUD_PANEL_INPAINTING_ENABLED`（未設定時fail closed）
- migration: `202608010002_cloud_panel_inpainting.sql`（価格行追加）
- 検証: deps、lint、Hub/Desktop typecheck、Hub 329/329、Canvas 26/26、AI 46/46、Desktop 182/182、migration 34/34、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 詳細: `docs/cloud/MANGA_PANEL_INPAINTING_V1.md`
- 未実施: staging migration、実Provider生成、タッチを含む実ブラウザ確認、責任者承認、親PR #97後のマージ

## 2026-08-01 長編マンガ制作 M3-1: コマ修正候補生成

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `agent/manga-panel-revision-v1`
- Base: `agent/manga-continuity-review-v1`（Draft PR #96）
- Draft PR: [#97](https://github.com/team478a/manga/pull/97)
- Preview: `https://mangai-hub-staging-git-agent-manga-pa-2b4a4e-team478as-projects.vercel.app`
- 実装: 採用画像を参照したImage-to-Image候補、顔・手・表情・衣装・背景・仕上げpreset、追加要望、2〜4案比較、非破壊レイヤー採用
- 安全性: 修正元は選択コマの表示中Assetに限定し、作品・所有者をサーバーで再検証。非公開Job入力を利用者へ返さない
- 境界: v1は参照画像による候補再生成。マスク付きInpaintingではない
- DB: 新規migrationなし
- 検証: deps、lint、Hub/Desktop typecheck、Hub 325/325、Canvas 26/26、AI 45/45、Desktop 182/182、migration 33/33、production build成功
- 詳細: `docs/cloud/MANGA_PANEL_REVISION_V1.md`
- 未実施: 実Provider生成、実ブラウザ比較、責任者承認、親PR #96後のマージ

## 2026-08-01 長編マンガ制作 M2-4: 生成履歴の一貫性チェック

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `agent/manga-continuity-review-v1`
- Base: `agent/manga-reference-assets-v1`（Draft PR #95）
- Draft PR: [#96](https://github.com/team478a/manga/pull/96)
- Preview: `https://mangai-hub-staging-git-agent-manga-co-df707f-team478as-projects.vercel.app`
- 実装: 採用画像の生成Job追跡、人物・衣装・場所・小物・画風の設定版照合、参照画像使用確認、version混在警告、ページ／設定修正導線
- 判定境界: 画像ピクセルではなく、Canvas・生成履歴・固定設定・参照画像の整合性を検査。見た目を確認したとは表示しない
- DB: 新規migrationなし。既存RLS下のデータだけを利用
- 検証: deps、lint、Hub/Desktop typecheck、Hub 321/321、Canvas 26/26、AI 44/44、Desktop 182/182、migration 33/33、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 詳細: `docs/cloud/MANGA_CONTINUITY_REVIEW_V1.md`
- 次: 8ページ実作品で警告→再生成→警告解消のブラウザ受入れ、将来の任意Vision評価設計
- 未実施: 実Provider有料生成、実ブラウザ確認、責任者承認、親PR #95後のマージ

## 2026-08-01 長編マンガ制作 M2-3: 参照画像・コマ明示割当

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `agent/manga-reference-assets-v1`
- Base: `agent/manga-generation-integration-v1`（Draft PR #94）
- 実装: Character／Style／Location／Propの非公開参照画像、コマ単位の人物・場所・小物割当、生成Jobへの参照asset固定、Workerでの短時間署名URL発行、BFL FLUX.2 multi-reference入力
- セキュリティ: 一般向け所有作品だけ、所有者RLS、検証済みRPC、別作品asset拒否、秘密URL非表示、migration未適用時fail-safe
- migration: `202608010001_cloud_visual_references.sql`
- 検証: deps、lint、Hub/Desktop typecheck、Hub 317/317、Canvas 26/26、AI 44/44、Desktop 182/182、migration 33/33、forward/rollback/reapply/canonical schema、production build成功
- 詳細: `docs/cloud/MANGA_VISUAL_REFERENCES_V1.md`
- 次: キャラクター・衣装・場所の継続性評価と警告
- 未実施: staging migration、実Provider有料生成、実ブラウザ確認、責任者承認、親PR #94後のマージ

## 2026-07-31 一般向け漫画生成の最新Cloud基盤への統合

- 状態: `READY_FOR_REVIEW`
- Branch: `agent/manga-generation-integration-v1`
- Base: `feature/manga-canvas-mvp` (`ae1279e`)
- Draft PR: [#94](https://github.com/team478a/manga/pull/94)
- Preview: `https://mangai-hub-staging-git-agent-manga-ge-907c74-team478as-projects.vercel.app`
- 対象: PR #87〜#90の一般向け漫画生成に必要な機能commit
- 完了: FLUXコマ生成、候補比較・採用・再実行、共通レイヤー合成、
  8ページ原稿検査、作品進捗、キャラクター設定、画風・場所・小物設定
- 検証: deps、lint、Hub/Desktop typecheck、Hub 312/312、Canvas 26/26、
  AI 44/44、Desktop 182/182、migration 32/32、production build成功
- 統合記録: `docs/cloud/MANGA_GENERATION_INTEGRATION_REPORT.md`
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 未完了: staging migration、実Provider有料生成、
  8ページ実ブラウザ目視、責任者承認、マージ
- 次: 新しいDraft PRの全CI確認後、一般向けモニター用の実機受入れへ進む

## 2026-07-31 長編マンガ制作 M2-2: 画風・場所・小物設定

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `codex/manga-world-bible-v1`
- Base: `codex/manga-character-profiles-v1`（Draft PR #89）
- 実装:
  - 作品単位のStyle Bibleとversion snapshot
  - 場所・小物Profileの作成・更新・削除とversion snapshot
  - 画風、線、陰影、背景密度、構図ルール、固定特徴、配色、禁止変更
  - 画風を全コマ、名前が一致する場所・小物を対象コマへ自動適用
  - 生成Job入力へ利用したBible/Profile IDとversionを保存
  - 所有者RLS、所有者確認RPC、migration未適用時の安全な案内
- 変更しない範囲: 成人向け、Desktop、Provider、Worker、Stripe、Marketplace
- 検証: deps、lint、Hub/Desktop typecheck、Hub 311/311、migration 32/32、local roundtrip、production build、diff check成功
- 次: 参照画像、コマへの明示割当、継続性評価・警告
- 未実施: staging migration、実Provider生成、実ブラウザ確認、責任者承認、マージ

## 2026-07-31 長編マンガ制作 M2-1: 編集可能なキャラクター設定

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `codex/manga-character-profiles-v1`
- Base: `codex/manga-production-m0-v1`（Draft PR #88）
- 実装:
  - 一般向けCloud作品ごとのCharacter Profile作成・更新・削除
  - 年齢、体格、髪、衣装、配色、固定特徴、追加・除外条件
  - 更新ごとの不変version snapshotと所有者RLS
  - 保存・削除中表示、空状態、migration未適用時の安全な案内
  - ネーム上の人物名と照合し、最新設定を画像生成条件へ自動反映
  - 生成Job入力へProfile IDとversionを保存
- 変更しない範囲: 成人向け、Desktop、Provider、Worker、Stripe、Marketplace
- 次: 参照画像、Style Bible、Location／Prop Profile、継続性警告
- 未実施: staging migration、実Provider生成、実ブラウザ確認、責任者承認、マージ

## 2026-07-31 長編マンガ制作 M1: キャラクター設定・作品全体進捗

- 状態: `IMPLEMENTED`
- Branch: `codex/manga-production-m0-v1`
- Draft PR: [#88](https://github.com/team478a/manga/pull/88)
- 実装:
  - 採用シナリオから人物名、役割、望み、恐れ、葛藤、変化を読み取り、
    作品画面へ基本キャラクター設定表として表示
  - キャラクター情報を複製DBへ保存せず、既存のシナリオ→ネーム→作品参照を利用
  - 対象コマの人物設定を画像生成Promptへサーバー側で自動追加
  - ページごとの画像配置数、待機中、処理中、失敗Jobを作品画面へ集約
  - 最新のコマ別Jobだけを採用し、古い失敗Jobを現在状態へ混入させない
  - 完成、生成中、要確認、未着手を日本語表示し、対象ページへ直接移動
- セキュリティ: 所有者RLS下の既存データだけを利用。service-role、秘密値、
  Provider内部エラー、技術Promptは利用者画面へ表示しない
- 変更しない範囲: DB、migration、Provider、Worker、成人向け、Desktop、販売処理
- 検証: deps、lint、Hub/Desktop typecheck、集中テスト16/16、
  Hub 302/302、production build、diff check成功
- 次: 実ブラウザで8ページ作品の設定表・進捗・Editor→PDFを責任者確認し、
  M1受入れ完了後にM2の編集可能な外見・衣装・場所・画風Profileへ進む
- 未実施: 実ブラウザ確認、実Provider有料生成、責任者承認、マージ

## 2026-07-31 長編マンガ制作 M1: 8ページ原稿チェック・書き出し検証

- 状態: `IMPLEMENTED`
- Branch: `codex/manga-production-m0-v1`
- Draft PR: [#88](https://github.com/team478a/manga/pull/88)
- 実装:
  - 作品画面で表紙、ページ順、空コマ、画像素材欠落を自動確認
  - 背景画像の仕上がり解像度不足を警告
  - 縦書き・横書き・ルビを含む文字layoutでoverflowを検出
  - 8ページ基準と画像配置済みコマ数を表示
  - 修正項目から対象ページの編集画面へ直接移動
  - 問題件数が多い作品は表示上限と残件数を保持
  - 8ページfixtureを実際に8ページPDFと`001.png`〜`008.png`へ出力
- セキュリティ: 所有者RLS下のCanvasとAssetメタデータだけを読み、
  Storage本体やservice-roleを原稿チェックに使用しない
- 変更しない範囲: 販売処理、DB、migration、Provider、Worker、成人向け、Desktop
- 検証: lint、Hub typecheck、原稿チェック5/5、8ページ出力3/3、
  Hub 295/295、production build、diff check成功
- 次: 実ブラウザでM1全体の画面・生成・書き出しを受入れ確認
- 未実施: 実ブラウザ確認、実作品でのPDF目視比較、責任者承認、マージ

## 2026-07-31 長編マンガ制作 M1: コマ候補の比較・採用・再実行

- 状態: `IMPLEMENTED`
- Branch: `codex/manga-production-m0-v1`
- 対象: 一般向けCloud Canvasのネーム連動コマ画像生成
- 実装:
  - 1コマにつき2〜4候補を一度の操作で受付
  - ネームの構図を維持しつつ、表情、視線誘導、背景を変えた候補を生成
  - 完成候補をサムネイルで比較し、選んだ候補をコマの背景layerへ配置
  - 失敗理由やProvider内部情報を表示せず、失敗候補だけ再実行
  - 利用枠不足などで一部だけ受付できた場合は、完了数を安全に案内
  - 再読込後もJobの`targetPanelId`から採用先と再実行対象を復元
- 変更しない範囲: DB、migration、Provider、Worker、成人向け、Desktop
- 検証: lint、Hub typecheck、集中テスト12/12、Hub 287/287、
  production build、diff check成功
- 次: ページ／全8ページの進捗表示、基本キャラクター設定表、原稿preflight、
  8ページfixtureによるPDF／連番PNGの完走検証
- 未実施: Draft PR、CI、Vercel Preview、実Provider有料生成、責任者画面確認

## 2026-07-31 長編マンガ制作 M0: Cloudページ合成基盤

- 状態: `IMPLEMENTED`
- Branch: `codex/manga-production-m0-v1`
- Base: `codex/cloud-general-image-v1` (`56ab885`)
- 計画:
  [`MANGA_100_PAGE_IMPLEMENTATION_PLAN.md`](cloud/MANGA_100_PAGE_IMPLEMENTATION_PLAN.md)
- 対象: 一般向けCloud Canvasの編集表示、プレビュー、PNG/PDF、販売パッケージ
- 実装:
  - ブラウザとServer書き出しが同じSVGページ合成器を利用
  - コマ内の背景・人物・小物・効果・トーン・補正を順番どおりに合成
  - cover/contain/manual、位置、倍率、回転、透明度、blend modeを反映
  - mask layer、斜め・曲線コマ、吹き出し尻尾、縦横文字・ルビを反映
  - 編集画面のコマ表示を最上位画像1枚から全レイヤー合成へ変更
  - Export時に最上位だけでなく必要な全レイヤーAssetを収集
  - 旧`flattened_legacy`だけのPageは従来画像へfallback
- Desktop方針:
  同じCanvas schemaと描画規則を維持し、将来の成人向けDesktopへ作品を
  引き渡せる境界を保持。今回Desktopコードと成人向けProviderは変更しない
- 検証: deps、lint、Hub typecheck、Hub 284/284、production build、
  Cloud Canvas集中テスト5/5、diff check成功
- 未実施: Draft PR、CI、Vercel Preview、実ブラウザでの編集→保存→PDF比較

## 2026-07-31 一般向けモニターWebマニュアル同期

- 状態: `READY_FOR_REVIEW`
- Branch: `codex/cloud-monitor-guide-sync-v1`
- Base: `feature/manga-canvas-mvp` (`ee6e2ca`、PR #92 merge後)
- 対象: 利用者向けWebマニュアル、スタッフ向け運用マニュアル、Cloud共通サイドバー
- 実装:
  - 利用者向けマニュアルを現在の8工程へ同期
  - 実装済みの工程1〜6へマニュアルから直接移動できる導線を追加
  - 販売準備・収益管理を「準備中」と明示
  - スマートフォン操作とFeature Flag停止時の案内を追加
  - Cloud共通サイドバーへ常設の「使い方」リンクを追加
  - スタッフ向け完走条件を一般向け6工程へ更新
- 変更しない範囲: DB、migration、認証、AI生成・保存ロジック、Feature Flag、成人向け境界、Desktop
- 検証: deps:check、lint、Hub typecheck、集中テスト5/5、Hub test 279/279、production build、git diff check成功
- 注記: `npm ci`の既存依存監査でhigh severity 11件。今回の表示・文書変更とは分離して扱う
- Draft PR: [#93](https://github.com/team478a/manga/pull/93)
- Preview: `https://mangai-hub-staging-git-codex-cloud-mo-eaf18e-team478as-projects.vercel.app`
- CI: 実装commit `25aaa92`でCore quality、Migration roundtrip、Windows build、Vercel成功
- 未実施: 責任者によるPreview画面確認・承認・マージ

## 2026-07-31 一般向け制作工程の利用入口修正

- 状態: `READY_FOR_REVIEW`
- Branch: `codex/cloud-workflow-entrypoints-v1`
- Base: `feature/manga-canvas-mvp` (`38c1481`、PR #91 merge後)
- 対象: Cloud共通サイドバー、企画・シナリオ・ネームの工程入口
- 実装:
  - 実装済みのAI企画提案・シナリオ作成・ネーム作成をクリック可能に変更
  - 各Feature Flagを個別に確認し、有効時は「利用可能」、無効時は「停止中」と表示
  - 利用者本人の一般向け制作データから最新の進行先を安全に解決
  - 前工程が未完了の場合は、必要な工程と遷移ボタンを表示
  - 他利用者データおよび成人向けデータを工程入口の候補から除外
  - 現在の制作進行表示を、閲覧中の工程に合わせて更新
- 変更しない範囲: DB、migration、AI生成・保存ロジック、成人向け境界、Desktop
- 検証:
  - deps:check: PASS
  - lint: PASS
  - Hub typecheck: PASS
  - 集中テスト: PASS（4/4）
  - Hub test: PASS（279/279）
  - Hub production build: PASS
  - git diff --check: PASS
- 注記: `npm ci`の既存依存監査でhigh severity 11件。今回の変更とは分離して扱う
- Draft PR: [#92](https://github.com/team478a/manga/pull/92)
- 未実施: CI、Vercel Preview、本番Feature Flag確認

## 2026-07-31 一般向け制作工程の表示整理

- 状態: `IMPLEMENTED`
- Branch: `codex/cloud-workflow-labels-v1`
- Base: `feature/manga-canvas-mvp` (`7eb783f`)
- 対象: Cloud共通サイドバー、Dashboard、`/creator`、シナリオ採用画面
- 実装:
  - 「マンガ生成」を「ネーム作成」と「原稿編集」へ分離
  - 原稿編集を制作ステップ5、作品管理をステップ6へ整理
  - 販売準備と収益管理へ「準備中」を表示
  - AI企画提案・シナリオ作成・ネーム作成へ「前工程の完了後」を表示
  - 企画・シナリオ・ネームの詳細URLに応じて現在工程を正しく強調
  - DashboardのRelease 1表記を「一般向けモニター」へ変更
  - `/creator`を「原稿編集」として案内し、初回3ステップも原稿編集用に統一
- 変更しない範囲: DB、API、認証、制作・保存ロジック、Feature Flag、Desktop
- 検証:
  - 集中テスト: PASS（11/11）
  - deps:check: PASS
  - lint: PASS
  - Hub typecheck: PASS（共通package build後）
  - Hub test: PASS（278/278）
  - Hub production build: PASS
  - git diff --check: PASS
- 注記: `npm ci`の既存依存監査でhigh severity 11件。今回の表示変更とは分離して扱う
- 未実施: push、Draft PR、CI、Vercel Preview、責任者画面確認

## 2026-07-31 一般向けクラウド画像生成Provider接続

- 状態: `IMPLEMENTED_LOCAL`
- Branch: `codex/cloud-general-image-v1`
- Base: 最新`feature/manga-canvas-mvp` (`7eb783f`)
- 対象: 一般向けRelease 6のコマ画像生成、`/admin/cloud-ai`
- 実装:
  - BFL FLUX.2固定版の非同期API adapter
  - 管理画面からAPIキー・モデル・有効状態を保存
  - APIキーをSupabase Vaultへ保存し、service-role限定で復号
  - Provider価格と原価上限をmigrationで登録
  - BFLのpolling URL・画像URLをHTTPSかつBFL domainへ限定
  - 既存の一般向けモデレーション、quota、Queue、Worker、画像検査、
    private Storage、コマ配置を維持
  - モニター公開チェックへ画像Provider設定とWorker実行条件を追加
  - Worker停止・短い署名Secretをpreflightで秘密値なしに拒否
  - 画像生成受付中はボタンを無効化し、二重Job登録を防止
- migration:
  `202607310004_cloud_general_image_provider.sql`
- 成人向け境界:
  成人向け画像はBFLへ送信せず、将来の独立GPU/VPS APIまで停止
- 文書:
  [`CLOUD_GENERAL_IMAGE_PROVIDER_V1.md`](cloud/CLOUD_GENERAL_IMAGE_PROVIDER_V1.md)
- 検証: deps、lint、Hub/Desktop typecheck、research eval、Hub 283/283、
  migration 30/30、production build、diff check成功
- migration roundtrip: ローカルDocker停止中のためGitHub CIで確認
- 未実施: 実API有料生成、staging migration、Draft PR、CI、Preview、
  責任者確認、本番公開

## 2026-07-31 クラウド制作の日本語化・初回ガイド

- 状態: `IMPLEMENTED`
- Branch: `codex/cloud-creator-ja-guide-v1`
- Base: `feature/manga-canvas-mvp` (`3d16839`)
- 対象: `/creator`、作品作成、作品構成、ゴミ箱、ページ編集、共通Header
- 実装:
  - 利用者向けの`Project`、`Episode`、`Page`を「作品」「話」「ページ」へ統一
  - `Cloud Creator`を「クラウド制作」へ変更
  - `/creator`配下を紫基調の`CloudWorkflowShell`へ統合し、左サイドバーを表示
  - 制作ワークフローのステップ4「マンガ生成」からクラウド制作へ遷移
  - Creator配下のButton、Card、FormをDashboardと同じ紫基調へ統一
  - 入口へ「作品作成→話とページの整理→ページ編集」の3ステップガイドを追加
  - 作品がない場合は「作品づくりを始める」を最初の操作として強調
  - エラー・完了メッセージとページ編集の主要英語表記も日本語化
- 変更しない範囲: DB、API契約、認証、制作・保存ロジック、Desktop
- 検証: deps、lint、Hub typecheck、集中テスト、Hub 278/278、
  production build、diff check成功
- 注記: root `typecheck`のHub部分は成功。Desktop部分はworktree内の
  Desktop依存未導入により実行不可で、今回のHub表示変更とは無関係
- 未実施: Draft PR、CI、Vercel Preview、責任者画面確認

## 2026-07-31 招待メール文面の管理画面編集

- 状態: `IMPLEMENTED`
- Branch: `codex/cloud-monitor-email-template-v1`
- Base: `feature/manga-canvas-mvp` (`506cf2b`)
- 管理画面: `/admin/general-monitors/email`
- 実装:
  - APIキーを再入力せず、招待メールの件名・本文を保存・変更
  - 宛名、利用開始URL、期限、AI利用上限の安全な差し込み
  - 利用開始URLがない本文、改行を含む件名、未知の差し込み項目を保存拒否
  - 文面変更を監査ログへ記録し、既存APIキーはVaultへ保持
  - migration未適用時も従来の既定文面で招待送信を継続
- migration:
  `202607310003_cloud_general_monitor_email_template.sql`
- 検証: deps、lint、Hub typecheck、Hub 275/275、migration 29/29、
  production build、diff check成功
- 未実施: Draft PR、CI、migration適用、Production redeploy

## 2026-07-31 モニター操作の処理中フィードバック

- 状態: `READY_FOR_REVIEW`
- Branch: `codex/cloud-action-pending-feedback-v1`
- Base: `feature/manga-canvas-mvp` (`6ebdbaa`)
- Draft PR: [#83](https://github.com/team478a/manga/pull/83)
- Preview:
  `https://mangai-hub-staging-hvbsecmo4-team478as-projects.vercel.app`
- 対象: モニター招待・再送・停止、利用許可更新、フィードバック対応、
  招待メール設定、利用者フィードバック送信、初回モニター開始
- 実装:
  - 共通`PendingSubmitButton`でクリック直後にスピナーと用途別メッセージを表示
  - Server Action完了までボタンを無効化し、二重送信を防止
  - `aria-busy`と`aria-disabled`で支援技術へ処理中状態を通知
- 変更しない範囲: Server Action、認証、DB、API、Feature Flag、Desktop
- 検証: deps、lint、Hub typecheck、Hub 274/274、production build、diff check、
  Core quality、migration roundtrip、Windows build、Vercelが成功
- 未実施: 責任者承認、merge、Production redeploy

## 2026-07-31 一般向けモニター本番統合

- 状態: `READY_FOR_REVIEW`
- Branch: `codex/cloud-monitor-production-v1`
- Base: `feature/manga-canvas-mvp`
- 統合元: `codex/cloud-general-monitor-beta-v1`
- 本番URL: `https://app.mang-ai.com`
- 対象: 一般向けRelease 1〜6、モニター招待・運用、Webマニュアル、
  管理画面Provider設定、公開前readiness check
- 除外: Stripe、課金、販売、Marketplace、成人向け公開、Desktop
- 成人向け境界: Productionの成人向けFlagは未設定または`false`を必須とする
- 文書:
  [`CLOUD_GENERAL_MONITOR_PRODUCTION_INTEGRATION.md`](cloud/CLOUD_GENERAL_MONITOR_PRODUCTION_INTEGRATION.md)
- 検証: deps、lint、typecheck、research eval、Hub 272/272、
  migration 28/28、production build、Production相当preflight、diff checkが成功
- 未実施: Draft PR、CI、責任者承認、protected branch merge、本番migration、
  Production redeploy、実招待

## 2026-07-31 一般向けモニター・本番限定公開チェック

- 状態: `READY_FOR_REVIEW`
- 管理者画面: `/admin/general-monitors/readiness`
- 追加内容:
  - 一般向け制作Feature Flag、成人向け停止、モニターDB、AI接続、招待メール、
    招待先HTTPS URLを秘密値なしで一括判定
  - `NEXT_PUBLIC_SITE_URL`と`MONITOR_INVITE_SITE_URL`が同じHTTPS本番originで
    あることを検査し、Previewや別ドメインへの誤招待を防止
  - 登録済み、利用中、初回確認済み、未完了フィードバック件数の表示
  - スタッフ1名 → 2〜3名 → 残りの順で段階公開する手順
  - モニター管理、スタッフマニュアル、各設定画面への導線
- 境界: 設定値、APIキー、内部DBエラーは表示しない。招待、Feature Flag変更、
  migration適用、本番公開は自動実行しない
- 検証:
  - 本番公開保護の集中テスト: PASS（9/9）
  - deps:check: PASS
  - lint: PASS
  - Hub typecheck: PASS
  - Hub test: PASS（272/272）
  - migration静的検証: PASS（28/28）
  - Hub production build: PASS
  - git diff --check: PASS
- 公開形態: 一般公開ではなく、本番環境上の招待制・無料・段階公開
- 外部確認: protected branchの承認とCI成功後に本番へ反映し、管理者画面の
  全項目が正常であることと、スタッフ1名の招待・メール受信・市場分析保存を確認する

## 2026-07-31 約10名モニター向けWebマニュアル

- 状態: `READY_FOR_REVIEW`
- 利用者向け: `/dashboard/monitor/guide`
- スタッフ向け: `/admin/general-monitors/guide`
- 内容:
  - 最初の5分、制作5工程、完了の目印、フィードバック、トラブル、安全上の注意
  - 約10名の同一コホート招待、日次確認、問い合わせ対応、停止判断、完了条件
  - スマートフォンで操作できるアンカーメニューと折りたたみFAQ
- 境界: 一般向け限定。成人向け、Stripe、販売、Marketplaceは変更しない
- 検証:
  - Webマニュアル集中テスト: PASS（8/8）
  - lint: PASS
  - typecheck: PASS（Hub）
  - hub:test: PASS（269/269）
  - Hub production build: PASS
  - git diff --check: PASS
- 未実施: Preview上での390px・768px・1280px実画面確認

## 2026-07-31 一般向けモニター招待メール

- 状態: `READY_FOR_REVIEW`
- Provider: 管理画面で設定するResend Email API
- APIキーと送信元は`/admin/general-monitors/email`で保存・変更し、Supabase Vaultだけを正本にする
- migration: `202607310002_cloud_general_monitor_email_provider`
- 招待登録と同時に登録メールアドレスへ自動送信
- 有効な招待は管理画面から再送可能
- 送信失敗と招待登録失敗を区別して表示
- API token、Provider response、内部エラーは画面へ露出しない
- 外部作業: Resendの認証済み送信ドメイン、API key、送信元、Preview URLの確認
- 検証:
  - 集中テスト: PASS（9/9）
  - deps:check: PASS
  - lint: PASS
  - typecheck: PASS（Hub + Desktop）
  - research:eval: PASS
  - hub:test: PASS（267/267）
  - db:migrations:validate: PASS（28/28）
  - Hub production build: PASS
  - 一般向けモニターpreflight: PASS（テスト値、値非表示）
  - git diff --check: PASS
- 未実施: Preview Supabaseへのmigration適用、実Resend送信、1〜3名の実機E2E、PR merge、本番公開

## 2026-07-31 一般向けモニター運用機能強化

- 状態: `READY_FOR_REVIEW`
- Branch: `codex/cloud-general-monitor-beta-v1`
- Draft PR: [#80](https://github.com/team478a/manga/pull/80)
- migration: `202607310001_cloud_general_monitor_operations`
- 追加内容:
  - 初回オンボーディングと本人の確認日時
  - 期限3日前、AI残り5回以下、停止・期限切れ・上限到達の警告
  - 管理者用の招待メール文面
  - フィードバックの未対応・対応中・対応済み管理
  - モニター一覧CSV出力
- 境界: Stripe、成人向け、本番公開は変更しない

## 2026-07-30 一般向け限定モニター公開

- 状態: `IMPLEMENTED_VALIDATING`
- Branch: `codex/cloud-general-monitor-beta-v1`
- Base: `codex/cloud-panel-image-generation-v1`（Draft PR #73）
- 対象: 一般向け市場分析、AI企画、シナリオ、ネーム、Canvas、コマ画像
- 除外: Stripe、販売、Marketplace、成人向け、本番公開
- migration: `202607300006_cloud_general_monitor_beta`
- 文書:
  - [`CLOUD_GENERAL_MONITOR_BETA_PLAN.md`](cloud/CLOUD_GENERAL_MONITOR_BETA_PLAN.md)
  - [`CLOUD_GENERAL_MONITOR_BETA_ACCEPTANCE.md`](cloud/CLOUD_GENERAL_MONITOR_BETA_ACCEPTANCE.md)
  - [`CLOUD_GENERAL_MONITOR_BETA_RUNBOOK.md`](cloud/CLOUD_GENERAL_MONITOR_BETA_RUNBOOK.md)

管理者による招待、期限、工程横断の累計AI上限、即時停止、利用者フィードバックを追加した。外部migration適用、Feature Flag変更、実API実行、モニター招待は未実施。

## 基本情報

- 更新日: 2026-07-30
- 状態: `READY_FOR_REVIEW`
- リポジトリ: `team478a/manga`
- Base: `codex/cloud-storyboard-canvas-materialization-v1` (`80b71f6`, Draft PR #72)
- Branch: `codex/cloud-panel-image-generation-v1`
- Draft PR: [#73](https://github.com/team478a/manga/pull/73)
- Vercel Preview: [Release 6 Preview](https://mangai-hub-staging-git-codex-cloud-pa-e0d887-team478as-projects.vercel.app)
- 仕様: [`docs/cloud/CLOUD_PANEL_IMAGE_GENERATION_V1.md`](cloud/CLOUD_PANEL_IMAGE_GENERATION_V1.md)
- 計画: [`docs/cloud/CLOUD_RELEASE6_IMPLEMENTATION_PLAN.md`](cloud/CLOUD_RELEASE6_IMPLEMENTATION_PLAN.md)

## 現在の目的

Release 5で作成したCanvas下書きのコマを選ぶだけで、採用ネームから一般向け漫画画像の生成条件をServer側で組み立て、既存Cloud AI Queueへ安全に登録する。利用者にはPrompt、Provider、モデル、解像度の知識を要求しない。

## 実装済み

- 選択コマと元ネームのページ・コマ対応解決
- ネームの画角、構図、人物、背景、動作、感情からServer側Promptを作成
- セリフ、吹き出し、文字を画像へ描かない生成指示
- コマ縦横比に応じた生成寸法の自動決定
- 既存moderation、quota、Provider Registry、Queueを通る専用API
- Jobへ対象panel IDを非公開入力として保存し、PromptをClientへ返さない履歴契約
- 完了Assetを生成対象コマへ配置するCanvas導線
- loading、disabled、error状態
- Feature Flag、UUID、所有者、Release 5由来Project、一般向け境界
- Release 6 preflightとモックProvider自動テスト

## 安全境界

- `CLOUD_PANEL_IMAGE_GENERATION_ENABLED`未設定時は認証・DB・Providerアクセス前にfail closed。
- Release 5の一般向けProjectと所有者本人だけを許可する。
- 既存moderation、quota、料金予約、Provider停止判定を迂回しない。
- PromptをClient response、URL、画面、ログへ返さない。
- 本番Provider、Worker、Feature Flag、有料生成は責任者が明示的に有効化する。
- Desktop、Stripe、Marketplace、成人向け画像生成は変更しない。

## 検証結果

- Release 6集中テスト: PASS（10/10）
- deps:check: PASS
- lint: PASS
- typecheck: PASS（Hub + Desktop）
- research:eval: PASS
- hub:test: PASS（254/254）
- canvas:test: PASS（26/26）
- ai:test: PASS（44/44）
- desktop:test: PASS（182/182）
- desktop:test:a11y: PASS（違反0、既存color contrast要手動確認）
- db:migrations:validate: PASS（25/25、Release 6追加migrationなし）
- Hub production build: PASS
- Desktop build: PASS
- git diff --check: PASS
- GitHub Core quality: PASS
- GitHub migration roundtrip: PASS
- GitHub Windows build: PASS
- Vercel Preview: READY
- rc:preflight: STRUCTURE READY、外部設定と手動E2Eは未実施
- Release 6 preflight: 想定どおりFAIL（ローカルに限定公開用環境変数を設定していない）
- 実Provider有料生成E2E: 未実施（停止条件）

## 責任者が後で行うこと

1. Release 2〜5のstacked migrationとFeature Flagを対象Preview環境で確認
2. Release 6 Preview branchだけで`CLOUD_PANEL_IMAGE_GENERATION_ENABLED=true`
3. 既存Cloud画像Provider、pricing、quota、Workerが検証用設定で動作することを確認
4. Release 5由来Canvasでコマを選び、AIおまかせ生成を1件実行
5. 完了Assetが元の対象コマへ配置され、保存・再表示できることを確認
6. Promptや内部Provider情報が画面・Network response・ログへ露出しないことを確認
7. 390px、768px、1280pxで横overflowと操作不能がないことを確認

## 注意事項

- Release 5 PR #72が未mergeのため、Release 6 PRのbaseはRelease 5 branchにする。
- migration適用、Feature Flag有効化、有料API実行、PR merge、本番公開は行わない。
- Release 6は一般向けコマ画像生成だけを対象とし、成人向け画像生成は含まない。

## 2026-08-03 Codex: モニター運用ハブ

- 更新情報を管理画面で作成・公開し、公開済み情報をダッシュボードへ表示する。
- モニター報告を感想、不具合、改善依頼、機能リクエストに分類し、影響度・環境・画面URLとともに保存する。
- 不具合と改善依頼を指紋で重複集約し、優先度と発生件数を管理する。
- 管理者が許可した修正候補だけを外部Workerへ渡す内部APIを追加する。
- 自動処理の上限は再現確認、テスト、GitHub IssueまたはDraft PR作成までとし、自動マージ・本番デプロイは行わない。
- migration `202608030001_cloud_monitor_operations_hub` は未適用。外部Worker環境変数も未設定のため、現時点では安全に停止する。

## 2026-08-03 Codex: モニター運用ハブ Phase 2

- モニター報告へブラウザー診断、任意スクリーンショット、個人情報・秘密情報マスクを追加。
- 画像は5MB以下のPNG/JPEG/WebPを非公開bucketへ保存し、所有者RLSと管理者署名URLで保護。
- 10分5件、24時間30件のDB投稿制限、受付通知、状態変更通知、利用者向け履歴を追加。
- 管理画面へ直近7日、未完了、重大報告の集計と診断・添付確認を追加。
- Workerの自動マージ・本番反映は禁止を維持。Phase 1ブランチをbaseとするstacked Draft PRで確認する。
- 検証: 専用6/6、Hub 438/438、deps、lint、Hub typecheck、48 migration静的検査、production build、diff check成功。

## 2026-08-03 Codex: モニター開始画面の例外処理強化

- `/dashboard/monitor/welcome` の開始操作でDB接続またはRPCが例外終了しても、Next.jsの汎用エラー画面へ落とさず日本語の再試行案内へ戻す。
- モニター情報取得時の一時的な管理クライアント生成失敗を安全に未取得として扱う。
- ページ固有のError Boundaryを追加し、再読み込みとダッシュボード復帰を提供する。
- migration、環境変数、DB schemaの変更はない。

## 2026-08-04 Codex: 日本語Action遷移の横断安全化

- 更新情報管理で判明した、日本語メッセージを未エンコードのURLへ含めるとServer Actionが失敗する問題を全Cloud画面で監査した。
- 認証、作品・商品・グッズ、Creator原稿編集、市場分析、モニター、端末認証、管理操作の84遷移を`encodeURI`で安全化した。
- モニター開始APIの遷移先と課金完了・キャンセルURLも同じ規則へ統一した。
- 未エンコードの日本語`message`／`error` queryを検出する横断テストを追加した。
- DB、migration、環境変数、業務ロジックは変更していない。

## 2026-08-04 Codex: 更新情報の二重登録防止

- 管理者が同じ更新情報を短時間に再送した場合、追加登録せず既存保存済みであることを案内する。
- ブラウザー側の送信中ボタンに加え、Server Action側でも同じ管理者・同じ内容・直近10分を確認する。
- 重複確認のDB接続が失敗した場合は保存を続行せず、安全な日本語案内へ戻す。
- アーカイブ済み情報は重複判定から除外し、意図した再掲載を妨げない。
- DB schema、migration、公開済み更新情報は変更しない。
- 検証: 専用5/5、Hub 481/481、deps:check、Hub typecheck、lint、migration 48/48、production build、diff check成功。

## 2026-08-04 Codex: 更新情報の編集

- 管理者が登録済み更新情報のタイトル、種類、関連画面、短い説明、詳しい説明を編集できる。
- 公開中の更新情報は保存後にダッシュボードへ即時反映する。
- UUID、管理者権限、アーカイブ状態をServer側で再確認し、存在しない情報やアーカイブ済み情報は編集しない。
- 保存中表示、Provider障害時の安全な日本語案内、一覧へ戻る導線を提供する。
- DB schema、migration、環境変数、公開状態は変更しない。
- 検証: 専用6/6、Hub 482/482、deps:check、Hub typecheck、lint、migration 48/48、production build、diff check成功。

# 2026-08-06 Codex: 本番Cloud AI Worker手動実行URL修正

- Branch: `codex/fix-cloud-ai-worker-invocation-url`
- Base: `origin/feature/manga-canvas-mvp`（PR #183 merge後、`ec1c6ee`）
- 実Provider受入れで、管理画面の手動Worker実行が本番でも保護付き`VERCEL_URL`を優先し、内部Worker endpointへ到達できないことを確認した。
- 本番は`NEXT_PUBLIC_SITE_URL`を優先し、Previewは従来どおり自身の`VERCEL_URL`を使用する。公開URL未設定時の既存fallbackとHTTPS検証は維持する。
- API、DB、migration、RPC、Storage、Provider、model、pricing、retry、timeout、Scheduler、Feature Flag、成人向け境界、Desktopは変更していない。
- focused 8/8、deps:check、lint、typecheck、Hub／Canvas／AI／Desktop test、migration 48本、Hub／Desktop build、release structure preflight、diff checkに成功。
- 実Provider Jobは1件待機中。修正PRの全CIとVercel Preview成功、責任者のmerge、本番再デプロイ後に手動Workerを1回だけ再実行する。それまでは追加Jobを登録しない。
