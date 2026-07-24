# Desktop AI Queue／Policyモジュール境界

## 目的

`AIService`の公開APIを維持しながら、生成先判定、Queue timer、retry policyをProvider呼出しから分離する。

## 構成

```text
apps/desktop/src/main/ai/
  ai-service.ts                       # Facade／orchestrator実装
  service.ts                          # 既存import向け互換entrypoint
  routing/
    generation-router.ts              # route判定と監査記録
  queue/
    generation-queue.ts               # Local／Dezgo timerと実行時間帯
    retry-policy.ts                   # retry／hold／failとbackoff
  providers/
    ollama.ts
    comfyui.ts
    dezgo.ts
```

## Generation Router

- `GenerationRouter.decide`は入力されたdraftとcontextから生成先を判定する。
- `decideAndRecord`は同じ判定結果とprompt SHA-256を専用Recorderへ渡す。
- RouterはSQLiteや`MangaiDatabase`へ直接依存せず、`GenerationRouteRecorder` interfaceだけを要求する。
- Asset Library、ComfyUI、Dezgoの既存route条件は変更しない。

## Queue

- `LocalGenerationQueue`と`DezgoGenerationQueue`がtimerを所有する。
- 夜間Queueの開始・終了時刻と現在時刻から次回wakeまでの時間を計算する。
- 再schedule時は旧timerを解除する。
- 設定変更時はtimerを解除して直ちに各Queueを再評価する。
- `now`、`setTimer`、`clearTimer`、`run`を注入できるため、実時間を待たず単体テストできる。
- Provider呼出しと永続Job状態は引き続きorchestratorが管理し、Queue classはProviderを知らない。

## Retry Policy

- Dezgoの`retry`／`hold`／`fail`判定を`queue/retry-policy.ts`へ配置した。
- ComfyUIの指数backoffを同じpolicyモジュールの`generationRetryDelayMs`へ統一した。
- 最大30秒、最小10ms、attempt回数による既存の増加条件を維持する。
- 旧`dezgo-queue-policy.ts`は既存importを壊さないcompatibility re-exportとして残す。

## Constructor依存

- `AIService`は`MangaiDatabase` concrete classではなく、必要なpublicメソッドだけを列挙した`AIServiceStore`を受け取る。
- Dezgo画像保存も`DezgoImagePipelineStore` interfaceへ縮小した。
- QueueとRouterは個別のdependency interfaceを持つ。

## 互換性

- `AIService`の公開メソッド、Electron IPC、preload APIを変更しない。
- `service.js`からの既存importを維持する。
- SQLite migration、Job schema、route decision schemaを変更しない。
- 成人向けDezgoのfail-closed条件、費用予約、Provider feature flagを変更しない。

## テスト

- Queue実行時間帯と次回wake計算
- timer差し替えと設定変更時の再実行
- bounded exponential backoff
- Route判定が1回だけ記録され、promptがSHA-256化されること
- ComfyUI／Dezgo Queue、pause、resume、cancel、retry、再起動復旧

## ロールバック

DB migrationはない。PRをrevertすれば旧`service.ts`内のQueue／Route処理へ戻せる。永続Jobや設定データの変換は不要。

## 残る分割

`ai-service.ts`にはChat、成人向けGate、外部費用承認、Provider実行orchestrationが残る。後続では各Serviceへ順次移し、AIService本体を薄いFacadeへ縮小する。
