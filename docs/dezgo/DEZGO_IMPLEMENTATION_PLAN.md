# MANGAI Desktop Dezgo Phase 1 実装計画

作成日: 2026-07-17

対象ブランチ: `feature/manga-canvas-mvp`

対象指示書: `MANGAI_Codex_Dezgo_Implementation_Instructions_Final.md`

## 1. 結論

Dezgoは既存のローカルComfyUIを置き換えず、追加の画像生成Providerとして実装する。既存の`ImageGenerationProvider`、SQLite生成Queue、生成履歴、Project外部送信ポリシー、外部送信previewを拡張し、rendererからDezgoへ直接通信しない。

Phase 1は開発環境で明示的に有効化した場合だけ、非成人向けProjectの1操作1枚Text-to-Imageを許可する。成人向けProject、成人向けJob、一括生成、Image-to-Image、ControlNet、Inpainting、Upscale、Remove Backgroundは無効のままとする。

## 2. 公式仕様の確認結果

2026-07-17にDezgo公式資料を確認した。

- Base URLは`https://api.dezgo.com/`
- 認証は`X-Dezgo-Key`
- `GET /info`は`models`にmodel metadataを返す
- `GET /account/tx/last`は現在残高を含む最後の取引を返す
- `POST /text2image`はJSON、form-urlencoded、multipartを受け付け、画像をraw binaryで返す
- Job開始応答には`x-dezgo-job-amount-usd`、`x-dezgo-balance-total-usd`等が返る
- Seedは`x-input-seed`で取得できる
- API料金とモデルは変更され得るため、モデルIDや価格表を製品コードへ固定しない

参照:

- <https://dev.dezgo.com/getting-started/>
- <https://dev.dezgo.com/guides/models/>
- <https://dev.dezgo.com/openapi.json>
- <https://dev.dezgo.com/changelog/>
- <https://dezgo.com/terms>
- <https://dezgo.com/info/faq>

公開Termsは18歳以上、違法利用、児童搾取、第三者権利侵害等の禁止を定めているが、成人向け漫画のAPI商用生成を明示的に承認する書面とは扱わない。指示書どおり`dezgoAdultGenerationEnabled=false`を維持し、成人向け実測は書面確認後の別Phaseへ延期する。

## 3. 現在の画像生成経路

```text
GenerationJobs.tsx
  -> preload window.mangai.ai.generateImage
  -> main IPC ai:image:generate
  -> AIService.generateImage
  -> routeGenerationJob / ProjectGenerationPolicy
  -> ComfyUIProvider.generateImage
  -> ComfyUI queue / history polling
  -> downloadImages
  -> Project assetsへローカル保存
  -> generation_jobs / generation_outputs更新
  -> rendererが履歴とProject bundleを再読込
```

補助経路:

- `AISettings.tsx` -> Provider設定、接続確認、モデル取得
- `AIService.enqueuePageBatch` -> Page単位のローカル一括Queue
- `AIService.previewExternalSafeAsset` -> safe background / prop / effectの外部送信preview
- `routeGenerationJob` -> local / cloud / render node / asset library / blockedの判定

## 4. 関連ファイル一覧

### 共通型・ルーティング

- `packages/ai-core/src/index.ts`
- `packages/ai-core/src/hybrid-generation.ts`
- `packages/ai-core/src/external-asset-provider.ts`
- `packages/ai-core/tests/hybrid-generation.test.mjs`

### Desktop main process

- `apps/desktop/src/main/ai/service.ts`
- `apps/desktop/src/main/ai/providers/comfyui.ts`
- `apps/desktop/src/main/ai/providers/http.ts`
- `apps/desktop/src/main/database.ts`
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/main/hub-device-store.ts`

### IPC・renderer

- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/preload/api.d.ts`
- `apps/desktop/src/renderer/features/ai-settings/AISettings.tsx`
- `apps/desktop/src/renderer/features/generation-jobs/GenerationJobs.tsx`
- `apps/desktop/src/renderer/i18n.tsx`

### テスト・文書

