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

## 20. 実装進捗

### 2026-07-17: OS資格情報Store

- 保守終了済み`keytar`を避け、N-APIの`@napi-rs/keyring` 1.3.0を採用
- `ProviderCredentialStore`をmain processへ追加
- Windows Credential Managerの固定service / accountへ保存し、SQLite・設定JSONへ保存しない
- rendererには設定済み状態、保存、削除だけを公開し、APIキー取得APIを公開しない
- Provider / BYOK flagが無効なら保存・削除IPCを拒否
- keyring不調時は秘密値を含まない固定errorに変換し、ファイルへfallbackしない
- Windows Credential Managerへの一時値の保存・読取・削除smoke成功
- Electron 39 Windows x64 unpacked build成功
- `app.asar.unpacked`へのkeyring JavaScriptと`keyring.win32-x64-msvc.node`同梱を確認
- Desktop TypeScript、ESLint、統合テスト64/64成功

### 2026-07-17: 読み取り専用Provider基盤

- 通信先を公式`https://api.dezgo.com`へ固定し、`X-Dezgo-Key`認証、15秒timeout、キャンセル、redirect拒否を実装
- `/info`による接続確認・モデル一覧と`/account/tx/last`による残高取得をmain processへ追加
- HTTP 400、401、402、403、404、429、5xx、timeout、通信失敗を秘密値を含まない固定errorへ分類
- 公式metadataの`functions`をMANGAI Job Typeへ変換し、未知の値は安全に無視
- モデルmetadataをSQLiteへ保持し、24時間cacheとAPI停止時のoffline fallbackを追加
- feature flag無効時はcacheを含むDezgo Provider操作を拒否
- rendererへ接続確認・モデル一覧・残高の限定IPCを公開し、APIキーと未加工response bodyは公開しない
- `generateImage`は明示的に未有効のまま維持し、この段階ではDezgoへ生成要求を送信しない
- ai-core 25/25、Desktop TypeScript、ESLint、統合テスト69/69、本番renderer build成功

### 2026-07-17: 設定画面統合

- 設定画面へDezgo専用カードを追加し、Provider / BYOK / OS資格情報Storeの利用可否を表示
- APIキー入力をpassword fieldとし、保存後はrenderer stateを消去して保存値を再表示しない
- APIキーの保存・更新・削除を既存の限定credential IPCへ接続
- 明示操作による接続確認後だけモデル一覧と残高を取得し、画像やPromptは送信しない
- モデル名、説明、family、native resolution、対応Job Type、cache状態を確認可能
- Phase 1 feature flagが無効な製品版ではカードを説明表示に留め、資格情報操作と外部通信を無効化
- 日本語・英語表示、status live region、busy / disabled状態、狭幅レイアウトへ対応
- Desktop TypeScript、ESLint、統合テスト69/69、本番renderer build、日英設定画面を含むaxe監査違反0件

### 2026-07-17: Projectポリシー・外部送信preview

- 画像生成画面へProject単位の外部処理ポリシー編集UIを追加
- `local_only`、`safe_assets_only`、`background_only`、`manual_approval`、種類指定に対応
- ローカル優先、毎回確認、Project月間費用上限を既存SQLiteポリシーへ保存
- Dezgo feature flagとOS keyringの設定済み状態を外部送信previewへ接続
- previewにはProvider、送信対象、非送信素材、推定費用、保持・学習利用、明示確認要件だけを表示し、Prompt本文は返さない
- 公式の事前見積APIを確認できないため、APIキー、許可ポリシー、月額上限が揃っても`cost_estimate_unavailable`で送信をblock
- 公式OpenAPIに基づきジョブデータ保持期間を完了後30日と表示し、未確認の学習利用条件や固定価格は推測しない
- 成人向け、人物・キャラクター参照、完成PageはProject設定で解除できないことを日英表示
- ai-core 25/25、Desktop TypeScript、ESLint、統合テスト69/69、本番renderer build、日英axe監査違反0件

