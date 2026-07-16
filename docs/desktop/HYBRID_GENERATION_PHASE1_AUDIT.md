# ハイブリッド生成 Phase 1 現状調査

確認日: 2026-07-16

対象ブランチ: `feature/manga-canvas-mvp`

実装基準コミット: `3e1b267`

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

| Provider | 用途         | 既定接続先               | 状態           |
| -------- | ------------ | ------------------------ | -------------- |
| Ollama   | Creator Chat | `http://127.0.0.1:11434` | 既定OFF        |
| ComfyUI  | 画像生成     | `http://127.0.0.1:8188`  | 既定OFF        |
| Mock     | 開発テスト   | loopback                 | 製品版では拒否 |

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

Electron起動時のRAM・GPU・専用VRAM診断、`cpu_only`から`vram_24gb_plus`までのRuntime Profile自動選択、端末設定への手動上書き保存、同時ローカル画像生成1件の排他制御を実装しました。ControlNet・LoRA上限、タイルVAE適合監査、Ollamaモデル解放まで接続済みです。CPU offloadはComfyUI起動環境の実機確認が残ります。

Phase 3で必要:

- GPU / VRAM / RAM検出（完了）
- `cpu_only`から`vram_24gb_plus`までのprofile（完了）
- profile別workflow parameter制約
- 同時ローカル画像生成数1の排他制御（完了。待機Queue化は未完了）
- OllamaとComfyUIの排他制御
- pause / resume / priority付き永続Queue
- 再起動後のqueued / paused復元

Phase 3のコード基盤は、profile別workflow制約、Ollamaとの排他、モデルunload、永続Queue、夜間実行、Page一括投入、タイルVAE適合監査まで完了しました。残る完了条件はCPU offload起動設定を含む8GB実機E2Eです。

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

### Commit 2: 作品ポリシー永続化（完了: `994cd20`）

- migration前バックアップ
- Project別policy table
- main processの読み書きAPI
- DB再オープン・バックアップ回帰テスト
- UIはまだ追加せず、main processの限定APIまで提供

`project_generation_policies`を追加し、全Projectへ`safe_assets_only`、ローカル優先、外部送信前確認を既定設定しました。policy、ローカル優先、確認要否、月間費用上限、customでcloud利用を許可するJob TypeをZod検証して保存します。限定IPCを追加し、rendererから外部Providerへ直接接続しない境界を維持しています。

既存DBはmigration前に自動バックアップし、既存Projectへ安全な既定値を追加します。設定は再起動、Project複製、自動・手動バックアップ、復元で維持します。generation policyを含まない旧version 1 / 2バックアップは安全な既定値で復元します。

### Commit 3: shadow routing（完了: `ca8e8a8`）

- 既存画像生成RequestをJob Draftへ変換
- Route Decisionを保存
- 実行は従来ComfyUIを維持
- 成人向け・不明入力がcloud決定にならないテスト

`generation_route_decisions`を追加し、既存画像生成ジョブごとにJob Draft、作品ポリシーを反映したRouting Context、Route Decision、PromptのSHA-256を記録します。Prompt本文、Negative Prompt、画像はroute判定履歴へ保存しません。履歴は限定IPCで読み出せ、バックアップ・復元時にProject、Page、Panel、Asset、Job参照を新IDへ変換します。

現行画像生成UIはJob TypeやSensitivityをまだ入力しないため、shadow modeでは`adult_character_render / external_forbidden / personPresence=unknown`として安全側へ分類します。実際のComfyUI実行経路は変更せず、判定と現行実行先の差を記録できる段階です。`preferLocal`もRouterへ反映し、Asset Libraryが見つからないsafe Jobでもローカル優先設定ならcloudよりlocalを選びます。

### Commit 4: ローカルComfyUI切替（完了: `91b5598`）

- Routerが`local`を選び、ComfyUI URLがloopbackの場合だけ既存Providerを実行
- remote ComfyUIは接続前に`ROUTE_BLOCKED`で拒否
- route判定の保存に失敗した場合も外部送信しない
- 生成履歴へtarget、sensitivity、reason、blocked状態を日英表示
- localhost成功とremote拒否の統合テストを追加

現行の汎用画像生成UIは分類入力が未実装のため、引き続き`adult_character_render / external_forbidden / personPresence=unknown`として扱います。このため、利用者がHTTPSのremote ComfyUIを設定しても、Prompt、Negative Prompt、画像、workflowを送信する前に拒否します。loopbackのlocalhost、127.0.0.0/8、IPv6 loopbackだけが既存ComfyUI経路へ進みます。

