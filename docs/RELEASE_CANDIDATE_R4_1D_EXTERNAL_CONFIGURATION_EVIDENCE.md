# MANGAI PR-R4-1d Production外部構成照合証跡

最終更新: 2026-08-10

状態: `EXTERNAL_CONFIGURATION_REQUIRED`

対象branch: `codex/release-r4-1d-checkpoint-acceptance`

基準commit: `84773f75c9f42715a33b540dd96dcde4fe6e74cd`（PR #221 merge commit）

Draft PR: [#222](https://github.com/team478a/manga/pull/222)

Preview: `https://mangai-hub-staging-git-codex-release-68a981-team478as-projects.vercel.app`

## 1. 判定

R4-1の優先残件であるProduction checkpoint migrationとCloud text readinessを、認証済み管理画面から秘密値を表示せず照合した。

checkpoint migrationは、現在のSupabase Dashboard accountから対象project `vmdsyxykcrgxcdbrwlkv`を参照できないため未適用状態を解消できない。対象SQL Editor URLはOrganization一覧へ戻され、表示できるprojectは別project `mailsend`だけだった。別projectへmigrationを誤適用していない。

Cloud textは、Production構成に必要な環境変数とProvider価格が不足していることを確認した。OpenAI市場分析設定は設定済み・有効だが、Cloud text Gatewayとは別経路であり代用しない。文章Job、Provider呼出し、credit予約、課金は実行していない。

本照合だけではR4-1を完了扱いにしない。外部構成の責任者確認と適用後にcheckpoint作成・差分・復元、Cloud text文章Job 1件を再受入れする。

## 2. checkpoint migration照合

| 確認 | 結果 |
|---|---|
| 対象project URL | `https://supabase.com/dashboard/project/vmdsyxykcrgxcdbrwlkv/sql/new` |
| Dashboard session | ログイン済み |
| 対象project access | BLOCKED。対象URLからOrganization一覧へ戻る |
| 現在表示できるproject | `mailsend` 1件のみ |
| 対応migration | `202608010011_cloud_project_checkpoints.sql` |
| 後続依存 | `202608020003_cloud_project_checkpoint_restore.sql` |
| 本番DB変更 | なし。SQL実行、migration適用、checkpoint作成を行っていない |

対象projectの権限を持つ担当者は、全migration manifestを依存順で照合し、少なくともcheckpoint migrationとrestore migrationの適用状態を確認する。単独SQLを推測適用せず、既存履歴、checksum、rollbackを維持する。

## 3. Cloud text readiness照合

### 3.1 Vercel Project variables

Production project `team478as-projects/mangai-hub-staging`のProject／Shared変数名だけを確認し、値は表示していない。

| 変数 | Project | Shared | 判定 |
|---|---:|---:|---|
| `MANGAI_CLOUD_TEXT_ENABLED` | あり（Production／Preview） | なし | 存在 |
| `MANGAI_CLOUD_TEXT_MODEL` | なし | なし | 不足 |
| `MANGAI_CLOUD_TEXT_PRICING_VERSION` | なし | なし | 不足 |
| `MANGAI_CLOUD_AI_GATEWAY_ENDPOINT` | なし | なし | 不足 |
| `MANGAI_CLOUD_AI_GATEWAY_KEY` | なし | なし | 不足 |

`MANGAI_CLOUD_TEXT_ENABLED`だけではcapabilityは有効にならない。repositoryの既存契約ではpricing versionが必要であり、Workerが実Providerを構築するにはHTTPS Gateway endpointとkeyも必要である。

### 3.2 Production Provider価格

管理画面 `/admin/cloud-ai` のProvider価格台帳は13行で、すべてBlack Forest Labs画像価格だった。`mangai-cloud-text`は0行である。

DBへtext価格を追加する場合は、責任者が確定したprovider ID、model ID、pricing version、job type、credit、最大原価だけを既存管理画面から登録し、停止状態で内容を確認してから有効化する。値を推測しない。

### 3.3 OpenAI設定との境界

`/admin/provider-settings`ではOpenAI市場分析が「設定済み／有効」だった。このVault設定は市場分析用であり、Cloud Editor文章Jobの`mangai-cloud-text` Gateway endpoint／keyではない。APIキー本体や末尾文字は確認・記録していない。

## 4. 再受入れ条件

### checkpoint

1. 対象Supabase projectへの正しい権限を確認する。
2. repository manifestとの差分を依存順で照合する。
3. `202608010011`と`202608020003`を含む未適用migrationを正規手順で適用する。
4. 既存一般向け検証作品でcheckpoint作成、差分表示、復元前自動backup、復元を確認する。
5. 作品所有権、生成中拒否、編集lock拒否、revision増加を確認する。

### Cloud text

1. 責任者がGateway運用先、model、pricing version、credit、最大原価を確定する。
2. Vercel Productionへ必要な5変数を設定し、再deployする。
3. `mangai-cloud-text`の`story`、`storyboard`、`speech_bubble`価格を必要範囲だけ登録・有効化する。
4. 秘密値非表示のreadinessを再確認する。
5. 一般向けの短い文章Jobを1件だけ登録し、Queue、Worker、credit予約／確定、生成結果を確認する。

## 5. 変更しなかったもの

- application code、DB、migration、RPC、Storage、API、URL、Feature Flag
- Provider、model、pricing、retry、timeout、Scheduler
- Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktop
- Production page、Canvas、Asset、作品状態、credit、外部設定

## 6. 残件

1. checkpoint migration適用と作成・差分・復元の再受入れ。
2. Cloud text外部構成適用と文章Job 1件の再受入れ。
3. 対象一般モニター本人sessionで市場分析の保存・一覧・再読込・フィードバック送信。
4. AIネーム由来8ページ以上の制作、候補操作、画像編集、一括生成、checkpoint、復元、PDF／PNG。
5. Scheduler、2利用者owner isolation、Stripe test E2E。

上記が揃うまでR4-1と`hub-production-acceptance`をpendingとし、R4-2へ進まない。

## 7. 自動検証

| 検証 | 結果 |
|---|---|
| `npm run rc:acceptance` | PASS。2 passed／11 pending／2 blocked、schema valid |
| `npm run rc:preflight` | PASS。repository structure READY。外部資格情報と手動E2Eは既知のpending |
| `npm run db:migrations:validate` | PASS。migration／rollback 50件 |
| `npm run rc:validate` | PASS。Hub 624/624、Desktop 182/182、Canvas 26/26、AI 48/48、migration 50/50、Hub／Desktop build |
| `git diff --check` | PASS |

## 8. Rollback

- 本PRは証跡文書と受入れ台帳だけのため、commitのrevertで戻せる。
- Production DB、Vercel変数、Provider価格、Provider、credit、利用者dataを変更していないため、本PR固有の外部rollbackは不要。
- 後続で外部構成を適用する場合は、適用前の環境変数scopeと価格active状態を別証跡へ記録し、個別に停止・削除できる状態を維持する。
