# Cloud AI Module Pipeline

## PR-R2B分割方針

正本の1,500行上限を守るため、Cloud AI責務分離を小さな連続PRへ分割します。

1. PR-R2B-1: Creator Queue APIと生成要求契約
2. PR-R2B-2: Worker lifecycle、lease、retry、監視
3. PR-R2B-3: Provider registryとProvider adapter
4. PR-R2B-4: 生成物Storage、管理操作、互換entrypointの完成

各PRは直前のPRが正本へマージされた後に作成します。Provider、model、pricing、retry回数、timeout、Scheduler頻度、API key保存方式、migration、DB RPCは全段階で変更しません。

## PR-R2B-1の対象

```text
Creator HTTP API
  → src/modules/cloud-ai/presentation/generation-route.ts
  → src/modules/cloud-ai/application/enqueue-generation.ts
  → 既存Cloud Creator generation service
  → 既存enqueue／list RPC契約

Creator cancel API
  → src/modules/cloud-ai/presentation/generation-route.ts
  → src/modules/cloud-ai/application/cancel-generation.ts
  → 既存cancel RPC契約
```

App Routerの次のrouteは、presentation関数だけを再公開する薄いadapterにします。

- `src/app/api/creator/generation-jobs/route.ts`
- `src/app/api/creator/generation-jobs/[jobId]/route.ts`

生成要求の公開契約は `contracts/generation-request.ts` に置き、`@mangai/ai-core` の既存schemaをそのまま再公開します。request body、response、HTTP status、URLは変更しません。

## この段階で維持する安全性

- UUID形式のproject、job、idempotency keyをHTTP境界で検証する。
- rate limitはenqueueより前に実行する。
- 認証、所有者分離、idempotency、credit予約、budget kill switchは既存service／RPCへ委譲する。
- cancelは既存の認証済み利用者用処理を利用する。
- Domain Errorだけを安定codeへ変換し、DB／Provider内部情報をレスポンスへ出さない。
- presentationはSupabase admin client、service role、DB RPCを直接扱わない。

## PR-R2B-2の対象

```text
Internal Worker route
  → src/modules/cloud-ai/application/process-generation.ts
  → 既存Worker orchestration（互換bridge）
      → application/claim-next-job.ts
      → application/lease-heartbeat.ts
      → domain/cloud-ai-errors.ts
      → domain/retry-policy.ts
      → infrastructure/cloud-ai-repository.ts

Admin worker monitoring
  → application/inspect-worker-health.ts
  → 旧lib entrypointから互換再export
```

PR-R2B-2では、claim、lease heartbeat、lease喪失、失敗分類、retry判定、Worker healthをCloud AI moduleへ分離します。Worker routeはapplication entrypointを参照し、既存の`src/lib/cloud-ai-worker.ts`はProvider実行と生成物Storageを保持する暫定orchestratorとして残します。

既存のclaim／lease RPC名、lease秒数、heartbeat間隔、retry回数、失敗状態、Worker route URL、最大実行時間は変更しません。既存import利用者向けにlease heartbeat、lease error、Worker healthの旧entrypointも維持します。

### PR-R2B-2で意図的に残すもの

- Provider registry、Provider選択、Provider adapter、moderation（PR-R2B-3）
- 生成物変換、private Storage upload、補償削除、cleanup queue（PR-R2B-4）
- credit確定・解放、原価ledger、Job完了／失敗RPCの最終repository分離（PR-R2B-4）
- Scheduler頻度、Provider、model、pricing、timeout、API key保存方式、DB、migration、環境変数

### PR-R2B-2回帰検査

- Worker routeがCloud AI application boundaryへ入ること。
- claim、lease、error分類、retry policyが新しい責務境界から利用されること。
- domain層がSupabase admin client、RPC、Storageへ依存しないこと。
- 旧Worker／health importが継続して動作すること。
- Provider、Storage、API、DBの既存契約と実行結果を維持すること。

## 後続PRへ残す責務