- `apps/desktop/tests/ai.test.mjs`
- `apps/desktop/tests/database.test.mjs`
- `docs/desktop/HYBRID_GENERATION_PHASE1_AUDIT.md`
- `docs/desktop/AI_CREATOR.md`

## 5. 既存Provider構造

`@mangai/ai-core`に`ImageGenerationProvider`が存在し、ComfyUIが実装している。新しい共通interfaceを重複作成せず、次を後方互換で追加する。

- Provider IDへ`dezgo`を追加
- `ImageGenerationRequest`へProvider共通のText-to-Image parameterをoptional追加
- `ImageGenerationResult.images`をDezgoの即時binary応答に利用
- model metadataを`AIModelInfo`へoptional追加
- 残高取得をoptional capabilityとして追加
- ComfyUIの非同期pollingとDezgoの即時完了をService側で分岐

`ExternalAssetProvider`の送信preview・確認契約も再利用する。Phase 1ではsafe JobだけをDezgo候補にし、Project policy、外部送信確認、費用確認を通過しない限り送信しない。

## 6. APIキー保存方式

APIキーはrenderer、SQLite、`localStorage`、設定JSON、通常ログ、診断ログ、生成履歴へ渡さない。

新しい`ProviderCredentialStore`をmain processに作り、次の契約を持たせる。

```typescript
interface ProviderCredentialStore {
  set(providerId: string, secret: string): Promise<void>;
  has(providerId: string): Promise<boolean>;
  get(providerId: string): Promise<string | null>;
  delete(providerId: string): Promise<void>;
}
```

保存先はOS keyringに限定する。

- Windows: Credential Manager
- macOS: Keychain
- Linux: Secret Service / libsecret

既存`hub-device-store.ts`の`safeStorage`＋暗号化JSONは設計参考にするが、Dezgo APIキーの保存先には使わない。OS keyringを利用できない場合は保存・接続をfail closedとし、平文または暗号化ファイルへfallbackしない。rendererへ返すのは`configured: boolean`だけで、全文再表示APIは作らない。

native keyring依存はElectron 39 / Node ABI / Windows x64製品buildで導入試験し、保守状況と署名対象を確認してから確定する。

## 7. 既存機能への影響

- ComfyUIの設定、workflow、Queue、再試行、停止、履歴は維持する
- Ollama / Creator Chatへ影響を与えない
- 既存Projectと既存`generation_jobs`を変換しない
- Dezgoが停止・無効・credential未設定でも編集、保存、書き出し、Asset Library、ComfyUIを継続可能にする
- rendererから外部URLや認証headerを指定できない固定origin設計にする
- 診断loggerへprompt、negative prompt、API key、Dezgo error body全文を渡さない

## 8. 変更予定ファイル

