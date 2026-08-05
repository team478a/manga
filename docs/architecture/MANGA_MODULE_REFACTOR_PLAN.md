# Cloud漫画生成 module 監査・分割計画

## 目的と基準

この文書は PR-R2C-0 の監査結果です。基準は `feature/manga-canvas-mvp` の `f3fc11f`（PR #174 merge commit）です。Cloud漫画制作の外部挙動を変えず、現在の `src/modules/cloud-creator` と互換 `src/lib`、App Router、Server Actionに分散したapplication責務を、レビュー可能な4 PRへ分割するための計画だけを定義します。

PR-R2C-0ではapplication code、DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Desktopを変更しません。

## 1. 現在のファイル・関数・依存関係

### 生成受付と候補生成

| 現在位置 | 主な関数／責務 | 直接依存 |
| --- | --- | --- |
| `src/app/api/creator/storyboard-panel-generation/route.ts` | `POST`、Feature Flag、rate limit、202/error応答 | `cloud-panel-image-generation*`、`cloud-ai-rate-limit` |
| `src/app/api/creator/generation-jobs/route.ts` | Job一覧と汎用生成受付 | Cloud AI presentation境界 |
| `src/app/api/creator/generation-jobs/[jobId]/route.ts` | Job取消 | Cloud AI presentation境界 |
| `src/lib/cloud-panel-image-generation-server.ts` | コマ文脈読込、prompt構築、2〜4候補、Image-to-Image、Inpainting、Outpainting、構図制御、背景・人物・効果の分離Job登録 | Supabase、Canvas schema、Feature Flag、`enqueueCloudGenerationJob`、visual reference／bible |
| `src/modules/cloud-creator/generation/generation-service.ts` | `getMyCloudAiQuota`、`enqueueCloudGenerationJob`、`listCloudGenerationJobs`、`cancelCloudGenerationJob` | AI schema／moderation、Provider選択、認証context、RPC／table |
| `src/modules/cloud-creator/generation/batch-production-service.ts` | `startCloudPageGenerationBatch`、一覧、pause/cancel、失敗Job再実行 | Canvas schema、panel生成、generation service、RPC／tables |
| `src/app/creator/[projectId]/pages/[pageId]/services/creator-api.ts` | browser側API client、生成要求DTO | 固定 `/api/creator/*` URL |

現在の主要フローは次のとおりです。

```text
CloudCanvasEditor
  -> creator-api.ts
  -> /api/creator/storyboard-panel-generation
  -> cloud-panel-image-generation-server.ts
  -> generation-service.ts
  -> Cloud AI application/infrastructure (PR-R2B)
  -> 既存enqueue RPC / private cloud-assets
```

### 比較・採用・再生成とCanvas

| 現在位置 | 主な関数／責務 | 直接依存 |
| --- | --- | --- |
| `CloudCanvasEditor.tsx` | 生成フォーム、候補polling、比較dialog、採用、再生成、分離レイヤー採用、透明レイヤー、構図指定 | browser fetch、Canvas state、asset URL、Feature Flag props |
| `PanelImageComparisonDialog.tsx` | 2候補比較UI | comparison service |
| `services/panel-image-comparison.ts` | 比較元frame決定の純粋関数 | なし |
| `PanelInpaintingDialog.tsx` | mask／修正指定UI | mask suggestion service |
| `services/panel-mask-suggestions.ts` | 顔・手・表情・衣装・背景等のmask候補座標 | UI内の型／純粋関数 |
| `src/modules/cloud-creator/canvas/canvas-service.ts` | snapshot取得・保存 | canvas repository |
| `canvas/canvas-repository.ts` | page、snapshot、`save_cloud_page_snapshot` | Supabase client |
| `canvas/canvas-normalizer.ts` | 保存済みCanvasの正規化 | `@mangai/canvas-core` |

候補の「採用」は専用DB RPCではなく、生成Jobの `output_asset_id` をCanvasの `imageAssetId` または `panelLayers[].assetId` へ反映し、既存snapshot保存APIで確定します。元画像を残す、分離生成を別レイヤーとして並べる、透明性を保持する挙動はCanvas schemaとEditorの操作契約です。