- Worker claim、lease heartbeat、retry、完了／失敗処理
- credit確定・解放、原価ledger、Worker監視
- Provider選択、BFL／Gateway／Mock adapter、moderation
- metadata除去、private Storage、補償削除、cleanup queue
- Scheduler route、管理者1件実行、管理者取消
- 旧 `src/lib/cloud-ai-*.ts` の互換entrypoint整理

後続責務は現在の既存実装をそのまま利用し、PR-R2B-1では移動も変更もしません。

## PR-R2B-3の対象

```text
Internal Worker route
  → infrastructure/provider-registry.ts
      → infrastructure/bfl-provider.ts
      → infrastructure/gateway-provider.ts
      → infrastructure/mock-provider.ts
  → application/process-generation.ts
```

Provider capability一覧、実行時capability、Provider選択、Worker用Provider構築をProvider registryへ集約します。Worker routeはBFL、Gateway、Mockの具体classを直接参照しません。

既存のProvider ID、model ID、pricing version、job type、operation、enabled条件、BFL／Gateway endpoint、120秒timeout、Gateway moderation、idempotency header、BFL URL検証、原価情報は変更しません。Vaultから画像設定を読む既存方式と、設定不備時に画像Providerだけをfail closedにして他のJob処理を継続する挙動も維持します。

旧Registry、BFL、Mock entrypointは互換再exportとして維持します。Gatewayは1,500行上限を守るため、このPRでは新しいinfrastructure entrypointから既存実装へ委譲し、実体移動はPR-R2B-4で行います。

### PR-R2B-3で意図的に残すもの

- 生成物変換、metadata除去、private Storage、補償削除、cleanup queue（PR-R2B-4）
- credit確定・解放、原価ledger、Job完了／失敗RPCの最終repository分離（PR-R2B-4）
- Scheduler route、管理者1件実行、管理者取消（PR-R2B-4）
- Gateway adapter実体と旧Provider entrypointの最終整理（PR-R2B-4）
- Provider、model、pricing、retry回数、timeout、Scheduler頻度、API key保存方式、DB、migration、環境変数

### PR-R2B-3回帰検査

- Worker routeがProvider registryだけを参照し、具体Providerを生成しないこと。
- BFL、Gateway、Mock adapterがCloud AI infrastructure配下にあること。
- 旧Provider importから既存classと関数を利用できること。
- Gateway moderation、BFL／Gateway timeout、BFL原価情報が維持されること。
- Provider adapter既存テストとWorker lifecycle既存テストが成功すること。

## PR-R2B-4の対象

```text
Internal Worker route → application/process-generation.ts
  → infrastructure/generated-asset-storage.ts
  → infrastructure/cloud-ai-repository.ts
  → infrastructure/provider-registry.ts → infrastructure/gateway-provider.ts
Admin App Router → presentation/admin-actions.ts
```

生成画像のmetadata除去、private Storage upload、補償削除、cleanup queueをStorage境界へ分離します。Job完了／失敗、credit確定・解放、原価ledgerは既存RPC契約のままrepository境界へ集約します。旧Worker、Gateway、管理設定入口は再exportで互換性を維持します。

Scheduler routeは既にapplicationを参照する薄いHTTP境界であり、認証、health、最大実行時間、ログを保持するためApp Routerに残します。Provider、model、pricing、retry、timeout、Scheduler頻度、API key保存方式、DB、migration、RPC、環境変数は変更しません。

### PR-R2B-4回帰検査

- 画像sanitization、private bucket、補償cleanupとJob完了／失敗RPCがinfrastructureにあること。
- Gateway moderationと旧Worker／Gateway／管理設定importが維持されること。
- Scheduler routeがapplicationへ委譲し、Provider responseやpromptをログへ出さないこと。

## 回帰検査

- Creator Queue routeがpresentationへの薄いadapterであること。
- presentationがservice role、admin client、DB RPCを直接扱わないこと。
- 入力schema、rate limit、202 response、cancel responseを維持すること。
- application entrypointが既存generation serviceへ明示的に委譲すること。