### Commit 5: Asset Library（完了: `d99edcc`）

- 既存Project素材へ背景・小物・効果・人物・その他の分類を追加
- ファイル名とタグの横断検索、分類・形式・お気に入りfilter
- Page・Panel・表紙の現在使用数を素材カードへ表示
- 既存のドラッグ配置を利用したCanvasへの再利用
- 分類・タグ・お気に入りを再起動、Undo、Project複製、バックアップ・復元で保持
- 外部通信なし

`asset-library-v1` migrationで既存Assetへ追加カラムだけを加えます。旧Projectはすべて未分類から始まり、旧バックアップは未分類・タグなし・お気に入りなしで復元します。Rendererは限定IPCだけを使用し、ファイル検索やSQLiteへ直接アクセスしません。

### Commit 6: safe素材JobとLibrary route（完了: `7f8c019`）

- 背景・小物・効果専用のsafe Job入力schema
- Project内Libraryに一致がある場合だけ`asset_library`を候補へ追加
- 一致素材をお気に入り優先で最大20件提示
- 候補選択から編集画面の素材選択状態へ復帰
- 一致なしはローカルComfyUIへfallbackし、remoteだけの場合はblocked
- 外部Providerを候補に加えず、検索・判定・候補表示を端末内で完結

safe Jobも通常のgeneration jobとroute監査履歴へ保存します。Job Draftは`sensitivity=safe / personPresence=none`を明示します。Asset Libraryに一致しない場合も自動的な外部送信は行いません。

### Commit 7: safe Jobのローカル生成handoff（完了: `a53340d`）

- Library不一致かつlocal fallbackの場合だけComfyUIフォームへ引き継ぎ
- safe Job Typeと検索語由来タグを画像生成Requestへ保持
- 通常の汎用画像生成とsafe素材生成のJob Draftを分離
- loopback ComfyUIで生成した新規素材をLibraryへ自動分類
- 重複排除で既存素材が選ばれた場合は既存分類を上書きしない
- remote ComfyUIへのsafe Requestも送信前にblocked

handoff中は対象分類を画面へ明示し、利用者は通常生成へ戻せます。画像生成Requestはmain processでも再検証し、種類とタグの不正値を拒否します。生成元metadataにもJob TypeとLibraryタグを残します。

外部背景APIはProvider事業者、利用規約、保存期間、料金、API credential運用が確定した後に実通信を有効化します。

### Commit 8: 外部safe素材Provider送信プレビュー（完了: `c3c5d71`）

- Provider capability、費用見積もり、送信manifest、確認内容の型とschema
- Provider未設定・無効・非対応・ポリシー拒否・費用不明をfail-closedで判定
- Prompt本文を返さずSHA-256だけを保持するプレビューAPI
- Prompt以外の入力素材、キャラクター参照、完成Pageを送信対象外として明示
- Library不一致時に送信予定内容、保持・学習利用条件、費用状態を日英表示
- 実Providerとendpointを未設定のまま維持し、外部通信・送信操作を実装しない

確認契約はpayload、費用、Provider条件の3項目すべての明示確認を要求します。現時点のDesktopは常に`provider_not_configured`で実行不可となり、プレビュー生成によってgeneration jobやroute履歴も増えません。

### Commit 9: Panelレイヤー永続基盤（完了: `c9b18b2`）

- `panel_layers`追加migrationとmigration前バックアップ
- 背景・人物・小物・効果・tone・mask・correction・従来統合画像の8分類
- 素材、source generation job、順序、表示・lock、opacity、blend mode、画像変形の保持
- 既存`panels.image_asset_id`を維持し、`flattened_legacy`へ自動移行
- Zod検証済み限定IPCとProject外素材・生成Jobの参照拒否
- Undo / Redo、再起動、Project複製、手動・自動バックアップ、旧バックアップ復元で保持

この永続基盤だけの時点ではCanvasとPDF・画像ZIPが`panels.image_asset_id`を描画していました。Commit 10で分離レイヤーの表示・基本操作とローカル合成を接続しました。

### Commit 10: PanelレイヤーCanvas編集・ローカル合成（完了: `15a0c09`）

- 選択コマ内の背景・人物・小物・効果・tone・mask・correctionレイヤー一覧
- 選択素材の追加・差し替え、表示、lock、opacity、blend mode、前後移動、削除
- レイヤーごとのfit・offset・scale・rotationを使ったCanvas描画
- コマ形状でclipした複数素材のローカル合成
- CanvasとPDF・連番PNG ZIPで同じ順序・表示・opacity・blend mode・画像変形を使用
- 分離レイヤーが存在するコマでは従来統合画像を描画せず、全レイヤー非表示も空の合成結果として維持
- 従来統合画像だけのProjectは既存描画経路を維持
- 書き出し画像の画素検証を含むDesktop統合テスト

