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

## 後続PRへ残す責務

- Worker claim、lease heartbeat、retry、完了／失敗処理
- credit確定・解放、原価ledger、Worker監視
- Provider選択、BFL／Gateway／Mock adapter、moderation
- metadata除去、private Storage、補償削除、cleanup queue
- Scheduler route、管理者1件実行、管理者取消
- 旧 `src/lib/cloud-ai-*.ts` の互換entrypoint整理

後続責務は現在の既存実装をそのまま利用し、PR-R2B-1では移動も変更もしません。

## 回帰検査

- Creator Queue routeがpresentationへの薄いadapterであること。
- presentationがservice role、admin client、DB RPCを直接扱わないこと。
- 入力schema、rate limit、202 response、cancel responseを維持すること。
- application entrypointが既存generation serviceへ明示的に委譲すること。