### ページ制作、長編、連続性、予算、checkpoint

| 領域 | 現在位置 | 主な関数／混在 |
| --- | --- | --- |
| ページ制作状態 | `production/production-status-service.ts` | default生成、project revision読込、page状態読込、状態更新RPC |
| 一括生成 | `generation/batch-production-service.ts` | ページ状態検査、Canvas読込、最大64コマ、Job登録、batch関連RPC、補償cancel |
| 長編構造 | `structure/structure-service.ts`、`projects/longform-cockpit-service.ts`、`chapter-production-plan-service.ts` | 構造更新RPCとcockpit集計 |
| 連続性 | `projects/narrative-continuity-service.ts`、`continuity-review-service.ts`、`src/lib/cloud-continuity-suggestions.ts` | facts／threads CRUD、採用画像と設定版の比較、候補提案 |
| 作品予算 | `projects/project-budget-service.ts`、`src/lib/cloud-project-budget.ts` | usage／limit RPCと入力schema |
| checkpoint | `projects/project-checkpoint-service.ts` | 一覧、manifest比較用current state、作成／復元RPC、復元履歴 |
| 差分 | `projects/project-checkpoint-diff.ts` | manifestと現行構造の決定的純粋比較 |
| 完成準備 | `projects/manuscript-preflight-service.ts` | page、snapshot、asset、Job状態の横断読込 |
| Server Action | `src/app/creator/actions.ts`、`cockpit/actions.ts`、`continuity/actions.ts` | validation、application呼出、例外変換、revalidate、redirectが同居 |

### PDF／PNG出力

| 現在位置 | 主な関数／責務 | 直接依存 |
| --- | --- | --- |
| `src/modules/cloud-creator/export/export-service.ts` | export用project／snapshot／asset staging | DB、Storage、filesystem |
| `src/lib/cloud-canvas-render.ts` | Canvas＋asset bytesからPNG render | `sharp` |
| `src/lib/cloud-canvas-export.ts` | PNG、PDF、zip、販売package生成とtemp file cleanup | export-core、filesystem、render、export service |
| `export/durable-export-service.ts` | export Job一覧／作成／状態変更／署名URL | RPC、table、admin Storage client |
| `src/lib/cloud-export-worker.ts` | claim、page分割、PNG/PDF生成、Storage、segment完了／失敗 | admin client、export-core、Storage、RPC |
| `src/app/api/internal/cloud-export/worker/route.ts` | secret認証、enabled判定、worker起動、300秒上限 | worker |
| `src/app/api/creator/projects/[projectId]/export/route.ts` | 同期export HTTP契約 | `cloud-canvas-export` |
| `src/app/api/creator/exports/[jobId]/download/route.ts` | 完成PDF download redirect | durable export service |

## 2. 責務混在の監査結果

- App Router: HTTP認証・validation・rate limit・Feature Flagに加え、旧libの具体use caseを直接選択するrouteが残る。R2Bで整理済みのgeneration-jobs routeと、未整理のstoryboard／export routeで境界の粒度が異なる。
- Server Action: `src/app/creator/actions.ts` は構造、制作状態、一括生成、checkpoint、export等をまとめてimportし、入力validation、業務エラー変換、cache無効化、redirect文言まで保持する。
- application: `*-service.ts` がuse caseの順序制御だけでなく `cloudCreatorContext()`、Supabase query／RPC、fallback用DB error code判定を直接持つ。
- repository: project／asset／canvasにはrepositoryがある一方、generation、batch、production、continuity、budget、checkpoint、exportはserviceからDBへ直結する。transaction相当の補償処理もservice内にある。
- domain: `project-checkpoint-diff.ts` 等の純粋規則は存在するが、batch上限（4〜8ページ、64コマ）、確定page拒否、候補数、revision操作、export readiness等の規則がapplication／UI／schemaに散在する。
- presentation: 約2,000行の `CloudCanvasEditor.tsx` がUI stateに加えて候補polling、Job分類、採用Canvas変換、再生成request組立を持つ。見た目を変えずに純粋な候補／採用規則をdomain/applicationへ抜ける余地がある。
- infrastructure: `cloud-panel-image-generation-server.ts` と `cloud-export-worker.ts` が認証済みデータ取得、業務判断、外部境界呼出、補償処理を一体で扱う。