現在は合成結果を描画時・書き出し時にローカル生成します。`panels.image_asset_id`互換cacheの更新は次工程です。

### Commit 11: Panelレイヤー直接変形（完了: `26b4cf3`）

- Inspectorから対象レイヤーを選び、Canvas専用編集モードを開始・終了
- Canvas上のドラッグ移動、四隅の等比拡縮、回転handle
- fit、倍率、横・縦offset、回転の数値編集
- 中央位置・倍率・回転のリセット
- 非表示・lock・別レイヤー選択時の編集モード安全終了
- 変形結果を既存Panel Layer IPCへ保存し、Undo / Redoと書き出しへ反映
- 従来統合画像の直接編集モードを維持

CanvasとPage rendererは同じfit・offset・scale・rotation値を使用します。Commit 12でmaskとcorrection透明パッチの合成規則を追加しました。

### Commit 12: mask合成・correction透明パッチ（完了: `c6bfd78`）

- mask画像のalphaを、それより下にある合成済みレイヤーへ適用
- maskより後ろに並ぶレイヤーへは影響させない逐次合成
- correction画像を透明部分を維持する修正パッチとして後段合成
- CanvasのPorter-Duff合成をPanel単位のオフスクリーンcacheへ隔離
- 低スペック端末を考慮し、Canvas cacheのpixel ratioを1に制限
- mask編集中は元画像をプレビューし、終了後にalpha maskへ復帰
- PDF・連番PNG ZIPのSVG alpha mask合成
- mask前の赤レイヤーとmask後の青correctionを画素検証

maskのblend modeは使用せず、alphaとopacityだけを適用します。correctionはalpha付き画像パッチとしてopacityとblend modeを利用できます。色調補正パラメータ型は未導入です。

### Commit 13: `panels.image_asset_id`互換cache（完了: `5ddcc3b`）

- 分離レイヤーのローカル合成結果をPanel寸法の内部PNGとして生成
- `panels.image_asset_id`を内部PNGへ更新し、画像変形値をcache表示用に正規化
- レイヤー保存、Panel寸法・形状変更、Canvas一括更新、Project再オープン、Undo / Redo後の同期
- Panel寸法・形状・レイヤー設定・参照素材SHA-256からcache signatureを計算
- signature一致時は画像生成、ファイル読込、DB更新を省略
- 対象Panelが実際に参照する表示中素材だけをメモリへ読込
- cacheを内部タグ付きAssetとしてバックアップ・複製可能にし、素材一覧・件数・一括Page化から除外
- 内部cacheのメタデータ編集・手動削除をmain processで拒否
- 分離レイヤー削除時は元の`flattened_legacy`参照へ復帰

互換cacheは派生データであり、CanvasとPDF・画像ZIPの正式な描画元は引き続き`panel_layers`です。従来統合画像は分離後も上書きせず、段階移行とUndo / Redoの復帰先として保持します。

### Commit 14: 低スペックRuntime Profile基盤（完了: `15b17c1`）

- 起動時にOS RAMとElectron GPU情報からGPU名・専用VRAMを診断
- GPU未検出は`cpu_only`、VRAM不明GPUは最小profileへ倒すfail-closed判定
- 指示書どおり`cpu_only`、6GB、8GB、12GB、16GB、24GB以上、Render Nodeのprofile型を追加
- 推奨profileの自動適用と、設定画面からの端末別手動上書き・再起動復元
- 設定画面へRAM、GPU、VRAM、推奨・実効profile、CPUのみ警告を表示
- 全ローカルprofileでbatch 1・同時画像生成1件を共通制約化
- Mainプロセスで2件目を`LOCAL_JOB_BUSY`として拒否し、失敗Jobへ記録
- GPU診断失敗時もDesktopを起動し、編集・素材・背景API経路を維持

高解像度上限、batch、ControlNet、LoRAのprofile別制約はCommit 15でComfyUI送信経路へ接続しました。VAEタイル、CPUオフロード、モデル解放は専用workflow・ComfyUI起動設定が必要なため未接続です。

### Commit 15: Runtime Profile別workflow制約（完了: `2b6cc20`）