- `packages/ai-core/src/index.ts`
- `packages/ai-core/src/external-asset-provider.ts`
- `apps/desktop/src/main/ai/service.ts`
- `apps/desktop/src/main/database.ts`
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/preload/api.d.ts`
- `apps/desktop/src/renderer/features/ai-settings/AISettings.tsx`
- `apps/desktop/src/renderer/features/generation-jobs/GenerationJobs.tsx`
- `apps/desktop/src/renderer/i18n.tsx`
- `apps/desktop/package.json`
- 関連lockfile、tests、docs

## 9. 新規ファイル

- `apps/desktop/src/main/ai/providers/dezgo.ts`
- `apps/desktop/src/main/ai/provider-credential-store.ts`
- `apps/desktop/src/main/ai/dezgo-feature-flags.ts`
- `apps/desktop/tests/dezgo.test.mjs`
- `docs/dezgo/DEZGO_IMPLEMENTATION_REPORT.md`
- `docs/dezgo/DEZGO_USER_GUIDE.md`

必要ならcredential storeのOS別adapterを同directoryへ分割する。

## 10. DBマイグレーション

APIキーはDBへ追加しない。既存`ai_models`を24時間model cacheに、`generation_jobs.input_json`を生成parameterに、`generation_jobs.output_json`と`generation_outputs.metadata_json`をSeed・実費・残高・所要時間に利用できる。

Phase 1で必要な追加migrationは次だけを候補とする。

- `generation_jobs.panel_id` nullable列
- Provider別利用額を集計しやすくする追加index

既存列・tableは削除しない。起動時の`pragma table_info`方式に合わせた冪等up migration、列追加前DBからの起動試験、Project複製・backup・restore試験、ロールバック手順を追加する。新列を利用するコードを戻せば、残ったnullable列は旧版の動作へ影響しない。

## 11. フィーチャーフラグ

次をmain processで評価し、rendererから書き換えられないようにする。

```text
dezgoProviderEnabled=false
dezgoDirectByokEnabled=false
dezgoAdultGenerationEnabled=false
dezgoBatchGenerationEnabled=false
```

開発時のみ環境変数で最初の2つを有効化できる。製品版はbuild設定で明示許可しない限りfalseとする。成人向けとbatchはPhase 1中、環境変数を設定してもtrueにならない定数とする。

## 12. リクエスト・保存設計

Phase 1入力:

- Provider=`dezgo`
- Job Type=`text_to_image`
- Prompt / Negative Prompt
- Model
- Width / Height
- Steps / Guidance / Sampler / Seed
- Output Format
- Project / Page / Panel
- 外部送信確認token

main processでProject所属、Project区分、外部送信policy、Provider flag、credential、model capability、1枚制約、費用上限、confirmationの整合性を再検証する。

Dezgo応答を受けたら一時ファイルを経由せず`Uint8Array`として受け取り、Sharpでdecode・再encodeしてEXIF等のmetadataを除去してからProject assetへ保存する。保存成功後だけJobをcompletedにする。

履歴にはendpoint名、model、parameter、Seed、実費、生成後残高、所要時間、Project / Page / Panel、local asset IDを保存する。API key、認証header、Dezgo user ID、未加工error bodyは保存しない。

## 13. コスト制御

既存のProject月間上限を再利用し、Phase 1で以下を追加する。

- 1ジョブ警告 `$0.05`
- 日次上限 `$5`
- 1作品上限 `$20`
- ユーザー月間上限 `$30`
- 残高注意 `$5`
- 残高警告 `$2`

Dezgoの公開資料では実費headerは確認できるが、任意parameterの公式見積APIは確認できていない。価格をコードへ固定せず、見積取得方法を公式OpenAPIで追加確認する。見積不能時は既存previewの`cost_estimate_unavailable`で外部送信をblockし、ユーザーの明示的な上限承認を見積の代替にしない。

タイムアウト後は二重課金防止のため自動再送しない。400 / 401 / 402 / 403も再試行しない。429 / 5xxだけ、応答がJobを開始していないと判定できる場合に最大1回再試行する。

## 14. 成人向け制御

Phase 1では次をすべて満たしても成人向け生成は実行しない。

- Projectが成人向け
- Job Typeが`adult_character_render`
- promptが成人向け
- UIまたは環境変数から成人向けを要求

既存Routerの`sensitive_local_only`に加え、Dezgo Provider入口でも`DEZGO_ADULT_DISABLED`として拒否する。表示文は日英で用意する。

指示書第19節の成人キャラクター20枚、ControlNet / Inpainting、20ページ検証はPhase 1対象外のため、書面確認と各Phase実装完了後に別受入れとして行う。

## 15. 想定リスク

| リスク                        | 対応                                                                     |
| ----------------------------- | ------------------------------------------------------------------------ |
| API key漏えい                 | main限定keyring、redaction test、DB・log走査                             |
| API仕様変更                   | OpenAPIに対するruntime validation、unknown field許容、model hardcode禁止 |
| 二重課金                      | timeout自動再送禁止、retry分類test                                       |
| 外部送信誤判定                | mainでProject policyとconfirmationを再検証                               |
| 成人向け誤送信                | Project区分とJob Typeの二重block、flag常時false                          |
| 料金超過                      | 送信前見積必須、利用額集計、残高・上限block                              |
| native keyringのpackaging失敗 | Windows製品build・install smokeを導入直後に実施                          |
| binary偽装・巨大応答          | Content-Type、最大byte、画像decode、pixel上限を検証                      |
| Dezgo停止                     | Provider単体failureに隔離し既存機能を継続                                |
| 既存Queue回帰                 | Provider別Queue testとComfyUI既存testを維持                              |

## 16. ロールバック方法

1. Dezgo feature flagをfalseにして通信を停止する。
2. Dezgo Provider登録とUI表示を戻す。
3. OS keyringの`MANGAI Desktop / dezgo`credentialを削除する。
4. nullable追加列は残しても旧コードへ影響しない。必要なら文書化したdown migrationで再構築する。
5. Dezgo生成済み画像は通常のProject assetとして残し、ユーザー作品を削除しない。
6. ComfyUI、Ollama、既存履歴、Project DBを巻き戻さない。

## 17. Phase 1実装順序

1. 既存Provider型を後方互換拡張し、4 feature flagを追加
2. OS keyring credential adapter、限定IPC、漏えい否定テスト
3. Dezgo HTTP client、error分類、timeout、header parser
4. `GET /info`接続確認、model validation、24時間cache、手動更新
5. `GET /account/tx/last`残高取得と警告表示
6. additive DB migrationと履歴metadata
7. 外部送信preview、費用見積、Project policy、confirmation接続
8. 1枚Text-to-Image、画像検証・metadata除去・Asset保存
9. 履歴表示、設定復元、画像を開く、費用表示
10. Queue上限20、同時実行1、cancel、限定retry、再起動復元
11. 日英UI、アクセシビリティ、自動テスト、Windows製品build
12. 非成人向け実API 10枚の手動E2Eと実装報告・ユーザーガイド

各番号を原則1目的1コミットに分ける。Phase 2機能は混在させない。

## 18. テスト方針

### 単体・mock

- feature flagの製品版default false
- credentialの保存・存在確認・削除、renderer非公開
- keyring unavailable時のfail closed
- API keyがDB、log、error、historyへ含まれない
- `/info`正常・schema差分・24時間cache・失敗時cache fallback
- balance正常・不正値・低残高・不足
- Text-to-Image parameter mappingと1枚制約
- header名の大文字小文字非依存
- Seed、実費、残高、所要時間保存
- HTTP 400 / 401 / 402 / 403 / 404 / 429 / 5xx分類
- timeout・cancel・retry上限・二重送信防止
- 非画像、巨大応答、decode失敗、metadata除去
- 外部送信禁止Project、成人向けProject、成人向けJobの拒否
- Project / Page / Panel参照不一致の拒否
- ComfyUIとDezgo Queueの相互非破壊

### 回帰

- Desktop TypeScript / ESLint / integration tests / renderer build
- ai-core tests
- axe accessibility監査
- Project作成・再起動・backup・restore
- ComfyUI生成・cancel・再試行
- PDF / ZIP /販売パッケージ書き出し
- Windows unpacked build、installer smoke、SBOM・checksum

### 実API

ユーザーが用意したDezgo BYOK keyをOS keyringへ保存し、秘密値を表示しない専用manual testで実施する。Phase 1は非成人向け画像10枚だけとし、model、寸法、steps、seed、時間、実費、残高、成功・失敗を記録する。画像とprompt本文は報告書へ添付しない。

## 19. Phase 1完了条件

指示書の23項目を満たし、次も確認できた場合に完了とする。

- `dezgoAdultGenerationEnabled=false`
- `dezgoBatchGenerationEnabled=false`
- strictな外部送信確認なしでは1byteも送信しない
- API key文字列がDB・設定・log・診断・Git走査で0件
- Dezgo停止時に既存Project編集・保存・書き出し・ComfyUIが動作
- 非成人向け実API 10枚の費用・速度結果を記録

成人向け、ControlNet、Inpainting、20ページ以上の実測はPhase 1完了条件へ含めない。