## 3. 現在の外部境界

### URL／API

維持対象は少なくとも次です。

- `POST /api/creator/storyboard-panel-generation`（成功時202）
- `GET|POST /api/creator/generation-jobs`
- `DELETE /api/creator/generation-jobs/[jobId]`
- `GET /api/creator/ai-quota`
- `GET|POST /api/creator/assets`
- `GET|PUT /api/creator/pages/[pageId]/snapshot`
- `POST /api/creator/projects/[projectId]/export`
- `GET /api/creator/exports/[jobId]/download`
- `POST /api/internal/cloud-export/worker`
- Creator配下の既存page URL、form field、redirect先、query message/error

### DB／RPC

R2Cではschemaも呼出意味も変更しません。主要tableは `cloud_generation_jobs`、`cloud_generation_batches`、`cloud_generation_batch_jobs`、`cloud_pages`、`cloud_canvas_snapshots`、`cloud_assets`、`cloud_projects`、`cloud_chapters`、`cloud_episodes`、`cloud_scenes`、`cloud_character_profiles` とversions、`cloud_world_profiles` とversions、`cloud_style_bibles` とversions、`cloud_visual_reference_assets`、`cloud_panel_subject_assignments`、`cloud_continuity_facts`、`cloud_plot_threads`、`cloud_project_resource_budgets`、`cloud_project_checkpoints`、`cloud_project_checkpoint_restores`、`cloud_export_jobs`、`cloud_export_segments` です。

生成・制作に関する主要RPCは以下です。

- `enqueue_cloud_generation_job_with_quota`、`cancel_cloud_generation_job`、`get_my_cloud_ai_quota`
- `create_cloud_generation_batch`、`attach_cloud_generation_batch_job`、`set_cloud_generation_batch_state`、`replace_cloud_generation_batch_job`
- `set_cloud_page_production_status`、`save_cloud_page_snapshot`
- `get_cloud_project_resource_usage`、`save_cloud_project_resource_budget`
- `create_cloud_project_checkpoint`、`restore_cloud_project_checkpoint`
- continuity、visual reference、character／world bible、chapter plan、structureの既存CRUD RPC
- `create_cloud_export_job`、`set_cloud_export_job_state`、`claim_cloud_export_job`、`complete_cloud_export_segment`、`fail_cloud_export_job`

### Storage／Feature Flag

- bucket `cloud-assets`、`cloud-exports`、`cloud-cache` と現行path規則、private／signed URL条件を維持する。
- panel image generation、inpainting、outpainting、storyboard Canvas、Cloud AI worker、Cloud export workerの既存Flag名、既定値、評価順を維持する。
- Feature Flag無効時のfail-closed応答を維持する。

## 4. 絶対に変更しない外部契約

- request／response JSON、HTTP method／status、URL、download filename、Server Actionのform／redirect契約。
- DB schema、migration履歴、RPC名・引数・戻り値・権限、RLS、所有者分離、revision単調性。
- Storage bucket／path／content type／private性／署名URL 300秒、補償削除とquota／budget強制。
- `cloudGenerationInputSchema`、Provider ID、model ID、pricing version、moderation、idempotency、candidate count 2〜4、batch 4〜8ページ／最大64コマ。
- text-to-image、image-to-image、inpainting、outpainting、mask、構図override、generation target、透明／分離layerの意味。
- Canvas schema、snapshot形式、panel／panelLayersの採用挙動、元候補を保持するUndo可能性。
- retry回数、timeout、lease、heartbeat、Scheduler頻度、Worker URL／secret、ログの秘密情報境界。
- PDF／PNG pixel、page順、DPI、命名、segment／merge、package manifest、checksum。
- 一般向けCloudと成人向けDesktop／ローカル優先境界。R2CからDesktopへ依存しない。
- `src/lib/cloud-creator-server.ts` 等の既存exportは利用箇所が移行完了するまでcompatibility entrypointとして維持する。

## 5. 推奨module構造