- profile別の最大出力辺、ControlNet数、LoRA数を共通制約として定義
- 最大辺を超える生成指定を縦横比を保った8px単位で自動縮小
- ComfyUI API workflow内の`batch_size`を送信直前に1へ固定
- ControlNet Loader / ApplyとLoRA Loaderを数え、profile上限超過を送信前に`WORKFLOW_PROFILE_LIMIT`で拒否
- 元の登録workflow JSONは変更せず、リクエスト用cloneだけを調整
- Generation Jobへprofile、要求・実効解像度、調整有無を記録
- 自動縮小時は生成画面へ実効解像度を日本語・英語で表示
- 1600×1200要求が8GB profileで1024×768、batch 4が1になる統合テスト

VAE Decodeのタイル版への置換やText EncoderのCPUオフロードはworkflow構造・導入済みcustom node・ComfyUI起動引数に依存します。既存workflowを推測で書き換えず、タイルVAEノードの適合監査をCommit 21で導入しました。次は実モデル用workflowと起動設定を8GB端末で検証します。

### Commit 16: Ollama・ComfyUI GPU排他とモデル解放（完了: `10d66b7`）

- 12GB以下のprofileをGPU排他・画像生成前モデル解放対象として定義
- ローカル画像生成の直前にOllama `/api/generate`へ`keep_alive: 0`を送信
- 設定中モデルの解放成功後だけComfyUIへworkflowを送信
- Ollama未使用・remote設定・モデル未選択の場合は解放要求を省略
- 画像生成中のCreator ChatとChat中の画像生成を`LOCAL_RESOURCE_BUSY`で拒否
- 同一低VRAM端末で複数Creator Chatを同時開始する操作も拒否
- 16GB以上では指示書どおり限定的同時利用を許可
- モデル解放結果を画像生成結果へ記録
- HTTP mockでモデル解放がComfyUI送信前に行われること、画像生成中のChatがOllamaへ送信されないことを検証

排他はMainプロセスの全AI入口へ配置し、renderer側のbusy表示だけには依存しません。次は拒否された処理を待機へ回せる永続Queue、停止・再開、再起動復元です。

### Commit 17: ローカル画像生成の永続Queue（完了: `567634c`）

- `generation_jobs`へ後方互換な`priority`列とQueue検索indexを追加
- `paused`状態をai-core、SQLite、IPC、rendererへ追加
- 画像生成中の追加Requestを失敗させず`queued`として永続保存
- priority降順・作成日時順で1件ずつ自動実行
- 実行中・待機中Jobの一時停止、停止、再開、キャンセル
- 待機・一時停止中Jobの優先順位を上下操作
- 実行中の一時停止時にComfyUIへinterruptを送信
- 起動時に中断された画像Jobを`RECOVERED_AFTER_RESTART`付きで待機列へ復元
- 中断されたCreator Chatは再送せず、従来どおり`INTERRUPTED`で失敗確定
- アプリ起動時とGPUリソース解放時にQueue処理を自動再開
- 待機Jobのバックグラウンド完了を生成画面で監視し、Project Bundleと新規素材を自動反映
- 既存の同期的な生成成功レスポンスを維持し、待機へ入った場合だけ即座に`queued`を返す
- Queue待機・一時停止・優先度・順次実行・再オープン復元の統合テスト

生成Promptとworkflow入力は従来どおりローカルSQLite内だけに保存します。夜間開始時刻、Page単位の一括投入、最大試行回数付き自動再試行まで実装済みです。

### Commit 18: 一時障害の永続自動再試行（完了: `eff2440`）

- `generation_jobs`へ`attempt_count`、`max_attempts`、`next_attempt_at`を後方互換追加
- 接続失敗、通信タイムアウト、モデル解放失敗など`retryable`エラーだけを自動再試行
- workflow不正、profile上限、route拒否、Provider設定不備は即時失敗
- 最大3回の試行上限と1秒開始・最大30秒の指数バックオフ
- 次回試行時刻まで別の実行可能Jobを優先
- 遅延中のJobだけが残る場合はMainプロセスのtimerで再開
- 次回時刻と試行回数をSQLiteへ保存し、アプリ再起動後も継続
- 一時停止後の手動再開では遅延を解除して即時実行
- 生成画面へ試行回数、最大回数、次回再試行時刻を日英表示
- HTTP接続切断後に同一Job IDで再試行し、2回目で完了する統合テスト

再試行のたびに新しいJobを増やさず、1件の監査履歴へ試行回数を集約します。手動の「再実行」は従来どおり新しいJobとして開始します。

### Commit 19: 夜間Queue実行時間帯（完了: `12e7c85`）

