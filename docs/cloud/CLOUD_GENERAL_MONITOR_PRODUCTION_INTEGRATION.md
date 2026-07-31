# 一般向けモニター本番統合レポート

## 目的

`https://app.mang-ai.com` で、スタッフを含む約10名へ一般向け制作機能を
招待制・無料・段階的に提供するための独立した本番候補を作る。

## 統合状態

- Branch: `codex/cloud-monitor-production-v1`
- Base: `feature/manga-canvas-mvp`
- 統合元: `codex/cloud-general-monitor-beta-v1`
- 統合方法: production branchの最新から非破壊的なmerge commitを作成
- 既存Draft PRと既存branch: 変更、rebase、force push、Closeを行わない
- 本番マージ、Production公開、招待送信: 未実施

## 本番候補に含める機能

1. 市場分析
2. AI企画提案
3. シナリオ生成
4. ネーム生成
5. Canvasへの素材化
6. 一般向けコマ画像生成
7. 一般向けモニター招待、期限、AI上限、停止
8. 初回案内、Webマニュアル、フィードバック
9. 招待メールProviderの管理画面設定
10. 秘密値を表示しない公開前readiness check

Stripe、課金、販売、Marketplaceはモニター受入条件に含めない。

## 成人向け境界

統合履歴には成人向け市場分析と成人向け企画の実装が含まれるが、
今回の一般向けモニターでは公開しない。

- `CLOUD_ADULT_RESEARCH_ENABLED`: 未設定または`false`
- `CLOUD_ADULT_PLANNING_ENABLED`: 未設定または`false`
- 成人向けの個別許可を新規付与しない
- 成人向けシナリオ、ネーム、Canvas、作品管理の後続branchは統合しない

preflightとreadiness checkは、成人向けFlagが有効な場合に失敗する。

## Production環境変数

値をログ、PR、監査文書へ記載しない。Productionでは次の設定名だけを確認する。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `MONITOR_INVITE_SITE_URL`
- `CLOUD_GENERAL_MONITOR_BETA_ENABLED`
- `CLOUD_RESEARCH_MVP_ENABLED`
- `CLOUD_PROPOSAL_GENERATION_ENABLED`
- `CLOUD_SCENARIO_GENERATION_ENABLED`
- `CLOUD_STORYBOARD_GENERATION_ENABLED`
- `CLOUD_STORYBOARD_CANVAS_ENABLED`
- `CLOUD_PANEL_IMAGE_GENERATION_ENABLED`
- `MANGAI_CLOUD_AI_WORKER_ENABLED`
- `MANGAI_CLOUD_AI_WORKER_SECRET`

`NEXT_PUBLIC_SITE_URL`と`MONITOR_INVITE_SITE_URL`は、
いずれも `https://app.mang-ai.com` の同一originにする。

AI Provider keyとResend API keyは、環境変数へ日常運用値として置かず、
管理画面からSupabase Vaultへ保存・更新する。

## 追加migration

本番候補で新たに必要になるmigrationは次の順序で適用する。

1. `202607290001_cloud_market_research.sql`
2. `202607290007_cloud_research_quality_v2.sql`
3. `202607290008_cloud_adult_research_option.sql`
4. `202607290009_cloud_adult_planning_option.sql`
5. `202607300001_cloud_research_ai_provider.sql`
6. `202607300002_cloud_story_proposals.sql`
7. `202607300003_cloud_story_scenarios.sql`
8. `202607300004_cloud_story_storyboards.sql`
9. `202607300005_cloud_storyboard_canvas_materialization.sql`
10. `202607300006_cloud_general_monitor_beta.sql`
11. `202607310001_cloud_general_monitor_operations.sql`
12. `202607310002_cloud_general_monitor_email_provider.sql`
13. `202607310003_cloud_general_monitor_email_template.sql`

適用済みmigrationは再実行せず、migration履歴とcanonical schemaの一致を確認する。
成人向けのテーブルが存在しても、一般向けモニター公開時は環境FlagとDB側設定を
停止状態に保つ。

## 本番公開手順

1. Draft PRの全CIとVercel Previewを確認する。
2. 責任者が差分、除外範囲、Previewを承認する。
3. protected branchへマージする。
4. Production Supabaseのmigration履歴を確認し、不足分だけを順番に適用する。
5. Supabase AuthのSite URLを `https://app.mang-ai.com` にし、
   Redirect URLへ `https://app.mang-ai.com/**` を追加する。
6. Production環境変数を設定し、成人向けFlagが停止中であることを確認する。
7. Productionをredeployする。
8. `/admin/general-monitors/readiness`の全項目を確認する。
9. 管理画面でAI ProviderとResendを設定する。
10. Worker schedulerから認証付き実行が継続されることを確認する。
11. スタッフ1名で招待、受信、ログイン、市場分析保存と1コマ画像生成まで確認する。
12. 2〜3名へ拡大し、問題がなければ残りへ拡大する。

## 停止条件

次のいずれかが発生したら新規招待を止め、
`CLOUD_GENERAL_MONITOR_BETA_ENABLED=false`へ変更してredeployする。

- readiness checkが不合格
- 招待先originが本番URLと一致しない
- 成人向けFlagが有効
- 他ユーザーのデータを参照できる
- API key、Provider応答、DB内部エラーが画面またはログへ露出する
- 一般向け主要工程が保存・再表示まで完走しない

## ローカル品質ゲート

2026-07-31に独立worktreeで次を確認した。

- `npm run deps:check`: PASS
- `npm run lint`: PASS
- `npm run typecheck`: PASS（Hub + Desktop）
- `npm run research:eval`: PASS
- `npm run hub:test`: PASS（272/272）
- `npm run db:migrations:validate`: PASS（28/28）
- `npm run build`: PASS
- `npm run cloud:general-monitor:preflight`: PASS（Production相当のテスト設定）
- `git diff --check`: PASS

preflightは設定名と合否だけを出力し、URL、credential、Provider keyを表示しない。
lockfileどおりの`npm ci`では既存依存にhigh severity audit警告があるため、
依存更新は本番統合とは分離した後続タスクとして扱う。
