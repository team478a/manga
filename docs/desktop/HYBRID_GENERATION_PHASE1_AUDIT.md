# ハイブリッド生成 Phase 1 現状調査

確認日: 2026-07-15

対象ブランチ: `feature/manga-canvas-mvp`

調査基準コミット: `bbd4a7c`

参照指示書: `MANGAI_low_spec_hybrid_generation_implementation_guide.md`

## 1. 結論

既存のMANGAI Desktopを全面再構築する必要はありません。現在の永続生成ジョブ、ComfyUI Provider、Project素材登録、Canvasオブジェクト、Undo / Redo、バックアップ、書き出しを維持し、その前段へGeneration Routerと外部送信ポリシーを追加する構成が適切です。

Phase 1で最初に解消すべき問題は、画像生成が`AIService.generateImage()`からComfyUIへ直接固定され、ジョブ内容・センシティブ区分・実行先・作品別外部送信ポリシーを判定する層がないことです。ComfyUIの既定接続先はlocalhostで無効状態ですが、明示許可したHTTPS originにも接続できるため、Router導入前は「リモートComfyUIへ人物・成人向け内容を送信しない」という製品ポリシーを構造的に保証できません。

したがって、Phase 1は次の順序で進めます。

1. 既存互換のジョブ分類型とRouterの純粋判定ロジック
2. 作品別外部送信ポリシーとfail-closed判定
3. Router判定結果の永続化と監査ログ
4. 既存ComfyUI生成をRouter経由へ移行
5. Project素材を検索・再利用する`asset_library` Provider
6. 外部背景Providerの抽象化と送信前確認

## 2. 現在の画像生成経路

```text
GenerationJobs renderer
  -> preload window.mangai.ai.generateImage
  -> IPC ai:image:generate
  -> imageJobRequestSchema
  -> AIService.generateImage
  -> ComfyUIProvider.generateImage
  -> ComfyUI /prompt
  -> /history polling
  -> /view image download
  -> Project/generated/images/<jobId>
  -> assets + generation_outputsへ登録
  -> operation_historyへ生成素材追加を記録
```

主要実装:

- `apps/desktop/src/renderer/features/generation-jobs/GenerationJobs.tsx`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/main/ai/service.ts`
- `apps/desktop/src/main/ai/providers/comfyui.ts`
- `packages/ai-core/src/index.ts`

RendererはNode.jsや外部APIを直接使用せず、preloadの限定APIとZod検証済みIPCを経由しています。この境界は維持します。

## 3. 現在の生成ジョブ

`generation_jobs`と`generation_outputs`はSQLiteへ永続化済みです。

現在保存している主な項目:

- Project / Episode / Page ID
- Provider種別・Provider ID・Model ID
- `generation_type`
- `queued / running / completed / failed / canceled`
- 進捗
- Prompt / Negative Prompt
- 入出力JSON
- Provider Job ID
- Error code / message
- 作成・開始・完了日時
- 出力素材参照

既存機能:

- 実行中状態と進捗更新
- キャンセル
- 失敗時の再実行
- タイムアウト
- アプリ再起動時に`running`を`INTERRUPTED`失敗へ変更
- バックアップversion 2で生成履歴と出力参照を保存・復元
- 複数画像の素材登録失敗時ロールバック

不足項目:

- 細分化されたJob Type
- Execution Target
- Sensitivity Level
- Panel ID
- 入出力Asset ID一覧
- Route reasonと確認要否
- Policy snapshot
- Retry count
- Pause / resume / priority
- Cost estimate / actual cost
- Workflow versionとモデルハッシュ

### 互換性判断

- 現在の状態値`canceled`を正規値として維持します。指示書の`cancelled`へ置換しません。
- 現在の`chat`と`image`を削除せず、新Job Typeへ段階移行します。
- 既存カラムは削除・renameせず、追加カラムまたは関連テーブルで拡張します。
- 旧行は`execution_target=local`相当として読み出し時に補完しますが、実データの一括書き換えは避けます。

## 4. Providerと通信制御

現在のProvider:

| Provider | 用途 | 既定接続先 | 状態 |
| --- | --- | --- | --- |
| Ollama | Creator Chat | `http://127.0.0.1:11434` | 既定OFF |
| ComfyUI | 画像生成 | `http://127.0.0.1:8188` | 既定OFF |
| Mock | 開発テスト | loopback | 製品版では拒否 |

既存の通信防御:

- loopback HTTPを許可
- リモートはHTTPSかつ明示した完全一致originだけ許可
- URL credential、base path、query、fragmentを拒否
- HTTP redirectを拒否
- timeoutとAbortSignal
- rendererからの直接通信なし

不足:

- `asset_library`
- `external_background_api`
- `lan_render_node`
- Provider capability宣言
- 背景専用Request / Result
- 費用見積もり
- Provider別データ保持条件
- API keyの安全な保存
- 外部送信前のpayload manifest

外部ProviderのAPI keyは現行`ai_provider_settings.config_json`へ平文保存しません。Hub端末tokenで使用しているElectron `safeStorage`方式を再利用可能ですが、Provider credential専用ファイル、識別子だけをSQLiteへ保存する構成を別途設計します。

## 5. Project・Page・Canvasデータ

現行Project Bundleは次を分離済みです。

- Project
- Episode
- Page
- Panel
- Balloon
- TextObject
- Asset

Panelは枠形状、z-index、表示、lock、変形、1つの`imageAssetId`と画像内変形を保持します。BalloonとTextObjectは独立したベクター相当データで、ローカルPage rendererがSVGを構築しSharpでPNGへ合成します。PDF・画像ZIPもこの共通レンダラーを利用します。

指示書に対して既に満たす部分:

- 枠・吹き出し・文字をAI生成せずアプリ内描画
- Page / Panel分離
- 表示・lock・opacity・z-index・transform
- 吹き出しとテキストの再編集
- ローカル最終合成・PDF / ZIP書き出し
- CanvasオブジェクトのUndo / Redo

不足:

- Panel内の背景・人物・小物・効果・tone・mask・correctionレイヤー
- レイヤーごとのAsset参照とsource job
- blend mode
- 背景だけの差し替え
- 人物だけの再生成
- レイヤー単位履歴
- 合成前後比較
- `flattened_legacy`区分

### Phase 2への境界

新しい`MangaPage`や`MangaPanel`を既存テーブルと重複作成しません。現行`pages`と`panels`を維持し、Panel内画像を構成する`panel_layers`関連テーブルを追加する案を優先します。既存`panels.image_asset_id`は互換用のflattened画像または合成キャッシュとして残します。

## 6. Projectポリシーとセンシティブ情報

Projectには`ageRating`があり、`成人向け`を識別できます。一方、現在は次がありません。

- Character Pack
- 成人確認・架空人物確認
- Job単位Sensitivity
- 外部送信禁止Asset属性
- Project単位External Processing Policy
- 外部送信前確認設定

Routerは画像やPromptを自動推測するだけの設計にしません。Project設定、Job Type、入力Assetの送信可否、Character Pack、利用者の明示指定を構造化入力として使います。情報不足・矛盾・解析失敗時は`external_forbidden`として外部送信を拒否します。

成人向けProjectの初期ポリシーは指示書どおり`safe_assets_only`とします。ただし、人物を含む可能性がある入力画像、キャラクター参照、完成Page、全文Promptは常に外部送信対象から除外します。

## 7. ログ・秘密情報

現在のAI失敗ログ`ai.log`はevent、error message、stack、Provider、Job IDを保存し、画像本体は保存しません。共通構造化ログはtoken、secret、API key等をredactします。

Phase 1で必要な変更:

- Router判定専用の構造化監査event
- Prompt本文ではなくSHA-256ハッシュを記録
- 送信Asset ID、ファイル名、画像本体を通常ログへ記録しない
- Route reasonは定義済みreason codeで保存
- Policy変更履歴を秘密値なしで保存
- 外部payload manifestは送信確認用の一時データとし、通常ログと分離

## 8. 低スペック対応の現在地

現在はComfyUIへwidth、height、seedとworkflow mappingを渡せますが、端末性能診断やRuntime Profileはありません。ComfyUI workflow内のbatch、ControlNet、LoRA、VAE tile、CPU offload、モデルunloadもMANGAI側では制御していません。

Phase 3で必要:

- GPU / VRAM / RAM検出
- `cpu_only`から`vram_24gb_plus`までのprofile
- profile別workflow parameter制約
- 同時ローカルジョブ数1のresource scheduler
- OllamaとComfyUIの排他制御
- pause / resume / priority付き永続Queue
- 再起動後のqueued / paused復元

これらはPhase 1のRouter型にRuntime Profileを入力できる余地だけ確保し、性能制御そのものはPhase 3まで持ち込みません。

## 9. Phase 1の追加設計

### 9.1 `packages/ai-core`

後方互換を維持して次を追加します。

- `HybridGenerationJobType`
- `ExecutionTarget`
- `SensitivityLevel`
- `ExternalProcessingPolicy`
- `GenerationJobDraft`
- `RoutingContext`
- `RouteDecision`
- Zod schema

Routerの初期判定は外部I/Oのない純粋関数とし、単体テストで全組み合わせを固定します。

### 9.2 初期Routerルール