### 2026-07-17: Text-to-Image内部pipeline

- 公式`POST /text2image`に合わせ、Prompt・Negative Prompt最大1000文字、320〜1024px・8px単位、Guidance、10〜150 Steps、Sampler、uint32 Seed、PNG/JPG/WebPをZod検証
- `application/json`の1枚限定request mapperを追加し、固定origin、`X-Dezgo-Key`、redirect拒否、3分timeout、cancelを維持
- binary responseをPNG・JPEG・WebP、25MiB以下に限定し、非画像・空画像・過大画像を固定errorで拒否
- `x-input-seed`、実費、生成後残高、取引indexだけを解析し、Dezgo user IDや全response headerを履歴へ保存しない
- Sharpでdecode後にPNGへ再encodeし、EXIF、ICC、XMP等のmetadataを除去
- 1枚だけをProject Assetへ登録し、model、寸法、Guidance、Steps、Sampler、Seed、実費、残高、所要時間を生成履歴へ保存
- Promptは既存の端末内Job履歴へ保持するが、Asset出力metadataへ重複保存せず、API keyはどちらにも保存しない
- 実API送信を呼び出すUI / IPC / Queue経路は追加せず、`DezgoProvider.generateImage`は無効のまま維持
- Desktop TypeScript、ESLint、統合テスト71/71、本番renderer build成功

### 2026-07-17: 生成履歴UI統合

- 完了したDezgo Jobの安全な`output_json`だけをrendererで解析し、未加工JSONやheaderは表示しない
- model、実費、生成後残高、Seed、所要時間、画像サイズ、Steps、Samplerを生成履歴へ日英表示
- 実費と残高は選択localeのUSD表記、所要時間はms / 秒で表示
- 保存済み`assetId`がある場合は「素材を開く」からProject Asset Libraryの該当素材を選択して編集画面へ戻る
- Dezgo履歴に`assetId`がなければ操作を無効化し、存在しない素材を開いたように見せない
- 既存ComfyUI履歴は従来どおり生成画面を閉じてAsset Libraryへ戻る挙動を維持
- axe監査用の隔離DBへDezgo完了Jobを追加し、日本語・英語の生成画面で結果詳細の描画を待ってから監査
- 実生成UI / IPC / Queue経路は引き続き無効で、外部API送信は行わない
- ai-core 25/25、Desktop統合テスト71/71、TypeScript、ESLint、本番renderer build、日英axe監査違反0件に成功

### 2026-07-17: Provider別Queue安全制御

- Dezgoの同時実行上限1件をQueue policyとして固定し、画像JobへDB層で自動的にactive Queue上限20件、最大試行2回（初回＋自動再試行1回）を適用
- 上限判定とJob作成を同じSQLite transactionで処理し、同時登録による20件超過を防止
- active件数は`queued`、`paused`、`running`を対象とし、完了・失敗・キャンセル後は新しいJobを登録可能
- Queue取得をProvider別に分離し、既存ComfyUI workerはDezgo Jobを取得しない
- 429と5xxだけを最大1回の自動再試行対象とし、通信断はQueue保留、400・401・402・403・404・入力不正・timeoutは自動再試行しない
- 汎用のキャンセルと再起動復元をDezgo Jobにも適用し、`running`は同じJob ID・最大試行数を維持して`queued`へ戻す
- Queue上限、Provider分離、キャンセル、再起動復元、試行上限、error別方針を自動テスト化
- 実行dispatcher、実生成UI、IPC、外部API送信はまだ有効化しない
- ai-core 25/25、Desktop統合テスト73/73に成功

### 2026-07-17: 一回限り外部送信承認契約

