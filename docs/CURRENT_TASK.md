# MANGAI Current Task

## 2026-08-24 Production品質イベント5xx再送loop修正

- 状態: `IMPLEMENTED_LOCAL / HUB_REGRESSION_PASSED / PRODUCTION_UNCHANGED / PROVIDER_NOT_CALLED`
- Base: PR #327 merge commit `35c358f`。Branch: `codex/fix-production-quality-event-5xx`。
- Production証跡: `app.mang-ai.com`の22ページから`POST /api/creator/manga-quality-events`が同一時刻に多数500。deployment `dpl_EjYtBf2cCPF7xDsqSAFz8Jd7vMBR`、Production、`feature/manga-canvas-mvp`。
- 原因: 完成Jobの表示イベント失敗時に送信済みIDを削除し、3秒周期のJob更新ごとに同じJob群を再送していた。旧Job等でRPCが`P0001 / cloud_generation_job_not_found`を返す場合も表示テレメトリを致命的に扱っていた。
- 修正: 表示イベントは画面session内で1 Job 1回だけ試行する。所有者として記録不能な旧Jobの上記エラーだけを非致命化する。採用・不採用、他のRPC／schema障害は従来どおりfail-closed。
- 不変: API payload、DB、migration、RPC、Storage、Provider、model、pricing、credit、Canvas、PNG／PDF、Productionデータを変更しない。
- 検証: 集中4/4、deps error 0（既存warning 2件）、lint、全型検査、Hub 833/833、`git diff --check`成功。
- 次: commit・push・Draft PR後、全CIとVercel Preview成功で停止する。merge／Production反映後に22ページを1回再読込し、同routeの5xx再発なしをread-only確認する。
- 詳細: `docs/RELEASE_CANDIDATE_PRODUCTION_QUALITY_EVENT_5XX_RETRY_GUARD_20260824.md`

---

## 2026-08-24 採用画像Visual Judge連続性証跡監査

- 状態: `IMPLEMENTED_LOCAL / ALL_LOCAL_GATES_PASSED / PRODUCTION_UNCHANGED / PROVIDER_NOT_CALLED`
- Base: PR #326 merge commit `e0e8aae`。Branch: `codex/audit-r4-3-visual-judge-evidence`。
- 実装: 採用中layerの`sourceJobId`と既存品質評価を結び、`evaluation_details.continuityMatch`が現行Evidence schemaを満たす場合だけ、score・confidence・sourceをread-only参考表示する。
- 安全境界: legacy rule-based中立75点、旧形式、不正形式はVisual Judge証跡として扱わない。履歴警告、完成判定、自動不採用、自動再生成、Provider、creditへ非接続。
- 検証: 集中7/7、deps error 0（既存warning 2件）、lint、全型検査、Hub 832/832、Canvas 26/26、AI 48/48、Desktop 182/182、migration 61件、Hub／Desktop build、RC structure、diff check成功。
- 不変: Production、作品、Canvas、DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、PNG／PDF、成人向け境界、Desktop製品コードを変更していない。書込み・Provider実行・credit予約／消費0件。
- 次: commit・push・Draft PRを作成し、全CIとVercel Preview成功で停止する。Production修復、再集計、Pilot生成は個別承認前に実行しない。
- 詳細: `docs/RELEASE_CANDIDATE_ADOPTED_VISUAL_JUDGE_CONTINUITY_EVIDENCE_20260824.md`

---

## 2026-08-24 見た目の連続性・完全一致候補監査

- 状態: `IMPLEMENTED_LOCAL / ALL_LOCAL_GATES_PASSED / PRODUCTION_UNCHANGED / PROVIDER_NOT_CALLED`
- Base: PR #325 merge commit `6b3e70d`。Branch: `codex/audit-r4-3-visual-continuity`。
- 実装: 一貫性チェックへ、同一ページまたは隣接ページの採用中生成画像について、同一Asset IDまたは完全一致SHA-256だけをread-only目視確認候補として表示する。
- 安全境界: 既存の設定版・参照画像・割当履歴警告と分離し、警告数、完成判定、自動不採用、自動再生成、Provider、creditへ接続しない。perceptual similarityや推測閾値は導入しない。
- 検証: 集中6/6、deps error 0（既存warning 2件）、lint、全型検査、Hub 831/831、Canvas 26/26、AI 48/48、Desktop 182/182、migration 61件、Hub／Desktop build、`git diff --check`成功。
- 不変: Production、作品、Canvas、DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、PNG／PDF、成人向け境界、Desktop製品コードを変更していない。書込み・Provider実行・credit予約／消費0件。
- 次: commit・push・Draft PRを作成し、全CIとVercel Preview成功で停止する。Production修復、read-only再集計、Pilot生成は個別の明示承認前に実行しない。
- 詳細: `docs/RELEASE_CANDIDATE_VISUAL_CONTINUITY_EXACT_MATCH_REVIEW_20260824.md`

---

## 2026-08-24 Production人物連続性監査・残コマ生成計画

- 状態: `AUDITED_LOCAL / DOCUMENTED / PRODUCTION_UNCHANGED / PROVIDER_NOT_CALLED`
- Base: PR #324 merge commit `7f4ccf1fcc8226ce81881d81d1c5862a82ab8e08`。Branch: `codex/audit-r4-3-production-continuity`。
- PR #324: 基準ブランチへの反映を確認した。既存Production原稿は明示的な「追加生成なし修復」と保存を行うまで自動更新されない。
- 監査結果: 現行の一貫性チェックは設定版、参照画像ID、コマ割当、生成履歴を検査するが、画像ピクセル上の顔・衣装・背景一致や類似構図は判定しない。Visual Judgeの`continuityMatch`契約は存在するが、Production完成判定へ未接続である。
- 既知証跡: 2026-08-20時点で32ページ157コマ中13コマ配置、144コマ未配置、完成原稿1/32。22ページは画像4/4、必須セリフ1/1、revision 11/11、PNG成功だが、類似構図と人物・場面連続性の目視事項が残る。
- 計画: Production再集計後、連続2ページ・最大8〜12コマのPilotから開始し、合格後も4ページ単位を上限とする。各batch前後にcheckpoint、参照設定、credit予約、品質、PNGを確認する。
- 検証: 一貫性・Character Identity・Visual Judge境界の集中テスト23/23成功。`git diff --check`成功。
- 不変: Production、作品、Canvas、DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、PNG／PDF、成人向け境界、Desktopを変更していない。Provider実行・credit消費0件。
- 制約: 今回のProductionブラウザ再確認は接続が応答せず未実施。既知件数とcreditは次回実行前にread-onlyで再集計する。
- 次: 責任者がProduction 22ページの追加生成なし修復、read-only再集計、Pilot対象・最大creditを承認した後にのみ実行する。見た目の連続性自動判定は別PRで契約を監査する。
- 詳細: `docs/RELEASE_CANDIDATE_PRODUCTION_CONTINUITY_AND_REMAINING_GENERATION_PLAN_20260824.md`

---

## 2026-08-20 セリフ出力の可読性と完成判定