- 端末共通の夜間Queue有効・開始時刻・終了時刻をSQLiteへ保存
- 22:00〜07:00の日跨ぎと09:00〜17:00の同日時間帯に対応
- 時間外の画像生成はProviderへ送信せず、試行回数0の`queued`として保存
- 開始時刻にMainプロセスtimerで自動起動
- 終了時刻を過ぎた実行中Jobは強制中断せず、現在の1件だけ完了
- 設定変更時にtimerを再計算し、夜間Mode解除時はQueueを即時再開
- 夜間設定と待機Jobをアプリ再起動後も復元
- 生成画面で有効化、開始・終了時刻の編集・保存
- 日跨ぎ判定、開始までの時間計算、時間外Provider未送信、設定再オープンのテスト

夜間Modeは既定無効です。利用者が明示的に有効化した端末だけで適用し、既存の単発生成挙動は変更しません。

### Commit 20: Episode内Pageの一括Queue投入（完了: `f9caa08`）

- 選択中EpisodeのPageを`order_index`順で画像生成Queueへ一括登録
- 各PageのPrompt、Negative Prompt、幅、高さを既存ComfyUI Jobへ引き継ぎ
- 空PromptのPageは安全にスキップし、対象件数とスキップ件数を日英表示
- Project・Episode境界外のPage IDと重複Page IDをMainプロセスで拒否
- `queue_order`を後方互換追加し、同一priority内の一括JobをPage順で実行
- 既存の夜間時間帯、最大3回再試行、一時停止・再開、priority、再起動復元をそのまま適用
- Page順、空Promptスキップ、重複拒否、永続Queue順序の統合テスト

一括登録は生成画面でworkflowを選択して実行します。夜間Modeの時間外ではProviderへ通信せず全件を待機させます。

### Commit 21: 低スペックComfyUI workflow適合監査（完了: `5257178`）

- 登録済みAPI workflowの`class_type`を安全に解析
- 標準`VAEDecode`、`VAEDecodeTiled`、`VAEEncodeTiled`を識別
- `VAEDecodeTiled`を8GB向けVAEタイル適合条件として検証結果へ追加
- CPUオフロードはworkflow JSONから推測せず、ComfyUI起動環境での確認必須として分離
- 生成画面へ選択workflowのタイルVAE適合状態とCPUオフロード確認案内を日英表示
- AI一括診断へ既定workflowの低スペック適合項目を追加
- 既存workflowを自動書き換えず、従来生成経路を維持

標準ComfyUIでは`--cpu-vae`、Dynamic VRAM、`--lowvram`等は起動環境の設定です。MANGAIはJSONから有効状態を断定しません。実機完了条件は、利用者環境のモデルを含むタイルVAE workflowとComfyUI起動設定を組み合わせた8GB端末E2Eです。

### Commit 22: ComfyUI低スペック実行環境診断（完了: `3e1b267`）

- ComfyUI公式`/system_stats`からversion、GPU、VRAM、起動引数を取得
- 取得した起動引数はrendererへそのまま渡さず、`--cpu-vae`、VRAM mode、`--reserve-vram`だけを構造化
- `/object_info/VAEDecodeTiled`で接続先ComfyUIのタイルVAEノード可用性を確認
- GPU、タイルVAE、CPU VAE起動設定をAI一括診断へ表示
- Provider無効・未起動・HTTP失敗を既存の接続制限とtimeoutで安全に通知
- HTTP mockで8GB GPU、タイルVAE、`--cpu-vae`、`--lowvram`、予約VRAMの解析を検証

2026-07-16時点で開発PC上に起動中ComfyUIと一般的な配置フォルダーは検出できなかったため、実画像生成E2Eは未実施です。ComfyUI起動後は設定画面のAI一括診断から前提条件を確認できます。

## 11. テスト基準

2026-07-16の確認時点:

- Desktop統合テスト: 58/58成功
- ai-core Router・外部送信契約・Runtime Profile単体テスト: 23/23成功
- canvas-core単体テスト: 25/25成功

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

Provider interface、無効状態、送信内容プレビュー、明示確認契約までは実装済みです。実Provider adapter、credential保存、費用見積もり、送信実行は外部条件が確定するまで有効化しません。

## 13. 今回変更しない範囲

- 既存Project形式の削除・置換
- 既存ComfyUI workflowの削除
- 既存Canvas、Undo / Redo、書き出し経路の置換
- Hub / Supabase / StripeへのDesktop秘密情報追加
- 外部Providerの直書き
- UIからの直接API通信
- 成人向け内容の自動外部送信
- Phase 1中のRender Node実装