1. `speech_bubble`、`text_layout`、`panel_layout`、`page_composite`、`export`は`builtin`
2. 人物系、成人向け、restricted、入力不明は`local`
3. background / prop / effectのsafeジョブは`asset_library`を優先
4. 外部ProviderはProject policyと明示許可を満たす場合だけ候補
5. `local_only`と外部送信禁止Assetは常に外部候補を除外
6. 外部Provider未設定・費用超過・失敗時は`asset_library`、次に`local`
7. Routerが安全な決定を返せない場合は実行せず確認を要求

### 9.3 永続化候補

最初のmigrationは追加型に限定します。

- `project_generation_policies`
- `generation_route_decisions`
- `generation_jobs`への`panel_id`、`job_type`、`execution_target`、`sensitivity`、`retry_count`

Promptや入力JSONを含む既存行の扱いを変えないため、migration前バックアップ、transaction、schema migration ID、再オープンテストを必須とします。

### 9.4 Feature flag

初期値はすべてOFFとします。

- `hybridGenerationEnabled`
- `externalBackgroundProviderEnabled`
- `layeredPanelEnabled`
- `lowSpecRuntimeEnabled`
- `renderNodeEnabled`

最初はRouterをshadow modeで実行し、決定を記録しても実行経路は従来ComfyUIのままにします。テスト合格後にローカルComfyUIだけRouter経由へ切り替えます。

## 10. 最初の実装単位

### Commit 1: 型と純粋Router（完了: `bbd4a7c`）

- `packages/ai-core`へ型・schema追加
- fail-closed Router追加
- local / builtin / asset_library / cloud候補判定テスト
- DB、IPC、UIは変更しない

`HybridGenerationJobType`、`ExecutionTarget`、`SensitivityLevel`、`ExternalProcessingPolicy`、Job Draft、Routing Context、Route DecisionとZod schemaを`packages/ai-core`へ追加しました。分類情報がない場合は`external_forbidden`と`personPresence=unknown`へ補完し、cloudへrouteしないfail-closed動作にしています。Router単体テスト12/12に成功しています。

### Commit 2: 作品ポリシー永続化

- migration前バックアップ
- Project別policy table
- main processの読み書きAPI
- DB再オープン・バックアップ回帰テスト
- UIはまだ既定値表示のみ

### Commit 3: shadow routing

- 既存画像生成RequestをJob Draftへ変換
- Route Decisionを保存
- 実行は従来ComfyUIを維持
- 成人向け・不明入力がcloud決定にならないテスト

### Commit 4: ローカルComfyUI切替

- `local_comfyui` adapter
- Routerが`local`を選んだ場合だけ既存Providerを実行
- Jobへtarget、sensitivity、reasonを表示
- 既存画像生成テストを維持

### Commit 5: Asset Library

- 既存Project素材metadataを利用した背景検索
- 一致時は生成せず再利用
- 使用回数・タグ・お気に入りの追加設計
- 外部通信なし

外部背景APIはProvider事業者、利用規約、保存期間、料金、API credential運用が確定した後に実通信を有効化します。

## 11. テスト基準

2026-07-15の調査時点:

- Desktop統合テスト: 46/46成功
- canvas-core単体テスト: 24/24成功

Phase 1追加テスト:

- adult / restricted / external_forbiddenがcloudへrouteされない
- 人物入力Asset付きbackgroundが外部拒否される
- 不明Sensitivityがfail-closedになる
- `local_only`が全外部候補より優先される
- `safe_assets_only`でsafe backgroundだけが候補になる
- 利用者指定targetもポリシー禁止を上書きできない
- Provider失敗時のfallback順
- Router導入後も既存ComfyUI生成・キャンセル・再実行・素材登録が成功する
- 旧DBと既存Projectを開ける
- バックアップ・復元・Project複製で新しいpolicyとroute履歴を保持する
- 通常ログへPrompt全文、画像、API keyが出ない

## 12. 外部依存と保留事項

Phase 1基盤とAsset Libraryは外部準備なしで実装できます。次は外部条件が必要です。

- 外部背景APIのProvider選定
- 成人向けProjectで送信可能な背景Promptの分離仕様
- Providerのデータ保持・学習利用・削除方針
- API料金・通貨・上限単位
- API key発行・失効・ローテーション手順
- VRAM 8GB / 12GB / 16GB実機
- LAN Render Node用の証明書・pairing設計

外部条件が未確定でも、Provider interface、無効状態、mock、確認UI契約までは実装可能です。

## 13. 今回変更しない範囲

- 既存Project形式の削除・置換
- 既存ComfyUI workflowの削除
- 既存Canvas、Undo / Redo、書き出し経路の置換
- Hub / Supabase / StripeへのDesktop秘密情報追加
- 外部Providerの直書き
- UIからの直接API通信
- 成人向け内容の自動外部送信
- Phase 1中のRender Node実装