```text
src/modules/manga/
  contracts/
    panel-generation.ts
    production.ts
    export.ts
  domain/
    panel-candidate.ts
    panel-adoption.ts
    generation-batch.ts
    production-state.ts
    continuity.ts
    checkpoint.ts
    export-plan.ts
  application/
    enqueue-panel-candidates.ts
    adopt-panel-candidate.ts
    retry-panel-generation.ts
    manage-generation-batch.ts
    manage-production-state.ts
    inspect-continuity.ts
    manage-checkpoint.ts
    prepare-project-export.ts
    process-export-segment.ts
  infrastructure/
    manga-generation-repository.ts
    manga-project-repository.ts
    manga-checkpoint-repository.ts
    manga-export-repository.ts
    manga-asset-storage.ts
  presentation/
    panel-generation-route.ts
    creator-actions.ts
    export-route.ts
```

既存 `src/modules/cloud-creator` は一括renameしません。各PRでは新しい境界へ実体を小さく移し、旧ファイルを再exportまたは薄い委譲adapterとして残します。`manga` moduleは `cloud-ai` の公開application／contractsだけを利用し、Provider実体へ依存しません。

依存方向は `presentation -> application -> domain/contracts`、`application -> repository interface`、`infrastructure -> repository interface` とします。domainはNext.js、Supabase、Storage、Node filesystem、Providerに依存しません。

## 6〜9. PR-R2C-1〜R2C-4分割案、見込み、回帰テスト

行数はmerge baseとの差分churn見込みで、各PR 1,500行以下を必須上限とします。文書更新・互換adapter・testを含む概算です。

### PR-R2C-1: コマ生成受付application境界

対象はコマ画像生成、2〜4候補、Image-to-Image、Inpainting、Outpainting、構図制御、背景・人物・効果の分離生成です。request解釈、Feature Flag判定、rate limit後のuse case、文脈読込、Job計画を分けます。Provider実行はR2BのCloud AIへ委譲したままです。

- 変更見込み: 新規 `manga/contracts/panel-generation.ts`、`domain/panel-generation-policy.ts`、`application/enqueue-panel-candidates.ts`、`infrastructure/manga-generation-repository.ts`、`presentation/panel-generation-route.ts`。既存storyboard route、`cloud-panel-image-generation-server.ts`、generation service、compatibility export、focused tests。
- ファイル見込み: 9〜14 files。
- 行数見込み: 900〜1,300 lines churn。
- 回帰: request schema、候補数2／3／4、202、rate limit retry-after、Flag fail-closed、moderation、idempotency、prompt非露出、各operation／target、source／mask所有者検査、部分enqueue、既存API snapshot。

### PR-R2C-2: 候補比較・採用・再生成境界

対象は比較、候補採用、再生成、mask提案、透明／分離レイヤーです。UIは変更せず、Editor内の純粋なJob分類、比較frame、採用Canvas patch、再生成request生成をdomain/application helperへ移します。snapshot APIとCanvas schemaは不変です。

- 変更見込み: 新規 `domain/panel-candidate.ts`、`domain/panel-adoption.ts`、`application/build-panel-revision.ts`、`presentation/panel-candidate-view-model.ts`。Editor、comparison／mask service、creator API types、compatibility export、focused tests。
- ファイル見込み: 8〜12 files。
- 行数見込み: 750〜1,150 lines churn。
- 回帰: 左右／重ね比較、2〜4候補、採用先panel、元asset保持、compositeとbackground／character／effect layer、透明layer、layer順／表示、revision preset、mask、outpainting direction、Undo／Redo、snapshot payloadの完全一致。

### PR-R2C-3: 一括・制作状態・長編application境界

対象は一括生成、ページ制作状態、長編制作、連続性、作品予算、checkpoint、差分・復元です。認証contextとDB query／RPCをrepositoryへ寄せ、applicationは順序・補償・fail-closedを表現します。純粋checkpoint diffはdomainに維持します。