- preview本体と元のsafe素材RequestをMainプロセスのメモリだけに保持し、rendererへPrompt本文を含む承認tokenを返さない
- preview ID、Project / Page、Job Type、Prompt SHA-256を元Requestへ固定し、不一致や差し替えを登録時に拒否
- Project外部処理policy、月額上限、policy更新時刻、Dezgo feature flag、資格情報設定状態をcontext SHA-256へ固定
- payload、費用、Provider条件の3項目を明示確認したconfirmationだけを受理
- preview有効期限5分、発行後token有効期限60秒、一回消費後は即時無効
- tokenから実行Requestを復元し、rendererから送られた別Requestをdispatcherへ渡さない契約
- policy・資格情報状態の変更、Prompt改ざん、Project不一致、未来・過去の不正確認時刻、blocked previewを拒否
- 承認情報は最大100件のメモリ上限を持ち、アプリ再起動後は復元せず再確認を必須化
- 現在のDezgo previewは費用見積未取得で`executable=false`のため、承認発行、実行dispatcher、IPC、外部API送信は引き続き無効
- 自動テストで改ざん、再利用、期限切れ、context変更、Project不一致、blocked preview、再起動相当のStore再生成を確認
- ai-core 25/25、Desktop統合テスト74/74、TypeScript、ESLint、本番renderer buildに成功

### 2026-07-17: 保守的費用見積・月間予算予約

- 公式の[Stable Diffusion 1/2価格表](https://dev.dezgo.com/pricing/sd1/)にある30 Steps時の320 / 512 / 768 / 1024px例とSteps比例を基準化
- 公式[OpenAPI](https://dev.dezgo.com/openapi.json)に事前見積endpointを確認できないため、要求画像以上の公開解像度帯を使い、さらに25%を加えた値をMANGAIの承認上限とする
- 価格表の確認日をversion化し、確認から30日を過ぎたbuildは`pricing_stale`でfail closed
- Project月間上限の未設定・超過、[`/account/tx/last`](https://dev.dezgo.com/getting-started/)による残高の取得失敗・不足を個別理由でblock
- previewと再確認時に価格version、寸法、Steps、予約上限、当月実費・予約額、残高をcontext SHA-256へ固定
- 承認token発行時にSQLite transactionで費用枠を予約し、同時承認でもProject月間上限を超えないようにする
- 台帳には承認tokenのSHA-256だけを保存し、実費確定時は`x-dezgo-job-amount-usd`で精算する契約を追加
- 承認Storeが再起動で消える設計に合わせ、未精算予約はDB起動時に自動解放し、settled実費は月次集計へ保持
- 実行dispatcher、実生成UI、外部送信IPCはまだ有効化せず、この段階で生成requestは送信しない
- ai-core 26/26、Desktop統合テスト76/76、TypeScript、ESLint、本番renderer build、日英axe監査違反0件に成功

### 2026-07-17: 明示確認UI・Dezgo Queue登録

- 生成画面から`GET /info`由来の24時間cacheを読み込み、`text_to_image`対応モデルだけを明示選択するUIを追加
- モデルIDをハードコードせず、選択モデルID・名称・cache更新時刻をpreviewと承認contextへ固定
- Prompt、入力素材なし、キャラクター参照なし、完成Pageなし、費用上限、保持・Provider条件をpreviewへ表示
- 最終確認dialogでpayload・費用・Provider条件の3チェックを必須とし、Escape、focus trap、focus復帰、背面`inert`へ対応
- rendererからはpreview ID、Prompt SHA-256、確認状態だけをIPCへ渡し、Prompt再送・API key・承認tokenを扱わない
- Mainプロセスで一回限りtokenを発行・消費し、既存費用予約へのJob関連付け、Dezgo Job作成、Route監査を1つのSQLite transactionで確定
- Jobにはmodel、width、height、Steps、Guidance、Sampler、format、承認metadataを保存し、同条件の再現に必要な値を固定
- Queueのキャンセル時は費用予約を解放し、再起動時はJob関連済み予約だけを保持、未使用の承認予約を解放
- ComfyUI workerは引き続きDezgo Jobを取得せず、Dezgo dispatcherと実生成API送信はまだ無効
- ai-core 27/27、Desktop統合テスト76/76、TypeScript、ESLint、本番renderer build、日英29画面・状態のaxe違反0件に成功