- 状態: `READY_FOR_OWNER_REVIEW / ALL_LOCAL_GATES_PASSED / INITIAL_CI_PASSED / PREVIEW_READY / PRODUCTION_READ_ONLY`
- Base: PR #323 merge commit `ea302207328faee8a647029cf528e55143f2b206`。Branch: `codex/fix-r4-3-dialogue-output-readability`。
- Production監査: `test`の既存22ページをread-only確認した。必須セリフ`（証拠を）`はCanvas上で42px縦書き・6列に分割され、横長吹き出し内で実用上読みにくかった。画像4/4、セリフ1/1、revision 11/11、PNG成功、credit使用80・予約0・残り20は維持している。
- 原因: Editorの`cqw`基準がCanvasではなくviewportになり、720px表示Canvasに対して文字が約1.78倍で描画された。また、短文を横長吹き出しでも縦書き優先にし、完成判定は文字列の存在だけを確認していた。
- 修正: Container Query基準をCanvas rootへ移す。6文字以下の短文は横長吹き出しなら24px以上の1行横書きを優先し、中央配置する。既存の短い複数列縦書きも明示修復時に同じ配置へ直す。完成判定へ`DIALOGUE_LAYOUT_UNREADABLE`を追加し、文字列が存在してもoverflowまたは短文の複数行・複数列なら販売原稿完成にしない。
- 不変: セリフ内容、既存Canvas schema、API、URL、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、PNG／PDF生成処理、成人向け境界、Desktop製品コードは変更しない。Production書込み・Provider実行・クレジット消費は0件。
- 検証: 集中53/53、deps error 0（既存warning 2件）、lint、全型検査、Hub 829/829、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。PNG fixtureでも32px横書き1行と出力寸法を確認した。RC外部設定Pendingは既存ローカル環境依存。
- Draft PR: [#324](https://github.com/team478a/manga/pull/324)はDraft／MERGEABLE。実装HEAD `fc4c77d`のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Preview: [Ready](https://mangai-hub-staging-git-codex-fix-r4-3-7d36ca-team478as-projects.vercel.app)。Production DB／Provider／creditへの操作なし。
- 次: 証跡同期後の最終HEADでも同じ5チェックを確認して停止する。責任者確認前にProductionの保存・修復や次タスクへ進まない。
- 詳細: `docs/RELEASE_CANDIDATE_DIALOGUE_OUTPUT_READABILITY_20260820.md`

---

## 2026-08-20 生成進捗と販売原稿完成の表示契約分離

- 状態: `READY_FOR_OWNER_REVIEW / ALL_LOCAL_GATES_PASSED / INITIAL_CI_PASSED / PREVIEW_READY / PRODUCTION_READ_ONLY`
- Base: PR #322 merge commit `176facb48568809b4bf5461247de498942dfc84a`。Branch: `codex/fix-r4-3-project-progress-completion-contract`。
- Production監査: 対象作品の「作品全体の生成進捗」は完成2/32ページと表示したが、完成原稿プレビューは完成1/32（3%）、未完成30、確認待ち1と判定した。画像配置は13/157コマ、原稿チェック要修正276件、creditは使用80・予約0・残り20。
- 原因: 生成進捗の`complete`は「表示対象コマの全てに画像Assetがある」だけを表し、必須セリフ、画像品質確認、revision、PNG、制作状態を含む販売原稿完成契約ではない。20ページは画像4/4でも4コマ全てが目視確認待ちで、完成原稿プレビューでは未完成だった。
- 修正: 生成進捗の状態名を`images_ready`へ変更し、画面の「完成」を「画像配置完了」へ改める。販売原稿としての完成判定は原稿プレビューで確認する案内を追加する。重い全ページPNG完成判定を作品画面へ重複追加しない。
- 目視品質: 22ページは技術的完成だが、吹き出し内のセリフが実用サイズで描画されず、下段2コマの構図重複と人物・場面連続性にも販売前確認が必要。20ページは4画像とも品質確認前で、短い縦書き1件の安全修復候補が残る。
- 不変: Production、DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF生成処理、成人向け境界、Desktop製品コードは変更しない。
- 検証: 集中9/9、deps error 0（既存warning 2件）、lint、全型検査、Hub 827/827、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。初回CIで100ページ受入れテストの旧集計名参照を検出し、`imageReadyPageCount`へ同期済み。RC外部設定Pendingは既存ローカル環境依存。
- Draft PR: [#323](https://github.com/team478a/manga/pull/323)はDraft／MERGEABLE。実装HEAD `d31b6e1`のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Preview: [Ready](https://mangai-hub-staging-6srpehoyl-team478as-projects.vercel.app)。Production DB／Provider／creditへの操作なし。
- 次: 証跡同期後の最終HEADでも同じ5チェックを確認して停止する。次PRは22ページの「セリフデータ上は配置済みだが出力上読めない」契約を最優先で修正し、その後に人物連続性と残り144コマの生成計画を分ける。
- 詳細: `docs/RELEASE_CANDIDATE_PROJECT_PROGRESS_COMPLETION_CONTRACT_20260820.md`

---

## 2026-08-20 PR #321 Production完成受入れ

- 状態: `PRODUCTION_ACCEPTANCE_PASSED / PAGE_COMPLETE / PNG_READY / CREDIT_UNCHANGED / AWAITING_PUBLISH_AUTHORIZATION`
- Base: PR #321 merge commit `c02fd0be0e9e1e9c7376801aa221c39fc068a1f9`。Branch: `codex/docs-r4-3-page-completion-production-acceptance`。
- Production反映: deployment `5995191657`がsuccess。URLは`https://mangai-hub-staging-k5fx0dv49-team478as-projects.vercel.app`。
- 限定操作: 責任者の明示承認後、`test`の既存22ページで「修正完了として再確認」を1回だけ実行した。`cloud_pages.production_status`は`revision_required`から既存契約の`review_required`へ遷移した。
- 結果: 完成バナーは「ページ完成」。画像4/4、セリフ1/1、生成中0、失敗0、保存revision 11／最新11、PNG成功を維持した。
- credit: 使用80、予約0、残り20で不変。Provider実行、追加Job、追加Asset、Canvas保存、追加課金は0件。
- ブラウザ: アプリ由来のerror／warningは0件。Chrome拡張由来の既知warningだけを確認し、製品障害には含めない。
- 不変: API、URL、DB schema、migration、RPC、Storage、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PNG／PDF処理、成人向け境界、Desktop製品コードを変更していない。
- 次: このProduction受入れ証跡のstage／commit／push／Draft PR作成は明示承認後に実施する。漫画品質の次課題は、完成22ページの販売原稿としての目視品質と作品全体32ページの完成率を分けて監査する。
- 詳細: `docs/RELEASE_CANDIDATE_PAGE_COMPLETION_PRODUCTION_ACCEPTANCE_20260820.md`

---

## 2026-08-20 ページ要修正を明示操作で再確認へ戻す

- 状態: `READY_FOR_OWNER_REVIEW / ALL_LOCAL_GATES_PASSED / INITIAL_CI_PASSED / PREVIEW_READY / PRODUCTION_UNCHANGED`
- Base: PR #320 merge commit `6095eadda7168a544118f080e154cb7b29bc0b84`。Branch: `codex/fix-r4-3-page-revision-review-action`。
- Production受入れ: PR #320のProduction反映後、`test`の既存22ページをread-only確認した。画像4/4、セリフ1/1、生成中0、失敗0、保存revision 11／最新11、PNG成功、credit使用80・予約0・残り20を維持し、完成阻害の唯一の表示理由が「ページ制作状態が『要修正』です。」であることを確認した。
- 原因: `cloud_pages.production_status=revision_required`が残っている。既存の長編制作管理には`revision_required`から`review_required`へ戻す操作があるが、対象22ページの編集画面からは到達しにくく、完成判定自身はこの状態を正しくfail-closedしていた。
- 修正: 完成条件を自動解除せず、阻害理由がページ要修正の場合だけ、編集画面の完成判定バナーに「修正完了として再確認」ボタンを表示する。既存の所有権検査済みrepositoryで`review_required`へ遷移し、同じページへ戻す。セリフ配置・候補採用由来の手動確認には表示しない。
- 不変: API、URL、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF処理、成人向け境界、Desktop製品コードを変更しない。
- 検証: 集中18/18、deps error 0（既存warning 2件）、lint、全型検査、Hub 827/827、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。RC外部設定Pendingは既存ローカル環境依存。
- Production: read-only確認だけ。作品、Canvas、DB、Storage、制作状態、Provider、creditへの書込み0件。
- Draft PR: [#321](https://github.com/team478a/manga/pull/321)はDraft／MERGEABLE。実装HEAD `85c53ad`のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Preview: [Ready](https://mangai-hub-staging-3bm8mokot-team478as-projects.vercel.app)。Vercel Authentication保護下であり、未認証HTTPはVercelログインへ正常に転送された。Production DB／Provider操作なし。
- 次: 証跡同期後の最終HEADでも同じ5チェックを確認して停止する。merge後は明示承認を得て対象ページのボタンを1回だけ操作し、ページ完成・PNG・credit不変を確認する。
- 詳細: `docs/RELEASE_CANDIDATE_PAGE_REVISION_REVIEW_ACTION_20260820.md`

---

## 2026-08-20 完成判定の手動確認理由を原因別に表示

- 状態: `IMPLEMENTED_LOCAL / ALL_LOCAL_GATES_PASSED / AWAITING_PUBLISH_AUTHORIZATION / PRODUCTION_UNCHANGED`
- Base: PR #319 merge commit `10f7b5c61efd755b405fb5f3a2c52861b2e74b3c`。Branch: `codex/fix-r4-3-completion-review-reasons`。
- Production受入れ: PR #319のProduction反映後に`test`の既存22ページを再読込した。画像4/4、セリフ1/1、生成中0、失敗0、保存revision 11／最新11、PNG成功、credit使用80・予約0・残り20を維持したが、編集画面はgenericな「自動配置結果に確認が必要です。」を残した。書込み・Provider実行・追加課金は0件。
- 監査結果: 完成判定の手動確認flagは、`cloud_page_dialogue_placements.status`、`cloud_pages.production_status`、`cloud_generation_panel_adoptions.status`の3系統をORし、同じ文言へ変換していた。セリフ配置はpage ID主キーで一意。通常のページ`review_required`は完成阻害ではなく、`revision_required`だけが阻害する。
- 修正: 完成条件を緩めず、セリフ配置確認、セリフ配置失敗、ページ制作状態の要修正、コマ画像候補採用確認を原因別メッセージとして返す。コマ由来の理由にはpanel／generation Jobの内部関連付けを維持する。
- 不変: API、URL、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF処理、成人向け境界、Desktop製品コードは変更しない。
- 検証: 集中18/18、deps error 0（既存warning 2件）、lint、全型検査、Hub 827/827、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。RC外部設定Pendingは既存ローカル環境依存。
- Production: read-only確認だけ。作品、Canvas、DB、Storage、品質記録、Provider、creditへの書込み0件。
- 次: stage／commit／push／Draft PR作成の明示承認後に公開し、全CIとVercel Preview成功で停止する。merge後に追加課金なしで対象22ページを再読込し、表示された原因だけを次の最小修正対象にする。
- 詳細: `docs/RELEASE_CANDIDATE_COMPLETION_REVIEW_REASONS_20260820.md`

---

## 2026-08-20 表示Assetの品質承認と完成判定の整合

- 状態: `READY_FOR_OWNER_REVIEW / ALL_LOCAL_GATES_PASSED / INITIAL_CI_PASSED / PREVIEW_READY / PRODUCTION_UNCHANGED`
- Base: PR #318 merge commit `f9316ea2b41c2ec97a20aef6f6fcd32bdbcf3864`。Branch: `codex/fix-r4-3-visible-asset-quality-completion`。
- Production受入れ: merge commitのVercel Production反映を確認後、`test`の既存22ページを再読込した。画像4/4、セリフ1/1、生成中0、失敗0、Canvas revision 11、PNG成功、credit使用80・予約0・残り20を維持したが、編集画面だけ「手動確認待ち」を残した。Production書込み・Provider実行・追加課金は0件。
- 原因: Asset IDによる品質承認照合は存在するが、`sourceJobId`を持たない表示layerを対象外にしていた。また表示Assetの生成元が最新Jobでない場合、その過去Jobを品質記録の取得対象へ含めていなかった。
- 修正: 現在表示中Assetを生成したJob IDも品質記録取得へ含め、Job IDまたはAsset IDで品質承認済みの表示layer／legacy `panel.imageAssetId`をコマ単位で認識する。非表示layerと未承認Assetは認識しない。
- 安全境界: 表示中の未承認生成画像、不採用画像、利用不能Asset、画像・セリフ不足、revision不一致、PNG失敗、制作状態要確認の既存guardは維持する。
- 不変: API、URL、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF処理、成人向け境界、Desktop製品コードを変更していない。
- 検証: 集中17/17、deps error 0（既存warning 2件）、lint、全型検査、Hub 826/826、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure成功。RC外部設定Pendingは既存ローカル環境依存。
- Draft PR: [#319](https://github.com/team478a/manga/pull/319)はDraft／MERGEABLE。初回HEAD `11fd4b7`のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Preview: [Ready](https://mangai-hub-staging-mng02lj4r-team478as-projects.vercel.app)。`/login`のタイトル、メール、パスワード、ログイン導線を確認し、エラー境界なし。Production DB／Provider操作なし。
- 次: 証跡同期後の最終HEADでも同じ5チェックを確認して停止する。merge前にProduction再生成・DB更新を行わない。merge後は対象22ページを追加課金なしで再読込する。
- 詳細: `docs/RELEASE_CANDIDATE_VISIBLE_ASSET_QUALITY_COMPLETION_20260820.md`

---

## 2026-08-20 表示中の品質承認済み画像と完成判定の整合

- 状態: `READY_FOR_OWNER_REVIEW / ALL_LOCAL_GATES_PASSED / INITIAL_CI_PASSED / PREVIEW_READY / PRODUCTION_UNCHANGED`
- Base: PR #317 merge commit `0538c4f4f3b4668f963220af3f45fd7f22e5ce83`。Branch: `codex/fix-r4-3-visible-reviewed-completion`。
- Production受入れ: merge commitのVercel Production反映を確認後、`test`の既存22ページを追加課金なしで再読込した。画像4/4、セリフ1/1、生成中0、失敗0、Canvas revision 11、PNG成功、credit使用80・予約0・残り20、ブラウザログ0件だが、編集画面だけ「手動確認待ち」を残した。
- 絞込み: 構造化セリフは`auto_placed`。長編制作状態の「確認が必要」filterにも22ページは含まれず、dialogue placementと`cloud_pages.production_status`は原因ではない。残る原因はpanel adoption完成判定だった。
- 原因: PR #317は同じ候補生成単位の品質承認だけを解決済みとしたが、現在Canvasに表示中の画像が別Job／Asset経路で品質承認されている場合、同じコマに残る非表示の古い`review_required`／`placement_failed`を解消できなかった。
- 修正: 現在Canvasで表示中かつ品質承認済みの生成画像をコマ単位で収集し、そのコマでは非表示の古い候補採用確認待ちを完成阻害にしない。表示中画像自体の品質承認・不採用・asset availability、画像／セリフ数、revision、PNG、制作状態の既存guardは維持する。
- 不変: API、URL、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF処理、成人向け境界、Desktop製品コードを変更していない。
- Production: 読取受入れだけ。作品、Canvas、画像、品質記録、DB、Storage、Provider、creditへの書込みは0件。
- 検証: 集中16/16、deps error 0（既存warning 2件）、lint、全型検査、Hub 825/825、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure成功。RC外部設定Pendingは既存ローカル環境依存。
- Draft PR: [#318](https://github.com/team478a/manga/pull/318)はDraft／MERGEABLE。初回HEAD `fbe59c5`のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Preview: [Ready](https://mangai-hub-staging-mez84eq7v-team478as-projects.vercel.app)。`/login`のタイトル、メール、パスワード、ログイン導線を確認し、エラー境界なし。Production DB／Provider操作なし。
- 次: 証跡同期後の最終HEADでも同じ5チェックを確認して停止する。merge前にProduction再生成・DB更新を行わない。merge後は対象22ページを追加課金なしで再読込し「ページ完成」を確認する。
- 詳細: `docs/RELEASE_CANDIDATE_VISIBLE_REVIEWED_COMPLETION_20260820.md`

---

## 2026-08-20 品質承認済み候補の完成判定整合

- 状態: `READY_FOR_OWNER_REVIEW / ALL_LOCAL_GATES_PASSED / INITIAL_CI_PASSED / PREVIEW_READY / PRODUCTION_UNCHANGED`
- Base: PR #316 merge commit `1cc2151996451d15ea00e7f9c8ab151939c33194`。Branch: `codex/fix-r4-3-selected-adoption-completion`。
- 監査結果: Productionの対象22ページは、構造化セリフが`auto_placed`、ページ一覧が「完成」、採用画像2件が品質確認済みである一方、編集画面だけ「手動確認待ち」を表示していた。
- 原因: 品質承認・採用は`cloud_manga_quality_logs`へ記録されるが、同じ候補生成単位の`cloud_generation_panel_adoptions.status`には過去の`review_required`／`placement_failed`が残る。完成判定が後者を無条件に優先し、採用済み候補の兄弟候補まで未確認扱いにしていた。
- 修正: 同じ候補生成単位に品質承認済みかつ不採用でない候補が1件あれば、その生成単位の古いadoption確認待ちは解決済みと判定する。承認候補が不採用の場合、未確認の兄弟候補がある場合、全候補不採用の場合を回帰テストで固定した。
- 不変: API、URL、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF処理、成人向け境界、Desktop製品コードを変更していない。
- Production: 読取監査だけ。作品、Canvas、画像、品質記録、DB、Storage、Provider、creditへの書込みは0件。
- 検証: 集中15/15、deps error 0（既存warning 2件）、lint、全型検査、Hub 824/824、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。RC外部設定Pendingは既存ローカル環境依存。
- Draft PR: [#317](https://github.com/team478a/manga/pull/317)はDraft／MERGEABLE。実装HEAD `e3f80a8`のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Preview: [Ready](https://mangai-hub-staging-qht1tbga3-team478as-projects.vercel.app)。`/login`のタイトル、メール、パスワード、ログイン導線を確認し、ブラウザログ0件。Production DB／Provider操作なし。
- 次: 証跡同期後の最終HEADでも同じ5チェックを確認して停止する。merge前にProduction再生成・DB更新を行わない。merge後は対象22ページを再読込し、編集画面が「ページ完成」になることを追加課金なしで確認する。
- 詳細: `docs/RELEASE_CANDIDATE_SELECTED_ADOPTION_COMPLETION_20260820.md`

---

## 2026-08-20 PR #315 Production受入れ

- 状態: `PRODUCTION_ACCEPTANCE_PASSED / PROVIDER_REJECTION_RESOLVED / PAGE_IMAGES_COMPLETE / ALL_CI_PASSED / PREVIEW_READY / MANUAL_REVIEW_REMAINS`
- Base: PR #315 merge commit `09a3bfddc476d5a37f8821f2ec6cc767f531d9a3`。Branch: `codex/docs-r4-3-provider-layout-production-acceptance`。
- Production反映: merge commitのVercel Production deploymentがReadyであることを確認し、`test`の既存22ページを再読込した。開始時はCanvas revision 10、画像3/4、セリフ1/1、生成中0、失敗1、PNG成功、credit使用78・予約0・残り22。
- 限定受入れ: 修正前に作成されたコマ2の元失敗Jobを1件だけ、PR #315の最初の一般向け安全再構成で再実行した。安全再構成済みの旧失敗Jobは選ばず、第2段階retryへ進めていない。
- Worker: [Cloud AI Worker scheduler run 32313830268](https://github.com/team478a/manga/actions/runs/32313830268)を`mode=run`で1回実行し成功した。先行run `32313790385`は既定の設定確認だけで、Provider通信・Job処理なし。
- 結果: BFL `flux-2-pro`で画像1件が完成し、Provider moderation拒否は再発しなかった。画像は正立、疑似文字・ロゴなし、販売原稿チェック4項目を目視確認して品質承認・コマ2へ採用した。
- 保存・出力: Canvas revision 10→11、画像4/4、セリフ1/1、生成中0、失敗0、PNG成功。プレビューで4コマすべての画像表示を確認し、ブラウザログは0件。
- credit: 使用78→80、予約0、残り22→20。追加Jobは登録していない。
- 残存確認: ページ一覧は22ページを「完成・画像配置4/4」と表示する一方、編集画面の完成バナーは「手動確認待ち／自動配置結果に確認が必要」と表示する。採用画像2件は品質確認済みで、画像・保存・PNG契約は成立している。次はread-onlyで残存statusのsourceを特定し、推測修正しない。
- 不変: API、DB schema、migration、RPC、Storage設定、Feature Flag、Provider、model、pricing、retry回数、timeout、Scheduler、Canvas schema、PNG／PDF処理、成人向け境界、Desktop製品コードを変更していない。Production変更は再試行Job1件、生成Asset1件、品質記録、コマ2採用、Canvas revision 11、credit 2のみ。
- Draft PR: [#316](https://github.com/team478a/manga/pull/316)はDraft／MERGEABLE。初回HEAD `9f70280`のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Preview: [Ready](https://mangai-hub-staging-2hg5soz33-team478as-projects.vercel.app)。`/login`のタイトル、メール、パスワード、ログイン導線を確認し、ブラウザログ0件。Production DB／Provider操作なし。
- 次: 証跡同期後の最終HEADでも同じ5チェックを確認して停止する。責任者確認前に追加Provider実行を行わず、手動確認待ちの原因監査を次工程とする。
- 詳細: `docs/RELEASE_CANDIDATE_PROVIDER_MODERATED_LAYOUT_20260820.md`

---

## 2026-08-20 不採用画像修復後の自動再読込loop修正

- 状態: `READY_FOR_OWNER_REVIEW / ALL_CI_PASSED / PREVIEW_READY / PRODUCTION_REPAIR_SAVED`
- Base: PR #313 merge commit `f9f2b544fe0ffc0cc5c23064097ccce089f1073d`。Branch: `codex/fix-r4-3-rejected-reload-loop`。
- Production受入れ: deployment `641F4jYmhK19GWyKbxmDw4zkLo9M`がReady／Productionであることを確認し、`test`の対象22ページで「既存原稿を修復」を1回実行した。不採用画像3件と逆転背景2コマを修復し、Canvasはrevision 8から9へ保存、PNG成功。残りcreditは24のままで追加生成・追加課金0件。
- 修復結果: 不採用画像の警告は消え、ページは画像2/4、生成中0、失敗1の未完成状態へ安全に戻った。コマ1・2は画像未配置となり、販売可能な完成ページとしては扱われない。
- 追加阻害: 不採用Jobは履歴上`panel_adoption_status=auto_placed`を保持するため、Canvasからlayerを外した後も自動反映effectが未読込画像と誤認し、約3秒ごとの再読込とedit lock確認を繰り返した。Runtime Logsではpage-lock POSTは200で、DB／RPC障害ではない。
- 修正: 自動反映の再読込候補から`quality_review_status=rejected`を除外する。不採用履歴、Canvas修復、完成guard、通常のauto placementは維持する。
- 不変: DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF処理、成人向け境界、Desktop製品コードを変更しない。
- 検証: 集中18/18、deps error 0（既存warning 2件）、lint、Hub／Desktop typecheck、Hub 821/821、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。RC外部設定Pendingは既存ローカル環境依存。
- Draft PR: [#314](https://github.com/team478a/manga/pull/314)。初期HEAD `c53baed`のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Preview: [Ready](https://mangai-hub-staging-git-codex-fix-r4-3-6d2c28-team478as-projects.vercel.app)。`/login`の表示、タイトル、入力欄を確認し、ブラウザエラー・警告は0件。Productionデータへの操作は行っていない。
- 次: 本PRのmerge前にProduction再生成を行わない。merge後、対象22ページを再読込してloop停止を確認し、明示承認済みのProduction Provider検査として不足コマだけを生成する。
- 詳細: `docs/RELEASE_CANDIDATE_REJECTED_RELOAD_LOOP_20260820.md`

---

## 2026-08-20 既存原稿の明示修復と背景描画順修正

- 状態: `READY_FOR_OWNER_REVIEW / ALL_CI_PASSED / PREVIEW_READY / PRODUCTION_UNCHANGED`
- Base: PR #312 merge commit `54d621ddb06c58e5753842e54afd6698ee171917`。Branch: `codex/fix-r4-3-existing-manuscript-repair`。
- Production受入れ: PR #312の現行deploymentが`app.mang-ai.com`へ割当済みであることを確認し、`test`の対象22ページを再読込した。不採用画像を完成扱いにしないguardは有効だが、merge前から保存済みの不採用layer、短い縦書き2列、逆転した背景layer順は自動変更されず残っていた。
- 修正: 編集者本人の明示操作で、不採用済みJob由来layerの除去、6文字以下の既存縦書きの1列化、安全に日時を比較できる逆転背景stackの並べ替えを1回のUndo可能なCanvas変更として行う。個別の不採用画像にも追加生成なしの除去ボタンを出す。
- 将来生成: 新しい背景候補は旧背景より前面、人物・小物・効果・補正より背面へ配置する。不採用layer除去後の`panel.imageAssetId`は残存する最前面の表示可能背景へ戻す。
- 安全境界: ページ読込時には自動変更しない。日時欠損・同値の背景順は推測修復しない。本文、座標、領域、Canvas schema、DB、migration、RPC、Storage、API、URL、Provider、model、pricing、credit、retry、timeout、Scheduler、PNG／PDF、成人向け境界、Desktop製品コードを変更しない。
- 検証: 集中60/60、deps error 0（既存warning 2件）、lint、全型検査、Hub 820/820、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。RC外部設定Pendingは既存環境依存。
- Production変更: 読取確認だけ。対象作品、Canvas、画像、Storage、Provider、credit、DBへの書込みは0件。
- Draft PR: [#313](https://github.com/team478a/manga/pull/313)はDraft／MERGEABLE。実装HEAD `b334502`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。
- Preview: [Ready](https://mangai-hub-staging-git-codex-fix-r4-3-322148-team478as-projects.vercel.app)。対象ページへの直URLは認証境界で`/login`へ遷移し、未認証保護が正常に動作した。Production DBへ接続する修復操作は実行していない。
- 次: 本証跡同期HEADでも同じ5チェックを確認して停止する。merge後に対象ページで本人が「既存原稿を修復」を明示実行し、保存・再読込・完成判定・PNGを確認する。
- 詳細: `docs/RELEASE_CANDIDATE_EXISTING_MANUSCRIPT_REPAIR_20260820.md`

---

## 2026-08-19 Production原稿の不採用画像・短い縦書き品質修正

- 状態: `READY_FOR_OWNER_REVIEW / ALL_CI_PASSED / PREVIEW_READY / PRODUCTION_UNCHANGED`
- Base: PR #311 merge commit `29744d3a720ce6c270face0b29768b746b33f239`。Branch: `codex/fix-r4-3-production-text-quality`。
- 利用者報告: Production作品の22ページで、画像内に混入した不要文字が残り、Canvasの短い縦書き「証拠を」も2列へ不自然に分割されていた。
- 原因1: 生成候補を不採用にしても品質記録だけが更新され、既にCanvasへ採用済みのlayerは残っていた。
- 原因2: 6文字以下の短い縦書きも「overflowしない最大font」を選んでいたため、少し縮小すれば1列になる文が2列のまま採用された。
- 修正: 不採用操作時に該当Job由来layerをCanvasから外し、直前の表示可能背景へ戻す。不採用Jobのlayerが残るページは完成不可とする。短い縦書きは可読下限内で1列を優先し、既存の不自然な短文2列も販売前検査で停止する。
- 不変: DB、migration、RPC、Storage、API、URL、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF処理、成人向け境界、Desktop製品コード、Production作品を変更していない。
- 検証: 集中55/55、deps error 0（既存warning 2件）、lint、Hub型検査、Hub全件、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。
- Draft PR: [#312](https://github.com/team478a/manga/pull/312)はDraft／MERGEABLE。実装HEAD `156ccb2`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。
- Preview: [Ready](https://mangai-hub-staging-git-codex-fix-r4-3-bbdcdb-team478as-projects.vercel.app)。`/login`は正常表示、error boundaryとconsole errorは0件。
- 次: 最終証跡同期HEADでも同じ5チェックを確認して停止する。merge前にProduction作品を修正しない。merge後に対象22ページで不採用、保存、短文再配置、完成判定、PNGを実機確認する。
- 詳細: `docs/RELEASE_CANDIDATE_PRODUCTION_TEXT_QUALITY_20260819.md`

---

## 2026-08-19 Production品質フィードバック保存復旧

- 状態: `READY_FOR_OWNER_REVIEW / ALL_CI_PASSED / PRODUCTION_ACCEPTANCE_PASSED / DATABASE_ROW_VERIFIED / PR_311_DOCS_ONLY`
- Base: PR #310 merge commit `5752227219cd87f2b77cdbe5fe306fb91972a3cc`。Branch: `codex/fix-production-quality-feedback-schema-fallback`。
- Production受入れ: `test`でダッシュボード、作品、22ページ原稿を確認した。原稿画像は48/48 imgが読込成功、broken 0、704x1024で、Canvas上の4コマ画像も目視確認した。Sharp／libvips障害は再発していない。
- 原因: Production DBだけ既存migration `202608020002_cloud_general_monitor_quality_feedback.sql` が未反映だった。適用前は品質列0/15だが後続の運用列9/9、rate-limit function／triggerは存在しており、アプリの完全形式INSERTとlegacy fallbackがともに400になっていた。
- 復旧: 正本に存在する未変更migrationをProductionへ適用した。適用後は品質列15/15、target／quality index、target constraint、owner INSERT policyを確認した。migration SQLのSHA-256は`2179278741D34E86FDDC407AA09FA7EE08483B96031DF560937B8DCFDF842132`。
- 実機保存: Productionの既存コードで品質評価を1回保存し、画面の成功表示とDB行`72665ec0-8093-410b-a5a3-1ca4efae761e`を照合した。`page / needs_revision / image_quality / minor`、page 22、generation_count 28、panel null、コメント一致。
- PR #311: 原因が部分schema互換ではなくmigration未適用と確定したため、中間fallback実装と専用テストを撤回した。差分は復旧証跡文書のみ。
- Production変更: 既存migrationの適用と検証用フィードバック1行の追加のみ。作品、画像、Provider、credit、Storage、RPC、API、Canvas、PNG／PDF、成人向け境界、Desktopは変更していない。画像生成とcredit消費は行っていない。
- Draft PR: [#311](https://github.com/team478a/manga/pull/311)はDraft／MERGEABLE。Core quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。
- 次: 責任者確認待ち。追加のProduction送信、PR merge、次工程へは進まない。

---

## 2026-08-19 Production Sharp Runtime復旧

- 状態: `READY_FOR_OWNER_REVIEW / ALL_CI_PASSED / PREVIEW_RUNTIME_RECOVERED / PRODUCTION_UNCHANGED`
- Base: PR #309 merge commit `27f29fec96104ca60dd736f2c9781ab09dcb8b50`。Branch: `codex/fix-production-sharp-runtime`。
- 障害: Production deploymentで`/login`を含む主要Routeが500。Vercel Runtime LogsはLinux x64版Sharpの`libvips-cpp.so.8.18.3`不足による`ERR_DLOPEN_FAILED`を示した。
- 修正: Next.js output file tracingへ既存の`@img/sharp-linux-x64@0.35.3`と`@img/sharp-libvips-linux-x64@1.3.2`を明示する。Sharp version、画像処理契約、Providerは変更しない。
- 回帰防止: trace設定、lockfile version、Linux x64 package解決を検査するHub testを追加した。Linux package配置build simulationではApp Router 110/110 traceにnative bindingとlibvipsの両方を確認した。
- 検証: deps error 0、lint、全型検査、Hub 811/811、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。既知warning／外部Pendingは差分外。
- 不変: Production、DB、migration、RPC、Storage、API、URL、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF、成人向け境界、Desktop製品コードは変更していない。
- Draft PR: [#310](https://github.com/team478a/manga/pull/310)はDraft／MERGEABLE。最終実装HEAD `bf13659`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。
- Preview: [Ready](https://mangai-hub-staging-mcbdzcerp-team478as-projects.vercel.app)。`/login`、`/works`、`/sales-packages`、`/`は200、500は0件。Runtime LogsにSharp／libvips errorは0件。
- CI補正: 初回Core qualityはpackage rootを解決する回帰テストの誤検査だけが失敗。公開subpathのnative binding／libvips binaryを解決する形へ修正し、再実行で成功した。
- 次: 最終証跡同期HEADの5チェックを再確認して停止する。責任者のmerge前にProductionを変更しない。merge後はProductionの主要Route、原稿画像、品質フィードバック保存、Runtime Logsを確認する。
- 詳細: `docs/RELEASE_CANDIDATE_PRODUCTION_SHARP_RUNTIME_20260819.md`

---

## 2026-08-19 原稿未生成表示・品質フィードバック保存阻害修正

- 状態: `READY_FOR_OWNER_REVIEW / INITIAL_CI_PASSED / PRODUCTION_UNCHANGED`
- Base: PR #308 merge commit `24da38c8632d3f36cf364bf616f3af668322cd4a`。Branch: `codex/fix-r4-3-monitor-manuscript-blockers`。
- 利用者報告: 原稿編集画面がコマ枠・吹き出し・文字だけで画像を表示せず、同じ画面の品質フィードバックも繰り返し保存失敗する。
- 原稿表示: 画像未生成のネームを完成原稿のように見せない。画像なしコマについて、未生成／生成中／失敗／生成済み配置確認待ちを画面上部へ表示し、作品画面の4〜8ページ一括画像生成へ直接移動できるようにした。Provider呼出しやcredit消費は利用者の明示操作なしに開始しない。
- 評価保存: caller-scopedのページ読込、作品・ページ一致、コマ存在、生成Job読込を先に完了した後、一般モニター報告と同じserver-only infrastructure repositoryで保存する。利用者RLSの二重評価へ依存せず、旧schema列不足時の既存fallbackは維持する。
- 不変: DB、migration、RPC、Storage、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF、成人向け境界、Desktop製品コード、Productionデータは変更していない。
- 検証: 集中6/6、deps error 0、module boundaryは既存2 warningのみ、lint、Hub型検査、Hub 810/810、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub build、diff check成功。
- Draft PR: [#309](https://github.com/team478a/manga/pull/309)はDraft／MERGEABLE。初回HEAD `a0701c5`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。Previewは[Ready](https://mangai-hub-staging-git-codex-fix-r4-3-babd9e-team478as-projects.vercel.app)。
- 次: 証跡同期後の最終HEADでも同じ5チェックを確認して停止する。merge前にProduction評価保存や有料画像生成を実行しない。
- 詳細: `docs/RELEASE_CANDIDATE_MONITOR_MANUSCRIPT_BLOCKERS_20260819.md`

---

## 2026-08-19 PR-R4-3A-15 Production Panel Rollout Guard

- 状態: `FEATURE_FLAG_ON / BATCH_ACTIVE_BUT_NOT_STARTED / ASSIGNMENTS_0 / RESPONSES_0 / FORMAL_COUNT_0`
- Base: PR #307 merge commit `5f37817c681b6a8592aee4d5c485b09c46dd1606`。Branch: `codex/docs-r4-3a15-production-panel-rollout`。
- Production: `MANGAI_MONITOR_QUALITY_REVIEW_ENABLED=true`をProductionだけへ設定し、deployment `FyCvjRpzXDuxsTKq9yU5S5Ntv91U`がReady、`app.mang-ai.com`割当済みであることを確認した。
- 原因確認: Reviewer A=`test`の割当操作は、`batch_private_01`の予定開始が2026-08-20 00:00 JSTのため、正本どおりINSERT前に拒否された。DB重複、migration、trigger、権限の不具合ではない。Productionのassignmentは0件のまま。
- 修正: 開始前・終了後のBatchでは割当フォームを表示せず、日本時間の開始日時を案内する。Server Actionは期間外エラーと一意制約エラーを別メッセージにする。開始前割当拒否契約は維持する。
- 割当予定: A=`test`、B=`青木隆康`、C=`なっかん`、D=`加藤周星`、E=`松浦周平`。2026-08-20 00:00 JST以降に管理画面から順番に割り当てる。
- 不変: Batch期間、DB、migration、RPC、Storage、画像、作品、Canvas、Provider、credit、API、URL、PNG／PDF、成人向け境界、Desktopは変更しない。
- 検証: 集中11/11、deps error 0、lint、全型検査、Hub 808/808、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。Draft PR、CI、Vercel Previewを確認して停止する。
- CI補正: PR #308初回Core qualityは描画中の`Date.now()`をReact purity ruleが拒否して失敗した。repositoryの同一読込時刻`loadedAt`を返して固定判定へ変更し、lint・全型検査・集中11/11を再確認した。
- 詳細: `docs/RELEASE_CANDIDATE_R4_3A15_PRODUCTION_PANEL_ROLLOUT.md`

---

## 2026-08-18 PR-R4-3A-14 Production Panel Migration Acceptance

- 状態: `PRODUCTION_MIGRATION_APPLIED / TARGET_REVIEWERS_5 / ASSIGNMENTS_0 / RESPONSES_0 / FEATURE_FLAG_OFF / FORMAL_COUNT_0`
- Base: PR #306 merge commit `a390091d590146b7a3f2496763ac2c0118e453ce`。Branch: `codex/docs-r4-3a14-production-panel-migration`。
- 実施: Production project `vmdsyxykcrgxcdbrwlkv`へ既存migration `202608180002_cloud_monitor_quality_review_panel`を改変せず1回適用した。
- 事前確認: Benchmarkテーブルあり、panel migration未適用、`batch_private_01`はactive、`PILOT_INTRINSIC_ONLY`、画像28、assignment 0、response 0。
- 事後確認: `target_reviewer_count=5`、画像28、assignment 0、response 0。目標外slot拒否関数とtriggerが存在し、`authenticated`からの関数直接実行権限はない。
- 不変: Feature Flag off、担当割当0、回答0、正式Benchmark 0/140。作品、Canvas、Storage object、Provider、credit、API、URL、PNG／PDF、成人向け境界、Desktopは変更していない。
- 画面確認: Production管理画面の新規タブは認証セッションが共有されずログイン画面へ戻った。DB受入れは完了し、管理画面表示確認だけを次工程へ持ち越す。
- 検証: deps error 0、lint、全型検査、Hub 806/806、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。既知warning／外部Pendingは差分外。
- Draft PR: [#307](https://github.com/team478a/manga/pull/307)はDraft／MERGEABLE。初回HEAD `dc51874`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。Previewは[Ready](https://mangai-hub-staging-if8el55ia-team478as-projects.vercel.app)。
- 次: 最終証跡同期HEADでも同じ5チェックを確認して停止する。責任者確認とProduction管理画面表示確認前にFeature Flag、モニター割当、Human Review、R4-3Bへ進まない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_3A14_PRODUCTION_PANEL_MIGRATION.md`

---

## 2026-08-18 PR-R4-3A-13 Multi-Reviewer Panel

- 状態: `READY_FOR_OWNER_REVIEW / ALL_CI_PASSED / PRODUCTION_UNCHANGED / FORMAL_COUNT_0`
- Base: PR #305 merge commit `8ae9beaa334c0621f80fc30d72527a7a031bfa8e`。Branch: `codex/feat-r4-3a13-multi-reviewer-panel`。
- 目的: 1名ずつではなく複数の招待モニターへ同じ28画像を独立割当し、判定の信頼性と進行速度を高める。
- 契約: 既定5名、Batchごとに2〜9名。Primary Reviewer A/Bは既存`mangai-human-review-v2`を維持し、Panel C〜Iは`mangai-human-review-panel-v1`へ分離する。
- Guard: 同一人物と同一slotの重複を拒否し、Batch目標人数を超えるslotをapplicationとDB triggerでfail closedにする。管理一覧は回答payloadを取得しない。
- UI: 管理画面の各active Batchへ、目標人数、割当済み人数、未割当slot、未割当の有効モニターを表示する。
- Production: `batch_private_01`はactive、画像28枚、assignment 0、response 0、Feature Flag off。migration適用、Flag変更、割当、回答、作品変更は実施していない。
- 検証: 集中17/17、deps error 0、lint、全型検査、Hub 806/806、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。既知warning／外部Pendingは差分外。
- Draft PR: [#306](https://github.com/team478a/manga/pull/306)はDraft／MERGEABLE。初回HEAD `252fe55`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。Previewは[Ready](https://mangai-hub-staging-git-codex-feat-r4-57ac78-team478as-projects.vercel.app)。
- 次: 最終証跡同期HEADでも同じ5チェックを再確認して停止する。責任者確認前にProduction migration、Feature Flag、担当割当、R4-3Bへ進まない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_3A13_MULTI_REVIEWER_PANEL.md`

---

## 2026-08-18 PR-R4-3A-12 Production Batch Activation Acceptance

- 状態: `PRODUCTION_BATCH_ACTIVE / CASES_28 / ASSIGNMENTS_0 / RESPONSES_0 / FEATURE_FLAG_OFF / FORMAL_COUNT_0`
- Base: PR #304 merge commit `0c6f8f9e6d380334d6605ad78ed11f64925fada8`。Branch: `codex/docs-r4-3a12-production-batch-activation`。
- 実施: 責任者によるPR #304のmergeと管理者ログイン確認後、Productionの`/admin/general-monitors/quality-review`で`batch_private_01`を検査付きで1回だけ有効化した。
- 事前確認: `draft`、画像28枚、担当割当0件、Feature Flag停止中を画面で確認した。Server Actionはscope、元package SHA-256、人間の権利確認、未失効期間、画像28枚、割当0件を再検査して成功した。
- 事後確認: 成功表示「Batchを有効化しました」、状態`active`、画像28枚、担当者未割当を確認した。Feature Flagは停止中で、割当ボタンは無効のまま。
- 不変: assignment 0、response 0、Human A/B 0/56、正式Benchmark 0/140。Production作品、Canvas、Provider、credit、DB schema、migration、RPC、Storage、API、URL、PNG／PDF、成人向け境界、Desktopは変更していない。
- Draft PR: [#305](https://github.com/team478a/manga/pull/305)はDraft／MERGEABLE。初回HEAD `a5cab7ca4c6a7264856ef6ad0fe2e6d78fdc2f55`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。Previewは[Ready](https://mangai-hub-staging-git-codex-docs-r4-836d87-team478as-projects.vercel.app)。
- 次: 本Docs-only Draft PRの全CIとVercel Preview確認後に停止する。責任者がReviewer AのProduction表示名と、Aとは異なるReviewer Bを指定するまでFeature Flagを有効化せず、担当割当、Human Review、R4-3Bへ進まない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_3A12_PRODUCTION_BATCH_ACTIVATION.md`

---

## 2026-08-18 PR-R4-3A-11 Controlled Batch Activation

- 状態: `READY_FOR_OWNER_REVIEW / ALL_CI_PASSED / PRODUCTION_UNCHANGED / FORMAL_COUNT_0`
- Base: PR #303 merge commit `03fe58c9fc22631d15407bf1fd82b77039bbfcb2`。Branch: `codex/feat-r4-3a11-controlled-batch-activation`。
- 目的: Productionの`batch_private_01`を手動SQLではなく、管理者画面から事前条件を再検査して安全に有効化／停止／再開できるようにする。
- Guard: `draft`、`PILOT_INTRINSIC_ONLY`、元package SHA-256、人間の権利確認、未失効期間、画像28枚、既存割当0件をfail closedで検査する。状態更新は取得時の旧状態が一致する場合だけ成功する。
- Feature Flag: 停止中でもBatch検査は可能だが、Reviewer割当は無効。有効化だけではモニター画面へ公開されない。
- 不変: Production Batchは`draft`、assignment 0、response 0、Feature Flag off、Human A/B 0/56、正式Benchmark 0/140。DB、migration、RPC、Storage、API、URL、作品、Canvas、Provider、credit、PNG／PDF、成人向け境界、Desktopの外部契約は変更していない。
- 検証: 集中4/4、deps、lint、Hub／Desktop型検査、Hub 801/801、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 60本、Hub／Desktop build、RC structure、diff check成功。既知module warning 2件とRC外部Pendingは差分外。
- Draft PR: [#304](https://github.com/team478a/manga/pull/304)はDraft／MERGEABLE。初回HEAD `07a8b8cb26366558bb9852d64ecc7780a1c5b851`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。Previewは[Ready](https://mangai-hub-staging-git-codex-feat-r4-c7e6e3-team478as-projects.vercel.app)。最終証跡同期HEADでも同じ5チェックを再確認して停止する。
- 次: 責任者確認前にProduction有効化、Flag変更、A/B割当、R4-3Bへ進まない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_3A11_CONTROLLED_BATCH_ACTIVATION.md`

---

## 2026-08-18 PR-R4-3A-10 Production Draft Acceptance

- 状態: `PRODUCTION_DRAFT_ADMITTED / PRIVATE_IMAGES_28_VERIFIED / ASSIGNMENTS_0 / FEATURE_FLAG_OFF / FORMAL_COUNT_0`
- Base: PR #302 merge commit `2da179c1b4c5534cf6eee182caeede773c932c7a`。Branch: `codex/docs-r4-3a10-production-draft-acceptance`。
- 方針: 責任者承認によりStaging専用Supabaseを追加せず、既存ProductionのBenchmark専用境界へ権利確認済み28画像を非公開`draft`として登録した。
- Migration: `202608180001_cloud_monitor_quality_review`をProductionへ適用。private bucket、4テーブル、RLS 4/4、専用RPC 3/3、`anon`／`authenticated`直接テーブル権限0を確認した。
- Batch: `batch_private_01`、`draft`、`PILOT_INTRINSIC_ONLY`、期間2026-08-20 00:00 JST〜2026-09-20 00:00 JST、source package SHA-256一致。
- 検証: case 28、private Storage 28、assignment 0、response 0。Storageから28画像を再取得し、DB記録のSHA-256と28/28一致、不一致0件を確認した。
- ローカル品質: Benchmark回帰5/5、migration 60本、dependency／module boundary error 0、lint、RC structure、diff check成功。既知warning 2件は差分外。
- 秘密境界: Production secret keyは現在の処理内だけで使用し、画面、stdout、環境ファイル、Gitへ保存せず、使用後にクリップボードを消去した。
- 不変: active化、A/B割当、Feature Flag、通常作品、Canvas、公開Storage、Provider、model、pricing、credit、API、URL、PNG／PDF、成人向け境界、Desktopは変更していない。正式Benchmarkは0/140、Human A/Bは0/56。
- Draft PR: [#303](https://github.com/team478a/manga/pull/303)はDraft／MERGEABLE。初回HEAD `4c2f6c6c2c77d8884a433b7d658a9a8c0ee2fba0`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。Previewは[Ready](https://mangai-hub-staging-git-codex-docs-r4-5a9ce0-team478as-projects.vercel.app)。最終証跡同期HEADでも同じ5チェックを再確認して停止する。
- 停止条件: 責任者確認前にactive化、A/B割当、Feature Flag有効化、R4-3Bへ進まない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_3A10_PRODUCTION_DRAFT_ACCEPTANCE.md`

---

## 2026-08-18 PR-R4-3A-9 Production Draft Admission

- 状態: `READY_FOR_OWNER_REVIEW / ALL_CI_PASSED / PRODUCTION_APPLY_NOT_RUN / FORMAL_COUNT_0`
- Base: `feature/manga-canvas-mvp` merge commit `8650c12ba9009652cebc00e9cb8247807e1c4b2c`（PR #301マージ済み）。Branch: `codex/feat-r4-3a9-production-draft-admission`。
- 方針: 責任者判断によりStaging専用Supabaseは準備しない。権利確認済み28画像をProduction内のBenchmark専用テーブル／private bucketへ非公開`draft`としてだけ登録できる入口を作る。
- 安全境界: 既定dry-run、専用Production秘密値、project ref／Batch code／固定確認句の三重確認、非上書きupload、Batch `draft`、`PILOT_INTRINSIC_ONLY`、割当0件を強制する。登録後はDB件数とStorage再取得画像のSHA-256を検証し、失敗時は当該Batchだけcleanupする。
- 不変: 通常作品、Canvas、公開Storage、active化、A/B割当、Feature Flag、DB schema、migration、RPC、API、Provider、credit、PNG／PDF、成人向け境界、Desktop。
- 外部状態: Production DB／Storageへのapplyは未実施。Human権利確認28/28、モニターA/B 0/56、正式Benchmark 0/140。
- 検証: 実package Production dry-runは28件で`PRODUCTION_BATCH_ADMISSION_READY`、外部変更0件。集中5/5、deps、lint、型検査、Hub 797/797、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、Hub／Desktop build、migration 60本、RC structure、diff check成功。
- Draft PR: [#302](https://github.com/team478a/manga/pull/302)はDraft／MERGEABLE。実装HEAD `e6e87d7ebf59cb95b19898a2432ce9a613d8a538`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。Previewは[Ready](https://mangai-hub-staging-pmolc68ia-team478as-projects.vercel.app)。最終証跡同期HEADでも同じ5チェックを再確認して停止する。
- 次: 責任者確認後にProductionのmigration／private bucket／管理者profile ID／対象期間をread-only確認し、28件dry-runを経て別途明示承認後にだけapplyする。
- 詳細: `docs/RELEASE_CANDIDATE_R4_3A9_PRODUCTION_DRAFT_ADMISSION.md`

---

## 2026-08-18 Benchmark Batch 01 匿名権利確認受入れ

- 状態: `HUMAN_RIGHTS_REVIEW_COMPLETE / DRY_RUN_PASSED / STAGING_CONFIGURATION_REQUIRED / STAGING_NOT_CHANGED / FORMAL_COUNT_0`
- Base: `feature/manga-canvas-mvp` merge commit `47fe03d3ecbe90f1fd45f7708bc49423cc17fd57`（PR #300マージ済み）。Branch: `codex/docs-r4-3a-rights-review-acceptance`。
- Human確認: 責任者が28画像を確認し、確認者名を公開・保存しない方針で`anonymous`として全権利確認項目を承認した。品質判定Reviewer A/BのログインプロフィールIDは既存契約どおり内部識別にだけ使用し、氏名入力を要求しない。
- 完了package: Git外private rootへ元ZIPを保持したまま別名で作成。`--require-complete`で28/28、Provider規約、Benchmark評価用途、顧客／Production素材不使用、個人情報なし、成人向けなし、PNG、SHA-256、寸法、Content Credentials、重複なしを確認した。package SHA-256は`05cf95e530d6ff699ade2a1237c882eb518281e15b9dcfb74f99a120f8a7ff59`。
- dry-run: `batch_private_01`、28件で`STAGING_BATCH_ADMISSION_READY`。DB、Storage、Productionはいずれも変更なし。
- 検証: 関連回帰4/4、dependency／module boundary、lint、diff check成功。module boundaryの既知warning 2件は今回差分外。
- 外部状態: staging専用URL、service role、staging project ref、Production project refの4設定は現在の実行環境に未設定。推測や一般Supabase環境変数へのfallbackを行わず、`--apply`は未実施。
- 現在: Human権利確認28/28、モニターA/B 0/56、正式Benchmark 0/140。staging／Production取込0件。
- Draft PR: [#301](https://github.com/team478a/manga/pull/301)はDraft／MERGEABLE。Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。Previewは[Ready](https://mangai-hub-staging-git-codex-docs-r4-661158-team478as-projects.vercel.app)。
- 次: staging専用4設定、実在する管理者profile ID、対象期間、migration適用先を確認後に、明示したstaging project refだけへapplyする。取込後もBatchは`draft`で停止し、DB件数、private bucket、SHA-256確認前にactive化・A/B割当を行わない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_3A_RIGHTS_REVIEW_ACCEPTANCE.md`

---

## 2026-08-18 PR-R4-3A-8 Review Batch Admission

- 状態: `READY_FOR_OWNER_REVIEW / ALL_CI_PASSED / HUMAN_RIGHTS_REVIEW_REQUIRED / STAGING_NOT_CHANGED / FORMAL_COUNT_0`
- Base: `feature/manga-canvas-mvp` merge commit `2ab608b799c1c8092adad589fc0ae2df3d664bd6`（PR #299マージ済み）。Branch: `codex/feat-r4-3a8-review-batch-admission`。
- 目的: 権利未確認画像をモニターHuman Reviewへ登録できないようにし、人間が全件承認した28画像だけをstagingへ安全に取込めるようにする。
- 実装: 既存rights package構造検査を再利用可能なlibraryへ分離し、`--require-complete`で確認者、日時、Provider規約、Benchmark利用、顧客／Production作品不使用、個人情報なし、成人向けなし、全件approvedを必須化した。
- 取込: 既定dry-run、28件、package／画像SHA-256、PNG、寸法、Content Credentialsを再検査する。`--apply`はstaging専用URL／service role／project refと明示確認の一致、Production project ref不一致を必須にし、private bucketへ非上書きuploadする。失敗時はStorageとDBをcleanupし、成功時もBatchは`draft`で停止する。
- 不変: Production、既存作品、DB schema、migration、RPC、RLS、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、runtime Judge、自動修復、Canvas、PNG／PDF、成人向け境界、Desktop。
- 現在: Human権利確認0/28、モニターA/B 0/56、正式Benchmark 0/140。staging／Production取込0件。
- 検証: 集中15/15、deps、lint、Hub型検査、Hub 796/796、Canvas 26/26、AI 48/48、migration 60本、研究評価、Cloud漫画repository、owner isolation、100ページ4/4、Webpack Hub build、RC structure、diff check成功。通常Turbopackは既知Windows path lengthで停止。Desktop typecheck／test／a11y／buildは差分外のローカル`@napi-rs/keyring`型宣言不足で停止し、GitHub Windows CIを正式判定にする。
- Draft PR: [#300](https://github.com/team478a/manga/pull/300)はDraft／MERGEABLE。Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。Previewは[Ready](https://mangai-hub-staging-git-codex-feat-r4-e9ad91-team478as-projects.vercel.app)。最終証跡同期HEADでも同じ5チェックを再確認する。
- 停止条件: Draft PR、全CI、Vercel Preview後に停止する。完了rights package受領前にstaging applyせず、責任者確認・A/B完了前にProduction登録とR4-3Bへ進まない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_3A8_REVIEW_BATCH_ADMISSION.md`

---

## 2026-08-18 PR-R4-3A-7 Monitor Review Portal

- Base: `feature/manga-canvas-mvp` merge commit `d154895cc04e198a60090ae4c74ea90ed1e7299b`（PR #298マージ済み）。Branch: `codex/feat-r4-3a7-monitor-review-portal`。
- 目的: 招待済みモニターがBenchmark専用画像をスマートフォンから独立Human Reviewし、管理者がA/Bの割当と進捗を確認できるようにする。
- 実装: 専用fail-closed Flag、private Storage、本人限定RPC、同意、下書き自動保存／再開、1画像確定、最終送信、管理者のA/B別人割当と進捗表示を追加する。
- Blind契約: 正解label、AI監査、他Reviewer回答、Prompt、source group／family、splitを利用者画面と管理進捗queryへ含めない。既存`mangai-human-review-v2`の判定規則を再利用する。
- 安全境界: 顧客作品、Production作品、モニター作品、権利未確認画像を使用しない。private Batch 01は人間の権利確認完了まで登録しない。
- Production: DB、Storage、作品、Provider、creditを変更していない。migrationとFlagは未適用。
- 検証: 集中13/13、deps、lint、Hub型検査、Hub 792/792、Canvas 26/26、AI 48/48、migration 60本、Webpack Hub build、RC structure、diff check成功。通常Turbopackは既知Windows path length、Desktop typecheck／test／a11y／buildは差分外のローカル`@napi-rs/keyring`型宣言不足で停止し、GitHub CIで正式判定する。
- Draft PR: [#299](https://github.com/team478a/manga/pull/299)はDraft／MERGEABLE。実装HEAD `f213ff4`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。Previewは[Ready](https://mangai-hub-staging-git-codex-feat-r4-377b35-team478as-projects.vercel.app)。最終証跡同期HEADでも同じ5チェックを再確認する。
- 停止条件: Draft PR、全CI、Vercel Previewを確認して停止する。責任者確認、権利確認、staging受入れ前にProduction登録とR4-3Bへ進まない。

---

## 2026-08-17 PR-R4-3A-6 Secure Human Review Transfer

- 状態: `READY_FOR_OWNER_REVIEW / ALL_CI_PASSED / ENCRYPTED_PACKAGES_READY / OUTBOUND_NOT_SHARED / HUMAN_REVIEW_REQUIRED / FORMAL_COUNT_0`
- Draft PR: [#298](https://github.com/team478a/manga/pull/298)（Draft／MERGEABLE）
- Vercel Preview: [Ready／SSO保護](https://mangai-hub-staging-mb4xx3i63-team478as-projects.vercel.app)
- Branch: `codex/feat-r4-3a6-secure-review-transfer`
- Base: `origin/feature/manga-canvas-mvp`@`ba9b31a`（PR #296 merge commit）。
- 目的: 権利確認者とHuman Reviewer A/Bへprivate ZIPを安全に渡すため、パスフレーズを別経路で共有できる自己完結型暗号化HTML封筒を追加する。
- 暗号契約: PBKDF2-HMAC-SHA-256 310,000回、16-byte random salt、AES-256-GCM、12-byte random IV、128-bit tag、version／元ZIP SHA-256／byte lengthをAADへ束縛する。パスフレーズは24文字以上、ファイル入力限定で、画面・ログ・receipt・Gitへ出さない。
- Blindness: 外向けHTMLとreceiptは中立名だけを使い、Reviewer slot、package ID、元ファイル名、Prompt、label、source metadataを平文へ含めない。slot対応はGit外のprivate mappingだけへ保存する。
- Fail closed: 元Human Review ZIP／private sidecarまたは権利確認ZIPを暗号化前に検証し、recipient role不一致、短い／誤ったパスフレーズ、改ざん、SHA不一致、既存出力上書きを拒否する。解除画面はCSP `connect-src 'none'`で外部通信を禁止する。
- Private実物: 権利確認、Reviewer A、Reviewer Bの各28件を別パスフレーズで暗号化した中立HTML 3件をローカルprivate rootへ生成。全3件を復号し、元ZIP SHA-256、package version、28件構造の一致を確認した。外部upload／共有は0件。
- 検証: 集中3/3、実権利package validator 28件、実暗号化／復号3/3、dependency／module boundary、lint、Hub型検査、Hub 784/784、Canvas 26/26、AI 48/48、migration 59本、Webpack Hub build、RC structure preflight、diff check成功。通常Turbopackは既知Windows path lengthで停止。ローカル`file://`のブラウザ操作はBrowser安全ポリシーで停止し、迂回せず受領端末確認へ残す。
- CI: 実装HEAD `1a06e46`のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。最終証跡同期HEADでも同じ5チェックを再確認する。
- 不変: Production、既存作品、DB、migration、RPC、RLS、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、runtime Judge、自動修復、Canvas、checkpoint、PNG／PDF、成人向け境界、Desktop。
- 現在の不足: 配布先の個人指定、HTMLとパスフレーズの別経路共有、受領スマートフォンでの復号確認、人間の権利確認0/28、独立Human Review 0/56、不一致裁定。正式Benchmarkは0/140。
- 次: 最終HEADの全CI成功後、責任者確認まで停止する。責任者が受取人と2つの共有経路を指定するまで外部送信せず、R4-3Bへ進まない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_3A6_SECURE_REVIEW_TRANSFER.md`

---

## 2026-08-17 PR-R4-3A-5 Mobile Offline Human Review

- 状態: `MERGED / ALL_CI_PASSED / MOBILE_OFFLINE_PACKAGE_READY / SECURE_TRANSFER_PENDING / HUMAN_REVIEW_REQUIRED / FORMAL_COUNT_0`
- PR: [#296](https://github.com/team478a/manga/pull/296)（マージ済み、merge commit `ba9b31ad7cbe731870fd1edab2f7eb01206c92fc`）
- Vercel Preview: [Ready／SSO保護](https://mangai-hub-staging-pzf49iulq-team478as-projects.vercel.app)
- Branch: `codex/feat-r4-3a5-mobile-offline-review`
- Base: `origin/feature/manga-canvas-mvp`@`f9aff56`（PR #297 merge commit）を通常mergeで取り込み済み。
- 目的: Reviewer A/Bのprivate ZIPを展開し、スマートフォン幅のブラウザで候補画像を確認、判定、確信度、欠陥、コメントを入力し、既存`mangai-human-review-v2`回答JSONを端末へ保存できるオフラインUIを追加する。
- 安全境界: `review.html`はCSPで外部通信を禁止し、外部script／画像／CSSを持たない。正解ラベル、相手の回答、AI監査、Prompt、source group／family、split、URL、秘密値を含めない。回答下書きは端末内だけに保存する。
- 後方互換: `review_ui`は既存v2 packageでoptional。新規generatorだけが`mangai-mobile-offline-review-v1`を追加し、既存CLI response validator／A/B比較schemaは変更しない。
- Private package: Batch 01のReviewer A/Bを各28件で再生成し、package validator、private sidecar、label leakage 0、Reviewer A leakage 0、C2PA `caBX`保持に成功。外部公開・外部Storage uploadは行っていない。
- UI検証: 390×844 viewportで28ケース全件を操作し、画像表示、前後移動、独立確認、下書き、全件回答、28-record JSON生成を確認した。テスト入力はHuman Review結果として保存・採用していない。
- 現在の不足: private ZIPをスマートフォンへ渡す安全な経路は未決定。人間の権利確認0/28、独立Human Review 0/56、正式Benchmark 0/140。AIはHuman Reviewerを代替しない。
- 不変: Production、既存作品、DB、migration、RPC、RLS、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、runtime Judge、自動修復、Canvas、checkpoint、PNG／PDF、成人向け境界、Desktop。
- 検証: 集中16/16、実A/B各28件package validator、390×844で28ケース全件操作、dependency、lint、Hub型検査、Hub 781/781、Canvas 26/26、AI 48/48、migration 59本、Webpack Hub build、RC structure preflight成功。通常Turbopackは既知Windows path length、Desktop typecheck／test／a11y／buildは差分外の既知`@napi-rs/keyring`型宣言不足でローカル停止し、GitHub CIで正式判定する。
- CI復旧: 期限契約を決定的時計で検査するPR #297を通常mergeしたHEAD `d3dc0d8`で、Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsがすべて成功。期限切れで失敗していたLinux／WindowsのDesktop契約は復旧した。最終証跡同期HEADでも同じ5チェックを再確認する。
- 次: 責任者のPR #296確認まで停止する。安全な配布経路とHuman Reviewer A/Bの割当てが決まるまでR4-3Bへ進まない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_3A5_MOBILE_OFFLINE_REVIEW.md`

---

## 2026-08-17 PR-R4-3A-5 prerequisite: Desktop期限契約の決定的時計

- 状態: `MERGED / ALL_CI_PASSED / PRODUCTION_FAIL_CLOSED_UNCHANGED`
- PR: [#297](https://github.com/team478a/manga/pull/297)（マージ済み、merge commit `f9aff56666731f25a1c678d65a080c15b7da46ae`）
- Vercel Preview: [Ready／SSO保護](https://mangai-hub-staging-qpkmz2lp4-team478as-projects.vercel.app)
- Branch: `codex/fix-desktop-expired-clock-contracts`
- Base: `origin/feature/manga-canvas-mvp`@`f989d61`（PR #295 merge commit）。
- 背景: PR #296のCore quality／Windows buildが再実行を含め同じDesktop 4テストで失敗した。2026-08-17 00:00 UTCに既存`DEZGO_PRICING_VALID_UNTIL`とテスト用成人Provider policyが同時失効し、壁時計へ依存した成功系fixtureがfail-closedへ変わったことが原因。
- 実装: `AIService`のDezgo費用判定へoptionalな時計を注入し、成人Provider policy状態取得／適用へoptionalな基準時刻を追加する。該当4テストだけが契約有効期間内の固定日時を明示する。本番呼出しは省略するため従来どおり実時刻を使う。
- 不変: Dezgo価格値、pricing version、有効期限、Provider、model、adult policy payload、署名検証、実行許可、fail-closed、DB schema、migration、API、IPC、Production、Storage、Canvas、PNG／PDF、credit。
- 検証: 費用guard 1/1、署名policy 1/1、dependency／module boundary、lint、Hub型検査、Hub 778/778、Canvas 26/26、AI 48/48、migration 59本、Webpack Hub build、RC structure preflight成功。Desktopローカルは既知`@napi-rs/keyring`型宣言不足とElectron／better-sqlite3 native binary不在で停止し、GitHub Linux／Windows CIを正式判定とする。
- CI: 実装HEAD `b458395`のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。Linux／Windows双方でDesktop 182/182を確認した。最終証跡同期HEADでも同じ5チェックを再確認する。
- 次: PR #296へ通常mergeで取り込み、同PRの全CIを再確認する。R4-3Bへ進まない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_3A5_DESKTOP_CLOCK_CONTRACT.md`

---

## 2026-08-17 PR-R4-3A-4 follow-up: Benchmark Content Credentials保全

- 状態: `READY_FOR_OWNER_REVIEW / PRIVATE_FIXTURE_REPAIRED / HUMAN_RIGHTS_AND_DUAL_REVIEW_REQUIRED / FORMAL_COUNT_0`
- Draft PR: [#295](https://github.com/team478a/manga/pull/295)（Draft／MERGEABLE）
- Vercel Preview: [Ready](https://mangai-hub-staging-git-codex-fix-r4-3-336c71-team478as-projects.vercel.app)
- Branch: `codex/fix-r4-3a4-benchmark-provenance`
- Base: `origin/feature/manga-canvas-mvp`@`c6bce94`（PR #294 merge commit）。
- 発見: 正式候補Batch 01のProvider原PNG 28/28にC2PA `caBX`があったが、最初の再エンコード正規化で除去されていた。原画像を保持していたため追加Provider実行・追加課金なしで復旧した。
- Private復旧: Content Credentialsなしの画像、validation report、A/B ZIPをquarantineへ隔離し、原PNGへ戻した。契約適用後のReviewer A/B ZIPは各28件、`caBX` 28/28、validator、checksum、blindness、private sidecar検査に成功した。権利確認用packageも28件作成した。
- 実装: private source case／assembly itemへ`required_provenance_chunks`を追加し、現版では`caBX`だけを許可する。review package生成、package検証、正式assemblyの全入口で必須chunk欠落を拒否する。未指定fixtureは`[]`で後方互換を維持する。
- 費用: Batch 01は承認済み28枚、840,000 micros（0.84米ドル）のまま。今回の復旧ではProviderを呼び出していない。
- 検証: 集中22/22、実A/B package validator、`caBX` 28/28、dependency／module boundary、lint、Hub型検査、Hub 778/778、Canvas 26/26、AI 48/48、migration 59本、Webpack Hub build、RC structure preflight成功。通常Turbopackは既知Windows path length、Desktop typecheck／test／a11y／buildは差分外の既知`@napi-rs/keyring`型宣言不足でローカル停止し、GitHub CIで正式判定する。
- CI: 実装HEAD `7389b67`のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。Windows CIではDesktop TypeScript、tests、Accessibility、unpacked application buildも成功。最終証跡同期HEADでも同じ5チェックを再確認する。
- 正式件数: 0/140。人間の権利確認0/28、独立Human Review 0/56、不一致裁定未実施。機械検査だけで正式採用しない。
- 不変: Production、既存作品、DB、migration、RPC、RLS、Storage、API、URL、Feature Flag、Provider設定、model、pricing、credit、retry、timeout、Scheduler、runtime Judge、自動修復、Canvas、checkpoint、PNG／PDF出力、成人向け境界、Desktop。
- 次: 最終証跡同期HEADの全CI／Vercel Preview成功を確認して停止する。責任者確認、人間の権利確認、Human A/B完了前に正式140件へ加算せず、R4-3Bへ進まない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_3A4_CONTENT_CREDENTIALS.md`

---

## 2026-08-17 PR-R4-3A-4 Reviewer Package Context / Schema Hardening

- 状態: `READY_FOR_OWNER_REVIEW / PILOT_PACKAGE_STRUCTURE_READY / PILOT_INTRINSIC_ONLY / NOT_COUNTED_IN_FORMAL_BENCHMARK`
- Draft PR: [#294](https://github.com/team478a/manga/pull/294)（Draft／MERGEABLE）
- Vercel Preview: [Ready](https://mangai-hub-staging-git-codex-fix-r4-3-0772e8-team478as-projects.vercel.app)
- Branch: `codex/fix-r4-3a4-review-package-context-schema`
- Base: `origin/feature/manga-canvas-mvp`@`61fcaf3`（PR #293 merge commit。PR #291／#292を含む）。
- 範囲: Candidate Visual BenchmarkのHuman Reviewを`intrinsic_only`／`referential`へ分離し、同一schemaで独立したHuman A/B reviewを行えるpackage generator、package／response validator、A/B比較を追加する。R4-3B、runtime Judge、自動修復は進めない。
- 監査結果:
  1. 正式v2.1のケースIDは`img_0001`、Reviewer ZIP内は中立な`case_000001`とし、対応表をprivate sidecarへ保持する。
  2. Referentialの`intended.json`は既存`panelSpecificationSchema`を直接再利用し、Production UUIDだけを中立UUIDへ変換する。
  3. 人物同一性はCharacter Identityへbindingされた人物参照画像がある場合だけ選択可能にする。
  4. 詳細Human defect categoryはruntime enumと分離し、正式Benchmark 7値への明示mappingだけを持つ。直接対応しない項目は`null`で自動昇格しない。
  5. AI監査は`reviewer_kind: ai_audit`の別schemaで、Human A/Bを代替しない。
  6. source group／family／character／reference group／splitはZIPへ入れずprivate sidecarへ保持し、同一source familyのdev／holdout分割を拒否する。
- 実装: Human response v2、verdict／confidence／severity／bbox、mode別category、Panel Specification／reference binding、blind ZIP、source sidecar、checksum、no-overwrite generator、package／response validator、A/B agreement／adjudication reportを追加した。
- Pilot: 既存12画像を上書きせず、`reviewer-a-r4-3a4.zip`と`reviewer-b-r4-3a4.zip`へ再生成した。両方12件、`PILOT_INTRINSIC_ONLY`、formal eligible=false、labelなし、private sidecar検証成功。Human回答は入力していない。
- Pilot SHA-256: Reviewer A `37A49366223C7582F73BD559C25D9466329E591EA55EC5DCBA4977482C622A64`、Reviewer B `1D908A5FC4EA92AB6ABE01452B800B1602A04971A688A8A2C75FAB4E2F2821BC`。
- 検証: 集中20/20、Hub 776/776、Canvas 26/26、AI 48/48、dependency／module boundary、lint、Hub型検査、59 migration／rollback、research eval、Cloud漫画repository、owner isolation、workspace packages、Webpack Hub build、RC structure preflight、diff check成功。実Pilot A/B validator成功。通常Turbopackは既知Windows path length、Desktop typecheck／test／a11y／buildは差分外の既知`@napi-rs/keyring`型宣言不足でローカル停止し、GitHub CIで正式判定する。
- 現在の正式Benchmark不足: 0/140、独立Human review 0/280、adjudication未実施。今回の12件を正式140件へ加算しない。
- 不変: Production、DB、migration、RPC、RLS、Storage、Provider、model、pricing、credit、Scheduler、runtime Visual／Panel Judge、repair engine、Canvas、checkpoint、PNG／PDF、公開販売、成人向け境界、Desktop。
- CI: 実装／PR同期HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。最終証跡同期HEADでも同じ5チェックを再確認して停止する。
- 次: 責任者確認まで停止する。正式Human ReviewやR4-3Bへ進まない。
- 詳細: `docs/quality-benchmark-human-review.md`、`docs/RELEASE_CANDIDATE_R4_3A4_REVIEW_PACKAGE_HARDENING.md`

---

## 2026-08-16 PR-R4-3A-3 Benchmark v2.1 Fixture Assembly

- 状態: `READY_FOR_OWNER_REVIEW / BLOCKED_FIXTURE_SHORTAGE / BLOCKED_HUMAN_REVIEW`
- Draft PR: [#293](https://github.com/team478a/manga/pull/293)（Draft／MERGEABLE）
- Vercel Preview: [Ready／SSO保護](https://mangai-hub-staging-git-codex-feat-r4-87ad37-team478as-projects.vercel.app)
- Branch: `codex/feat-r4-3a3-benchmark-assembly`
- Base: `origin/feature/manga-canvas-mvp`@`3f121f5`（PR #292 merge commit。PR #291 merge commit `355ebfd`を含む）。
- 範囲: Candidate Visual Benchmark 140件を、権利確認、禁止コンテンツ確認、二重review、family単位のdev／private holdout分離、漏洩検査を通して組み立てるローカル専用基盤。Visual Judge、runtime判定、自動修復、Providerは変更しない。
- 監査結果:
  1. PR #291の`ok / unknown / not_evaluated` Evidenceとprovider-neutral Visual Judgeを維持する。
  2. PR #292のBenchmark v2.1 schemaを正本とし、4桁の中立ID `img_0001`を維持する。今回指示の6桁表記は中立名の例であり、既存schema変更指示とは扱わない。
  3. strict入口は`npm run manga:quality:benchmark:strict`、不足時は`BLOCKED_FIXTURE_SHORTAGE`で非0終了する。
  4. checkerは`tests/fixtures/manga-quality/tools/bench_leak_check_v2_1.py`、現行SHA-256は`3FB2030AAC0884D8051BE45B98F48A5725D7850CDD47A62805E7F865B97213E0`。
  5. `manifest.json`はversion、dataset、candidate suite、split、review version、Production-native profiles、画像ID／path／SHAだけを持つ。
  6. `cases.json`はlabelを持たないpublic入力で、candidate、judge mode、profile、refs、intendedだけを持つ。
  7. `labels.private.json`はevaluator-onlyで、verdict、defects、2名以上のreviewer、review日時を持つ。
  8. image profileは実Production pipelineの幅・高さをmanifestに固定し、upscaleや背景色でlabelを分けない。
  9. intendedのsource of truthは既存`panelSpecificationSchema`で、独自互換schemaを作らない。
  10. Benchmark defectは7値／6群。runtime failure schemaへ意味の違う項目を強制変換しない。
  11. 件数契約はdev 48／48／16、private holdout 12／12／4、合計good 60／bad 60／borderline 20。
  12. v1 evidenceは`overall=false`のnegative controlで、v2.1正式画像へ流用しない。
  13. dev、holdout、旧assets、`.env*`はgitignore対象。private labels、review、権利資料、画像をGitへ入れない。
  14. ローカルfixture root環境変数は未実装だったため、今回追加対象とする。既定値は後方互換のignored rootに限定する。
- 現在の不足: 権利確認済み実画像0/140、独立review 0/280、adjudication未実施。ダミー、顧客、Production、モニター、v1画像では補完しない。
- 不変: Production、DB、migration、RPC、RLS、Storage、既存作品、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas、checkpoint、PNG／PDF、成人向け境界、Desktop。
- 実装: ローカルroot、収集／権利／review台帳、AI review拒否、第三者adjudication、family split、exact／near duplicate、合意率／kappa、no-overwrite assembly、共通preflight／leak rootを追加した。
- 検証: 集中7/7、Hub 763/763、Canvas 26/26、AI 48/48、長編4/4、dependency／module boundary、lint、Hub型検査、59 migration／rollback、research eval、Cloud漫画repository、owner isolation、workspace packages／Webpack build、diff check成功。assemblyとv2.1 non-strictは正常に不足を報告し、strictは期待どおり終了コード1。TurbopackはWindows path length、Desktop 3ゲートは差分外の既知`@napi-rs/keyring`型宣言不足でローカル停止。
- CI: 実装HEAD `e10b1c0`のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。最終文書同期HEADでも同じ5チェックを再確認する。
- 次: 最終HEADのCI／Preview成功後、責任者レビューまで停止する。画像収集、Production、Provider、R4-3Bへ進まない。
- 詳細: `docs/quality-benchmark-assembly.md`、`docs/RELEASE_CANDIDATE_R4_3A3_BENCHMARK_ASSEMBLY.md`

---

## 2026-08-16 PR-R4-3A2 Benchmark v2.1契約修正

- 状態: `READY_FOR_OWNER_REVIEW / BLOCKED_FIXTURE_SHORTAGE / BLOCKED_SKLEARN`
- Draft PR: [#292](https://github.com/team478a/manga/pull/292)（Draft／MERGEABLE）
- Vercel Preview: [確認済み](https://mangai-hub-staging-git-codex-fix-r4-3-7f4fb4-team478as-projects.vercel.app)
- Branch: `codex/fix-r4-3a2-benchmark-v2-1-contract`
- Base: `origin/feature/manga-canvas-mvp`@`355ebfd`（PR #291 merge commit）。
- 実装: public casesとprivate labels、devとprivate holdoutを分離し、140件の厳密構成、Production-native profile、SHA／PNG metadata／Panel Specification／review／重複／shortcutの検査契約へ更新した。意味の異なるfailure強制mappingを廃止した。
- Evidence: 旧v1検査は`overall=false`のnegative control。旧v1実画像は添付なしで再現不能。v2.1画像は0/140で、strict受入れは未完了。
- 不変: Production、既存作品、DB、migration、RPC、RLS、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas、checkpoint、PNG／PDF、成人向け境界、Desktop。
- 検証: 集中14/14、Hub 755/755、Canvas 26/26、AI 48/48、長編4/4、dependency／module boundary、lint、Hub型検査、59 migration／rollback、research eval、Cloud漫画repository、owner isolation、Python syntax、workspace packages／Webpack build、diff check成功。添付checkerのSHA-256一致。非strict preflightは正常に不足を報告し、strictとleak acceptanceは実画像不足で期待どおり停止。TurbopackはWindowsパス長、Desktop 3ゲートは差分外の既知`@napi-rs/keyring`型宣言不足でローカル停止。初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。最終文書同期HEADでも同じ5チェックを再確認する。
- 次: 最終文書同期HEADのCI／Preview成功を確認して責任者レビューまで停止する。140画像・二重review・private holdout・scikit-learn acceptanceが揃うまでR4-3Bへ進まない。
- 詳細: `docs/quality-engine-benchmarks.md`、`docs/RELEASE_CANDIDATE_R4_3A2_BENCHMARK_V2_1.md`

---

## 2026-08-16 PR-R4-3A 漫画品質ベンチマーク基盤

- 状態: `READY_FOR_OWNER_REVIEW / BLOCKED_FIXTURE_SHORTAGE`
- Draft PR: [#291](https://github.com/team478a/manga/pull/291)（Draft／MERGEABLE）
- Vercel Preview: [確認済み](https://mangai-hub-staging-git-codex-feat-r4-c36bff-team478as-projects.vercel.app)
- Branch: `codex/feat-r4-3a-quality-benchmark`
- Base: `origin/feature/manga-canvas-mvp`@`75eb858`（PR #290 merge commit）。
- 実装: 未評価を75／100へ補完しないEvidence契約、provider-neutral Visual Judge境界、30〜50画像fixture schema、readiness／hash／寸法preflight、精度・coverage・Judge費用・遅延の集計を追加した。既存runtime Judgeは変更していない。
- 監査: 現行ルールJudge、Panel Specification、Candidate順位、品質DB／RPC／RLS、操作ログ、BFL inpainting／outpainting、VLM／embedding／OCR候補を文書化した。
- Blocker: 権利確認済み正解付き実画像0/30、採用可能0/15、主要6不良群はいずれも0/5。Production作品を転用せず、推測値や架空画像で精度を報告しない。
- 不変: Production、既存作品、DB、migration、RPC、RLS、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas、checkpoint、PNG／PDF、成人向け境界、Desktop。
- 検証: 集中8/8、Hub 750/750、Canvas 26/26、AI 48/48、長編4/4、dependency／module boundary、lint、Hub型検査、59 migration／rollback、research eval、Cloud漫画repository acceptance、owner isolation、workspace packages／Webpack build、diff check成功。fixture preflightは正常に不足を報告。TurbopackはWindowsパス長、Desktop 3ゲートは差分外の既知`@napi-rs/keyring`型宣言不足でローカル停止し、GitHub CIで正式判定する。
- CI: 初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsがすべて成功。最終文書同期HEADでも同じ5チェックを再確認する。
- 次: 責任者確認まで停止する。責任者がfixture、外部送信、検証予算、Judge採用条件を承認するまでPR-R4-3Bへ進まない。
- 詳細: `docs/quality-engine-benchmarks.md`、`docs/RELEASE_CANDIDATE_R4_3A_QUALITY_BENCHMARK.md`

---

## 2026-08-16 PR-R4-2AG 正方向だけのProvider安全再構成

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#290](https://github.com/team478a/manga/pull/290)（Draft／MERGEABLE）
- Vercel Preview: [確認済み](https://mangai-hub-staging-git-codex-fix-r4-2-b9d25a-team478as-projects.vercel.app)
- Branch: `codex/fix-r4-2ag-positive-only-safe-retry`
- Base: `origin/feature/manga-canvas-mvp`@`7cb9f02`（PR #289 merge commit）。
- Production受入れ: ページ22・コマ1の最新失敗Jobを1件だけ再実行した。Worker [31932216482](https://github.com/team478a/manga/actions/runs/31932216482)は`requests=2 processed=1`で成功。Creditは使用76／予約0／残24 → 予約2／残22 → 使用76／予約0／残24へ全額復元。
- 結果: 再実行Jobも`provider_moderation_blocked`、Assetなし、Provider課金0。追加再実行、追加生成、候補採用、Canvas配置なし。Canvas revision 8、PNG、公開・販売状態は不変。
- 原因: 第1段階安全再構成の正方向Promptに、禁止対象を「避ける」という説明と携帯品・ポケット表現が残り、positive promptだけを送るBFLへ直接渡っていた。
- 実装: 通常生成から端末位置anchorも除外し、人物・背景の相対配置、自然な衣服、手、画面外への視線だけへ変換する。第1・第2段階安全再構成も穏やかな描写だけで構成し、旧版第1段階Jobを後方互換で第2段階へ変換する。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、retry回数、timeout、Scheduler、Canvas、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- 検証: 集中54/54、Hub 742/742、Canvas 26/26、AI 48/48、依存境界、lint、Hub型検査、59 migration／rollback、research eval、100ページfixture、Cloud漫画repository acceptance、owner isolation、package／Next.js build、diff check成功。RC preflightはstructure ready。Desktop 3ゲートは差分外の既知の`@napi-rs/keyring`型宣言不足でローカル停止し、GitHub Windows buildで正式判定する。
- CI: 初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsが成功。Windows CIではDesktop test、Accessibility、Windows application buildも成功。
- 次: 最終文書同期HEADでも同じ5チェックを確認し、責任者レビューまで停止する。merge前にProduction追加生成・再実行を行わない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2AG_POSITIVE_ONLY_SAFE_RETRY.md`

---

## 2026-08-16 PR-R4-2AF moderation安全な衣服表現

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#289](https://github.com/team478a/manga/pull/289)
- Vercel Preview: [確認済み](https://mangai-hub-staging-git-codex-fix-r4-2-b509b2-team478as-projects.vercel.app)
- Branch: `codex/fix-r4-2af-moderation-safe-garment-cue`
- Base: `origin/feature/manga-canvas-mvp`@`713bb47`（PR #288 merge commit）。
- Production受入れ: ページ22・コマ1で2候補を1回だけ生成した。Worker [31930333853](https://github.com/team478a/manga/actions/runs/31930333853)は`requests=3 processed=2`で成功。Creditは使用76／予約0／残24 → 予約4／残20 → 使用76／予約0／残24へ全額復元。
- 結果: 2 Jobとも`provider_moderation_blocked`、Assetなし、Provider課金0。失敗Job再実行、追加生成、候補採用、Canvas配置なし。Canvas revision 8、PNG、公開・販売状態は不変。
- 原因: PR #288の限定差分で追加した`concealed prop`が曖昧な危険物表現として解釈された可能性が最も高い。安全再実行も端末・表示面語を再導入していた。
- 実装: 端末・画面・UI・`concealed`を使わず、胸ポケットの縫い目、自然な布のふくらみ、手の位置と視線だけで表現する。通常生成と第1・第2段階安全再実行へ共通適用する。Promptは2,000文字未満。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、retry回数、timeout、Scheduler、Canvas、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- 検証: 集中53/53、Hub 741/741、Canvas 26/26、AI 48/48、依存境界、lint、Hub型検査、59 migration／rollback、research eval、100ページfixture、Cloud漫画repository acceptance、owner isolation、package／Next.js build、diff check成功。RC preflightはstructure ready。Desktop 3ゲートは差分外の既知の`@napi-rs/keyring`型宣言不足でローカル停止し、GitHub Windows buildで判定する。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsが成功。
- 次: 責任者レビューとmergeを待って停止する。merge前にProduction追加生成・再実行を行わない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2AF_MODERATION_SAFE_GARMENT_CUE.md`

---

## 2026-08-16 PR-R4-2AE 端末を直接描かず編集要素を分離

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#288](https://github.com/team478a/manga/pull/288)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-aq6n206s3-team478as-projects.vercel.app
- Branch: `codex/fix-r4-2ae-concealed-prop-overlay`
- Base: `origin/feature/manga-canvas-mvp`@`b9ac507`（PR #287 merge commit）。
- Production受入れ: ページ22・コマ1で2候補を1回だけ生成した。Worker [31928823358](https://github.com/team478a/manga/actions/runs/31928823358)は`requests=3 processed=2`で成功。Creditは使用72／予約0／残28 → 予約4／残24 → 使用76／予約0／残24。2候補とも完成し追加生成なしで不採用。
- 品質結果: 候補1は胸ポケットと端末背面を維持したが日本語風・疑似文字の効果音を生成。候補2は胸ポケットを維持したが端末表示面、英字氏名、通話UIを生成。候補採用、Canvas配置、追加生成なし。Canvas revision 8、PNG、公開・販売状態は不変。
- 原因: 端末の向き指定自体がProviderへ端末・画面概念を与え続け、文字・効果音を後段編集へ分離する契約も不足していた。
- 実装: 端末を含む短縮クローズアップの`layout`と人物`action`から端末・画面・UI語を除き、位置anchorと衣服・手の輪郭だけで隠れた小物を示す。`overlay_stage`で文字等は後段追加と明示する。Promptは2,000文字未満。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、retry、timeout、Scheduler、Canvas、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- 検証: 集中53/53、Hub 741/741、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository、owner isolation、packages／Webpack build、diff check成功。Desktopローカルは既知`@napi-rs/keyring`型宣言不足で停止し、Windows CIを正式判定にする。
- CI: 実装HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。最終文書同期HEADでも同じ5チェックを再確認する。
- 次: 責任者のmerge判断待ち。merge前にProduction追加生成を行わない。merge後はページ22・コマ1を2候補で1回だけ受入れし、合格前は配置しない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2AE_CONCEALED_PROP_OVERLAY_STAGE.md`

---

## 2026-08-16 PR-R4-2AD ネーム構図から端末表示面を除外

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#287](https://github.com/team478a/manga/pull/287)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-f5e0c4-team478as-projects.vercel.app
- Branch: `codex/fix-r4-2ad-device-safe-layout`
- Base: `origin/feature/manga-canvas-mvp`@`a3d957a`（PR #286 merge commit）。
- Production受入れ: ページ22・コマ1で手動比較を維持する最小2候補を1回だけ生成した。Worker [31926041721](https://github.com/team478a/manga/actions/runs/31926041721)は`requests=3 processed=2`で成功。Creditは使用70／予約0／残30 → 予約4／残26 → 使用72／予約0／残28。1候補完成、1候補失敗・予約返却。
- 品質結果: 完成した704×1024 PNGは胸ポケットと端末のクローズアップという元ネーム構図へ戻ったが、端末表示面に日本語・疑似文字・通話UIが生成されたため不採用。候補採用、Canvas配置、失敗候補再実行、追加生成なし。Canvas revision 8、PNG成功、公開・販売状態は不変。
- 原因: PR #286で追加したraw `layout`が位置anchorだけでなく「端末表示面をカメラへ向ける」指示も保持し、後段の端末背面契約と競合した。
- 実装: クローズアップ構図に端末・画面語がある場合だけ、端末語より前の位置anchorを保持し、端末1個の背面／側面をカメラへ、表示面を人物側／画面外へ向ける短い契約へ変換する。非端末構図は不変。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、retry、timeout、Scheduler、Canvas、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- 検証: 集中53/53、Hub 741/741、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository、owner isolation、packages／Webpack build、RC structure、diff check成功。Desktopローカルは既知`@napi-rs/keyring`型宣言不足で停止し、Windows CIを正式判定にする。
- CI: 初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。最終文書同期HEADでも同じ5チェックを再確認して停止する。
- 次: 責任者のmerge判断待ち。merge前にProduction追加生成を行わない。merge後はページ22・コマ1を手動比較可能な最小2候補で1回だけ受入れし、合格前は配置しない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2AD_DEVICE_SAFE_LAYOUT.md`

---

## 2026-08-16 PR-R4-2AC 安全再構成でネーム構図を維持

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#286](https://github.com/team478a/manga/pull/286)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-accept-r-b227a0-team478as-projects.vercel.app
- Branch: `codex/accept-r4-2ac-conservative-retry`
- Base: `origin/feature/manga-canvas-mvp`@`035c2a6`（PR #285 merge commit）。
- Production受入れ: ページ22・コマ1を1件だけ再実行し、Worker [31923479315](https://github.com/team478a/manga/actions/runs/31923479315)は`requests=2 processed=1`で成功した。Creditは使用68／予約0／残32 → 予約2／残30 → 使用70／予約0／残30。画像4/4、セリフ1/1、生成中0、失敗0、Canvas revision 8、PNG成功。
- 品質結果: 704×1024 PNGは正立、顔、手、人体、清潔な描画面を満たしたが、汎用的な室内人物画となり元ネームの場面と構図を失ったため不採用。品質承認、採用、Canvas配置、追加生成は行っていない。
- 原因: 短縮Provider契約が元ネームの構図を渡さず、第2段階再構成も背景・構図を一律の日常場面へ置換していた。
- 実装: 短縮契約へ安全な`layout`を追加し、第2段階では危険描写だけを除いて画角、人数、人物・背景の相対配置を維持する。`layout`は長さ制限、危険語拒否、ローカルmoderationを通す。
- 不変: URL、API response、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、Worker自動retry、timeout、Scheduler、Canvas、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- 検証: 集中52/52、Hub 740/740、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository、owner isolation、packages／Webpack build、RC structure、diff check成功。Desktopローカルは既知`@napi-rs/keyring`型宣言不足で停止し、Windows CIを正式判定にする。
- CI: 実装HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。最終文書同期HEADでも同じ5チェックを再確認して停止する。
- 次: 責任者merge待ち。merge前にProduction追加生成を行わない。merge後は現在の不採用候補を再試行せず、安全なネーム構図を含む新規Jobを1案だけ受入れ確認する。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2AC_STORYBOARD_LAYOUT_SAFE_RETRY.md`

---

## 2026-08-16 PR-R4-2AB Provider moderation後の第2段階安全再構成

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#285](https://github.com/team478a/manga/pull/285)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-cb5583-team478as-projects.vercel.app
- Branch: `codex/fix-r4-2ab-conservative-moderation-retry`
- Base: `origin/feature/manga-canvas-mvp`@`d44fc8d`（PR #284 merge commit）。
- Production受入れ: ページ22・コマ1を1件だけ再実行した。Worker [31921455570](https://github.com/team478a/manga/actions/runs/31921455570)は`requests=2 processed=1`で成功したが、Jobは`provider_moderation_blocked`でAssetなし。Creditは使用68／予約0／残32 → 予約2／残30 → 使用68／予約0／残32へ全額復元された。
- Production状態: Canvas revision 8、PNG成功、画像4/4、セリフ1/1、生成中0、失敗1。Canvas、公開・販売状態、設定は変更していない。Production DBは分類と契約適用有無の読み取りだけで、書込なし。
- 原因: 第1段階安全再構成と端末背面契約は適用済みだったが、BFL moderationで再度停止した。現行Serviceは安全再構成済みJobの次の再構成を許可せず、利用者が行き止まりになる。
- 実装: 背景・場所・構図・演出・動作・表情を穏やかな日常場面へ置換する第2段階を1回だけ許可する。第2段階済みJobが再拒否された場合は必ず停止する。人物設定、衣装、参照Asset、端末背面契約を維持する。
- 不変: URL、API response、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、Worker自動retry回数、timeout、Scheduler、Canvas、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- 検証: 集中20/20、Hub 739/739、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository、owner isolation、packages／Webpack build、RC structure、diff check成功。
- CI: 実装HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。最終文書同期HEADでも同じ5チェックを再確認して停止する。
- 次: 責任者merge待ち。merge前にProduction再実行を行わない。merge後、同じ失敗コマを1回だけ再実行し、第2段階再構成の完成画像と漫画品質を確認する。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2AB_CONSERVATIVE_MODERATION_RETRY.md`

---

## 2026-08-16 PR-R4-2AA 端末表示面を描かせない正方向契約

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#284](https://github.com/team478a/manga/pull/284)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-1bdb66-team478as-projects.vercel.app
- Branch: `codex/fix-r4-2aa-concealed-device-surface`
- Base: `origin/feature/manga-canvas-mvp`@`59b8377`（PR #283 merge commit）。
- Production受入れ: ページ22・コマ1を1件だけ安全再実行した。Worker [31920132648](https://github.com/team478a/manga/actions/runs/31920132648)は`requests=2 processed=1`で成功し、Creditは使用66／予約0／残34から使用68／予約0／残32へ確定した。
- 品質結果: 正立、人体、小物1個は満たしたが、端末へ時刻、UI風文字・アイコンが生成され、顔上端も大きく切れたため不採用。Canvas revision 8、PNG成功、生成中0、失敗0、公開・販売状態は不変。
- 原因: BFLはnegative promptを受け取らず、「空の端末画面」という正方向指定でも表示面を描く際にUIを補完した。
- 実装: 手持ち端末は無地の背面または細い側面だけをカメラへ向け、表示面を人物側または画面外へ向ける契約へ変更する。通常生成、短縮Provider JSON、安全再実行へ共通適用する。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、retry回数、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- 検証: 集中47/47、Hub 737/737、Canvas 26/26、AI 48/48、100ページ長編4/4、dependency／module boundary、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository、owner isolation、workspace packages、Webpack production build、RC structure、diff check成功。
- CI: 初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。最終文書同期HEADの同じ5チェックを再確認して停止する。
- 次: 責任者確認のため停止する。merge前にProduction再生成を行わない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2AA_CONCEALED_DEVICE_SURFACE.md`

---

## 2026-08-16 PR-R4-2Z 安全再実行への最新画像品質契約継承

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#283](https://github.com/team478a/manga/pull/283)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-031855-team478as-projects.vercel.app
- Branch: `codex/fix-r4-2z-retry-quality-contract`
- Base: `origin/feature/manga-canvas-mvp`@`e52540c`（PR #282 merge commit）。
- Production受入れ: ページ22・コマ1の失敗Jobを1件だけ再実行した。Worker [31918003768](https://github.com/team478a/manga/actions/runs/31918003768)は`requests=2 processed=1`で成功し、Creditは使用64／予約0／残36から使用66／予約0／残34へ確定した。
- 品質結果: 新候補は正立、人体、小物単一性は改善したが、端末画面、衣装、画面端に文字状模様が残り不採用とした。Canvas revision 8、PNG成功、公開・販売状態は不変。最終は生成中0、失敗0、未配置候補1件。
- 原因: 古い失敗Jobの安全再実行が保存済みnegative promptをそのまま維持し、PR #281で追加した端末・小物・画像内文字の最新品質契約を補強していなかった。
- 実装: 安全再実行だけへ正立、自然な人体、小物単一性、空の端末画面、純粋な描画面の正方向契約と、疑似文字、端末UI、ロゴ、重複小物等のnegative promptを追加する。元Job固有の条件、参照Asset、対象コマ、versionを維持する。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、retry回数、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- 検証: 集中39/39、Hub 737/737、Canvas 26/26、AI 48/48、100ページ長編4/4、dependency／module boundary、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository、owner isolation、workspace packages、Webpack production build、RC structure、diff check成功。
- CI: 初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。最終文書同期HEADの同じ5チェックを再確認して停止する。
- 次: 責任者確認のため停止する。merge前にProduction再生成を行わない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2Z_RETRY_QUALITY_CONTRACT.md`

---

## 2026-08-16 PR-R4-2Y 失敗候補の再実行デッドロック解消

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#282](https://github.com/team478a/manga/pull/282)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-accept-r-5e2140-team478as-projects.vercel.app
- Branch: `codex/accept-r4-2y-page22-device-quality`
- Base: `origin/feature/manga-canvas-mvp`@`be7ae34`（PR #281 merge commit）。
- Production受入れ: ページ22・コマ1を2案だけ生成した。Worker [31916441291](https://github.com/team478a/manga/actions/runs/31916441291)は`requests=3 processed=2`で成功したが、2 JobともAssetなしで失敗した。Creditは使用64／予約0／残36 → 予約4／残32 → 使用64／予約0／残36へ全額復元した。
- 再現: queued／running Jobが0でも、同一コマのcompleted確認候補があるため、失敗Jobの再実行ボタンがすべて「進行中」と判定され無効になった。
- 実装: 失敗Jobの再実行だけは同一コマのqueued／running Jobを排他し、completed確認候補とsibling failed Jobでは停止しない。従来の未採用候補排他は他操作へ維持する。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry回数、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- Production状態: Canvas revision 8、PNG成功、使用64／予約0／残36。新規Asset、Provider課金、Canvas、公開・販売変更なし。
- 検証: 集中12/12、Hub 737/737、Canvas 26/26、AI 48/48、100ページ長編4/4、dependency／module boundary、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository、owner isolation、workspace packages、Webpack production build、RC structure、diff check成功。Desktopローカルは既知`@napi-rs/keyring`型宣言不足で停止し、Windows CIを正式判定にする。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- 次: 責任者確認のため停止する。merge前に失敗Jobを再実行しない。merge後はページ22・コマ1の失敗候補を1件だけ再実行し、候補品質とCredit確定を確認する。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2Y_FAILED_CANDIDATE_RETRY.md`

---

## 2026-08-16 PR-R4-2X 端末無記名・小物単一化契約

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#281](https://github.com/team478a/manga/pull/281)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-accept-r-1189f2-team478as-projects.vercel.app
- Branch: `codex/accept-r4-2x-page22-quality-gate`
- Base: `origin/feature/manga-canvas-mvp`@`e844143`（PR #280 merge commit）。
- Production受入れ: ページ22でコマ1を計4案、コマ3を2案だけ生成した。コマ3の合格1案を4項目品質確認して配置し、Canvas revision 7→8、保存、PNG成功を確認した。コマ1は端末画面の疑似文字と端末重複が残り、完成候補3案をすべて不採用、1 Jobは生成失敗とした。
- Worker: [31914291083](https://github.com/team478a/manga/actions/runs/31914291083)、[31914514888](https://github.com/team478a/manga/actions/runs/31914514888)、[31914739580](https://github.com/team478a/manga/actions/runs/31914739580)はすべて成功。Creditは使用56／予約0／残44 → 使用64／予約0／残36。保留Jobと予約残なし。
- 実装: 短縮・長文Promptへ、端末displayを反射と光だけの無記名面にすること、必要な各小物をネーム指定位置へ一つだけ描くことを正方向契約として追加する。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- 検証: 集中31/31、Hub 735/735、Canvas 26/26、AI 48/48、長編4/4、dependency／module boundary、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository、owner isolation、workspace packages、Webpack production build、RC structure、diff check成功。Desktopローカルは既存`@napi-rs/keyring`型宣言不足で停止し、Windows CIを正式判定にする。
- Production状態: コマ3とCanvas revision 8だけを保存。コマ1、コマ2、コマ4の目視確認、未配置候補2件、自動配置確認が残り、ページ全体は未完成。公開・販売変更なし。
- CI: 実装・Draft PR記録HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- 次: 最終HEADの全CIとVercel Preview成功を確認して停止する。merge前に追加Production生成を行わない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2X_BLANK_DEVICE_SINGLE_PROP.md`

---

## 2026-08-16 PR-R4-2W 生成画像の採用品質ゲート

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#280](https://github.com/team478a/manga/pull/280)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-fd5441-team478as-projects.vercel.app
- Branch: `codex/fix-r4-2w-generation-quality-gate`
- Base: `origin/feature/manga-canvas-mvp`@`3bd3488`（PR #279 merge commit）。
- 背景: PR #279はマージ済み。ページ22はコマ4が合格・配置済みだが、コマ1の不自然な上下方向、コマ3の画像内疑似文字、未配置候補2件、自動配置確認が残る。
- 監査: 現行rule-based quality judgeは画像ピクセルのOCR・天地・人体意味解析を行わないため、自動検査済みとは扱わない。
- 実装: 短縮Promptにも正立・自然な重力・人体・清潔な絵画面の品質条件を追加する。生成画像の配置・承認前に正立、画像内文字なし、人体、小物、物語構図の4項目を必須確認する。未配置候補は追加生成なしで明示却下でき、全候補却下済みの場合だけ不要なblockerを解除する。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- 検証: Hub 735/735、Canvas 26/26、AI 48/48、100ページ長編4/4、dependency／module boundary、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository、owner isolation、workspace packages、Webpack production build成功。Desktopローカルは既存`@napi-rs/keyring`型宣言不足のためWindows CIを正式判定にする。
- CI: 実装・Draft PR記録HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。Draft／MERGEABLE。
- Preview確認: deploymentは成功。ブラウザ直アクセスはVercel Deployment Protectionの「チーム所有者の承認が必要」で停止したため、認証後画面の手動確認は未実施。アクセス要求は送信せず、4項目dialog、採用ボタン無効／有効、不採用、完成判定はHub自動テストで確認した。
- Production変更: なし。Provider生成、DB、credit、Canvas、PNG／PDF、公開・販売状態を変更していない。
- 次: 最終文書同期HEADの同じ5チェックを再確認して停止する。責任者のmerge前にProduction再生成と次工程へ進まず、merge後にページ22のコマ1・コマ3を必要最小限で再制作して本ゲートで確認する。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2W_GENERATION_QUALITY_GATE.md`

---

## 2026-08-16 PR-R4-2V 確認済み生成Assetの完成判定同期

- 状態: `MERGED_PRODUCTION_ACCEPTED`
- Draft PR: [#279](https://github.com/team478a/manga/pull/279)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-cf4c4b-team478as-projects.vercel.app
- Branch: `codex/fix-r4-2v-reviewed-asset-completion`
- Base: `origin/feature/manga-canvas-mvp`@`fcaca93`（PR #278 merge commit）。
- Production受入れ: `test`モニターのページ22・4コマ目を1案だけ再制作した。公式Worker [31909535792](https://github.com/team478a/manga/actions/runs/31909535792)は`status=idle requests=2 processed=1`で成功した。
- Credit: 使用54／予約0／残46 → 予約2／残44 → 使用56／予約0／残44。重複Job、追加Worker、安全再実行なし。
- 品質結果: 704×1024 PNGは頭髪全体、両目、首、肩、胴体、手、左右背景を含み、吹き出し、疑似文字、口内文字がない。販売品質を満たす4コマ目候補として品質確認・配置し、Canvas revision 6→7、保存済み、PNG成功を確認した。
- 原稿全体: コマ4の改善はプレビューへ反映済み。コマ1の不自然な上下方向、コマ3の画像内疑似文字、未配置候補2件、自動配置確認が残るためページ全体は未完成。
- 判明した境界: 同一の生成画像Assetを候補Job経由で品質確認しても、保存Canvas layerの`sourceJobId`が別の候補Jobを指す場合は、完成判定だけが目視確認を要求し続ける。
- 実装: 最新品質イベントが`selected`の生成Jobから確認済み`output_asset_id`を解決し、可視layerは確認済みJob IDまたは同一Asset IDのどちらかで目視確認済みとする。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- 検証: 集中12/12、Hub 732/732、Canvas 26/26、AI 48/48、100ページ長編4/4、dependency／module boundary、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository、owner isolation、workspace packages、Webpack production build、RC structure、diff check成功。Desktopローカルは既存`@napi-rs/keyring`型宣言不足で開始前に停止し、Windows CIを正式判定にする。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Production変更: 合格した4コマ目候補の品質確認・配置とCanvas revision 6→7のみ。追加生成、公開・販売変更なし。
- Merge: PR #279 merge commit `3bd3488`。追加Production生成なしでPR-R4-2Wへ引き継いだ。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2V_REVIEWED_ASSET_COMPLETION.md`

---

## 2026-08-16 PR-R4-2U 台詞安全な再制作フレーミング

- 状態: `MERGED_PRODUCTION_ACCEPTED`
- Draft PR: [#278](https://github.com/team478a/manga/pull/278)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-f5a9b7-team478as-projects.vercel.app
- Branch: `codex/fix-r4-2u-dialogue-safe-rework-framing`
- Base: `origin/feature/manga-canvas-mvp`@`72f1d0d`（PR #277 merge commit）。
- Production受入れ: `test`モニターのページ22・4コマ目を1案だけ再制作した。公式Worker [31906333027](https://github.com/team478a/manga/actions/runs/31906333027)は`status=idle requests=2 processed=1`で成功した。
- Credit: 使用52／予約0／残48 → 予約2／残46 → 使用54／予約0／残46。重複Job、追加Worker、安全再実行なし。
- 品質結果: 新規704×1024 PNGは人物の顔・首付近だけの極端なcropとなり、口内と胸元付近の吹き出し状領域へ原台詞と一致する「証拠を」が描画されたため不採用。候補採用、配置、品質承認、Canvas、公開・販売状態は変更していない。
- 原因判断: Panel Specificationの画角が`extreme_close_up`または`detail`の場合、場面欄へ混入した台詞を除外して58%短縮構図へ切り替える既存契約を通らず、長文Promptへ場面記述を直接含めていた可能性が高い（推論）。Prompt本体はログ・文書へ記録していない。
- 実装: Provider向けの動作、感情、背景、構図、演出から引用発話と既知台詞を除外する。台詞混入を検知した`extreme_close_up`／`detail`だけ58%の短縮安全フレームへ切り替え、台詞のない意図的な寄りは維持する。Panel Specificationの原文と画角は変更しない。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- 検証: 集中35/35、Hub 731/731、Canvas 26/26、AI 48/48、長編4/4、dependency／module boundary、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository、owner isolation、workspace packages、Webpack production build、RC structure成功。通常Turbopackは既知のWindows path長、Desktop typecheckは既存`@napi-rs/keyring`型宣言不足で停止し、Windows CIを正式判定にする。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Merge: PR #278 merge commit `fcaca93`。merge後のProduction限定受入れはPR-R4-2Vへ記録する。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2U_DIALOGUE_SAFE_TIGHT_FRAMING.md`

---

## 2026-08-15 PR-R4-2T 顔面無記名・引き構図の正方向契約

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#277](https://github.com/team478a/manga/pull/277)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-cb03d2-team478as-projects.vercel.app
- Branch: `codex/fix-r4-2t-clean-face-safe-framing`
- Base: `origin/feature/manga-canvas-mvp`@`faeef67`（PR #276 merge commit）。
- Production受入れ: `test`モニターのページ22・4コマ目を1案だけ再制作した。公式Worker [31886026453](https://github.com/team478a/manga/actions/runs/31886026453)は`status=idle requests=2 processed=1`で成功し、Asset `2fe8d763-cedd-4a13-99ea-afc85adbc758.png`を生成した。
- Credit: 使用50／予約0／残50 → 予約2／残48 → 使用52／予約0／残48。重複Job、継続Worker、安全再実行なし。
- 品質結果: 704×1024 PNGはmoderationを通過し、両目・顔・首・肩まで改善した。一方、頭頂が上端に接し、人物が画面高の約9割を占め、左右背景余白が不足し、口元へ「証 拠を」に見える疑似文字が生成されたため不採用。配置、品質承認、Canvas、公開・販売状態は変更していない。
- 実装: JSON先頭を`composition`／`framing`へ変更し、余白の広い環境ポートレート、被写体高58%、髪上端18%、衣服下端82%、左右環境余白18%へ引く。台詞fallbackの`speaking`を除去し、顔面と全描画面を自然な線画・陰影だけで完成させる正方向契約を追加する。初回生成と一般向け安全再実行へ共通適用する。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- 検証: 集中32/32、Hub 728/728、Canvas 26/26、AI 48/48、長編4/4、dependency／module boundary、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository、owner isolation、workspace packages、Webpack production build、RC structure成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- 次: 最終文書同期HEADの同じ5チェックを再確認して停止する。責任者merge前に追加Production生成を行わず、merge後に同じ対象コマを1案だけ限定受入れする。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2T_CLEAN_FACE_SAFE_FRAMING.md`

---

## 2026-08-15 PR-R4-2S Provider安全な座標フレーミング

- 状態: `MERGED`
- PR: [#276](https://github.com/team478a/manga/pull/276)（merge commit `faeef67`）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-b52cd0-team478as-projects.vercel.app
- Branch: `codex/fix-r4-2s-provider-safe-frame-coordinates`
- Base: `origin/feature/manga-canvas-mvp`@`4728941`（PR #275 merge commit）。
- Production受入れ: `test`モニターのページ22・4コマ目を1案だけ再制作した。公式Worker [31883817067](https://github.com/team478a/manga/actions/runs/31883817067)は`status=idle requests=2 processed=1`で処理したが、Provider moderation拒否となった。一般向け安全再実行を1回だけ行い、Worker [31883888494](https://github.com/team478a/manga/actions/runs/31883888494)も同じく拒否された。
- Credit／Asset: 各回で予約2を全額解放し、最終は使用50／予約0／残50。新規Asset、候補画像、Provider課金はない。候補採用、配置、品質承認、Canvas revision、公開・販売状態は変更していない。
- 原因判断: PR #274の安全再実行は成功しており、PR #275で追加した`chest`／`waist`を含む身体部位列挙が主な差分。過去の同種Provider moderationとも一致するため、構図の身体部位列挙をやめる。
- 実装: 短縮JSONを中距離portraitへ戻し、`framing`に被写体高72%、髪上端15%、上着下端92%、左右余白12%を構造化する。`position`／`composition`／`camera.distance`も同じ座標契約へ統一し、初回生成と安全再実行の保存済み旧JSONへ共通適用する。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- 検証: 集中32/32、Hub 728/728、Canvas 26/26、AI 48/48、長編4/4、dependency／module boundary、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository、owner isolation、workspace packages、Webpack production build、RC structure成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- 次: 最終文書同期HEADの5チェックを再確認して停止する。merge前に追加Production生成を行わない。merge後は同じ対象コマを1案だけ再制作し、Provider moderation拒否時だけ一般向け安全再実行を1回許可する。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2S_PROVIDER_SAFE_FRAME_COORDINATES.md`

---

## 2026-08-15 PR-R4-2R 短縮クローズアップの一枚絵・画面内ランドマーク契約

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#275](https://github.com/team478a/manga/pull/275)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-7249f5-team478as-projects.vercel.app
- Branch: `codex/fix-r4-2r-compact-output-framing`
- Base: `origin/feature/manga-canvas-mvp`@`ebc9107`（PR #274 merge commit）。
- Production受入れ: ページ22・4コマ目を1案だけ再制作した。初回Job `487df1f8-1096-4513-a329-a60117e0e712`はWorker `31873260143`で`provider_moderation_blocked`、安全再実行はWorker `31873352419`でPNG Asset `2d3a5c3e-f943-4c83-a387-0e4b27a45a30.png`を生成した。
- Credit: 使用48／予約0／残52 → 初回予約2・全額解放 → 安全再実行予約2 → 使用50／予約0／残50。重複Jobと継続Workerはない。
- 品質結果: 704×1024 PNGは頭頂、髪全体、両目が画面外となり、口元から胸元だけの過度な接写だった。顔中央を横切る不要な矩形線もあり、販売品質未達。候補採用、配置、品質承認、Canvas、公開・販売状態は変更していない。
- 根因: BFLへnegative promptを送らない既存契約上、短縮JSONから欠落していた一枚絵出力契約をProviderへ伝えられなかった。`mid-torso upward`と被写体高55%も頭部位置を固定できなかった。
- 実装: `scene`を腰上中景へ変更し、`output_type`／`canvas`へ端から端まで一続きの絵を追加する。髪上端約15%、両肩を左右余白内、腰を画面下部に置くランドマークを初回生成と安全再実行へ共通適用する。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- 検証: 集中32/32、Hub 728/728、Canvas 26/26、AI 48/48、100ページ長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository受入れ、owner isolation、packages／Webpack build、RC structure、diff check成功。通常Turbopackは既知のWindows path長、Desktopは既存`@napi-rs/keyring`型宣言不足で停止し、Windows CIを正式判定にする。
- CI: 初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- 証跡: `docs/RELEASE_CANDIDATE_R4_2R_COMPACT_OUTPUT_FRAMING.md`
- 次: 最終文書同期HEADの全CI／Vercel Preview成功を再確認して停止する。merge前にProduction再生成を行わない。

---

## 2026-08-15 PR-R4-2Q クローズアップ構図優先度・公式JSON契約

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#274](https://github.com/team478a/manga/pull/274)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-tnt1bshvg-team478as-projects.vercel.app
- Branch: `codex/fix-r4-2q-closeup-framing-priority`
- Base: `origin/feature/manga-canvas-mvp`@`9519bfc`（PR #273 merge commit）。
- Production受入れ: PR #273反映後、`test`モニターのページ22・4コマ目で失敗Jobの安全再実行を1回だけ実施した。Worker run `31870804091`は`status=idle requests=2 processed=1`、新規候補は手動確認待ち100%で完了した。
- Credit: 使用46／予約0／残54 → 使用46／予約2／残52 → 使用48／予約0／残52。重複Job、追加Worker、再試行なし。
- 品質結果: 704×1024 PNGはProvider moderationを通過し、両目・顔・無記名面を満たした。一方、頭頂、髪の上部、首、両肩、周囲背景が不足する顔全面の寄りで販売品質未達。候補採用、コマ配置、品質承認、Canvas revision、公開・販売状態は変更していない。
- 根因: FLUX.2は先頭要素を重視するが、短縮JSONが`portrait`で始まり、後段の65%構図より顔寄り解釈を先に与えていた。cameraも公式例の数値`lens-mm`ではなく独自`lens`だった。
- 実装: JSON先頭を胸元から上の`medium shot`へ変更し、完全な頭部、髪、首、両肩、頭上・左右背景、被写体高約55%を先頭から固定する。`lens-mm: 50`と全体focusへ公式JSON構造を合わせる。一般向け安全再実行も保存済み旧JSONを同じ契約へ正規化する。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- 検証: 集中32/32、Hub 728/728、Canvas 26/26、AI 48/48、100ページ長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository受入れ、owner isolation、packages／Webpack build、RC structure、diff check成功。通常Turbopackは既知のWindows path長上限で停止。
- CI: 初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Production変更: 上記1 Job／2 creditのみ。本PR実装後のProvider E2Eはmerge前に行わない。
- 証跡: `docs/RELEASE_CANDIDATE_R4_2Q_CLOSEUP_FRAMING_PRIORITY.md`
- 次: 最終文書同期HEADの全CI／Vercel Preview成功を再確認して停止する。責任者確認前に追加のProduction生成を行わない。

---

## 2026-08-15 PR-R4-2P 短縮クローズアップの一般向け安全再実行

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#273](https://github.com/team478a/manga/pull/273)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-5cgcg63dm-team478as-projects.vercel.app
- Branch: `codex/fix-r4-2p-compact-closeup-safe-retry`
- Base: `origin/feature/manga-canvas-mvp`@`e16e001`（PR #272 merge commit）。
- Production受入れ: PR #272反映後、ログイン済み`test`モニターでページ22・4コマ目を1案だけ再制作した。Job `d0eb56b3-50b9-4bf3-b618-2a7251c6ab56`を公式Worker run `31869411513`が`status=idle requests=2 processed=1`で処理した。
- 結果: Jobは`provider_moderation_blocked`、試行1/2、進捗1%、actual cost 0、Assetなし。使用46、予約0→2→0、残り54→52→54で全額復元し、重複Jobと継続Workerはない。
- 根因: R4-2Oの短縮Promptは場面情報をJSONの`subjects.action`／`subjects.expression`／`background`／`variation`へ移したが、既存の一般向け安全再実行は旧来の複数行Promptだけを置換していた。短縮JSONは構図以外が未変換となり、同じ直接描写を再送する回帰があった。
- 実装: Provider拒否後の安全再実行時だけ、短縮JSONの動作、表情、背景、候補演出を一般向けの間接表現へ置換する。人物description、position、style、camera、70mm相当、65%構図、無記名面、`input_image_N`参照役割、target panel、reference Asset IDは維持する。
- 不変: 初回生成Prompt、URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、retry回数、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、成人向け境界、Desktop。
- 検証: 集中32/32、Hub 726/726、Canvas 26/26、AI 48/48、deps、lint、Hub typecheck、migration 59/59、共有package build、Webpack production build、diff check成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Production変更: 上記1 Jobのみで課金なし。候補採用、画像配置、品質承認、Canvas revision、作品、公開・販売状態は変更していない。R4-2P merge前に追加の実Provider E2Eを行わない。
- 証跡: `docs/RELEASE_CANDIDATE_R4_2P_COMPACT_CLOSEUP_SAFE_RETRY.md`
- 次: 最終文書同期HEADの5チェックを再確認して停止する。merge後に失敗Jobの安全再実行を1回だけ受入れし、責任者判断前に次工程へ進まない。

---

## 2026-08-15 PR-R4-2O クローズアップProvider Prompt短縮・安定化

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#272](https://github.com/team478a/manga/pull/272)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-l6vr8i9ca-team478as-projects.vercel.app
- Branch: `codex/fix-r4-2o-compact-closeup-provider-prompt`
- Base: `origin/feature/manga-canvas-mvp`@`9047f40`（PR #271 merge commit）。
- Production受入れ: PR #271反映後、ログイン済み`test`モニターでページ22・4コマ目の再制作を1案だけ登録した。Job `230eac0d-e1d3-4813-bd43-bb6830c492ba`を公式Worker run `31867709945`が`status=idle requests=2 processed=1`で完了した。使用creditは44→46、予約0→2→0、残り56→54。重複Jobと継続Workerはない。
- 品質結果: Asset `f7a22c48-fe92-48ca-8697-b2ee3ac6d70d`（704×1024 PNG）はProvider moderationを通過したが、鼻・口・顎だけの極端なcropとなり、両目と頭頂が画面外、口元へ生成文字`証拠を`が混入した。販売品質未達のため配置・品質承認・追加生成を行っていない。
- 切り分け: Jobは`text_to_image`かつ`source_asset_id=null`で、失敗候補画像をsourceとして固定していない。保存済み画風参照も完全な頭部を含む清潔な無記名画像。BFL公式推奨より長く、同じ場面契約、構図、動作、感情、背景、演出が重複するPromptによって、最優先の撮影距離と無記名面が希釈された可能性が高い（推論）。
- 実装: 人物あり・新規`close_up`だけを短いJSON Provider契約へ切り替える。被写体を中央の中距離portrait、画像高約65%、完全なsilhouetteと周囲背景、70mm相当へ固定する。台詞本文と引用符付き発話を動作・表情・背景から除外し、描画面を清潔な無記名モノクロ面へ固定する。2〜4候補の候補別制作差分と参照画像ごとの役割は維持する。
- 適用外: revision／Image-to-Image／Inpainting／Outpainting、人物なし、close-up以外は従来Promptを維持する。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、retry回数、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、成人向け境界、Desktop。
- 検証: 集中31/31、Hub 726/726、Canvas 26/26、AI 48/48、100ページ長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository受入れ、owner isolation、workspace package build、Webpack production build、RC structure、diff check成功。
- ローカル既知制約: 全体typecheckは既存Desktop依存`@napi-rs/keyring`型宣言不足だけで停止。今回Desktop差分はなく、Windows CIを正式判定とする。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Production変更: 上記1 Job／2 creditのみ。画像配置、品質承認、Canvas revision、作品、公開・販売状態は変更していない。R4-2O merge前に追加の実Provider E2Eを行わない。
- 証跡: `docs/RELEASE_CANDIDATE_R4_2O_COMPACT_CLOSEUP_PROVIDER_PROMPT.md`
- 次: 最終文書同期HEADの5チェックを再確認して停止する。merge後に1案だけ受入れし、責任者判断前に次工程へ進まない。

---

## 2026-08-15 PR-R4-2N Provider moderation安全な構図契約

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#271](https://github.com/team478a/manga/pull/271)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-kg3ib7at3-team478as-projects.vercel.app
- Branch: `codex/fix-r4-2n-provider-moderation-safe-framing`
- Base: `origin/feature/manga-canvas-mvp`@`ff5ea38`（PR #270 merge commit）。
- Production受入れ: PR #270反映後、`test`モニターのページ22・4コマ目を1案だけ再制作した。初回Job `8bf051c1-3f08-4ec9-8a63-f3a553d30f14`はWorker `31866069529`、既存の一般向け安全再実行Job `d5eaed83-1c10-45a0-94ec-bcda1b7ac219`はWorker `31866237664`で処理した。両runとも`status=idle requests=2 processed=1`で、Jobは`provider_moderation_blocked`、Assetなし、actual cost 0だった。
- Credit: 各試行で使用44、予約0→2→0、残り56→54→56。成功課金、重複Job、継続Workerはなく、最終は使用44／予約0／残り56。
- 切り分け: 同じコマ・参照でR4-2L Promptは生成完了しており、R4-2MでProvider JSON先頭へ重複追加した`both eyes, nose, mouth, chin, neck`の身体部位列挙が、初回と安全再実行の両方へ残っていた。BFLの構造化Prompt対応は維持し、Provider moderationとの語彙衝突だけを除く。
- 実装: Provider JSONのclose-up構図を、身体部位列挙なしの「uncropped medium close-up head-and-shoulders portrait」「被写体全体をframe内」「10% composition margin」へ置換する。後段の日英フレーミング契約は維持する。Provider拒否後の安全再実行でも、保存済み旧JSON契約だけを同じ安全な構図へ変換する。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、retry回数、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、成人向け境界、Desktop。
- 検証: 集中30/30、Hub全体、Canvas 26/26、AI 48/48、100ページ長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository受入れ、owner isolation、workspace package build、Webpack production build、RC structure成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Production変更: 上記2 Jobだけ。両方ともAsset・課金なし。画像配置、品質承認、Canvas、作品、公開・販売状態は変更していない。R4-2N実装後のProvider E2Eは行わない。
- 証跡: `docs/RELEASE_CANDIDATE_R4_2N_PROVIDER_MODERATION_SAFE_FRAMING.md`
- 次: 最終文書同期HEADの5チェックを再確認して停止する。責任者merge前にProductionで追加生成しない。

---

## 2026-08-15 PR-R4-2M Provider構図契約・参照役割の構造化

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#270](https://github.com/team478a/manga/pull/270)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-9d6nqnlbl-team478as-projects.vercel.app
- Branch: `codex/fix-r4-2m-provider-framing-contract`
- Base: `origin/feature/manga-canvas-mvp`@`c7615a6`（PR #269 merge commit）。
- Production受入れ: PR #269反映後、`test`モニターのページ22で有効な再制作を1回だけ登録した。Jobは1件、公式Worker run `31864612499`は`status=idle requests=2 processed=1`で成功。使用creditは42→44、予約0→2→0、残り56、重複登録と継続Workerはなかった。
- 品質結果: 新しいAsset `1e1fd972-ce78-4bb0-b700-126cd693c35d.png`（704×1024）は頭頂、髪、両目が切れ、鼻下・口・顎・首・肩だけの構図となり、下部に生成文字`証拠を`が混入した。販売品質未達のため配置、品質承認、追加生成は行っていない。
- 参照確認: 保存済み画風参照Asset `84dce883-e71a-4e6b-8efa-465e36e4f366`は、頭部全体と人物全身を含む清潔な無記名画像だった。参照画像自体のcrop／文字汚染は原因ではない。
- 根因: Domainの`close_up`がProvider Prompt内で後から単純な「クローズアップ」と再指定され、頭肩・10%余白契約と競合していた。複数参照も件数と一般的役割だけで、BFLへ送る`input_image_N`ごとの役割を明示していなかった。長い自然言語Prompt内で構図・無記名面の優先度が不足していた。
- 実装: Provider Promptの先頭へJSON構図契約を置き、`close_up`を頭部全体・首・両肩・周囲10%余白を含むミディアムクローズアップへ一貫変換する。選択済み参照を送信順どおり`Input image 1`以降へ割り当て、人物同一性、画風、場所、小物の役割と、構図・cropはProvider契約を優先する境界を明示する。
- Provider契約: BFL公式の構造化Prompt／複数入力画像の役割明示を採用する。FLUX.2はnegative prompt非対応のため、既存どおり送信せず正方向契約だけを強化する。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、retry、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、成人向け境界、Desktop。
- 検証: 集中27/27、Hub全体、Canvas 26/26、AI 48/48、100ページ長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository受入れ、owner isolation、workspace package build、Webpack production build、RC structure成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Production変更: 上記PR #269受入れの1 Job／2 creditだけ。R4-2Mコード実装後のProvider E2E、画像配置・承認、DB／Storage／作品内容の変更は行っていない。
- 証跡: `docs/RELEASE_CANDIDATE_R4_2M_PROVIDER_FRAMING_CONTRACT.md`
- 次: 最終文書同期HEADの5チェックを再確認して停止する。責任者merge前にProductionで追加生成しない。

---

## 2026-08-15 PR-R4-2L クローズアップ余白・無記名描画面の固定

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#269](https://github.com/team478a/manga/pull/269)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-ju48odwjq-team478as-projects.vercel.app
- Branch: `codex/fix-r4-2l-closeup-clean-output`
- Base: `origin/feature/manga-canvas-mvp`@`7f3dc73`（PR #268 merge commit）。
- Production受入れ: PR #268反映後、`test`モニターのページ22で有効な再制作を1回だけ登録した。Jobは1件だけ、Worker run `31860725448`は`status=idle requests=2 processed=1`で成功。使用creditは40→42、予約0→2→0、残り58、重複登録と継続Workerはなかった。先行run `31860684723`は`mode=check`の設定確認だけでWorker／Provider requestを送っていない。
- 品質結果: 新しい704×1024 Assetは両目・鼻・口・顎を含み、前回の口元だけの極端なcropを改善した。一方で頭頂と髪が切れ、口元に生成文字`証拠をさ`が混入したため販売品質未達。配置・品質承認・追加生成は行っていない。
- 実装: 人物あり`close_up`を顔だけの極端な寄りではなく頭と肩の構図とし、髪全体、顎、首、両肩の付け根と画像短辺約10%の頭部周囲余白を日英Promptで固定する。参照素材は同一性、輪郭、髪型、衣装、線画だけに用い、肌、口元、衣服、背景を解剖学的輪郭と自然な陰影だけの清潔な無記名面として再構成する。
- 適用境界: 既存の参照選択、Panel Specification、実効画角、moderation、候補数を維持する。人物なしJobや`wide`等の画角へ頭肩契約を混入させない。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、成人向け境界、Desktop。
- 検証: 集中27/27、Hub全体、Canvas 26/26、AI 48/48、100ページ長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository受入れ、owner isolation、workspace package build、Webpack production build、RC structure成功。
- ローカル既知制約: Desktop差分はない。既存`@napi-rs/keyring`型宣言不足はWindows CIを正式結果とする。
- CI: 実装・Draft PR記録HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Production変更: 上記PR #268受入れの1 Job／2 creditだけ。R4-2Lコード実装後のProvider E2E、画像配置・承認、DB／Storage／作品内容の変更は行っていない。
- 証跡: `docs/RELEASE_CANDIDATE_R4_2L_CLOSEUP_CLEAN_OUTPUT.md`
- 次: 最終文書同期HEADの全CIとVercel Preview成功を確認して停止する。責任者merge前にProductionで追加生成しない。

---

## 2026-08-15 PR-R4-2K クローズアップの顔フレーミング固定

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#268](https://github.com/team478a/manga/pull/268)
- Vercel Preview: https://mangai-hub-staging-gmukjl68x-team478as-projects.vercel.app
- Branch: `codex/fix-r4-2k-closeup-framing`
- Base: `origin/feature/manga-canvas-mvp`@`0d987a0`（PR #267 merge commit）。
- Production受入れ: PR #267反映後、`test`モニターのページ22で失敗候補の安全な再実行を1回だけ行った。Jobは1件だけ登録され、Worker run `31859031742`が`requests=2 processed=1`で成功した。使用creditは38→40、予約2→0、残り60で、重複POSTと継続Workerはなかった。
- 品質結果: 新しい704×1024 Assetは疑似文字を含まず技術的には正常完了したが、鼻・口・顎だけの極端な寄りとなり、両目と顔全体が画面外へ切れた。販売品質未達のため配置・品質承認・追加生成は行っていない。
- 原因: `close_up`は「顔と表情が主役」とだけ指定され、顔全体をフレーム内へ保つ境界がなかった。参照画像と縦長出力の組み合わせでProviderが下顔面へ過度に寄る余地が残っていた。
- 実装: ネーム画角と画面上書き画角から実効画角を一度解決し、人物を含む`close_up`だけへ、頭頂から顎まで、両目・鼻・口・顎、頭上・顎下の余白を日英の正方向Promptで固定する。同一生成契約の先頭と末尾へ再利用する。
- 非対象: `wide`等へ上書きした場合、人物を生成しない背景・効果Job、意図的な`extreme_close_up`／`detail`には顔全体契約を混入させない。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF、checkpoint、成人向け境界、Desktop。
- 検証: 集中26/26、Hub全体、Canvas 26/26、AI 48/48、100ページ長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository受入れ、owner isolation、workspace package build、Webpack production build、RC structure、diff check成功。
- ローカル既知制約: 標準Turbopack buildはWindowsパス長上限で停止。Desktop typecheck／test／a11yは既存`@napi-rs/keyring`型宣言不足でbuild前停止した。今回Desktop差分はなく、GitHub Windows CIとVercelを正式結果とする。
- CI: 実装・Draft PR記録HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。Draft／MERGEABLE。
- Production変更: 上記PR #267受入れの1 Job／2 creditだけ。R4-2Kコード実装後のProvider E2E、既存画像の配置・承認、DB／Storage／作品内容の変更は行っていない。
- 証跡: `docs/RELEASE_CANDIDATE_R4_2K_CLOSEUP_FRAMING.md`
- 次: 最終文書同期HEADの全CIとVercel Preview成功を確認して停止する。責任者merge前にProductionで追加生成しない。

---

## 2026-08-15 PR-R4-2J Provider拒否後の対話型コマ安全再実行

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#267](https://github.com/team478a/manga/pull/267)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-p3ch4z2xg-team478as-projects.vercel.app
- Branch: `codex/fix-r4-2j-interactive-safe-retry`
- Base: `origin/feature/manga-canvas-mvp`@`193f0ae`（PR #266 merge commit）。
- Production切り分け: 品質参照Assetを作品全体の画風へ1件登録し、ページ22の不良候補を1案だけ作り直した。公式Workerで同一Provider Jobのpoll継続を確認したが、初回と画面からの1回の再実行はいずれもProvider完了時に失敗した。各回の予約2 creditは全額解放され、使用38、予約0、残り62へ復元した。追加実行は停止した。
- 根因: ページ編集画面の失敗Job再実行は失敗Job IDを使わず、同じパネルから元の生成Promptを再構築していた。未マージの旧PR #254に長編batch専用の安全化はあったが、現行基準にも対話型経路にも含まれていなかった。
- 実装: `POST /api/creator/generation-jobs/[jobId]/retry`を追加し、RLS下で失敗Jobの保存済み入力を復元する。Provider投入後の`provider_rejected`／`provider_moderation_blocked`だけ、人物外見、画風、参照Asset、対象コマ、source revisionを保持したまま動作・感情・演出を一般向けの間接表現へ安全化する。Panel Specificationも新Jobへ引き継ぐ。
- 再送防止: 安全化済み入力が再度Provider拒否された場合は同一入力を再登録せず、構図・内容変更を案内する。BFLの`Request Moderated`／`Content Moderated`は即時の非retry moderation拒否へ分類する。長編batchの失敗Jobにも同じDomain policyを適用する。
- 不変: DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、retry回数、210秒timeout、30分上限、Scheduler、Canvas schema、PNG／PDF、checkpoint、成人向け境界、Desktop。
- 検証: 集中27/27、Hub全体、Canvas 26/26、AI 48/48、100ページ長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository受入れ、owner isolation、workspace package build、Webpack production build、RC structure、diff check成功。
- ローカル既知制約: 通常Turbopack buildはWindows path長上限、Desktop test／a11yは既存`@napi-rs/keyring`型宣言不足で停止。今回Desktop差分はなく、GitHub Windows CIとVercelを正式結果とする。
- CI: 初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。Windows CIでDesktop TypeScript、tests、Accessibility、unpacked buildを確認した。
- Production変更: 参照登録1件と上記2回の限定生成以外は変更なし。コード実装後のProvider E2E、DB／Storage／作品内容の追加変更は行っていない。
- 旧PR: PR #254はOPENのまま変更・comment・close・mergeしていない。本PRは最新基準から独立実装する。
- 証跡: `docs/RELEASE_CANDIDATE_R4_2J_INTERACTIVE_SAFE_RETRY.md`
- 次: 文書同期後の最終HEADでも全CI／Vercel Previewを確認して停止する。merge前にProductionで再実行しない。

---

## 2026-08-15 PR-R4-2H 参照付き単一コマ生成

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#265](https://github.com/team478a/manga/pull/265)
- Vercel Preview: https://mangai-hub-staging-jk5shubps-team478as-projects.vercel.app
- Branch: `codex/quality-r4-2h-grounded-panel-generation`
- Base: `origin/feature/manga-canvas-mvp`@`78eccff`（PR #264 merge commit）。
- Production受入れ: ページ22の問題3コマを各1案だけ再制作し、Worker run `31809744470`で3/3完了。使用32→38、予約6→0、残り62、重複Jobなし。成人向け誤判定は解消した。
- 品質結果: 無関係な複数場面＋生成文字、顔切れ、救助動作の人体・接触破綻が残った。3候補は配置・承認せず、正常画像、Canvas、公開・販売状態は変更していない。追加有料生成は停止した。
- 実装: Panel Specificationから「一枚の場面画像」契約を作り、Provider Promptの先頭と末尾へ固定する。枠のない一枚画像、登場人数、人物、動作、場所、構図、画角を同じ正本から指示する。
- 参照画像: DB作成順の先着8件を廃止し、最大32件のbounded読込後に人物各2件→画風1件→場所／小物各1件の順で最大8件へ固定する。参照の役割と生成契約優先をProviderへ明示する。
- 不変: URL、公開API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF、checkpoint、成人向け境界、Desktop。
- 検証: 集中24/24、Hub全体、Canvas 26/26、AI 48/48、100ページ長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository受入れ、workspace package build、Webpack production build、RC structure、diff check成功。
- Desktop: 既存`@napi-rs/keyring`型宣言不足でtypecheck／test／a11y／buildがbuild前停止。Desktop差分はなくGitHub Windows CIを正式結果とする。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Windows CIでDesktop TypeScript、tests、Accessibility、unpacked buildも成功した。
- Production変更: 限定受入れの3 Job／6 credit以外に変更なし。本PR実装後のProvider E2Eはmerge前に行わない。
- 証跡: `docs/RELEASE_CANDIDATE_R4_2H_GROUNDED_PANEL_GENERATION.md`
- 次: Draft PR、全CI、Vercel Preview成功で停止する。merge後は参照設定を先に確認し、1コマ1案だけで限定受入れする。

---

## 2026-08-14 PR-R4-2G 一般漫画Promptと成人向け検知の語彙衝突修正

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#264](https://github.com/team478a/manga/pull/264)（Draft／MERGEABLE）
- Vercel deployment: https://vercel.com/team478as-projects/mangai-hub-staging/84qDxxD1emsNu6s18yQ6ZNsbPiL5
- Branch: `codex/fix-r4-2g-prompt-moderation-collision`
- Base: `origin/feature/manga-canvas-mvp`@`6fb9bf0`（PR #263 merge commit）。
- Production限定受入れ: ページ22の不良候補1件を再制作しようとしたが、Provider登録前に`adult_content`でfail-closed拒否された。使用32、予約0、残り68で、新規Job・Provider課金・Assetは0。残り2件は未操作。
- 原因: R4-2Fの非正立動作向け英語Promptに`explicitly described`を追加した一方、既存一般Cloud moderationは`explicit`を成人向け語として遮断するため、一般漫画Promptが自己拒否した。
- 修正: 意味を維持して`clearly described`へ置換し、落下構図の完成Promptが既存moderationで`allow`になる回帰テストを追加する。成人向けpatternとfail-closed境界は変更しない。
- Production復元: 切り分け中の誤配置1件はUndo後に保存済みを確認した。公開・販売状態は変更していない。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF、checkpoint、成人向け境界、Desktop。
- 検証: 集中23/23、Hub 714/714、Canvas 26/26、AI 48/48、100ページ長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository受入れ、Webpack production build、RC structure成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。
- 証跡: `docs/RELEASE_CANDIDATE_R4_2G_PROMPT_MODERATION_COLLISION.md`
- 次: 責任者のreview／merge判断まで停止する。merge前にProduction再生成を行わない。

---

## 2026-08-14 PR-R4-2F Provider生成コマの再制作品質

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#263](https://github.com/team478a/manga/pull/263)（Draft／MERGEABLE）
- Vercel deployment: https://vercel.com/team478as-projects/mangai-hub-staging/3WsM1i1ZiJBujvajZh46Gv4zQLwB
- Branch: `codex/fix-r4-2f-provider-panel-quality`
- Base: `origin/feature/manga-canvas-mvp`@`9fbf228`（PR #262 merge commit）。
- Production限定受入れ: ページ22の不良2画像を各1回だけ作り直し、Worker run `31802403441`で2件ともProvider生成完了。creditは使用28→32、予約4→0、残り68。新画像にも人体／小物融合と疑似文字が残ったため配置・承認せず、追加有料再実行を停止した。
- 原因: BFLへnegative promptを送らない既存契約上、正方向Promptの小物接触・無地表面・非正立例外が不足していた。再制作も同じ条件を再送し、承認取消し、未配置候補却下、後続Job中の重複防止がなかった。
- 実装: 正立／明示された非正立動作を分離し、紙面の正立、人体、小物接触、衣服との境界、非記号的な無地表面を日英Promptへ追加する。再制作へ既存`compositionInstruction`で品質修正を付ける。未配置候補と承認済み画像の却下・1案再制作、同じコマの生成中／候補確認待ちで古い再実行を停止する。
- 不変: URL、公開API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、retry、timeout、Scheduler、Canvas schema、PNG／PDF、checkpoint、成人向け境界、Desktop。
- 検証: 集中41/41、Hub 714/714、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository受入れ、Webpack production build、RC structure、diff check成功。標準Turbopackは既知のWindows path長、Desktopは既存`@napi-rs/keyring`型宣言不足で停止し、CIを正式結果とする。
- Production: 手動確認待ち2画像は未配置。公開・販売状態、DB、migrationは変更していない。追加Provider実行は行わない。
- 証跡: `docs/RELEASE_CANDIDATE_R4_2F_PROVIDER_PANEL_QUALITY.md`
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Windows CIでDesktop tests、Accessibility tests、unpacked buildも成功した。
- 次: 責任者のreview／merge判断まで停止する。merge前にProduction再生成を行わない。

---

## 2026-08-14 PR-R4-2E 生成原稿の最終品質ゲート

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#262](https://github.com/team478a/manga/pull/262)（Draft／MERGEABLE）
- Vercel Preview deployment: [成功](https://vercel.com/team478as-projects/mangai-hub-staging/9DPtY51tHu77KUhqhmEZBcWy4smy)
- Branch: `codex/quality-r4-2e-final-manuscript-gate`
- Base: `origin/feature/manga-canvas-mvp`@`51a9864`（PR #261 merge commit）。
- 実機所見: Productionページ22は4コマへ画像が表示されたが、上下反転した人物、画像内の吹き出し／疑似文字、過大な文字、人物連続性の弱さが残り、画像存在だけの完成判定では販売品質を保証できない。
- 実装: 正立方向、自然な重力・人体、意味のある絵柄だけを日英の正方向Promptへ追加する。自動吹き出しを縮小・左右分散し、最大文字サイズを32pxへ下げる。
- 品質gate: 自動配置した生成画像は、ownerが既存品質ログへ`selected`を記録するまでページを`review_required`とする。Editorに品質確認と対象コマ1案だけの作り直しを追加し、未確認／却下画像をcheckpoint、PNG／PDF、公開・販売の共通完成guardで停止する。
- 費用境界: OpenAIによる自動視覚判定は、コマ単位の費用を現行Cloud AI価格・credit台帳の外へ増やすため実装しない。新しいProvider呼出し、job type、価格、migrationは追加しない。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PDF／PNG形式、成人向け境界、Desktop。
- 現在の検証: 集中54/54、Hub 711/711、Canvas 26/26、AI 48/48、長編4/4、research eval、deps、lint、Hub typecheck、migration 59/59、Webpack production build、Cloud漫画repository preflight、RC structure、4ページPNG／PDF fixture、diff check成功。標準Turbopackは既知のWindows path長上限、Desktop依存再構築はVisual Studio C++環境不足、Desktop型検査は既存`@napi-rs/keyring`型宣言不足で停止したため、GitHub Windows CIを正式結果とする。
- Production: DB、既存作品、Provider Job、credit、公開作品を変更していない。実Provider再生成は行っていない。
- 証跡: `docs/RELEASE_CANDIDATE_R4_2E_FINAL_MANUSCRIPT_QUALITY_GATE.md`
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。現在のChrome／Vercel CLIは別Vercelアカウントのため直接Preview URLのDashboard表示は404だったが、GitHub deployment checkの成功を確認した。
- 次: 責任者のreview／merge判断まで停止する。merge前にProduction再生成を行わない。

---

## 2026-08-14 PR-R4-2D 作品管理・販売準備と完成原稿の連携

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#261](https://github.com/team478a/manga/pull/261)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-rjp97t5rz-team478as-projects.vercel.app
- Branch: `codex/feat-r4-2d-work-publication-link`
- Base: `origin/feature/manga-canvas-mvp`@`a8f8d05`（PR #260 merge後）
- 正本: `MANGAI_PR-R4-2C以降_完全版_2026-08-14.md`のPR-R4-2D。
- 契約: `works.source_project_id`をProject関連、`cloud_project_checkpoints.kind='release'`を完成原稿の固定点、`orders.status='paid'`を購入後閲覧権限とする。旧1枚画像作品はpublication列nullで維持する。
- 実装: version付きpublication／本文ページ、checkpoint固定PNG・PDF、公開・販売Server gate、停止後のversion切替、sample／購入後／ownerを分離した縦長reader、作品編集表示を追加した。
- 検証: 集中7/7、Hub 708/708、Canvas 26/26、AI 48/48、Desktop 182/182、deps、lint、全typecheck、migration 59/59、PostgreSQL 16で全forward→rollback→forward、Webpack Hub build、Desktop build、RC structure preflight、diff check成功。通常Turbopack buildは既知のWindows path長上限、Desktop a11yはローカルElectron起動timeoutのため、GitHub Windows CIを正式結果とする。
- Production: PR #260のmergeは確認済み。Chrome接続が再読込時に連続timeoutしたためページ20・22のmerge後目視は未完了。Production DB、作品、Provider Job、creditは変更していない。
- 証跡: `docs/RELEASE_CANDIDATE_R4_2D_WORK_PUBLICATION_LINK.md`
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。PreviewはVercel SSOへの正常な302応答まで読み取り確認した。
- 次: 責任者のreview／merge判断まで停止する。Production migration、既存作品のpublication変換、公開・販売、本番決済は行わない。

---

## 2026-08-14 PR-R4-2C-1 ページ別生成候補境界・配置復旧

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#259](https://github.com/team478a/manga/pull/259)
- Vercel Preview: https://mangai-hub-staging-git-codex-quality-a4aee1-team478as-projects.vercel.app
- Branch: `codex/quality-r4-2c1-provider-manga`
- Base: `origin/feature/manga-canvas-mvp`@`6f3c82a`（PR #258 merge commit）
- Production監査: 一般モニター`test`の既存32ページ作品で、19〜22ページは全コマ白紙。作品全体は画像配置3/157、要修正265、対象batchは16 Job化済み・14完了・2失敗・待機／処理中0。creditは使用28・予約0・残り72で、追加Provider呼出しは行っていない。
- 原因1: Production migration `202608140001`〜`202608140003`は未適用／未確認のままで、完了Jobの自動採用台帳・revision連鎖・dialogue回収が動作していない。現在のSupabase Dashboard sessionは対象projectを参照できず、別projectへSQLを誤適用していない。
- 原因2: 原稿Editorがproject全体の直近100 Jobを全ページへ表示していた。別ページ用の完成候補を押しても、対象panelが現在Canvasにないことを検出せず「配置しました」と誤表示し、内容不変のsnapshot保存だけが発生し得た。
- 修正: 生成履歴APIへ後方互換の任意`pageId`を追加し、DB queryの`limit(100)`前にproject＋pageで限定する。SSR、再読込、client stateでも現在ページだけへ絞り、別ページJobと存在しないpanelを配置前に拒否する。
- Production変更: 切り分け中に別ページ用候補を19ページへ1回だけ手動配置操作した。追加課金、Provider Job、Asset、Canvas画像追加は0で、再読込後も画像・本文は不変。既存保存RPCにより内容不変revisionが1回進んだ可能性は残る。以後の手動配置と失敗Job再実行は停止した。
- 不変: DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF、成人向け境界、Desktop。
- 現在の検証: 集中9/9、Hub全体、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y violations 0、deps、lint、全typecheck、migration 58/58、research eval、Webpack Hub build、Desktop build、RC structure preflight、diff check成功。通常Turbopack buildだけは既知のWindows path長上限で停止した。Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsも成功し、PreviewのMANGAIトップ表示を確認した。
- 次: 責任者のreview／merge判断まで停止する。merge後はProduction migration適用を先に行い、14完了画像の回収後、2失敗Jobだけを再実行する。PR-R4-2Dへは進まない。

---

## 2026-08-14 PR-R4-2C ページ完成判定・4ページ原稿プレビュー

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#258](https://github.com/team478a/manga/pull/258)
- Vercel Preview: https://mangai-hub-staging-git-codex-feat-r4-859121-team478as-projects.vercel.app
- Branch: `codex/feat-r4-2c-page-completion`
- Base: `origin/feature/manga-canvas-mvp`@`ef533307`（PR #257 merge commit）
- 正本: `MANGAI_PR-R4-2C以降_完全版_2026-08-14.md`のPR-R4-2Cだけを実施する。PR-R4-2A／2Bは再実装せず、PR-R4-2Dへは進まない。
- 完成判定: 最新保存Canvas、page／snapshot revision、採用Storyboardの必須dialogue、最新画像生成操作、配置台帳、project内Asset実体、実PNGレンダリングをsource of truthにする。Job完了率やclient stateは作品完成率に使わない。
- 実装: domain completion判定と作品集計、application inspection、原稿編集状態、4ページ原稿preview、private PNG routeを追加。page finalized、release checkpoint、durable PDFへ共通server guardを追加する。
- DB: migration／RPC／状態値の追加なし。既存`production_status`とCanvas schema／保存契約を維持する。
- fixture: 4ページ×2コマ、各800×1200 pxで4/4 complete、PNG 4枚、4ページPDFを生成。Poppler再描画でページ順、欠落、重複、縦長切れがないことを確認した。
- Production: DB、migration、Storage、既存32ページ作品、Provider Job、creditを変更しない。本番課金Provider E2Eは実行しない。
- 検証: 集中10/10、Hub 702/702、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y violations 0、deps、lint、全typecheck、migration 58/58、research eval、Webpack Hub build、Desktop build、RC structure preflight、diff check成功。通常Turbopack buildだけは既知のWindowsパス長上限で停止した。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。Preview上のMANGAIログイン画面と未認証redirectを確認し、作品／DBは操作していない。
- 次: 責任者のreview／merge判断まで停止する。責任者確認前にPR-R4-2Dへ進まない。
- 詳細: [`RELEASE_CANDIDATE_R4_2C_PAGE_COMPLETION.md`](RELEASE_CANDIDATE_R4_2C_PAGE_COMPLETION.md)

---

## 2026-08-14 PR-R4-2B セリフ・ナレーションの自動配置

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#257](https://github.com/team478a/manga/pull/257)
- Vercel Preview: https://mangai-hub-staging-git-codex-feat-r4-18faf7-team478as-projects.vercel.app
- Branch: `codex/feat-r4-2b-dialogue-placement`
- Base: `origin/feature/manga-canvas-mvp`@`306a2fb`（PR #256 merge commit）
- 正本: `MANGAI 実装指示書 PR-R4-2 漫画完成パイプラインの構築`のPR-R4-2Bだけを実施する。PR-R4-2C／2Dへは進まない。
- 監査: 採用Storyboardの各panelに`dialogue[{type,speaker,text}]`があり、初期materializationも吹き出しと`parentBalloonId`付きテキストを作る。一方、画像自動配置後の最新版Canvasに構造化セリフを再保証するWorker／application／永続化境界がなく、既存Production原稿の空吹き出しを修復できなかった。panel specificationは画像生成仕様、scenarioは`dialogueGoal`であり、実行時の本文推測には使わない。
- domain: Storyboardのpage番号とCanvasのpanel順を対応させ、対象コマ内の吹き出しを上→右から左の読書順で使用する。空吹き出しを優先し、不足時だけコマ内へspeech／thought／narration型の吹き出しを作る。本文は縦書き、改行保持、42pxから18pxまで自動縮小し、最小でも収まらない場合は完成blockerにする。
- 手動編集保護: 空でない別本文、親なし既存本文、locked panel／balloon／text、finalized pageを上書きしない。同じ本文と`parentBalloonId`が存在する場合は成功no-opにし、同じセリフを重複させない。既存の空かつ未固定textObjectは再利用する。効果音の高度配置は今回の優先対象外で、対応不能としてblockerへ固定する。
- application／Worker: 画像Job完了後にR4-2A採用を先に行い、同一batch・同一pageの全targetが`auto_placed`になった時だけページ単位でセリフを配置する。画像途中ではpage revisionを進めない。中断分は次回Worker runで1ページずつ回収し、永続化失敗の再試行は最大2回で止める。文章生成Jobの完了は配置完了に使用しない。
- DB: migration `202608140003_cloud_page_dialogue_placements`でowner限定のページ配置台帳とservice-role限定RPCを追加する。page row lock、expected revision、finalized、全画像配置、採用Storyboard、2 MiB上限を再検証し、Canvas snapshot、page／project revision、version event、配置結果を同一transactionで保存する。画像・panelLayers等は既存Canvasと完全一致させ、変更をballoons／textObjectsに限定する。本文は台帳・manifest・logへ保存しない。
- UI: 原稿編集画面に自動配置済み件数、確認待ち、配置失敗を表示する。内部理由や本文は台帳表示に含めない。
- 現在の検証: 集中9/9、Hub 691/691、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y violations 0、deps、lint、Hub／Desktop typecheck、migration 58/58、research eval、Webpack Hub build、Desktop build、RC structure preflight、diff check成功。PostgreSQL 16でforward全適用→rollback全適用→forward再適用とassertionに成功。通常Turbopack buildだけは既知のWindowsパス長上限で停止し、同一sourceのWebpack buildを成功させた。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- Production: migration `202608140001`〜`202608140003`の適用と実Provider受入れは未確認。既存Chrome Productionタブへの読み取り接続がtimeoutしたため、成功扱いにしない。DB・画面・Provider Jobは変更していない。
- 不変: URL、公開API、既存RPC、Storage、Feature Flag、Provider、model、pricing、credit、生成retry／timeout、Scheduler頻度、Canvas schema、PDF／PNG、成人向け境界、Desktop。
- 次: 責任者のreview／merge判断まで停止する。Production migrationと実Provider受入れは未確認のまま維持し、責任者確認前にPR-R4-2Cへ進まない。
- 詳細: [`RELEASE_CANDIDATE_R4_2B_DIALOGUE_PLACEMENT.md`](RELEASE_CANDIDATE_R4_2B_DIALOGUE_PLACEMENT.md)

---

## 2026-08-14 PR-R4-2A-1 同一ページ複数コマの自動配置revision連鎖

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#256](https://github.com/team478a/manga/pull/256)
- Vercel Preview: https://mangai-hub-staging-2c6ir91um-team478as-projects.vercel.app
- Branch: `codex/fix-r4-2a-batch-revision-chain`
- Base: `origin/feature/manga-canvas-mvp`@`f11b893`（PR #255 merge commit）
- 発見: 一括生成targetは同一ページの全コマで同じ`source_page_revision`を固定する。最初のコマの自動配置がページrevisionを1進めるため、現行R4-2Aは2コマ目以降を`source_revision_changed`として停止する。1ページにつき最初の1画像だけが自動配置され得るため、PR-R4-2A受入条件を満たさない。
- 原因: applicationとservice-role保存RPCが`current revision === source revision`だけを安全条件にしており、revision差分がR4-2A自身の自動配置だけで構成される正当な連続処理を区別できない。
- 修正方針: `source_page_revision + 1`から現在revisionまでの全revisionが、同じページ・同じsource revisionの`auto_placed`台帳で欠番なく証明できる場合だけ後続コマを許可する。applicationの事前判定とDB transaction内の最終判定を一致させる。
- 手動編集保護: 途中に通常Canvas保存、セリフ配置、復元、その他のrevision更新が1件でも入れば台帳revisionに欠番が生じるため、従来どおり`source_revision_changed`で確認待ちにする。既存画像、locked、finalized、owner境界は変更しない。
- 回帰対象: 同一source revisionの2コマ連続採用、3コマ以上の連鎖、revision欠番、別source revision、手動画像、冪等再処理、DB service-role限定。
- 実装: application contextへDB検証済みの自動revision連鎖判定を追加し、通常のrevision差分は引き続き確認待ちにする。repositoryはservice-role限定の連鎖確認RPCとv2保存RPCを使用する。
- DB: migration `202608140002_cloud_generation_panel_adoption_revision_chain`で、`source + 1`から現在revisionまでの全番号が同じページ・同じsource revisionの`auto_placed.applied_page_revision`に存在することを検証する。保存時はpage row lock後の実revisionで再検証し、欠番をfail-closedにする。rollbackとmanifestを追加した。
- 検証: 集中14/14、Hub 682/682、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y violations 0、deps、lint、全typecheck、migration 57本、research eval、Webpack Hub build、Desktop build、RC structure preflight、diff check成功。通常Turbopack buildのみ既知のWindows path長上限で停止した。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 次: 責任者のreview／merge判断まで停止する。merge後にmigration `202608140001`と`202608140002`を順番に適用して複数コマ自動配置を実機確認し、責任者確認前にPR-R4-2Bへ進まない。

---

## 2026-08-14 PR-R4-2A 生成画像の自動採用・Canvas自動配置

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#255](https://github.com/team478a/manga/pull/255)
- Vercel Preview: https://mangai-hub-staging-2pohngbee-team478as-projects.vercel.app
- Branch: `codex/feat-r4-2a-auto-panel-adoption`
- Base: `origin/feature/manga-canvas-mvp`@`d7a7062`（PR #253 merge commit）。PR #254はDraft／OPEN／MERGEABLEで未マージのため、そのbranchへ変更を追加せず独立branchで進める。
- Job／Asset: Workerは`complete_cloud_generation_image_job`でStorage Assetと`cloud_generation_jobs.status=completed`を原子的に確定するが、完了後は品質評価だけでCanvas配置・保存を行っていない。
- Batch linkage: `cloud_generation_batch_targets.generation_job_id`からJob、`page_id`、`panel_id`、`source_page_revision`を一意に追跡でき、`cloud_generation_batch_jobs`もbatch／page／jobを保持する。一括生成は1コマ1候補である。
- Canvas保存: `save_cloud_page_snapshot`はpage row lock、expected revision、2 MiB上限、finalized拒否、snapshot追加、project revision追加を同一transactionで行う。現行は認証利用者専用で、service-role Workerからの自動採用用契約はない。
- Canvas構造: `PageCanvas`は`panels`、`panelLayers`、`balloons`、`textObjects`を持つ。画像候補の手動採用はClientが`applyPanelCandidateAdoption`を呼び、background／correctionでは`panel.imageAssetId`も更新してautosaveする。現行domain処理には同一Job／Assetの重複防止がない。
- セリフ情報: 採用storyboardの各panelに`dialogue[{type,speaker,text}]`、scenarioに`dialogueGoal`、panel specificationに対象panelの生成仕様がある。Canvas側の吹き出しとテキストは別配列で、現時点では自動関連付けされない（PR-R4-2B対象）。
- 制作状態: `not_started`、`generating`、`review_required`、`revision_required`、`finalized`を使用する。Job完了triggerは`review_required`にするが、画像配置・セリフ・保存を確認せずページ完成とは判定していない。
- 完成物: release checkpointは全ページfinalized・context一致を要求し、PNGは単一Canvas、durable PDFは分割Workerと非公開Storageを使用する。作品全体の完成判定・4ページ連続プレビューはPR-R4-2C対象。
- Works linkage: `works.source_project_id`でCloud制作Projectと一意に関連し、Marketplace draft作成経路が存在する。完成原稿との公開・販売連携はPR-R4-2D対象。
- PR-R4-2A方針: Worker完了通知後にManga application serviceが自動採用可否を判定し、Canvas domainの冪等処理を通し、service-role限定RPCでowner／Job／Asset／page／panel／source revision／finalizedを再検証して永続保存する。手動編集・locked・revision変更時は上書きせず確認待ちとして記録する。
- 実装: 1候補のネーム生成とdurable batch targetを自動採用対象として記録し、Job完了直後に対象Canvasへ配置する。Worker中断で取り残された完了Jobは次回runで1件ずつ回収し、自動retryは最大2回で止める。background／correctionは`panel.imageAssetId`も更新し、同一`sourceJobId`または同一panel＋assetは成功no-opにする。
- 永続化: migration `202608140001_cloud_generation_panel_adoptions`でowner限定の採用結果台帳とservice-role限定の検索／結果記録／snapshot保存RPCを追加する。snapshot、page revision、project revision、制作状態、採用結果を同一transactionで更新し、rollbackを用意した。
- UI: 生成中、画像生成完了、自動配置済み、手動確認待ち、配置失敗、再実行可能を表示する。自動配置済みの通常採用buttonは隠し、安全に再読込できる場合は保存済みCanvasへ自動更新する。手動確認時の既存採用導線は維持する。
- 保護: 生成開始後revision変更、別画像、locked panel／layer、finalized、明示拒否では既存画像を削除・上書きしない。owner／project／page／panel／Job由来Assetの一致をDB側でも再確認する。Prompt、画像、秘密値、Provider応答はログ・公開responseへ追加しない。
- ローカル検証: 集中29/29、Hub全体、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y violations 0、deps、lint、全typecheck、migration 56本、research eval、Webpack Hub build、Desktop build、RC structure preflight、diff check成功。通常Turbopack buildのみ既知のWindows path長上限で停止し、同一sourceのWebpack buildで成功した。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 次: 責任者のreview／merge判断まで停止する。merge後はProduction migrationを先に適用し、Workerで1候補生成画像がCanvasへ自動配置されることを実機確認する。責任者確認前にPR-R4-2Bへ進まない。
- 対象外: PR-R4-2B〜2D、Provider、model、pricing、retry、timeout、Scheduler頻度、成人向け境界、Desktop。

---

## 2026-08-13 PR-R4-1ab 長編一括生成登録阻害の解消

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#250](https://github.com/team478a/manga/pull/250)
- Vercel Preview: [deployment](https://vercel.com/team478as-projects/mangai-hub-staging/9xJFUBsRdwSi41RhpvSBD6rFNNd5)
- Branch: `codex/fix-r4-1ab-batch-registration-diagnostics`
- Base: `origin/feature/manga-canvas-mvp`（`09da196`、PR #249 merge commit）
- PR #249はmerge commit `09da19696a6bfa8dcb5bc45a03262b5ce0856acc`でマージ済み。
- Production実機: `test`へTrial 30日を付与後、作品`b008b746-94c6-4e83-85dd-3bb0e379c96a`の19〜22ページ（4ページ／16コマ）を1回だけ開始した。画風、主要人物3/3名、32/100 credit、model／pricingは合格していたが、永続登録前に「一括生成を開始できませんでした。」でfail-closedになった。
- 安全性: 一括生成履歴0、利用／予約credit 0、Provider Job 0を確認し、再試行していない。
- 実装: 準備／入力schema／RPC登録を安全な失敗段階へ分類する。既存RPC signatureと原子性を保ったまま、登録検証を固定code化し、PostgREST schema cache reloadを通知する。未知のDB情報、Prompt、画像、payloadは表示しない。
- 不変: URL、公開API、RPC signature、Storage、Feature Flag、Provider、model、pricing値、credit、retry、timeout、rate limit、Scheduler、Canvas、PDF／PNG、成人向け境界、Desktop。
- 検証: 集中16/16、Hub 662/662、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y violations 0、deps、lint、全typecheck、migration 55/55、Hub／Desktop build、RC structure、diff check成功。Hub buildはWindows長pathを避けた短い物理worktreeで同一commitを確認した。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 次: 責任者のreview／merge判断まで停止する。merge後にProduction migrationを適用し、同じ4ページ生成を1回だけ再受入れする。
- 証跡: [`RELEASE_CANDIDATE_R4_1AB_BATCH_REGISTRATION_DIAGNOSTICS.md`](RELEASE_CANDIDATE_R4_1AB_BATCH_REGISTRATION_DIAGNOSTICS.md)

---

## 2026-08-13 PR-R4-1aa-3 長編一括生成条件固定

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#249](https://github.com/team478a/manga/pull/249)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-cd467b-team478as-projects.vercel.app
- Branch: `codex/fix-r4-1aa-batch-prompt-freeze`
- Base: `origin/feature/manga-canvas-mvp`（`3b5b7da`、PR #248 merge commit）
- PR #248はmerge commit `3b5b7da3b4d63b0db897cbe8bc07cec2f53ea7c3`でマージ済み。
- 監査: 一括生成は採用scenario、人物visual profile、作品style bible、negative promptを各targetへ含め、人物／画風versionも固定していた。ただし複数chunkの準備中に管理model／pricingまたは人物／画風が更新されると、同一batch内へ異なる条件が混在する時間差があった。
- 実装: 全target準備後、durable登録RPCより前に、preflight時点のProvider／model／pricingと、画風ID／version、同一人物profileのversionが一貫することを確認する。不一致はfail-closedで中止する。
- 不変: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing値、credit、retry、timeout、Scheduler、Canvas、PDF／PNG、成人向け境界、Desktop。
- Production: `test`の画風v1、主要人物3名v1は設定済み。19〜22ページは必要32 creditに対して残り8で24不足。実Provider Job、batch target、credit消費は追加していない。
- 検証: 集中・関連21/21、Hub 658/658、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y、deps、lint、全typecheck、migration 54/54、Hub／Desktop build、diff check成功。RC外部設定／manual E2Eはローカルに本番SecretがないためPENDING。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 次: 責任者のreview／merge判断まで停止する。merge後、管理者が`test`へTrial 30日を付与して4ページ生成を1回だけ行う。
- 証跡: [`RELEASE_CANDIDATE_R4_1AA_BATCH_PROMPT_FREEZE.md`](RELEASE_CANDIDATE_R4_1AA_BATCH_PROMPT_FREEZE.md)

---

## 2026-08-13 PR-R4-1aa-2 Productionビジュアル設定受入れ

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#248](https://github.com/team478a/manga/pull/248)
- Vercel Preview: https://mangai-hub-staging-git-codex-release-dfd32f-team478as-projects.vercel.app
- Branch: `codex/release-r4-1aa-visual-setup`
- Base: `origin/feature/manga-canvas-mvp`（`bf6e86e`、PR #247 merge commit）
- PR #247はmerge commit `bf6e86eb06dc1f285b9d190f8f6d6942ae89415b`でマージ済み。
- Production実機: 一般向けモニター`test`の作品`b008b746-94c6-4e83-85dd-3bb0e379c96a`へ、現代犯罪サスペンス向けモノクロ画風v1と、`城戸真琴`／`榊圭吾`／`城戸湊`の外見・衣装・固定特徴v1を保存した。
- 再確認: 19〜22ページ、4ページ／16コマを選択すると、作品画風は設定済み、人物は3/3名設定済み。ビジュアルblockerは0になった。
- 残る阻害要因: 必要32 creditに対して残り8 creditで、24不足。生成ボタンはfail-closedで無効。
- 安全性: 実Provider Job、batch target、credit消費は追加していない。Provider、model、pricing、rate limit、Scheduler、DB、Storage、Canvas、PDF／PNG、成人向け境界、Desktopは変更していない。
- 検証: deps、RC structure、diff check成功。Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 次: 責任者のreview／merge判断まで停止する。merge後、管理者が`test`へ既存Trialを30日付与してcredit blocker 0を確認し、4ページ生成を1回だけ行う。
- 停止条件: 残りcreditが32以上になるまで生成を開始しない。4ページ受入れ合格前に8ページ完成原稿／販売品質受入れへ進まない。
- 証跡: [`RELEASE_CANDIDATE_R4_1AA_VISUAL_SETUP.md`](RELEASE_CANDIDATE_R4_1AA_VISUAL_SETUP.md)

---

## 2026-08-13 PR-R4-1aa-1 長編一括生成ビジュアル準備

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#247](https://github.com/team478a/manga/pull/247)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-ff0747-team478as-projects.vercel.app
- Branch: `codex/fix-r4-1aa-visual-readiness`
- Base: `origin/feature/manga-canvas-mvp`（`914f127`、PR #246 merge commit）
- PR #246はmerge commit `914f1278d08d9e5f2a72ad9a34ec89fe417b7602`でマージ済み。
- Production監査: 一般向けモニター`test`の作品`b008b746-94c6-4e83-85dd-3bb0e379c96a`は、作品画風、人物設定、参考画像、連続性台帳が未設定。19〜22ページの採用ネームには`城戸真琴`、`榊圭吾`、`城戸湊`が必要で、未設定のまま16コマを生成すると人物・衣装・画風の連続性を担保できない。
- 実装: 有料長編一括生成のpreflightが採用storyboard／scenarioと人物・画風の現行versionを確認する。画風または選択ページの主要人物設定が不足すればbatch登録前にfail-closedで拒否し、不足人物名と設定画面への導線を表示する。
- 対象外: 単一コマ生成の挙動は維持する。DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas、PDF／PNG、成人向け境界、Desktopは変更しない。
- Production安全性: 生成前バックアップ`作業バックアップ・32ページ・2026/8/13 4:22:55`を作成済み。実Provider Job、batch target、credit消費は追加していない。
- 検証: 集中・関連29/29、Hub 657/657、Canvas 26/26、AI 48/48、Desktop、Desktop a11y violations 0、deps、lint、全typecheck、migration 54/54、Hub／Desktop build、RC structure、diff check成功。Hub buildは短い物理worktreeへ依存関係を実体インストールして同一commitを検証した。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 次: 責任者のreview／merge判断まで停止する。merge後、`test`へTrial 30日付与、作品画風、`城戸真琴`／`榊圭吾`／`城戸湊`の外見設定を完了してから4ページ生成を1回だけ行う。
- 停止条件: visual blockerとcredit blockerが0になるまで生成を開始しない。4ページ受入れ合格前に8ページ完成原稿／販売品質受入れへ進まない。
- 証跡: [`RELEASE_CANDIDATE_R4_1AA_VISUAL_READINESS.md`](RELEASE_CANDIDATE_R4_1AA_VISUAL_READINESS.md)

---

## 2026-08-13 PR-R4-1aa 4ページ限定Production受入れ

- 状態: `CREDIT_ENTITLEMENT_UI_IMPLEMENTED_LOCAL_VALIDATION`
- Draft PR: [#246](https://github.com/team478a/manga/pull/246)
- Vercel Preview: https://mangai-hub-staging-be38wgjhu-team478as-projects.vercel.app
- Branch: `codex/release-r4-1aa-four-page-acceptance`
- Base: `origin/feature/manga-canvas-mvp`（`a5e903d`、PR #245 merge commit）
- PR #245はmerge commit `a5e903d5f062fab9c05068a67a8c102854ff5dd5`でマージ済み。Productionのdurable target ACLは16/16で安全境界を確認済み。
- Production: `https://app.mang-ai.com`。一般向けモニター`test`、作品`b008b746-94c6-4e83-85dd-3bb0e379c96a`で確認する。
- 最小対象: 19〜22ページの4ページ／16コマ、1案／コマ、`flux-2-pro`、`bfl-flux2-2026-03`。必要32 credit、最大予約費用$0.48、Worker最短6回／約30分、1分Job化上限3コマ。
- 現在値: Cloud AI残り8 credit、モニターAI残り85回、作品credit上限なし。24 credit不足のため開始ボタンはfail-closedで無効。実Provider Jobは追加していない。
- 新たな阻害要因: 現行管理画面は全体Planの値だけを編集でき、対象ユーザーへ既存Planを付与する操作がない。接続中ブラウザーとCLIにもProduction Supabase管理者認証がなく、安全な個別付与を実行できない。
- 実装: 管理者ユーザー詳細へCloud AI個別利用枠を追加。既存Free／Trial／Creatorと1〜90日の新期間だけを付与し、Stripe管理中、予約creditあり、queued／running Jobあり、停止中Planはfail-closedで拒否する。変更は管理監査へ記録する。
- 不変: DB／migration／RPC、全体Plan値、Provider、model、pricing、credit単価、rate limit、retry、timeout、Scheduler、Storage、Canvas、PDF／PNG、成人向け境界、Desktop。
- 検証: 集中10/10、Hub 654/654、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y violations 0、deps、lint、全typecheck、migration 54/54、Hub／Desktop build、RC structure、diff check成功。Hub buildはWindows長pathを避けた短い物理worktreeで同一commitを検証した。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。最終文書commit後の再確認を継続する。
- 次: 本解除PRの全CI／merge後、管理者画面から`test`へ既存Trialを30日付与し、残りcredit、blocker 0、要求16コマを再確認してから4ページ生成を1回だけ開始する。
- 停止条件: migrationとcreditの両方が成立するまで生成ボタンを押さない。Provider、model、pricing、rate limit、Scheduler頻度を変更しない。
- 証跡: [`RELEASE_CANDIDATE_R4_1AA_FOUR_PAGE_PRODUCTION_ACCEPTANCE.md`](RELEASE_CANDIDATE_R4_1AA_FOUR_PAGE_PRODUCTION_ACCEPTANCE.md)

---

## 2026-08-13 PR-R4-1z 長編一括生成 durable登録

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#244](https://github.com/team478a/manga/pull/244)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-4ba5a7-team478as-projects.vercel.app
- Branch: `codex/fix-r4-1z-durable-batch-registration`
- Base: `origin/feature/manga-canvas-mvp`（`394707b`、PR #243 merge commit）
- 実装: 4〜8ページ／最大64コマを非公開targetへ全件原子的に永続登録し、Workerが既存Schedulerから1件ずつ既存monitor／rate limit／credit／費用上限を消費してJob化する。
- 安全性: Promptを画面・通常query・ログへ返さない。元page revision／pricing変更はfail-closed。rate limit時はpendingを保持してtight loopを停止し、恒久失敗は固定codeだけを保存して利用者が再試行できる。
- 操作: pauseは新規Job化を停止し、cancelは既存Jobと未Job化targetを中止する。履歴はJob化待ち／Job化済み／完了／失敗を区別する。
- 不変: 公開URL／API、Storage、Provider、model、pricing値、credit単価、retry、timeout、Scheduler頻度／上限、Canvas schema、PDF／PNG、成人向け境界、Desktop code。
- migration: `202608130001_cloud_generation_batch_targets`。全53 migrationのforward／rollback／reapplyと、既存quota経由の原子的dispatchをPostgreSQL 16で確認済み。
- 検証: 集中26/26、Hub 650/650、Canvas 26/26、AI 48/48、deps、lint、全typecheck、migration 53/53、Hub／Desktop build、diff check成功。Hub buildは短い物理worktreeで完走した。Desktop統合／a11yはElectron終了待ち、Windows CIで最終判定する。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1Z_DURABLE_BATCH_REGISTRATION.md`](RELEASE_CANDIDATE_R4_1Z_DURABLE_BATCH_REGISTRATION.md)
- 次: 責任者のreview／merge判断まで停止する。Production migration適用前にR4-1aaの有料4ページ受入れへ進まない。

---

## 2026-08-13 PR-R4-1y 長編一括生成 合算preflight

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#243](https://github.com/team478a/manga/pull/243)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-00d2ff-team478as-projects.vercel.app
- Branch: `codex/fix-r4-1y-longform-batch-preflight`
- Base: `origin/feature/manga-canvas-mvp`（`cbb0d74`、PR #242 merge commit）
- 実装: 選択ページ／対象コマ、現行model／pricing、1候補固定、必要credit、最大予約費用、plan／作品／global／monitor残量、Scheduler下限、1分登録上限を開始前に合算表示する。
- fail-closed: 容量不足、現在snapshot欠損、空ページ、64コマ超、現在の1分登録上限超過はbatch作成前に拒否する。
- 部分登録: 全件登録時だけ成功表示し、途中登録時は要求／登録／未登録コマ数を赤い警告で明示する。履歴は紐付いたJobを「登録済み」と表示する。
- 不変: DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler頻度、Canvas schema、PDF／PNG、成人向け境界、Desktop。
- 検証: 集中17/17、Hub 650/650、Canvas 26/26、AI 48/48、deps、lint、全typecheck、migration 52/52、Hub／Desktop build、RC structure、diff check成功。Hub buildは元worktreeのWindows長path上限を短い物理worktreeで回避した。Desktop統合はElectron終了待ち、Windows CIで最終判定する。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1Y_LONGFORM_BATCH_PREFLIGHT.md`](RELEASE_CANDIDATE_R4_1Y_LONGFORM_BATCH_PREFLIGHT.md)
- 次: 責任者のreview／merge判断まで停止し、責任者確認前にR4-1zや有料4ページ受入れへ進まない。

---

## 2026-08-13 PR-R4-1x 長編漫画credit・段階生成成立条件監査

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#242](https://github.com/team478a/manga/pull/242)
- Vercel Preview: https://mangai-hub-staging-git-codex-audit-r4-5dcaff-team478as-projects.vercel.app
- Branch: `codex/audit-r4-1x-longform-credit-plan`
- Base: `origin/feature/manga-canvas-mvp`（`96f27b6`、PR #241 merge commit）
- 結論: 単一コマ生成は合格したが、現行4〜8ページ一括生成は、Jobごとの作品rate limit（Free 3／Trial 6／Creator 20件/分）で途中終了し得る。必要credit／最大予約費用の合算preflightと、要求数／登録数の差の警告もないため、長編Production受入れは未成立。
- 32ページ成立性: 157コマをProで初回1候補なら314 credit、2候補なら628、3候補なら942。段階生成は`2P + 4C + 6F` creditを基準に、全コマ1候補→選択コマだけ比較→選択コマだけFill修正とする。
- 次PR案: R4-1yで合算preflight／表示、R4-1zでrate limitを越えるdurable登録、R4-1aaで4ページ限定Production受入れ、合格後にR4-1abで8ページ完成原稿／販売品質受入れ。
- 変更範囲: 監査証跡、CURRENT_TASK、AI_HANDOFF、HANDOFF_LOGだけ。application codeと外部契約は変更しない。追加の有料Provider Jobも実行しない。
- ローカル検証: 集中20/20、deps、RC repository structure、diff check成功。RC外部設定とmanual E2Eはローカル秘密情報なしのためPENDING。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1X_LONGFORM_CREDIT_AND_STAGING_AUDIT.md`](RELEASE_CANDIDATE_R4_1X_LONGFORM_CREDIT_AND_STAGING_AUDIT.md)
- 次: 責任者のreview／merge判断まで停止し、責任者確認前にR4-1yを実装しない。

---

## 2026-08-13 PR-R4-1w FLUX単一コマProduction受入れ

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#241](https://github.com/team478a/manga/pull/241)
- Vercel Preview: https://mangai-hub-staging-git-codex-release-f980ec-team478as-projects.vercel.app
- Branch: `codex/release-r4-1w-flux-production-acceptance`
- Base: `origin/feature/manga-canvas-mvp`（`d0091a0`、PR #240 merge commit）
- Production実機: 一般向けモニター`test`、既存32ページ作品の2ページ3コマ目へ2候補を生成した。
- Provider結果: Scheduler [run 31647042128](https://github.com/team478a/manga/actions/runs/31647042128)は`idle requests=3 processed=2`で成功し、2候補ともcompleted 100%。
- 品質結果: 2候補とも単一の全面モノクロ場面で、複数コマ、枠、吹き出し、文字、疑似文字なし。PR-R4-1vの限定実Provider受入れは合格。
- credit／保存: 残12／使用8／予約0から、登録時残8／使用8／予約4、完了時残8／使用12／予約0へ正しく遷移。候補1を採用し、`保存済み`、再読込後の`AI背景レイヤー`復元を確認した。
- 範囲境界: 単一コマ縦切りは利用可能。人物連続性、4〜8ページ一括生成、完成原稿、PDF／PNG、販売品質は未合格のまま。
- 変更範囲: 証跡、CURRENT_TASK、AI_HANDOFF、HANDOFF_LOGだけ。application codeと外部契約は変更しない。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1W_FLUX_PRODUCTION_ACCEPTANCE.md`](RELEASE_CANDIDATE_R4_1W_FLUX_PRODUCTION_ACCEPTANCE.md)
- 次: 責任者のreview／merge判断まで停止。次工程は長編credit／段階生成条件の監査で、責任者確認前に有料4〜8ページ一括生成や実装を行わない。

---

## 2026-08-13 PR-R4-1v FLUX単一コマ正方向Prompt

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#240](https://github.com/team478a/manga/pull/240)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-b536a9-team478as-projects.vercel.app
- Branch: `codex/fix-r4-1v-flux-positive-panel-prompt`
- Base: `origin/feature/manga-canvas-mvp`（`92f379e`、PR #239 merge commit）
- Production再受入れ: 漫画画像2候補はともにcompletedし、4 credit確定、比較、採用、自動保存、再読込後のlayer／Storage path復元まで成功した。PR-R4-1uのtimeout／Scheduler阻害は解消した。
- 品質結果: 候補1は単一コマ・文字なしで合格。候補2は漫画ページ風の複数コマ、吹き出し、疑似文字を含み不合格。画像品質は2件中1件だけの合格。
- 原因: FLUX.2はnegative prompt非対応だが、BFL adapterが禁止語を`Avoid:`としてPromptへ連結していた。避けたい漫画ページ、複数コマ、吹き出し、文字を逆に誘発した。
- 修正: BFLへ共通`negativePrompt`を送らず、単一の全面場面、1 camera view／1 moment、文字のない絵を正方向Promptだけで指定する。共通schemaは他Provider互換のため維持する。
- 不変: Provider、model、pricing、credit、retry、timeout、Scheduler、API key、DB、migration、RPC、Storage、API、URL、Feature Flag、Canvas schema、PDF／PNG、成人向け境界、Desktop code。
- 検証: 集中29/29、Hub 645/645、Canvas 26/26、AI 48/48、migration 52/52、deps、lint、全typecheck、Desktop build、短い物理worktreeでHub build、RC preflight、diff check成功。
- ローカルDesktop統合: Electron終了待ちで結果出力前に停止。Desktop差分なし、Windows CIを最終判定にする。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Core初回のElectron取得HTTP 503は同一commit再実行で成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1V_FLUX_POSITIVE_PANEL_PROMPT.md`](RELEASE_CANDIDATE_R4_1V_FLUX_POSITIVE_PANEL_PROMPT.md)
- 次: 責任者のreview／merge判断まで停止。merge前に追加の有料Jobは実行せず、merge後に未生成コマ1つ・2候補で単一コマ品質を再受入れする。

---

## 2026-08-12 PR-R4-1u 漫画画像生成timeout／Scheduler復旧

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#239](https://github.com/team478a/manga/pull/239)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-2e4013-team478as-projects.vercel.app
- Branch: `codex/fix-r4-1u-image-generation-recovery`
- Base: `origin/feature/manga-canvas-mvp`（`c98e5b1`、PR #238 merge commit）
- Production症状: 未生成コマ1つの2候補がともに1%からfailed。各Worker実行が約126〜128秒で終了し、BFL adapterの120秒poll上限と一致した。
- 修正: BFL poll 210秒、Worker 240秒、Scheduler request 230秒へ整合させる。`failed`を既知の終端状態として後続Jobへ進み、timeoutは秘密値なしの固定診断分類を残す。
- 不変: Provider、model、request、pricing、credit、retry回数、Scheduler頻度、DB、migration、RPC、Storage、API、URL、Feature Flag、Canvas schema、PDF／PNG、成人向け境界、Desktop code。
- 検証: 集中27/27、Hub 645/645、Canvas 26/26、AI 48/48、migration 52/52、deps、lint、全typecheck、Desktop build、短い物理worktreeでHub build、RC preflight、diff check成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1U_IMAGE_GENERATION_RECOVERY.md`](RELEASE_CANDIDATE_R4_1U_IMAGE_GENERATION_RECOVERY.md)
- 次: 責任者のreview／merge判断まで停止。merge後、Productionで未生成コマ1つ・2候補、比較、採用、保存、再読込を実施する。合格前に8ページ一括生成へ進まない。

---

## 2026-08-12 PR-R4-1t 販売下書き完成原稿preflight

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#238](https://github.com/team478a/manga/pull/238)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-6729b3-team478as-projects.vercel.app
- Branch: `codex/fix-r4-1t-marketplace-readiness-preflight`
- Base: `origin/feature/manga-canvas-mvp`（`209d7a6`、PR #237 merge commit）
- 原因: 販売artifact生成がページ1件以上だけを要求し、durable PDF用の完成原稿preflightを使っていなかった。Creator画面の販売buttonも未完成状態で有効だった。
- 修正: 既存の完成原稿preflightを販売artifact生成前に必須化する。全ページ確定、revision一致、再確認済み、生成中なし、必須修正0を満たさない場合はStorage upload前に`ValidationError`で拒否する。画面も同じ条件でbuttonを無効化し、要修正件数を案内する。
- 正常系: 完成原稿だけが従来どおり非公開作品／販売停止商品を作成・更新できる。公開中／販売中の上書き禁止も維持する。
- 不変: DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PDF形式、成人向け境界、Stripe、Desktop code。
- 検証: 集中13/13、Hub 643/643、Canvas 26/26、AI 48/48、migration 52/52、deps、lint、全typecheck、Hub／Desktop production build、RC preflight、diff check成功。Hub buildは長いpathでWindows上限となり、同一commitの短い物理worktreeで成功した。
- ローカルDesktop統合: Electron終了待ちで2回とも結果出力前に停止。Desktop codeは変更しておらず、Windows CIで最終判定する。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1T_MARKETPLACE_READINESS_PREFLIGHT.md`](RELEASE_CANDIDATE_R4_1T_MARKETPLACE_READINESS_PREFLIGHT.md)
- 次: 責任者のreview／merge判断まで停止する。merge後にProduction未完成作品で拒否を再確認し、画像Provider失敗は別PRで扱う。

---

## 2026-08-12 PR-R4-1s 市場分析から販売までのProduction E2E監査

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#237](https://github.com/team478a/manga/pull/237)
- Vercel Preview: https://mangai-hub-staging-git-codex-release-faa8ee-team478as-projects.vercel.app
- Branch: `codex/release-r4-1s-market-to-sale-e2e`
- Base: `origin/feature/manga-canvas-mvp`（`2afae10`、PR #236 merge commit）
- Production E2E: 保存済み市場分析→選択済み企画→採用シナリオ→採用32ページネーム→Creator 32ページ／157コマの連続引継ぎを確認した。
- 画像再受入れ: 未生成コマ1つで2候補を実行したが両方failed。4 credit予約は全解放され、残16／使用4／予約0へ戻った。単一コマ／文字なし品質のmerge後受入れは未合格。
- 完成状態: 画像1/157、完成0/32、確定0/32、必須修正267、完了ガイド0/4。durable PDFと完成版checkpointは正しく無効だった。
- 重大検出: 上記未完成状態でも販売下書きが作成できた。検証artifactは非公開作品／販売停止商品で維持し、一般一覧へ非表示、直接checkoutも入力・購入button無効を確認した。公開・実決済・購入は未実施。
- Scheduler: Workerの正規終端`failed`を未知状態として扱い、workflowを`Worker応答の状態を確認できませんでした。`で失敗させるため、後続Jobを妨げる。
- credit成立性: 現価格は2候補で4 credit。未生成156コマの最低2候補には追加624 creditが必要で、残16では32ページを完成できない。
- 変更範囲: 監査証跡と進行文書だけ。application code、DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktopは変更しない。
- ローカル検証: Scheduler／marketplace policy／durable export 14/14、deps、RC preflight、diff check成功。RC外部設定はローカル未設定、manual acceptanceは別管理のためpreflight上はpending。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1S_MARKET_TO_SALE_E2E_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1S_MARKET_TO_SALE_E2E_EVIDENCE.md)
- 次: 文書限定Draft PRの全CI／Vercel Preview成功後に停止する。次PRはP0販売準備preflight、実画像生成失敗、Scheduler終端状態、長編credit成立条件を分離して扱う。

---

## 2026-08-12 PR-R4-1r 漫画生成Production E2E・単一コマ品質修正

- 状態: `READY_FOR_OWNER_REVIEW`（Draft PR [#236](https://github.com/team478a/manga/pull/236)）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-c6c81b-team478as-projects.vercel.app
- Branch: `codex/fix-r4-1r-single-panel-image-quality`
- Base: `origin/feature/manga-canvas-mvp`（`d3441a4`、PR #235 merge commit）
- Production E2E: `test`一般向けモニターで32ページAIネームを約2分で生成し、1〜32ページ欠落なし、採用、Canvas下書き32ページ／157コマ、BFL画像2候補、4 credit確定、候補比較・採用、自動保存、再読込復元まで成功した。
- 検出事項: 2候補のうち1候補が複数コマ風となり、画像内に読めない疑似文字を生成した。別候補は採用可能だった。
- 修正: 共通画像Promptへ「単一コマを全面描画」「漫画ページ／複数コマ／枠／余白禁止」「文字／疑似文字／吹き出し禁止」を日英で追加し、negative promptにも固定する。
- 不変: Provider、model、pricing、credit単価、retry、timeout、Scheduler、API key、DB、migration、RPC、Storage、API、URL、Feature Flag、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktop。
- 検証: 専用21/21、Hub 640/640、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 52/52、deps、lint、全typecheck、research eval、Hub／Desktop production build、RC preflight、diff check成功。長いclone pathでのTurbopack path-length失敗は短い物理worktreeで再実行して成功した。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1R_MANGA_PRODUCTION_E2E_AND_IMAGE_QUALITY.md`](RELEASE_CANDIDATE_R4_1R_MANGA_PRODUCTION_E2E_AND_IMAGE_QUALITY.md)
- 次: 責任者のreview／merge判断まで停止する。merge前に追加の実Provider生成を行わず、merge後に未生成コマ1つ・2候補だけで単一コマ品質を再受入れする。

---

## 2026-08-12 PR-R4-1q モニター制作阻害要因修正

- 状態: `READY_FOR_OWNER_REVIEW`（Draft PR [#235](https://github.com/team478a/manga/pull/235)）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-da7543-team478as-projects.vercel.app
- Branch: `codex/fix-r4-1q-monitor-blockers`
- Base: `origin/feature/manga-canvas-mvp`（`924b833`）
- Production症状: 32ページAIネームtimeout、失敗時AI利用回数増加、品質評価保存失敗、一般報告保存・履歴読込失敗。
- 修正: GPT-5.6 Terra、Responses API、`store:false`を維持。8ページ以下は既存の1応答、9〜48ページは全体連続性設計1応答＋8ページ単位の並列応答へ分割する。全ブロックを結合後に既存schemaで検証し、全成功時だけ保存・AI利用回数消費を行う。
- 実行上限: 全体設計45秒＋最遅ブロック150秒をServer Action 240秒内へ収める。32ページは巨大な1応答ではなく全体設計1＋4ブロック、48ページは全体設計1＋6ブロック。ブロックは並列実行する。
- 保存互換: 構造化列へ通常保存し、列不足だけ基本列へ退避保存する。本人履歴と管理者一覧も同じ条件でfallbackする。RLS、制約、接続障害はfallbackしない。
- migration: 新規・変更なし。完全な構造化運用には既存`202608020002`、`202608030001`、`202608030002`のProduction適用が必要。
- 不変: Provider、model選択、API key、pricing、retry、Feature Flag、DB、migration、RPC、Storage、URL、公開API、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktop code。
- 追加検証: 長編分割を含む集中25/25、Hub 639/639、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、deps、lint、Hub／Desktop typecheck、research eval、migration 52/52、RC preflight、Hub／Desktop production build、diff check成功。a11y初回はElectron終了`ETIMEDOUT`、単独再実行で成功。
- CI: 長編分割実装HEADでCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1Q_MONITOR_BLOCKER_FIX.md`](RELEASE_CANDIDATE_R4_1Q_MONITOR_BLOCKER_FIX.md)
- 次: 本文書同期後の最終HEADでも全CIとVercel Preview成功を確認して停止。merge後にtestモニターで32ページ分割ネーム、品質評価、一般報告、本人・管理者履歴を再検証する。

---

## 2026-08-12 PR-R4-1o 対象ユーザー市場分析受入れ完了

- 状態: `READY_FOR_OWNER_REVIEW`
- Branch: `codex/release-r4-1o-research-user-acceptance`
- Base: `origin/feature/manga-canvas-mvp`（`44b99dd`、PR #232 merge commit）
- Draft PR: [#233](https://github.com/team478a/manga/pull/233)
- Vercel Preview: https://mangai-hub-staging-git-codex-release-e6ee4a-team478as-projects.vercel.app
- 本人E2E: 2026-08-12、MANGAI責任者から対象ユーザー本人による市場分析のユーザー検証完了報告を受領した。
- 完了範囲: 既存Report表示、新規市場分析保存、詳細表示、再読込後の本人履歴再表示。PR-R4-1mの非blocking保留を解除する。
- 証拠境界: 対象本人の操作完了を責任者報告で受入れる。Codexは本人session、Report本文、Prompt、件数、費用を取得・推測しない。
- データ扱い: 本人E2Eで通常仕様どおり作成されたReport／利用記録は削除しない。Codexは追加の本番操作を行わない。
- 残件: Cloud text実Job、AIネーム由来8ページE2E、一般ユーザー所有生成成果物・署名付き書き出しURLのowner isolation、Stripe test E2E。
- 外部契約: application code、DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas、PDF／PNG、成人向け境界、Stripe、Desktopは変更しない。
- ローカル検証: `rc:acceptance`成功（2 passed／11 pending／2 blocked）、full `rc:validate`成功（Desktop 182/182、Hub 632/632、migration 52/52、Hub／Desktop production build）、diff check成功。
- CI: Draft PR初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1O_RESEARCH_USER_ACCEPTANCE_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1O_RESEARCH_USER_ACCEPTANCE_EVIDENCE.md)
- 停止条件: 文書限定Draft PRの全CI／Vercel Previewを確認して停止する。残るR4-1項目を成功扱いせず、責任者確認前にR4-2へ進まない。

---

## 2026-08-12 PR-R4-1n Production所有者分離受入れ

- 状態: `READY_FOR_OWNER_REVIEW`
- Branch: `codex/release-r4-1n-owner-isolation`
- Base: `origin/feature/manga-canvas-mvp`（`ff9e0d5`、PR #231 merge commit）
- Draft PR: [#232](https://github.com/team478a/manga/pull/232)
- Vercel Preview: https://mangai-hub-staging-git-codex-release-0fef78-team478as-projects.vercel.app
- Production: read only transactionで2人の一般ユーザーclaimを再現し、市場分析Reportの双方向分離と非公開Cloud作品の所有者1件／相手0件を確認した。
- 生成成果物: 非公開作品に紐づく既存生成Job、Asset、`cloud-assets` objectは所有側1件／一般ユーザー側0件。ただし既存所有者はadminで、一般ユーザー所有側の実成果物は存在しない。
- 未実施: 非公開`works` row、一般ユーザー所有生成成果物、Cloud書き出しJob、`cloud-exports` objectが0件のため、marketplace作品と署名付き書き出しURLの実データ比較は未実施。
- データ不変: `BEGIN TRANSACTION READ ONLY`、authenticated role／JWT claim切替、selectだけを実行し、最後に`ROLLBACK`。個人識別子と秘密値は記録しない。
- 残件: Cloud text実Job、AIネーム由来8ページE2E、一般ユーザー所有生成成果物・書き出しURLのowner isolation、Stripe test E2E。対象本人の市場分析E2Eは非blocking保留のままpassedにしない。
- 外部契約: application code、DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas、PDF／PNG、成人向け境界、Stripe、Desktopは変更しない。
- 検証: owner isolation契約7/7、RC JSON、full `rc:validate`成功（Desktop 182/182、Hub 632/632、migration 52/52、Hub／Desktop production build）、diff check、Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。
- 証跡: [`RELEASE_CANDIDATE_R4_1N_OWNER_ISOLATION_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1N_OWNER_ISOLATION_EVIDENCE.md)
- 停止条件: 文書限定Draft PRの全CI／Vercel Previewを確認して停止する。未実施項目を成功扱いせず、責任者確認前にR4-2へ進まない。

---

## 2026-08-12 PR-R4-1m Production反映後確認・本人E2E保留

- 状態: `READY_FOR_OWNER_REVIEW`
- Branch: `codex/release-r4-1m-production-closeout`
- Base: `origin/feature/manga-canvas-mvp`（`8fe3888`、PR #230 merge commit）
- Draft PR: [#231](https://github.com/team478a/manga/pull/231)
- Vercel Preview: https://mangai-hub-staging-git-codex-release-a6dc7b-team478as-projects.vercel.app
- Production: 管理画面TOP 11人、ユーザー一覧11人で一致。対象モニターはactive、AI利用13/50、期限内、主要画面に汎用エラーなし。
- 責任者判断: 2026-08-12、対象本人の市場分析E2Eはクライアント確認に時間を要するため後日確認へ非blocking保留する。成功扱いにはしない。
- データ不変: 読み取りと画面遷移だけを行い、Provider、credit、AI利用、Report、作品、Asset、設定、注文を変更していない。
- 残件: Cloud text実Job、AIネーム由来8ページE2E、2利用者owner isolation、Stripe test E2E。本人確認待ちだけでは後続を停止しない。
- 外部契約: application code、DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas、PDF／PNG、成人向け境界、Stripe、Desktopは変更しない。
- 検証: full `rc:validate`成功（Hub 632/632、Desktop 182/182、migration 52/52、Hub／Desktop production build）。RC JSON、diff check、Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。
- 証跡: [`RELEASE_CANDIDATE_R4_1M_PRODUCTION_CLOSEOUT_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1M_PRODUCTION_CLOSEOUT_EVIDENCE.md)
- 停止条件: 文書限定Draft PRの全CI／Vercel Previewを確認して停止する。merge後は本人E2Eを待たず、実行可能なR4残件へ進める。

---

## 2026-08-11 PR-R4-1l 管理画面ユーザー件数整合性

- 状態: `READY_FOR_OWNER_REVIEW`
- Branch: `codex/fix-admin-user-count-consistency`
- Base: `origin/feature/manga-canvas-mvp`（`3fd2d54`、PR #229 merge commit）
- Draft PR: [#230](https://github.com/team478a/manga/pull/230)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-admi-61f545-team478as-projects.vercel.app
- Production診断: 管理画面TOPはProfile全12件、ユーザー一覧は削除済みAuthアカウントを除く11人を表示した。
- 原因: TOPと一覧で「登録ユーザー」の集計条件が異なり、TOPだけが削除済みAuthアカウントに残るProfileも数えていた。
- 修正: ProfileとAuth directoryの共通可視判定をapplicationへ追加し、TOPと一覧の両方で使用する。Auth directory障害時は不正確な件数を表示しない。
- 外部契約: DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas、PDF／PNG、成人向け境界、Stripe、Desktopは変更しない。
- 検証: 集中13/13、full `rc:validate`成功（Hub 632/632、Desktop 182/182、migration 52/52、Hub／Desktop production build）。Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。
- 証跡: [`RELEASE_CANDIDATE_R4_1L_ADMIN_USER_COUNT_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1L_ADMIN_USER_COUNT_EVIDENCE.md)
- 停止条件: Draft PRの全CI／Vercel Previewを確認して停止し、対象モニター本人の市場分析確認前にR4-2へ進まない。

---

## 2026-08-11 PR-R4-1k Production市場分析RLS受入れ

- 状態: `READY_FOR_OWNER_REVIEW`（Production migration・RLS受入れ・全品質ゲート・Draft PR完了）
- Branch: `codex/release-r4-1k-research-acceptance`
- Base: `origin/feature/manga-canvas-mvp`（`acac27a`、PR #228 merge commit）
- Draft PR: [#229](https://github.com/team478a/manga/pull/229)
- Preview: `https://mangai-hub-staging-git-codex-release-9642ee-team478as-projects.vercel.app`
- Production migration: `202608110001_profile_admin_rls_recursion.sql`適用済み。`SECURITY DEFINER`、固定search path、authenticated EXECUTEを確認。
- 対象モニターRLS: 自profile 1件、所有Report 4件、他owner 0件、直近Reportの表示必須構造を確認。`stack depth limit exceeded`は再現しない。
- データ不変: active、AI利用9、usage 9件、Report 4件。Provider呼出し、credit消費、新規Report作成なし。
- Production UI: `/admin/users`、`/admin/general-monitors`、`/dashboard`、`/creator`正常。
- 検証: 集中14/14、full `rc:validate`成功（Desktop 182/182、Hub 629/629、migration 52/52、Hub／Desktop production build）。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1K_RESEARCH_ACCEPTANCE_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1K_RESEARCH_ACCEPTANCE_EVIDENCE.md)
- 残件: 対象本人による既存Report表示と、必要時のみ新規市場分析の保存・再読込確認。
- 停止条件: Draft PRの全CI／Vercel Previewを確認して停止し、本人確認前に追加AI利用やR4-2へ進まない。

---

## 2026-08-11 PR-R4-1j 市場分析RLS再帰修正

- 状態: `READY_FOR_OWNER_REVIEW`（修正・非永続Production検証・全品質ゲート・Draft PR完了）
- Branch: `codex/fix-profile-rls-admin-recursion`
- Base: `origin/feature/manga-canvas-mvp`（`0255968`、PR #227 merge commit）
- Draft PR: [#228](https://github.com/team478a/manga/pull/228)
- Preview: `https://mangai-hub-staging-git-codex-fix-prof-a5b7c1-team478as-projects.vercel.app`
- Production診断: 対象モニターはactive／招待完了／期限内。AI利用9件に対して市場分析Report 4件が保存済みで、直近2回も保存成功。表示データ型も正常。
- 原因: 認証利用者のReport readで`current_profile_id()`が`profiles`を参照し、profiles RLSの`is_admin()`が再び`profiles`を参照して`stack depth limit exceeded`となる。
- 修正: `public.is_admin()`だけを固定`search_path=public,pg_temp`の`SECURITY DEFINER`へ変更する追加migration。判定条件、RLS policy、table、RPC、API、URL、application codeは維持する。
- Production非永続検証: 同一transaction内で修正を適用すると対象利用者が所有Report 4件・直近Report 1件を参照できた。ROLLBACK後に関数定義未変更を確認。
- 証跡: [`RELEASE_CANDIDATE_R4_1J_RESEARCH_RLS_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1J_RESEARCH_RLS_EVIDENCE.md)
- 検証: 集中14/14、full `rc:validate`成功（Desktop 182/182、Hub 629/629、migration 52/52、Hub／Desktop production build）。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 残件: merge後のProduction migration適用、対象本人による既存Report再表示と新規市場分析E2E。
- 停止条件: Draft PRの全CI／Vercel Previewを確認して停止し、責任者確認前にProduction適用やR4-2へ進まない。

---

## 2026-08-10 PR-R4-1i Production checkpoint受入れ

- 状態: `READY_FOR_OWNER_REVIEW`（checkpoint受入れ合格、R4-1全体はpending）
- Branch: `codex/release-r4-1i-checkpoint-acceptance`
- Base: `origin/feature/manga-canvas-mvp`（`f954403`、PR #226 merge commit）
- Draft PR: [#227](https://github.com/team478a/manga/pull/227)
- Production migration: `202608100001_cloud_project_checkpoint_digest_schema.sql`を対象Supabaseへ適用済み。`extensions.digest`、RPC引数、Security Definer、固定search path、authenticated EXECUTEを確認。
- Production実機: 8ページ作品でcheckpointを作成し、作品基本設定だけの差分表示、復元前自動checkpoint、復元、再読込後の元説明復帰を確認。
- DB: checkpoint 2件、restore 1件、checkpoint page 16行、各8ページ。Job更新・ledger追加なし。Assetは復元仕様で`updated_at`だけ更新され、SHA-256／容量／寸法／有効状態はmanifestと一致。
- 証跡: [`RELEASE_CANDIDATE_R4_1I_CHECKPOINT_ACCEPTANCE_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1I_CHECKPOINT_ACCEPTANCE_EVIDENCE.md)
- 検証: AI単独30/30、full `rc:validate`再実行成功（Desktop 182/182、Hub 627/627、migration 51/51、Hub／Desktop production build）。初回Desktop 181/182はComfyUI timeout mockの並列タイミング競合で、単独／全体再実行により成功を確認。
- 変更範囲: 証跡、CURRENT_TASK、handoff、RC台帳だけ。application code、追加DB schema、RPC契約、Storage object、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktop codeは変更しない。
- 残件: Cloud text、対象モニター本人の市場分析、AIネーム由来8ページE2E、2利用者実owner isolation、Stripe test E2E。
- 停止条件: Draft PRの全CI／Vercel Previewを確認して停止し、R4-2へ進まない。

## 2026-08-10 PR-R4-1h Production checkpoint digest修正

- 状態: `READY_FOR_OWNER_REVIEW`（R4-1全体はpending）
- Branch: `codex/fix-r4-checkpoint-digest-schema`
- Base: `origin/feature/manga-canvas-mvp`（`c1660e2`、PR #225 merge commit）
- Draft PR: [#226](https://github.com/team478a/manga/pull/226)
- Preview: `https://mangai-hub-staging-git-codex-fix-r4-c-7d4b6b-team478as-projects.vercel.app`
- Production再現: checkpoint作成が42883となり、UIはmigration不足として表示。checkpoint、Provider Job、Asset、credit、費用の増加なし。
- DB診断: 対象Supabaseにtable／RPC／権限／RLSが存在し、Production作品IDも同じprojectに存在。ROLLBACK付きRPC診断で未修飾`digest()`が`extensions` schemaを解決できないことを確定した。
- 修正: 追加migrationで`digest()`の2呼出しだけを`extensions.digest()`へ明示修飾する。RPC signature、権限、Security Definer、固定search path、manifest、hash方式は維持する。
- 証跡: [`RELEASE_CANDIDATE_R4_1H_CHECKPOINT_DIGEST_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1H_CHECKPOINT_DIGEST_EVIDENCE.md)
- 検証: Production DBのROLLBACK付き修正後RPC成功、永続変更0、集中21/21、migration manifest 51件、full `rc:validate`成功（Hub 627/627、Hub／Desktop production build）。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 外部契約: table、RLS、RPC契約、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktopを変更しない。
- 残件: merge後のProduction migration適用とcheckpoint作成・差分・復元、Cloud text、対象モニター本人の市場分析、AIネーム由来8ページE2E、2利用者実owner isolation、Stripe test E2E。
- 停止条件: Draft PRの全CI／Vercel Previewを確認して停止し、Production再受入れ前にR4-2へ進まない。

## 2026-08-10 PR-R4-1g Cloud Canvas編集lease確認ゲート

- 状態: `READY_FOR_OWNER_REVIEW`（R4-1全体はpending）
- Branch: `codex/fix-page-edit-lock-checking-gate`
- Base: `origin/feature/manga-canvas-mvp`（`0f704d8`、PR #224 merge commit）
- Draft PR: [#225](https://github.com/team478a/manga/pull/225)
- Preview: `https://mangai-hub-staging-git-codex-fix-page-aa7b79-team478as-projects.vercel.app`
- 証跡: [`RELEASE_CANDIDATE_R4_1G_PAGE_LOCK_GATE_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1G_PAGE_LOCK_GATE_EVIDENCE.md)
- Production再現: ページ遷移後、leaseが`checking`の間も編集UIが操作でき、確認完了時に通知領域が消えてレイアウトが移動する問題を確認。検証用の一時コマ名は元の`コマ1`へ戻して保存済み。Provider／credit／費用変更なし。
- 修正: `acquired`以外は編集UI全体とグローバルショートカットを遮断。確認中、別画面編集中、確認不能を固定overlayで案内し、確認不能時は再読込導線を表示する。
- 外部契約: API、DB、migration、RPC、Storage、Feature Flag、lease token／時間、Canvas schema、Provider、model、pricing、retry、timeout、Scheduler、PDF／PNG、成人向け境界、Stripe、Desktopを変更しない。
- 検証: 集中15/15、lint、Hub／Desktop typecheck、deps、research eval、full `rc:validate`成功（Hub 626/626、Desktop 182/182、Canvas 26/26、AI 48/48、migration 50/50、Hub／Desktop build）。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 残件: checkpoint migration、Cloud text、対象モニター本人の市場分析、AIネーム由来8ページE2E、2利用者実owner isolation、Stripe test E2E。
- 停止条件: Draft PRの全CI／Vercel Previewを確認して停止し、R4-1と`hub-production-acceptance`をpendingのまま責任者確認待ちとする。R4-2へ進まない。

## 2026-08-10 PR-R4-1f 一括生成開始拒否の本番再現・修正

- 状態: `READY_FOR_OWNER_REVIEW`（R4-1全体はpending）
- Branch: `codex/fix-empty-generation-batch-on-rejection`
- Base: `origin/feature/manga-canvas-mvp`（`0754e0b`、PR #223 merge commit）
- Draft PR: [#224](https://github.com/team478a/manga/pull/224)
- Preview: `https://mangai-hub-staging-juvn34ftl-team478as-projects.vercel.app`
- 証跡: [`RELEASE_CANDIDATE_R4_1F_BATCH_REJECTION_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1F_BATCH_REJECTION_EVIDENCE.md)
- Production再現: 既存検証作品を8ページ／9コマへ拡張。手動作品のため7コマ一括生成はAIネーム関連境界でJob登録前に拒否され、Provider／Asset／credit／費用増加なし。拒否時に「処理中0/0」Batchが残る問題を確認し、検証Batchは中止済み。
- 修正: 初回Queue拒否時は作成済みBatchを`canceled`へ補償し、Batch未紐付けJobもキャンセルする。Job 0件のcanceled Batchは利用者履歴へ表示しない。DB上の記録は削除しない。
- 市場分析: 現sessionは一般モニター資格境界で拒否。保存・Provider呼出し・費用なし。対象モニター本人session待ち。
- 検証: 集中15/15、lint、Hub／Desktop typecheck、full `rc:validate`成功（Hub 625/625、Desktop 182/182、Canvas 26/26、AI 48/48、migration 50/50、Hub／Desktop build）。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 残件: checkpoint migration、Cloud text、対象モニター本人の市場分析、AIネーム由来8ページE2E、2利用者実owner isolation、Stripe test E2E。
- 停止条件: Draft PRの全CI／Vercel Previewを確認して停止し、R4-1と`hub-production-acceptance`をpendingのまま責任者確認待ちとする。R4-2へ進まない。

## 2026-08-10 PR-R4-1e Production Scheduler受入れ

- 状態: `READY_FOR_OWNER_REVIEW`（R4-1全体はpending）
- Branch: `codex/release-r4-1e-scheduler-acceptance`
- Base: `origin/feature/manga-canvas-mvp`（`2e3a1d5`、PR #222 merge commit）
- Draft PR: [#223](https://github.com/team478a/manga/pull/223)
- Preview: `https://mangai-hub-staging-git-codex-release-47537d-team478as-projects.vercel.app`
- 証跡: [`RELEASE_CANDIDATE_R4_1E_SCHEDULER_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1E_SCHEDULER_EVIDENCE.md)
- Production: Worker secretをVercel Production／PreviewとGitHub Actionsへ同値ローテーションし、`2e3a1d5`を再deployしてReadyを確認。値は文書、ログ、commitへ記録しない。
- Scheduler: 通信なしcheck [31359117746](https://github.com/team478a/manga/actions/runs/31359117746)成功。Queue 0件／Worker正常を確認して有効化し、限定run [31359171708](https://github.com/team478a/manga/actions/runs/31359171708)は`idle`、requests 1、processed 0で成功。Provider生成・credit消費なし。
- 定期実行: 自動run [31359786321](https://github.com/team478a/manga/actions/runs/31359786321)が`event=schedule`で成功。`idle`、requests 1、processed 0。実行後もQueue 0件／Worker正常を確認。
- 変更範囲: 外部Worker認証、GitHub Actions secrets／variable、Production再deploy、証跡文書だけ。application code、DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler workflow／頻度、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktop code、本番作品dataを変更しない。
- 検証: RC台帳2 passed／11 pending／2 blocked、full `rc:validate`成功（Hub 624/624、Desktop 182/182、Canvas 26/26、AI 48/48、migration 50/50、Hub／Desktop build）。
- 残件: checkpoint migration、Cloud text、対象モニター本人の市場分析、AIネーム由来8ページE2E、2利用者実owner isolation、Stripe test E2E。
- 停止条件: 文書限定Draft PRの全CI／Vercel Previewを確認し、R4-1と`hub-production-acceptance`をpendingのまま責任者確認待ちとする。R4-2へ進まない。

## 2026-08-10 PR-R4-1d Production外部構成照合

- 状態: `EXTERNAL_CONFIGURATION_REQUIRED`
- Branch: `codex/release-r4-1d-checkpoint-acceptance`
- Base: `origin/feature/manga-canvas-mvp`（`84773f7`、PR #221 merge commit）
- Draft PR: [#222](https://github.com/team478a/manga/pull/222)
- Preview: `https://mangai-hub-staging-git-codex-release-68a981-team478as-projects.vercel.app`
- 証跡: [`RELEASE_CANDIDATE_R4_1D_EXTERNAL_CONFIGURATION_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1D_EXTERNAL_CONFIGURATION_EVIDENCE.md)
- checkpoint: Supabase Dashboardはログイン済みだが対象project `vmdsyxykcrgxcdbrwlkv`へアクセスできず、別project `mailsend`だけを表示できる。誤適用を避け、SQL実行・本番DB変更は行っていない。
- Cloud text: Vercel Projectには`MANGAI_CLOUD_TEXT_ENABLED`だけがあり、model、pricing version、Gateway endpoint/keyはProject／Sharedともにない。Production価格台帳13行はすべてBFL画像で、`mangai-cloud-text`は0行。
- OpenAI: 市場分析用Vault設定は設定済み・有効だが、Cloud text Gatewayとは別経路。文章Job、Provider呼出し、credit予約・課金は行っていない。
- 変更範囲: 証跡、CURRENT_TASK、handoff、RC台帳だけ。application code、DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktop code、外部設定、本番dataを変更しない。
- 検証: RC台帳2 passed／11 pending／2 blocked、full `rc:validate`成功（Hub 624/624、Desktop 182/182、Canvas 26/26、AI 48/48、migration 50/50、Hub／Desktop build）。
- 残件: 対象projectのmigration適用とcheckpoint再受入れ、Cloud text外部構成と1件再受入れ、対象モニター本人の市場分析、AIネーム由来8ページE2E、Scheduler、2利用者owner isolation、Stripe test E2E。
- 停止条件: 文書限定Draft PRの最終HEADで全CI／Vercel Previewを確認し、R4-1と`hub-production-acceptance`をpendingのまま責任者確認待ちとする。R4-2へ進まない。

## 2026-08-10 PR-R4-1c Production編集ロック再受入れ

- 状態: `READY_FOR_OWNER_REVIEW`
- Branch: `codex/release-r4-1c-page-lock-acceptance`
- Base: `origin/feature/manga-canvas-mvp`（`d40d8d4`、PR #220 merge commit）
- Draft PR: [#221](https://github.com/team478a/manga/pull/221)
- Preview: `https://mangai-hub-staging-git-codex-release-61ff0c-team478as-projects.vercel.app`
- 証跡: [`RELEASE_CANDIDATE_R4_1C_PAGE_LOCK_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1C_PAGE_LOCK_EVIDENCE.md)
- Production合格: 同一タブ即時再読込、作品画面からの同一タブ再入場、別タブ排他、元タブ継続編集、保存済み表示、既存生成画像表示。
- 変更範囲: Productionでは編集leaseだけを取得。ページ内容、Canvas、Asset、作品状態、Provider、credit、課金、外部設定は変更しない。本PRは証跡、CURRENT_TASK、handoff、RC台帳だけを変更する。
- 検証: RC台帳2 passed／11 pending／2 blocked、全`rc:validate`成功（Hub 624/624、Desktop 182/182、Canvas 26/26、AI 48/48、migration 50/50、Hub／Desktop build）。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- R4-1残件: checkpoint migration、Cloud text readiness、対象モニター本人の市場分析、AIネーム由来8ページE2E、Scheduler、2利用者owner isolation、Stripe test E2E。
- 停止条件: 文書限定Draft PRの最終HEADで全CI／Vercel Previewを確認し、R4-1と`hub-production-acceptance`をpendingのまま責任者確認待ちとする。R4-2へ進まない。

## 2026-08-10 Cloud Canvas同一タブ編集ロック修正

- 状態: `MERGED`
- Branch: `codex/fix-page-edit-lock-reload`
- Base: `origin/feature/manga-canvas-mvp`（`39cb9e6`、PR #219 merge後）
- Draft PR: [#220](https://github.com/team478a/manga/pull/220)
- Merge: `d40d8d4f4e30ff57fcb160f7842afb7b780069d5`
- Preview: `https://mangai-hub-staging-git-codex-fix-page-67c3b3-team478as-projects.vercel.app`
- 目的: Productionで再現した、同一タブの再読込／作品画面からの再入場直後に自分の編集leaseへ衝突し、最大約2分編集できない問題だけを修正する。
- 実装: ページ単位のUUID lock tokenをタブ専用`sessionStorage`へ保持し、同一タブでは再利用する。別タブ／別ページは別tokenのまま維持する。画面破棄時の遅延DELETEが再取得済みleaseを消す競合を避け、タブ終了後は既存の120秒server leaseで失効する。
- 外部契約: URL、API request／response、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktopを変更しない。
- 検証: 専用9/9、全`rc:validate`成功（Hub 624/624、Desktop 182/182、Canvas 26/26、AI 48/48、migration 50/50、Hub／Desktop build）。初回`rc:validate`は120秒の実行上限で切断されたため、十分な時間枠で同一commandを再実行して完走した。
- CI／Preview: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Preview公開トップのtitleと主要導線を実ブラウザで確認。Draft／MERGEABLE。
- 停止条件: Draft PRとCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功を確認して停止する。merge／Production反映前に本番修正済みと扱わず、責任者確認前にR4-2へ進まない。

## 2026-08-10 PR-R4-1b Production API追加受入れ

- 状態: `PARTIAL_EXTERNAL_CONFIGURATION_REQUIRED`
- Branch: `codex/release-r4-1b-production-api-acceptance`
- Base: `origin/feature/manga-canvas-mvp`（`7a30483`、PR #218 merge後）
- Draft PR: [#219](https://github.com/team478a/manga/pull/219)
- 証跡: [`RELEASE_CANDIDATE_R4_1B_PRODUCTION_API_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1B_PRODUCTION_API_EVIDENCE.md)
- Production成功: BFL `flux-2-pro`背景画像1件、Queue、2 credit予約／確定、手動Worker、private Asset、Canvas配置、自動保存、再読込、1ページPNG。実コスト`$0.0300`、予約解放、直近24時間の失敗0件。
- Production未解決: `202608010011_cloud_project_checkpoints.sql`未適用相当でバックアップ不可。同一タブ再読込／再入場後に編集lockが最大約2分残る。Cloud Editor文章Jobは登録前拒否でOpenAI未呼出し・課金なし。
- 市場分析: 現在の管理者は一般モニターenrollment対象外。対象利用者は管理画面でactive・利用7/50だが本人sessionへログインできず、保存・再読込は未確認。
- 変更範囲: production test dataとして検証ページ1件、BFL Asset1件、Canvas layer1件を追加。application code、DB、migration、RPC、Storage設定、API、URL、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG仕様、成人向け境界、Stripe、Desktop codeは変更しない。
- 残件: production migration照合、Cloud text readiness、編集lock別修正PR、対象利用者の市場分析、AIネーム由来8ページE2E、Scheduler、2利用者owner isolation、Stripe test E2E。
- 検証: RC台帳2 passed／11 pending／2 blocked、Cloud漫画repository、migration 50/50、全`rc:validate`成功（Desktop 182/182、Hub 620/620、Hub production build）。初回Desktop 181/182は単独再実行と全体再実行で182/182成功。
- 停止条件: 文書限定Draft PRの最終HEADで全CI／Vercel Previewを確認し、R4-1をpartialのまま責任者確認待ちとする。R4-2へ進まない。

## 2026-08-10 PR-R4-1 Cloud／Supabase／Vercel／Stripe統合受入れ

- 状態: `PARTIAL_EXTERNAL_CONFIGURATION_REQUIRED`
- Branch: `codex/release-r4-1-cloud-acceptance`
- Base: `origin/feature/manga-canvas-mvp`（`ba93db0`、PR #217 merge後）
- Draft PR: [#218](https://github.com/team478a/manga/pull/218)
- 証跡: [`RELEASE_CANDIDATE_R4_1_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1_EVIDENCE.md)
- 完了確認: production Vercel deployment／domain、認証済みHubのアカウント名・Dashboard・Creator、Provider readiness、既存Cloud作品と生成履歴を読み取り確認。Cloud漫画repository、owner isolation、100ページ4/4、research eval、migration 50/50が成功。
- 外部設定: VercelのSupabase変数3件は存在するがStripe変数はProject／Sharedともに0件。GitHub Actions Schedulerはrepository variable／secretがなく、通信なしcheck run [31343333031](https://github.com/team478a/manga/actions/runs/31343333031)でWorker URL／secret不足を確認。対象Supabase projectは現在のDashboard accountから参照できない。
- 未実施: Stripe test E2E、市場分析の本番保存・再読込、実DB migration／RLS／RPC／Storage照合、Scheduler実行、8ページCloud制作・PDF／PNG、2利用者実owner isolation。未実施を成功扱いしない。
- 変更範囲: 証跡・CURRENT_TASK・handoff・RC受入れ文書だけ。application code、DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktop code、外部設定、本番dataを変更しない。
- 停止条件: 文書限定Draft PRの最終HEADで全CI／Vercel Previewを確認し、外部条件の再開待ちで停止する。R4-1を完了扱いせず、責任者確認前にR4-2へ進まない。

## 2026-08-10 PR-R4-0 Release Candidate統合監査・計画

- 状態: `MERGED`
- Branch: `codex/release-r4-0-acceptance-plan`
- Base: `origin/feature/manga-canvas-mvp`（`78f4503`、PR #216 merge後）
- Draft PR: [#217](https://github.com/team478a/manga/pull/217)
- Merge: `ba93db0429ce1abc66a89b35deb8d1648ebc60ec`
- Preview: `https://mangai-hub-staging-git-codex-release-e49113-team478as-projects.vercel.app`
- 現在: R0〜R3完了後の残件を、R4-0（文書・台帳）、R4-1（Hub／Supabase／Vercel／Stripe実受入れ）、R4-2（Desktop実AI／アクセシビリティ／Windows配布／最終RC）の3工程へ統合する。
- 今回: `docs/RELEASE_CANDIDATE_R4_PLAN.md`を新設し、CURRENT_TASK、HANDOFF、roadmap、RC台帳を現行基準へ同期する。コードや外部環境は変更しない。
- R3完了: PR #216は`78f4503f6ca235c1c949cddc33c91e7efcc34fa3`でマージ済み。PR-R3-1〜R3-5bの実装残件は0。
- RC現状: ローカル品質ゲートとDesktopローカル受入れはpassed。実サービス、実ブラウザ、実Windows受入れは11 pending、署名／署名付き更新は2 blockedであり、未実施を成功扱いしない。
- 不変条件: application code、DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktop codeを変更しない。
- 除外: 成人向けDezgo production接続、依存更新、旧PR整理、新機能、UI redesign。
- 検証: RC台帳2 passed／11 pending／2 blocked、release構造READY、deps 0 errors／承認済み2 warnings、lint、Hub／Desktop typecheck、research eval、Hub 620/620、Canvas 26/26、AI 48/48、Desktop 182/182／a11y、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4が成功。
- CI: 初回HEAD `00f645f`でCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 残件: 本PR後は統合したR4-1とR4-2の2工程。資格情報、費用承認、実Windows環境、信頼された証明書が必要な項目は外部条件が揃うまでpending／blockedを維持する。
- 停止条件: 責任者確認とmergeを完了し、PR-R4-1へ移行済み。

## 2026-08-10 PR-R3-5b shared infrastructure closeout

- 状態: `MERGED`
- Branch: `codex/refactor-r3-5b-shared-infra-closeout`
- Base: `origin/feature/manga-canvas-mvp`（`0884a1f`、PR #215 merge後）
- Draft PR: [#216](https://github.com/team478a/manga/pull/216)
- Merge: `78f4503f6ca235c1c949cddc33c91e7efcc34fa3`
- Preview: `https://mangai-hub-staging-git-codex-refactor-8989d9-team478as-projects.vercel.app`
- 現在: R3に残るaudit log、rate-limit、signed URL、readiness、resilienceを一括監査し、外部契約を変えず安全に一致する低水準primitiveだけを共通化してR3-5を完了する。
- 実装: `src/lib/rate-limit-primitives.ts`へHMAC-SHA256 subject hashと、`cf-connecting-ip`→`x-real-ip`→`x-forwarded-for`の有効IP抽出を移す。Cloud AI、Cloud市場分析、Desktop端末認証のsecret解決、最小長、key prefix、window、上限、RPC、例外、status/bodyは各機能に維持する。
- 統合しない判断: auditはCloud AIの直接INSERTと、Provider／一般モニター／成人向けのtransaction内RPC・triggerが異なるため統合しない。signed URLはbucket、path、TTL、download、owner、failure処理が異なるため統合しない。readinessは一般／成人向けProvider境界、resilienceは管理画面のfatal fallbackと利用者画面の部分継続が異なるため統合しない。
- R3完了判定: R3-1〜R3-5bはすべてマージ済みで、R3の実装残件は0。責任者の指示により後続はPR-R4-0へ移行した。
- 不変条件: rate-limit値、secret名、key prefix、RPC、status/body、audit event／payload／transaction、Storage bucket/path/TTL/download/owner、readiness、resilience、Auth、DB、RLS、migration、URL、API、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktop protocolを変更しない。
- 検証: focused 4/4、deps（0 errors／承認済み2 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 620/620、Canvas 26/26、AI 48/48、Desktop 182/182／a11y 29画面・違反0、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、release structure成功。
- CI: 最終HEADでCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draftのままマージ済み。
- 外部環境: release preflightは構造READY。Supabase／Stripe／staging資格情報と手動E2Eはローカル環境外の既存pending。本PRはProvider呼出し境界を変更しないため、有料Provider再実行は不要。
- 停止条件: 最終HEADの全CI／Vercel Preview成功と責任者確認を完了し、PR-R4-0へ移行済み。

## 2026-08-10 PR-R3-5a internal Worker auth primitive

- 状態: `MERGED`
- Branch: `codex/refactor-r3-5a-internal-worker-auth`
- Base: `origin/feature/manga-canvas-mvp`（`1ce0d98`、PR #214 merge後）
- Draft PR: [#215](https://github.com/team478a/manga/pull/215)
- Merge: `0884a1fc10a645734f3641a5a7d556d2e88bb23a`
- Preview: `https://mangai-hub-staging-git-codex-refactor-ff4eaa-team478as-projects.vercel.app`
- 現在: PR-R3-5aだけを実施する。Cloud AI、Cloud Export、Cloud Storage、Monitor Opsの4つのinternal Worker Routeで重複するBearer secret比較を`src/lib/internal-worker-auth.ts`へ集約する。
- 実装: Authorization headerのcase-insensitiveな`Bearer`除去、secret未設定／header欠落／32文字未満／文字列長不一致の拒否、同一長だけの`crypto.timingSafeEqual`を共通helperへ移す。各Routeには既存の環境変数名、feature flag、401／503、response body、ログ、Worker処理順を維持する。
- R3-4完了: PR #214は`1ce0d98a405171e71a8d023a49bc1080d23ae0ed`でマージ済み。通常一覧のempty stateとpaginationは要素、CTA、権限、件数、状態reset、ページ意味が異なるため統合しないことを最終判断とし、R3-4を完了する。
- 不変条件: secret値、環境変数名、認証失敗status／body、Feature Flag、Auth、DB、RLS、migration、RPC、Storage、URL、API、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktopを変更しない。
- 検証: focused 29/29、deps（0 errors／承認済み2 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 616/616、Canvas 26/26、AI 48/48、Desktop 182/182／a11y 29画面・違反0、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、release structure成功。
- CI: 最初のHEADでCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft。
- 外部環境: release preflightは構造READY。Supabase／Stripe／staging資格情報と手動E2Eはローカル環境外の既存pendingであり、R3-5aの失敗ではない。実DB、実Provider、Storage、Desktopアプリコードは変更／実行しない。
- 残件見込み: R3-5b以降はaudit log境界、rate-limit低水準interface、signed URL低水準境界、readiness／resilience監査（必要なら0〜2 PR）、R3完了監査で概ね4〜6 Draft PR。
- 停止条件: Draft PRと最終HEADの全CI／Vercel Preview成功後、責任者確認待ちで停止する。確認前にR3-5b、R4へ進まない。

## 2026-08-10 PR-R3-4g Cloud市場分析not-found visual shell

- 状態: `MERGED`
- Branch: `codex/refactor-r3-4g-research-not-found-shell`
- Base: `origin/feature/manga-canvas-mvp`（`c488e41`、PR #213 merge後）
- Draft PR: [#214](https://github.com/team478a/manga/pull/214)
- Merge: `1ce0d98a405171e71a8d023a49bc1080d23ae0ed`
- Preview: `https://mangai-hub-staging-git-codex-refactor-568040-team478as-projects.vercel.app`
- 現在: PR-R3-4gだけを実施する。Cloud市場分析、企画、シナリオ、ネームのApp Router上にある全4つの`not-found.tsx`で完全一致するpage／panel visual shellを既存共通componentへ移す。
- 実装: 4画面の`main.page.max-w-3xl`を`AsyncStatePage`、`section.panel.text-center`を`AsyncStatePanel`へ委譲する。見出し要素・class・文言、説明、`FileQuestion`アイコンと既存ARIA、Link要素・class・文言、`/dashboard/research` URLは各画面に維持する。新規componentは追加しない。
- 分割: R3-4gはApp Router上の全not-found boundary 4画面だけに限定する。通常一覧のempty stateは要素、icon、margin、CTA、権限、検索結果0件の意味が異なるため対象外。paginationも表示件数、状態reset、ページ意味が異なるため統合しない。
- 不変条件: 情報設計、文言、Link、URL、query名／encoding、Server Action、business state、Auth、DB、RLS、migration、RPC、Storage、API、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktopを変更しない。
- 検証: focused 21/21（AsyncState専用5/5）、deps（0 errors／承認済み2 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 614/614、Canvas 26/26、AI 48/48、Desktop 182/182／a11y違反0、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、release structure成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 外部環境: release preflightは構造READY。Supabase／Stripe／staging資格情報、実端末認証と手動E2Eはローカル環境外の既存pendingであり、R3-4gの失敗ではない。実DB、実Provider、Desktopアプリコードは変更／実行しない。
- 停止条件: Draft PRと最終HEADの全CI／Vercel Preview成功後、責任者確認待ちで停止する。確認前にR3-4h、R3-5、R4へ進まない。

## 2026-08-10 PR-R3-4f inline alert error visual shell

- 状態: `MERGED`
- Branch: `codex/refactor-r3-4f-inline-alert-errors`
- Base: `origin/feature/manga-canvas-mvp`（`169a3cd`、PR #212 merge後）
- Draft PR: [#213](https://github.com/team478a/manga/pull/213)
- Merge: `c488e41b0241310e27d5c7a785afa30dfbc57566`
- Preview: `https://mangai-hub-staging-git-codex-refactor-b33029-team478as-projects.vercel.app`
- 現在: PR-R3-4fだけを実施する。管理、一般モニター、市場分析、企画、シナリオ、ネームの10画面11箇所で完全一致する`rounded-lg`のinline alert error visual shellを既存共通componentへ移す。
- 実装: `InlineErrorMessage`へ`radius="md" | "lg"`を追加し、R3-4eの21箇所は既定の`md`のまま維持する。今回の11箇所だけ`radius="lg"`を指定し、`p`要素、`mt-5 rounded-lg bg-red-50 p-4 text-red-700`、既存`role="alert"`、文言、表示条件を維持する。
- 分割: R3-4fは要素、全visual class、ARIAが一致する11箇所だけに限定する。色、余白、要素、ARIAが異なるerror表示、成功／警告、error boundaryは対象外。empty stateとpaginationは要素、CTA、見出し、件数、状態resetが異なるためR3-4g以降で再監査する。
- 不変条件: 情報設計、文言、表示条件、query名／encoding、Server Action、business state、Auth、DB、RLS、migration、RPC、Storage、URL、API、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktopを変更しない。
- 検証: focused 9/9（専用2/2）、deps（0 errors／承認済み2 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 613/613、Canvas 26/26、AI 48/48、Desktop 182/182／a11y違反0、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、release structure成功。Desktop testは並列時181/182の一時失敗後、単独再実行で182/182成功。Hub buildも単独実行で成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 外部環境: release preflightは構造READY。Supabase／Stripe／staging資格情報、実端末認証と手動E2Eはローカル環境外の既存pendingであり、R3-4fの失敗ではない。実DB、実Provider、Desktopアプリコードは変更／実行しない。
- 停止条件: Draft PRと最終HEADの全CI／Vercel Preview成功後、責任者確認待ちで停止する。確認前にR3-4g、R3-5、R4へ進まない。

## 2026-08-09 PR-R3-4e inline error visual shell

- 状態: `MERGED`
- Branch: `codex/refactor-r3-4e-inline-error-shell`
- Base: `origin/feature/manga-canvas-mvp`（`96b22a9`、PR #211 merge後）
- Draft PR: [#212](https://github.com/team478a/manga/pull/212)
- Merge: `169a3cd710394402561c3e13383e919702f5ac9e`
- Preview: `https://mangai-hub-staging-git-codex-refactor-bc0c4d-team478as-projects.vercel.app`
- 現在: PR-R3-4eだけを実施する。認証、購入、作品、商品、グッズ申請、Desktop端末、Cloud作品の20画面21箇所で完全一致するinline error visual shellを共通componentへ移す。
- 実装: `src/components/InlineErrorMessage.tsx`に`p`要素と`mt-5 rounded-md bg-red-50 p-4 text-red-700`だけを集約する。表示条件、error値、購入不可文言、唯一既存の`role=alert`は各画面に維持する。
- 分割: R3-4eは要素と全classが一致する21箇所だけに限定する。角丸、色、余白、ARIAが異なるerror表示、成功／警告、error boundaryは対象外。empty stateとpaginationは要素、見出し、CTA、状態管理が異なるためR3-4f以降で再監査する。
- 不変条件: 情報設計、文言、表示条件、query名／encoding、Server Action、business state、Auth、DB、RLS、migration、RPC、Storage、URL、API、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktopを変更しない。
- 検証: focused 9/9（専用2/2）、deps（0 errors／承認済み2 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 613/613、Canvas 26/26、AI 48/48、Desktop 182/182／a11y、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、release structure成功。Hub buildは並列実行時のtimeout後、単独再実行で成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 外部環境: release preflightは構造READY。Supabase／Stripe／staging資格情報、実端末認証と手動E2Eはローカル環境外の既存pendingであり、R3-4eの失敗ではない。実DB、実Provider、Desktopアプリコードは変更／実行しない。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。確認前にR3-4f、R3-5、R4へ進まない。

## 2026-08-09 PR-R3-4d status badge visual shell

- 状態: `MERGED`
- Branch: `codex/refactor-r3-4d-status-badges`
- Base: `origin/feature/manga-canvas-mvp`（`4ce9c6c`、PR #210 merge後）
- Draft PR: [#211](https://github.com/team478a/manga/pull/211)
- Merge: `96b22a9111edd8b7ccc5c50ce2d37eb3e21e80db`
- Preview: `https://mangai-hub-staging-drbv62wn1-team478as-projects.vercel.app`
- 現在: PR-R3-4dだけを実施する。管理者／制作者の作品、商品、グッズ申請、ユーザー画面の8画面で一致するlinen色のstatus badge visual shellを共通componentへ移す。
- 実装: `src/components/StatusBadge.tsx`に`span`、`rounded-full bg-linen px-3 py-1`だけを集約する。各画面の`statusLabel`、公開／非公開判断、role表示、配置・文字サイズclassは各画面に維持する。
- 分割: R3-4dは同じ要素・色・paddingを持つ8画面だけに限定する。色付きアカウント状態badge、作成日chipは意味と色が異なるため対象外。empty state、pagination、form field errorは要素、見出し階層、CTA、状態管理、ARIAが異なるためR3-4e以降で再監査する。
- 不変条件: 情報設計、文言、business state、Auth、DB、RLS、migration、RPC、Storage、URL、API、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktopを変更しない。
- 検証: focused 6/6（専用2/2）、deps（0 errors／承認済み2 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 611/611、Canvas 26/26、AI 48/48、Desktop 182/182／a11y、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、release structure成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 外部環境: release preflightは構造READY。Supabase／Stripe／staging資格情報、実端末認証と手動E2Eはローカル環境外の既存pendingであり、R3-4dの失敗ではない。実DB、実Provider、Desktopアプリコードは変更／実行しない。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。確認前にR3-4e、R3-5、R4へ進まない。

## 2026-08-09 PR-R3-4c Cloud制作Action feedback境界

- 状態: `MERGED`
- Branch: `codex/refactor-r3-4c-action-feedback`
- Base: `origin/feature/manga-canvas-mvp`（`be7d436`、PR #209 merge後）
- Draft PR: [#210](https://github.com/team478a/manga/pull/210)
- Merge: `4ce9c6cc0d454b0dc32b376be9aab37fe1cea478`
- Preview: `https://mangai-hub-staging-git-codex-refactor-6fab4e-team478as-projects.vercel.app`
- 現在: PR-R3-4cだけを実施する。企画比較、シナリオ履歴、シナリオ版、ネーム版の4画面で完全一致するAction成功／失敗feedbackを共通componentへ移す。
- 実装: `src/components/CloudActionFeedback.tsx`にerrorとmessageの表示を集約する。error→messageの順序、`p`要素、赤／緑class、`role=alert`／`role=status`、query値のReact text表示を維持する。
- 分割: R3-4cはconfirmation/action feedbackの完全一致4画面だけに限定する。partial noticeは既存`CloudDataNotice`へ集約済み。empty state、status badge、pagination、form field errorは見出し階層、CTA、意味、表示形状が異なるため後続R3-4d以降で再監査する。
- 不変条件: 情報設計、文言、query名／encoding、Server Action、business state、Auth、DB、RLS、migration、RPC、Storage、URL、API、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktopを変更しない。
- 検証: focused 12/12（専用2/2）、deps（0 errors／承認済み2 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 609/609、Canvas 26/26、AI 48/48、Desktop 182/182／a11y、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、release structure、diff check成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 外部環境: release preflightは構造READY。Supabase／Stripe／staging資格情報、実端末認証と手動E2Eはローカル環境外の既存pendingであり、R3-4cの失敗ではない。実DB、実Provider、Desktopアプリコードは変更／実行しない。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。確認前にR3-4d、R3-5、R4へ進まない。

## 2026-08-09 PR-R3-4b AI送信pending操作境界

- 状態: `MERGED`
- Branch: `codex/refactor-r3-4b-pending-actions`
- Base: `origin/feature/manga-canvas-mvp`（`388e8ee`、PR #208 merge後）
- Draft PR: [#209](https://github.com/team478a/manga/pull/209)
- Merge: `be7d4363c65fd5fa656715c158e5027e9e357fcf`
- Preview: `https://mangai-hub-staging-git-codex-refactor-6da17d-team478as-projects.vercel.app`
- 現在: PR-R3-4bだけを実施する。市場分析、企画生成／採用、シナリオ生成／採用、ネーム生成／採用に残る4つの専用`useFormStatus`実装を、既存`PendingSubmitButton`へ委譲する。
- 実装: 専用component名と呼び出し側は維持し、内部のpending検出、二重送信防止、`aria-busy`／`aria-disabled`、spinnerを共通componentへ集約する。通常時／処理中の日本語文言、primary／secondary class、幅、Server Actionは変更しない。
- 分割: R3-4bはDUP-010のAI送信操作だけに限定する。empty state、partial notice、status badge、pagination、confirmation feedback、form errorは後続R3-4c以降で同義性を再確認する。
- 不変条件: 情報設計、business state、Auth、DB、RLS、migration、RPC、Storage、URL、API、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktopを変更しない。
- 検証: focused 15/15（専用1/1）、deps（0 errors／承認済み2 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 607/607、Canvas 26/26、AI 48/48、Desktop 182/182／a11y、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、release structure、diff check成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 外部環境: release preflightは構造READY。Supabase／Stripe／staging資格情報、実端末認証と手動E2Eはローカル環境外の既存pendingであり、R3-4bの失敗ではない。実DB、実Provider、Desktopアプリコードは変更／実行しない。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。確認前にR3-4c、R3-5、R4へ進まない。

## 2026-08-09 PR-R3-4a error／loading visual shell

- 状態: `MERGED`
- Branch: `codex/refactor-r3-4a-ui-state-primitives`
- Base: `origin/feature/manga-canvas-mvp`（`d8ac7cd`、PR #207 merge後）
- Draft PR: [#208](https://github.com/team478a/manga/pull/208)
- Merge: `388e8ee10356fa6e1c0c072c15d80d5d521dc246`
- Preview: `https://mangai-hub-staging-git-codex-refactor-9758c5-team478as-projects.vercel.app`
- 現在: PR-R3-4aだけを実施する。R3-1〜R3-3は完了・マージ済み。9つのerror boundaryと4つのloading boundaryで重複するpage／panel／action rowのvisual shellを共通化する。
- 実装: `src/components/AsyncStateShell.tsx`に`AsyncStatePage`、`AsyncStatePanel`、`AsyncStateActions`を追加する。各boundaryには固有文言、reset callback、Link、ログcontext、`role`／`aria-live`、spinner／skeleton、max widthを残す。
- 分割: R3-4全体は20〜35ファイル／700〜1,200行見込みのため、error／loadingだけをR3-4aへ限定する。pending、empty、partial notice、status badge、pagination、confirmation feedback、form errorは後続R3-4b以降で別途確認する。
- 契約維持: 出力する`main`／`section`／`div`、`page`／`panel`／`flex` class、既存文言、CTA、URL、reset範囲、ログcontext、alert/status role、aria属性を変更しない。error詳細を新たに表示せず、loading方式も統合しない。
- 不変条件: 情報設計、business state、Auth、DB、RLS、migration、RPC、Storage、URL、API、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktopを変更しない。
- 検証: 専用4/4、deps（0 errors／承認済み2 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 606/606、Canvas 26/26、AI 48/48、Desktop 182/182／a11y、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、release structure、diff check成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 外部環境: release preflightは構造READY。Supabase／Stripe／staging資格情報、実端末認証と手動E2Eはローカル環境外の既存pendingであり、R3-4aの失敗ではない。実DB、実Provider、Desktopアプリコードは変更／実行しない。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。確認前にR3-4b、R3-5、R4へ進まない。

## 2026-08-09 PR-R3-3l Desktop project status repository境界

- 状態: `MERGED`
- Branch: `codex/refactor-r3-3l-desktop-project-status-repository`
- Base: `origin/feature/manga-canvas-mvp`（`b2810bd`、PR #206 merge後）
- Draft PR: [#207](https://github.com/team478a/manga/pull/207)
- Merge: `d8ac7cdf24012dee2dfadacd422de7df210a1194`
- Preview: `https://mangai-hub-staging-git-codex-refactor-11cce2-team478as-projects.vercel.app`
- 現在: PR-R3-3lだけを実施する。R3-3a〜R3-3kは完了・マージ済み。Desktop Hub project status Routeに残る端末認証済みservice-role DB操作を`desktop-project` infrastructure repositoryへ移す。
- 実装: `src/modules/desktop-project/infrastructure/desktop-project-repository.ts`へowner限定の一般作品読取、非公開draftの楽観ロック更新、認証済みstatus読取、owner限定販売status読取を集約する。Routeには入力validation、端末認証／scope、domain error mapping、response／loggingと未認証公開GETのRLS clientを維持する。
- 契約維持: `authorizeDesktopRequest`をrepository生成より前に維持し、認証済みprofile IDだけをowner条件へ渡す。作品／商品列、`creator_id`／`source_project_id`／`content_class=general`、最新1件、非公開draft、`updated_at`楽観ロック、公開GET、API status/body／messageを変更しない。
- 警告: `src/app/**`のadmin-client直接利用warningを3件から2件へ削減する。残る2件はCloud AI／monitor opsの認証済みA分類Worker composition rootであり、R3-3の承認済み残件として維持する。
- 不変条件: DB、RLS、migration、RPC、Storage、URL、API、Desktop protocol／IPC／保存形式、認証期間／scope／rate limit、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripeを変更しない。
- 検証: focused 23/23（専用6/6）、deps（0 errors／承認済み2 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 602/602、Canvas 26/26、AI 48/48、Desktop 182/182／a11y、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、release structure、diff check成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 外部環境: release preflightは構造READY。Supabase／Stripe／staging資格情報、実端末認証と手動E2Eはローカル環境外の既存pendingであり、R3-3lの失敗ではない。Desktopアプリコード、実DB、実端末認証、実Providerは変更／実行しない。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。確認前にR3-4、R3-5、R4へ進まない。

## 2026-08-09 PR-R3-3k Desktop端末認証repository境界

- 状態: `MERGED`
- Branch: `codex/refactor-r3-3k-desktop-device-repository`
- Base: `origin/feature/manga-canvas-mvp`（`5228399`、PR #205 merge後）
- Draft PR: [#206](https://github.com/team478a/manga/pull/206)
- Merge: `b2810bdd17884db64ac4f822e475f672b66539c8`
- Preview: `https://mangai-hub-staging-git-codex-refactor-a897d0-team478as-projects.vercel.app`
- 現在: PR-R3-3kだけを実施する。R3-3a〜R3-3jは完了・マージ済み。Desktop端末認証の開始／poll／期限切れ／token解除と、利用者による承認／解除／一覧に残るservice-role DB操作5ファイルを`desktop-device` infrastructure repositoryへ移す。
- 実装: `src/modules/desktop-device/infrastructure/desktop-device-repository.ts`へ認証開始insert、secret hash poll、pending期限切れ、token revoke、user code検索、profile承認、owner revoke、scope確認、承認済み端末一覧の9操作を集約する。Route／Action／Pageにはrate limit、cleanup、token生成／hash、Bearer token、`requireProfile`、scope確認、期限計算、API response／redirect／表示を維持する。
- 契約維持: rate limitとcleanup、request validationをrepository生成より前に、Bearer tokenと`requireProfile`をrepository accessより前に維持する。table／列、user code衝突時5回retry、Postgres `23505`、pending 15分、token 90日、scope名、secret／profile owner filter、status遷移、API status/body、redirect文言を変更しない。
- 警告: `src/app/**`のadmin-client直接利用warningを8件から3件へ削減する。残件はDesktop Hub project status route 1件と、A分類Worker composition root 2件。project statusはowner／revision conflict契約が異なるため後続R3-3lへ分割する。
- 不変条件: DB、RLS、migration、RPC、Storage、URL、API、Desktop protocol／IPC／保存形式、認証期間／scope／rate limit、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripeを変更しない。
- 検証: focused 23/23（専用6/6）、deps（0 errors／既知3 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 596/596、Canvas 26/26、AI 48/48、Desktop 182/182／a11y、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、release structure、diff check成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 外部環境: release preflightは構造READY。Desktop rate-limit署名鍵、Supabase staging資格情報と実端末認証はローカル環境外の既存pendingであり、R3-3kの失敗ではない。Desktopアプリコードと実DBは変更／実行しない。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。確認前にR3-3l、R3-4、R3-5、R4へ進まない。

## 2026-08-09 PR-R3-3j checkout result repository境界

- 状態: `MERGED`
- Branch: `codex/refactor-r3-3j-checkout-result-repository`
- Base: `origin/feature/manga-canvas-mvp`（`88fd9d6`、PR #204 merge後）
- Draft PR: [#205](https://github.com/team478a/manga/pull/205)
- Merge: `52283992a26350f303f16660880ab2cb29f1ec03`
- Preview: `https://mangai-hub-staging-git-codex-refactor-eb9c81-team478as-projects.vercel.app`
- 現在: PR-R3-3jだけを実施する。R3-3a〜R3-3iは完了・マージ済み。checkout success／cancel画面に残るservice-role DB／private Storage操作を、既存`checkout` infrastructure repositoryへ移す。
- 実装: paid注文とproduct IDの照合、private商品fileの300秒署名URL生成、署名済みcancel token検証後のpending注文cancel更新をrepositoryへ集約する。App RouterにはStripe Session取得／支払反映、paid reference判定、環境確認、既存message／表示を維持する。
- 契約維持: Stripeのpaid session確認をdownload queryより前に、cancel token検証とadmin環境確認をDB更新より前に維持する。注文ID／商品ID／paid status照合、bucket `digital-products`、file path、TTL 300秒、`download:true`、pendingだけをcanceledへ更新する条件を変更しない。cancel tokenに現行存在しない有効期限仕様は追加しない。
- 警告: `src/app/**`のadmin-client直接利用warningを10件から8件へ削減する。残件はDesktop 6件と、A分類Worker composition root 2件だけ。本PRではいずれも変更しない。
- 不変条件: DB、RLS、migration、RPC、Storage bucket／path／private設定、URL、API、Stripe Session／metadata／webhook／success／cancel契約、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Desktopを変更しない。
- 検証: focused 17/17、deps（0 errors／既知8 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 590/590、Canvas 26/26、AI 48/48、Desktop 182/182／a11y、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、release structure、diff check成功。
- 外部環境: release preflightは構造READY。Supabase／Stripe／staging資格情報と手動E2Eはローカル環境外の既存pendingであり、R3-3jの失敗ではない。実Stripe／Storageは呼び出さない。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。PRはDraft／MERGEABLE。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。確認前にDesktop repository slice、R3-4、R3-5、R4へ進まない。

## 2026-08-09 PR-R3-3i checkout pending order repository境界

- 状態: `MERGED`
- Branch: `codex/refactor-r3-3i-checkout-order-repository`
- Base: `origin/feature/manga-canvas-mvp`（`02fb6cf`、PR #203 merge後）
- Draft PR: [#204](https://github.com/team478a/manga/pull/204)
- Merge: `88fd9d6762578e7eb09b67677828daf9f0964b57`
- Preview: `https://mangai-hub-staging-git-codex-refactor-8799f2-team478as-projects.vercel.app`
- 現在: PR-R3-3iだけを実施する。R3-3a〜R3-3hは完了・マージ済み。checkout開始時のpending注文作成に残るservice-role DB insertを、`checkout` infrastructure repositoryへ移す。
- 実装: `src/modules/checkout/infrastructure/checkout-order-repository.ts`へpending注文insertを集約する。Server Actionには購入者メール検証、任意ログインprofile照合、商品取得／公開状態確認、金額／手数料計算、Stripe Checkout調停、redirectを維持する。
- 契約維持: guest checkoutを維持し、任意の認証済みprofileはメール一致時だけ`buyer_profile_id`へ使用する。商品query、20% platform fee、注文列、`pending` status、注文作成後だけStripe Sessionを作る順序、`orderId` metadata／redirectを変更しない。
- 警告: `src/app/**`のadmin-client直接利用warningを11件から10件へ削減する。署名済みstateを扱うcheckout success／cancel（E分類）、Worker composition root、Desktopは本PRに含めない。
- 不変条件: DB、RLS、migration、RPC、Storage、URL、API、Stripe Session／metadata／success／cancel契約、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Desktopを変更しない。
- 検証: focused 24/24、deps（0 errors／既知10 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 586/586、Canvas 26/26、AI 48/48、Desktop 182/182／a11y、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、release structure、diff check成功。
- 外部環境: release preflightは構造READY。Supabase／Stripe／staging資格情報と手動E2Eはローカル環境外の既存pendingであり、R3-3iの失敗ではない。実Stripe Checkoutは行わない。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。PRはDraft／MERGEABLE。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。確認前にcheckout result E分類、Desktop、Worker、R3-4、R3-5、R4へ進まない。

## 2026-08-09 PR-R3-3h 一般モニターfeedback repository境界

- 状態: `MERGED`
- Branch: `codex/refactor-r3-3h-monitor-feedback-repository`
- Base: `origin/feature/manga-canvas-mvp`（`714ffaf`、PR #202 merge後）
- Draft PR: [#203](https://github.com/team478a/manga/pull/203)
- Merge: `02fb6cf5d60e51b0f9924af9669123f7ea5c3c45`
- Preview: `https://mangai-hub-staging-6w1pusqg6-team478as-projects.vercel.app`
- 現在: PR-R3-3hだけを実施する。R3-3a〜R3-3gは完了・マージ済み。一般モニターのfeedback送信に残るservice-role DB／Storage操作を、`general-monitor` infrastructure repositoryへ移す。
- 実装: `src/modules/general-monitor/infrastructure/monitor-feedback-repository.ts`へprivate画像upload、feedback insert、DB失敗時のStorage cleanupを集約する。Server Actionにはprofile認証、monitor利用資格、FormData validation、サニタイズ、rate-limit案内、redirect／revalidateを維持する。
- 契約維持: `requireProfile`と`requireCloudGeneralMonitor`をrepository呼出しより前に維持し、認証済み`profile.id`だけをowner／Storage pathに使用する。bucket `monitor-feedback`、path、content type、`upsert:false`、DB列、rate-limit識別子／日本語文言、失敗時cleanupを変更しない。
- 警告: `src/app/**`のadmin-client直接利用warningを12件から11件へ削減する。Worker composition root、checkout、Desktopは本PRに含めない。
- 不変条件: DB、RLS、migration、RPC、Storage bucket／path／private設定、URL、API、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktopを変更しない。
- 検証: focused 24/24、deps（0 errors／既知11 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 583/583、Canvas 26/26、AI 48/48、Desktop 182/182／a11y、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、release structure、diff check成功。
- 外部環境: release preflightは構造READY。Supabase／Stripe／staging資格情報と手動E2Eはローカル環境外の既存pendingであり、R3-3hの失敗ではない。実Storage／Providerは呼び出さない。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。PRはDraft／MERGEABLE。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。確認前に次のR3 slice、R3-4、R3-5、R4へ進まない。

## 2026-08-09 PR-R3-3g 購入履歴query repository境界

- 状態: `MERGED`
- Branch: `codex/refactor-r3-3g-purchase-query-repository`
- Base: `origin/feature/manga-canvas-mvp`（`de42c5b`、PR #201 merge後）
- Draft PR: [#202](https://github.com/team478a/manga/pull/202)
- Merge: `714ffafbd7f2ec8a95b0e4b8f546bf418031032c`
- Preview: `https://mangai-hub-staging-1wwopie3h-team478as-projects.vercel.app`
- 現在: PR-R3-3gだけを実施する。R3-3a〜R3-3fは完了・マージ済み。一般利用者の購入履歴画面に残るservice-role queryを、`purchases` infrastructure repositoryへ移す。
- 実装: `src/modules/purchases/infrastructure/purchase-query-repository.ts`へ購入履歴型と本人購入queryを集約する。App Routerにはprofile認証、表示、download URL、空状態を維持する。
- 契約維持: `requireProfile`をrepository呼出しより前に維持し、認証済み`profile.id`だけをowner IDとして渡す。`orders`の列／join、`buyer_profile_id` filter、`paid`／`refunded`条件、`paid_at`降順、既存download routeを変更しない。
- 警告: `src/app/**`のadmin-client直接利用warningを13件から12件へ削減する。Worker composition root、checkout、Desktop、dashboard monitor feedbackは本PRに含めない。
- 不変条件: DB、RLS、migration、RPC、Storage、URL、API、Stripe checkout／webhook／download、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Desktopを変更しない。
- 検証: focused 8/8、deps（0 errors／既知12 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 580/580、Canvas 26/26、AI 48/48、Desktop 182/182／a11y、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、release structure、diff check成功。
- 外部環境: release preflightは構造READY。Supabase／Stripe／staging資格情報と手動E2Eはローカル環境外の既存pendingであり、R3-3gの失敗ではない。Stripe／download実行は行わない。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。PRはDraft／MERGEABLE。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。確認前に次のR3 slice、R3-4、R3-5、R4へ進まない。

## 2026-08-09 PR-R3-3f Cloud AI管理repository境界

- 状態: `MERGED`
- Branch: `codex/refactor-r3-3f-cloud-ai-admin-repository`
- Base: `origin/feature/manga-canvas-mvp`（`1b49639`、PR #200 merge後）
- Draft PR: [#201](https://github.com/team478a/manga/pull/201)
- Merge: `de42c5b2f88ae5bde803fb00aff3e9f784156805`
- Preview: `https://mangai-hub-staging-8c0pu318j-team478as-projects.vercel.app`
- 現在: PR-R3-3fだけを実施する。R3-3a〜R3-3eは完了・マージ済み。Cloud AI管理画面のworkspace読取、Job取消、運用設定／Plan／価格更新、管理監査ログ保存を`cloud-ai` infrastructure repositoryへ移す。
- 実装: `src/modules/cloud-ai/infrastructure/admin-cloud-ai-repository.ts`へservice-role DB読取／更新と既存取消RPCを集約する。App Routerにはadmin認証、Worker実行、FormData validation、取消可能状態の判定、redirect／revalidate、表示とresilienceを維持する。
- 契約維持: `requireAdmin`をrepository呼出しより前に維持し、14本のworkspace query、列／filter／order／limit、取消対象`queued`／`running`、`cancel_cloud_generation_job`、監査before／after、Worker secret非表示、175秒timeoutを変更しない。
- 警告: `src/app/**`のadmin-client直接利用warningを15件から13件へ削減する。Worker composition root、checkout、Desktop、dashboard monitor／購入履歴は本PRに含めない。
- 不変条件: DB、RLS、migration、RPC、Storage、URL、API、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Worker挙動、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktopを変更しない。
- 検証: focused 20/20、deps（0 errors／既知13 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 577/577、Canvas 26/26、AI 48/48、Desktop 182/182／a11y、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、release structure、diff check成功。
- 外部環境: release preflightは構造READY。Supabase／Stripe／staging資格情報と手動E2Eはローカル環境外の既存pendingであり、R3-3fの失敗ではない。Provider／Workerの実呼出しは行わない。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。PRはDraft／MERGEABLE。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。確認前に次のR3 slice、R3-4、R3-5、R4へ進まない。

## 2026-08-09 PR-R3-3e 管理者アカウントrepository境界

- 状態: `MERGED`
- Branch: `codex/refactor-r3-3e-account-admin-repository`
- Base: `origin/feature/manga-canvas-mvp`（`ccb0ff5`、PR #199 merge後）
- Draft PR: [#200](https://github.com/team478a/manga/pull/200)
- Merge: `1b496399e4c7d90a5b8a63dff19a1e9055cab6ef`
- Preview: `https://mangai-hub-staging-git-codex-refactor-453f9b-team478as-projects.vercel.app`
- 現在: PR-R3-3eだけを実施する。R3-3a〜R3-3dは完了・マージ済み。管理者ユーザー一覧・詳細と一般ユーザーの停止／再開／soft deleteを、`account` infrastructure repositoryへ移す。
- 実装: profile読取、Auth Adminの一覧／詳細／更新、monitor招待履歴、成人向けentitlement／企画grant、一般モニター状態の読取をrepositoryへ集約する。App Routerにはadmin認証、環境確認、filter／表示、resilience、自己／admin保護、redirect／revalidateを維持する。
- 契約維持: `requireAdmin`をrepository呼出しより前に維持し、query列／順序、Auth一覧1000件、削除済み除外、Feature Flag停止時のmonitor非参照、`ban_duration`の`876000h`／`none`、soft delete `true`、日本語feedbackを変更しない。
- 警告: `src/app/**`のadmin-client直接利用warningを18件から15件へ削減する。Cloud AI、Worker composition root、Desktop、checkout、利用者monitor／購入履歴は本PRに含めない。
- 不変条件: DB、RLS、migration、RPC、Storage、URL、API、Auth順序、Feature Flag、成人向け本人同意／外部送信境界、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、Stripe、Desktopを変更しない。
- 検証: focused 21/21、deps（0 errors／既知15 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 574/574、Canvas 26/26、AI 48/48、Desktop 182/182／a11y、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、diff check成功。
- 外部環境: release preflightは構造READY。Supabase／Stripe／staging資格情報と手動E2Eはローカル環境外の既存pendingであり、R3-3eの失敗ではない。本PRはDB、migration、Provider、利用者画面を変更しない。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。PRはDraft／MERGEABLE。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。確認前に次のR3 slice、R3-4、R3-5、R4へ進まない。

## 2026-08-09 PR-R3-3d 成人向け管理entitlement repository境界

- 状態: `MERGED`
- Branch: `codex/refactor-r3-3d-adult-entitlement-repositories`
- Base: `origin/feature/manga-canvas-mvp`（`cd37f79`、PR #198 merge後）
- Draft PR: [#199](https://github.com/team478a/manga/pull/199)
- Merge: `ccb0ff508aa71b9397d7b345c34d186bc0131d85`
- Preview: `https://mangai-hub-staging-git-codex-refactor-32ee08-team478as-projects.vercel.app`
- 現在: PR-R3-3dだけを実施する。R3-3a〜R3-3cは完了・マージ済み。管理者ユーザー詳細の成人向け企画grant／成人向け市場分析entitlement更新を、各domainのrepositoryへ移す。
- 実装: `adult-planning`と`adult-research`のinfrastructure repositoryへtarget profile存在確認とRPCを集約する。Server Actionはadmin認証、FormData validation、resilience、redirect／revalidateを維持する。
- 契約維持: `requireAdmin`をrepository呼出しより前に維持し、target profile UUID確認、actor／target profile ID、`set_cloud_adult_feature_grant`／`set_cloud_adult_research_entitlement`、Feature Key、status／source／validUntil／adminNote、redirect文言を変更しない。
- 警告: `src/app/**`のadmin-client直接利用warningを20件から18件へ削減する。ユーザー一覧・詳細読取、account停止／再開／削除、Cloud AI、Desktop、checkout、利用者feedbackは本PRに含めない。
- 不変条件: DB、RLS、migration、RPC、Storage、URL、API、Auth順序、Feature Flag、成人向け本人同意／外部送信境界、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、Stripe、Desktopを変更しない。
- 検証: focused 16/16、deps（0 errors／既知18 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 571/571、Canvas 26/26、AI 48/48、Desktop／a11y、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、diff check成功。
- 外部環境: release preflightは構造READY。Supabase／Stripe／staging資格情報と手動E2Eはローカル環境外の既存pendingであり、R3-3dの失敗ではない。本PRはDB、migration、Provider、利用者画面を変更しない。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。PRはDraft／MERGEABLE。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。確認前に次のR3 slice、R3-4、R3-5、R4へ進まない。

## 2026-08-09 PR-R3-3c モニターissue管理repository境界

- 状態: `MERGED`
- Branch: `codex/refactor-r3-3c-monitor-issues-repository`
- Base: `origin/feature/manga-canvas-mvp`（`3cce998`、PR #197 merge後）
- Draft PR: [#198](https://github.com/team478a/manga/pull/198)
- Merge: `cd37f7997e1e3d775935614bd60fa9be6a5ebb9d`
- Preview: `https://mangai-hub-staging-git-codex-refactor-584fdb-team478as-projects.vercel.app`
- 現在: PR-R3-3cだけを実施する。R3-3a／R3-3bは完了・マージ済み。管理者向けモニターissue一覧・添付署名URL・状態更新を機能完結sliceとしてrepositoryへ移す。
- 実装: `src/modules/monitor-operations/infrastructure/admin-monitor-issue-repository.ts`へtask／feedback読取、署名URL生成、状態更新を集約する。App Routerはadmin認証、validation、resilience、redirect、表示を維持する。
- 契約維持: `requireAdmin`をrepository呼出しより前に維持し、query列、`last_reported_at`降順、100件上限、feedback ID条件、Storage bucket `monitor-feedback`、署名URL TTL 600秒、status mapping、retry時のclaim／error初期化、redirect文言を変更しない。
- 警告: `src/app/**`のadmin-client直接利用warningを22件から20件へ削減する。`src/app/api/internal/monitor-ops/worker/route.ts`は認証済みA分類composition rootとして維持し、Cloud AI、account、Desktop、checkout、利用者feedbackは本PRに含めない。
- 不変条件: DB、RLS、migration、RPC、Storage bucket／path／TTL、URL、API、Auth順序、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Worker lease、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktopを変更しない。
- 検証: focused 18/18、deps（0 errors／既知20 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 568/568、Canvas 26/26、AI 48/48、Desktop／a11y、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、diff check成功。
- 外部環境: release preflightは構造READY。Supabase／Stripe／staging資格情報と手動E2Eはローカル環境外の既存pendingであり、R3-3cの失敗ではない。本PRはDB、migration、Provider、利用者画面を変更しない。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。PRはDraft／MERGEABLE。
- 停止条件: Draft PRと全CI／Vercel Preview成功後、責任者確認待ちで停止する。確認前に次のR3 slice、R3-4、R3-5、R4へ進まない。

## 2026-08-09 PR-R3-3b 一般モニター運営repository境界

- 状態: `MERGED`
- Branch: `codex/refactor-r3-3b-monitor-repositories`
- Base: `origin/feature/manga-canvas-mvp`（`aa8b127`、PR #196 merge後）
- Draft PR: [#197](https://github.com/team478a/manga/pull/197)
- Merge: `3cce998a47318be895a684219a7fe32ffe7addb5`
- Preview: `https://mangai-hub-staging-git-codex-refactor-36074a-team478as-projects.vercel.app`
- 現在: PR-R3-3bだけを実施する。Q0〜Q2は完了・マージ済み。R3-3aに続き、一般モニター運営管理の機能完結sliceをrepositoryへ移す。
- 実装: モニター一覧、feedbackレビュー、招待メール監査、CSV用読取、招待／再送／停止のservice-role DB・Auth Admin・Storage署名URL操作を`src/modules/general-monitor/infrastructure/admin-monitor-repository.ts`へ集約する。App Routerは認証、Feature Flag、validation、redirect、表示、メール送信調停を維持する。
- 契約維持: `requireAdmin`をrepository呼出しより前に維持し、actor／target profile ID、RPC名・引数、query、並び順、100件上限、署名URL TTL 600秒、CSV status／header、redirect文言を変更しない。
- 警告: `src/app/**`のadmin-client直接利用warningを27件から22件へ削減する。monitor worker、利用者feedback送信、issue task、Cloud AI、Desktop、checkoutは本PRに含めない。
- 不変条件: DB、RLS、migration、RPC、Storage bucket／path／TTL、URL、API、Auth／admin順序、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktopを変更しない。
- 検証: focused 40/40、deps（0 errors／既知22 warnings）、lint、Hub／Desktop typecheck、research eval、Hub 565/565、Canvas／AI／Desktop／a11y、migration 50/50、Hub／Desktop build、Cloud漫画repository／owner isolation／100ページ4/4、diff check成功。
- 外部環境: release preflightのSupabase／Stripe／staging資格情報と手動E2Eはローカル環境外の既存pendingであり、R3-3bの失敗ではない。本PRはDB、migration、Provider、実利用画面を変更しない。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。PRはDraft／MERGEABLE。
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

# 2026-08-14 Codex: 長編一括生成target UUID契約修正

- 状態: `READY_FOR_REVIEW`
- Branch: `codex/fix-r4-1ac-batch-target-idempotency`
- Base: `origin/feature/manga-canvas-mvp`@`ad8905d`（PR #250 merge後）
- Draft PR: [#251](https://github.com/team478a/manga/pull/251)
- Productionへ既存migration `202608130003_cloud_generation_batch_registration_diagnostics.sql` を適用し、関数定義への診断識別子反映を確認した。
- `test`モニターの既存作品でページ19〜22（4ページ、16コマ）を1回だけ再試行した。事前検査はProvider、model、pricing、32 credit、モニター利用枠とも通過したが、RPC登録前の「一括生成条件を準備できませんでした。」で停止し、Job・credit消費・Provider呼出しは発生していない。
- 原因は、バッチ内部が各コマのidempotency keyを`UUID:target:番号`で作る一方、共通のコマ生成入力契約がUUIDを必須としていたこと。各targetに`crypto.randomUUID()`を割り当て、API、DB、RPCの既存契約を変えずに整合させた。
- 回帰テストでUUID生成の使用と旧複合形式の不在を固定した。Provider、model、pricing、retry、timeout、Scheduler、Feature Flag、Canvas schema、PDF／PNG、成人向け境界、Desktopは変更していない。
- ローカル検証: focused 31/31、deps:check、lint、typecheck、Hub／Canvas／AI／Desktop／a11y、migration 55本、Desktop build、RC structure preflight、`git diff --check`成功。Hub buildは通常TurbopackがWindowsの作業パス長上限で停止したため、同一ソースの`next build --webpack`で成功を確認した。TurbopackはVercel Previewで確認する。
- 次: Draft PRの全CIとVercel Preview成功後に停止する。merge・Production反映前は追加生成しない。反映後に同じ4ページを1回だけ再試行し、16 target登録、Worker処理、完成画像、課金を確認する。
- Draft PR #251のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。Draft／MERGEABLEを確認し、Production再試行を行わず停止した。

# 2026-08-14 Codex: BFL長時間生成の継続polling修正

- 状態: `READY_FOR_REVIEW`
- Branch: `codex/fix-r4-1ad-bfl-poll-resume`
- Base: `origin/feature/manga-canvas-mvp`@`82e6228`（PR #251 merge後）
- Draft PR: [#252](https://github.com/team478a/manga/pull/252)
- PR #251反映後、`test`モニターの既存作品でページ19〜22（4ページ、16コマ）を1回登録し、target登録16/16に成功した。
- Production DBで既存migration `202608080001_cloud_manga_quality_logs.sql` と `202608080002_cloud_manga_quality_judge.sql` の適用漏れを特定し、順番通り適用した。3テーブル、3 RPC、RLS有効を確認し、Job化失敗3件だけを再登録した。
- 公式`Cloud AI Worker scheduler`の限定runで10/16画像を実Provider生成し、完成Asset、panel specification、品質評価の保存を確認した。Provider応答が210秒を超えるコマが複数あり、旧実装はretry時にBFLへ新規Jobを再投入していたため、未完了6コマで追加runを停止した。
- BFL投入直後にProvider Job IDを実行中lease付きで保存し、timeout後の次回Workerでは新規投入せず同じ`get_result`をpollする。Provider、model、pricing、retry回数、210秒timeout、Scheduler頻度、API、Canvas、PDF／PNG、成人向け境界、Desktopは変更しない。
- 回帰テストはProvider Job IDのcheckpoint、POSTなしのpoll再開、timeout失敗記録へのID保持を固定する。
- ローカル検証: focused 22/22、deps、lint、typecheck、Hub、AI 48/48、Canvas 26/26、Desktop 182/182、migration 55本、Cloud漫画repository受入れ、Webpack Hub build、Desktop build、RC structure preflight、`git diff --check`成功。通常Turbopack buildだけは既知のWindowsパス長上限で停止し、Vercel Previewを正規確認先とする。
- 次: 責任者merge待ち。merge／Production反映前は残り6コマを実行しない。反映後は既存失敗1件だけを再登録し、残りQueueを16/16完了まで処理する。
- Draft PR #252のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。Draft／MERGEABLE。責任者のmergeとProduction反映前に残り6コマを実行しない。

# 2026-08-14 Codex: Provider待機のretry予算分離

- 状態: `READY_FOR_REVIEW`
- Branch: `codex/fix-r4-1ae-provider-pending-budget`
- Base: `origin/feature/manga-canvas-mvp`@`7fc04fc`（PR #252 merge後）
- Draft PR: [#253](https://github.com/team478a/manga/pull/253)
- PR #252のProduction反映後、失敗2コマだけを再登録し、公式Workerを限定実行した。12/16から14/16へ進んだが、残る2件はBFLの210秒超過pollingが通常retryとして数えられ、`max_attempts=2`を使い切って失敗した。追加再実行は停止した。
- BFLへの再POSTは発生せず、PR #252のProvider Job ID checkpointと同一Job pollingは機能した。追加阻害はProvider処理中という正常な待機状態と、通信・Provider失敗のretry予算が同じだったこと。
- Provider Job ID保存後のtimeoutだけを15秒後のQueueへ戻し、claim時に増えた`attempt_count`をlease一致条件で戻す。Provider Jobの初回開始から30分を上限とし、無期限pollingは許可しない。通常のtimeout、rate limit、5xx、network errorの既存retry回数は変更しない。
- 新規DB migration、RPC、公開API、Storage、Provider、model、pricing、210秒timeout、Scheduler頻度、Canvas schema、PDF／PNG、成人向け境界、Desktopの変更なし。
- ローカル検証: focused 24/24、deps、lint、typecheck、Hub、AI 48/48、Canvas 26/26、Desktop 182/182、Desktop a11y、migration 55本、Cloud漫画repository受入れ、owner isolation、100ページ長編4/4、Webpack Hub build、Desktop build、RC structure preflight、diff check成功。通常Turbopack buildだけは既知のWindowsパス長上限で停止した。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。Draft／MERGEABLE。
- 次: 責任者merge待ち。merge／Production反映前に失敗2コマを再実行しない。反映後、2件だけ再登録し、16/16完了・Asset・品質評価・画像目視を確認する。

# 2026-08-14 Codex: PR-R4-2C2 Canvas実画像表示修正

- 状態: `READY_FOR_REVIEW`
- Branch: `codex/fix-r4-2c2-canvas-image-render`
- Base: `origin/feature/manga-canvas-mvp`@`43a701f`（PR #259 merge後）
- Draft PR: [#260](https://github.com/team478a/manga/pull/260)
- Productionへ既存migration `202608140001`〜`202608140003`を順番通り適用し、table、RPC、RLSを確認した。既存完成Job 14件は10件を自動配置、生成開始後にrevisionが変わった4件を安全に手動確認待ちへ移した。Queue 0、配置失敗0、追加Provider呼出しなし、creditは使用28・予約0のまま。
- `test`モニター作品のページ20と22は画像4/4、台詞、revision、PNGの完成判定に成功した。ページ21は画像2/4、既存失敗2件のため未完成。ページ19はrevision不一致4件を手動確認待ちとして維持した。
- ProductionのBFL完成資産を単体表示すると704×1024の漫画画像が正常だった一方、Canvas編集画面ではぼやけた別表示になった。原因は署名付き外部画像を参照するSVGを`data:` URL化して`img`へ渡す表示境界で、Storage、Provider、DB、採用Canvas自体の破損ではない。
- 編集Canvasと原稿プレビューだけをinline SVG表示へ変更し、署名付き画像をページDOMから直接読み込ませる。PNG／PDF生成、Canvas schema、保存revision、Provider、model、pricing、retry、timeout、Scheduler、成人向け境界、Desktopは変更しない。
- ローカル検証: deps、lint、typecheck、Hub 704/704、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y violations 0、migration 58本、Webpack Hub build、Desktop build、RC structure preflight、`git diff --check`成功。通常Turbopack buildだけは既知のWindows path長上限で停止した。次はDraft PR、CI、Vercel Previewで実画像表示を確認し、Productionは変更せず停止する。
- PR #260のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。Previewは公開URLで未ログイン画面まで起動確認済み。Productionと認証cookieを共有しないため、責任者merge後に既存`test`セッションでページ20・22の実画像表示を再確認し、それまではProduction変更と有料再生成を行わない。

# 2026-08-15 Codex: PR-R4-2I 既存画像素材の参照登録

- 状態: `IMPLEMENTED_LOCAL_VALIDATION_COMPLETE`
- Branch: `codex/fix-r4-2i-existing-reference-assets`
- Base: `origin/feature/manga-canvas-mvp`@`923055c`（PR #265 merge後）
- Productionの`test`モニター作品で参照画像の手動アップロードが「画像形式と容量を確認してください。」として失敗した。対象PNGは1,271,581 bytes、704×1024、sRGBで、20MB／20,000pxの既存制限内。参照画像0件、credit使用38・予約0のままで、画像自体やcredit不足が原因ではない。
- 同じ作品のCloud Assetとして既に保存済みの画像を再アップロードせず、参照対象・画像素材・用途メモを選んで既存`save_cloud_visual_reference`契約へ直接登録できる経路を追加した。新規ファイルのアップロード経路は後方互換のため維持する。
- DB、migration、RPC、Storage schema、公開API、Provider、model、pricing、retry、timeout、Scheduler、Feature Flag、Canvas schema、PNG／PDF、成人向け境界、Desktopは変更していない。Productionのデータ変更と外部Provider実行も行っていない。
- ローカル検証: focused 3/3、deps、lint、Hub typecheck、Hub 715 tests、Canvas 26/26、AI 48/48、migration 59本、Webpack Hub build、RC structure preflight、`git diff --check`成功。全typecheckのDesktopだけはローカル依存の`@napi-rs/keyring`型宣言不足、通常Turbopack buildは既知のWindows path長上限で停止したため、正規確認先をGitHub Actions／Vercel Previewとする。
- 次: commit・push・Draft PRを作成し、Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功で停止する。責任者merge前にProductionで参照登録や有料再生成を行わない。
- Draft PR: [#266](https://github.com/team478a/manga/pull/266)。初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。Previewは`https://mangai-hub-staging-niam5c0ge-team478as-projects.vercel.app`。Draft／MERGEABLEを確認し、Productionを変更せず責任者review待ちで停止する。