- 変更見込み: 新規 `domain/generation-batch.ts`、`production-state.ts`、`application/manage-generation-batch.ts`、`manage-production-state.ts`、`inspect-continuity.ts`、`manage-checkpoint.ts`、repository群。既存batch／production／continuity／budget／checkpoint service、Server Action薄型化、compatibility export、focused tests。
- ファイル見込み: 15〜22 files。1,500行を超える場合はcheckpointだけをR2C-3bとして責任者へ再提案し、無断で第5 PRを開始しない。
- 行数見込み: 1,100〜1,450 lines churn。
- 回帰: 4〜8ページ／64コマ、確定page拒否、途中enqueue、pause／cancel／retry補償、production revision、長編cockpit、continuity版一致、budget kill switch、checkpoint決定性、restore前backup、別作品拒否、生成中／編集中拒否、復元後要再確認、既存Action redirect。

### PR-R2C-4: PDF／PNG出力application／infrastructure境界

同期exportとdurable workerの両方を、export plan、repository、Storage、renderer、application orchestrationへ分離します。render結果やworker設定は変更しません。

- 変更見込み: 新規 `domain/export-plan.ts`、`application/prepare-project-export.ts`、`process-export-segment.ts`、`infrastructure/manga-export-repository.ts`、`manga-export-storage.ts`、presentation adapter。既存export service、canvas export／render、export worker、2 route、compatibility export、focused tests。
- ファイル見込み: 12〜18 files。
- 行数見込み: 950〜1,400 lines churn。
- 回帰: page／layer順、非表示除外、legacy flattened fallback、PNG寸法、DPI、PDF byte-level fixtureまたは既存決定性検査、4ページsegment、segment merge、path、content type、署名URL、worker secret／300秒、lease／retry／failure RPC、temp cleanup、package manifest／checksum。

## 10. ロールバック方法

各PRはDB／migration／保存形式を変更しないため、そのPRのmerge commitを通常の `git revert` で戻します。force push、履歴書換え、破壊的rebaseは使用しません。

- 新moduleをrevertし、旧compatibility entrypointの委譲前実装を同じrevertで復元する。
- PR単位で独立して戻せるよう、R2C-NはR2C-(N-1)のmerge後だけ開始する。
- DB、Storage、生成Job、checkpoint、export artifactのdata rollbackは行わない。
- Provider／Worker設定、Feature Flagをrollback手段として無断変更しない。
- revert後に該当focused test、Hub、migration validate、build、Previewを再確認する。

## 11. 実Provider受入れのタイミング

実Provider受入れはR2C-1〜R2C-4がすべてmergeされ、静的・fixture・CI回帰が成功した後に別工程として実施します。途中PRでは有料Providerを呼びません。

受入れでは一般向けの専用test projectを使い、1コマ生成、2〜4候補、比較／採用／再生成、Image-to-Image、Inpainting、Outpainting、構図override、背景／人物／効果分離、透明layer、一括生成、8ページPDF／PNGを確認します。実費、model、Provider response、prompt、利用者素材をログへ出さず、成人向け入力を外部送信しません。結果はrepository acceptanceと実Provider acceptanceを明確に分けて記録します。

## 12. PR-R3へ進む前の停止条件

次をすべて満たすまでPR-R3へ進みません。

1. R2C-1〜R2C-4が各々最新 `feature/manga-canvas-mvp` から開始され、Draft PR、全ローカル品質ゲート、Core quality、Migration roundtrip、Windows build、Vercel Preview成功後に責任者承認を得て順番にmerge済みである。
2. 各PRが1,500行上限内で、API／DB／RPC／Storage／Feature Flag／Provider／Canvas／PDF契約の差分ゼロを回帰testで示している。
3. 旧漫画制作PRの追加merge、Close、rebase、force pushを行っていない。
4. 実Provider受入れと8ページPDF／PNG目視、候補比較・採用・再生成、一括生成、owner isolation、長編100ページfixtureが成功または具体的な外部環境blockとして記録されている。
5. compatibility entrypointの残存／削除判断、既知warning、rollback手順を `CURRENT_TASK` とhandoffへ同期している。
6. 責任者がR2C完了とR3開始を明示承認している。

PR-R2C-0自身もDraft PRの全CI／Vercel Preview成功後に停止し、責任者確認前にPR-R2C-1を開始しません。
