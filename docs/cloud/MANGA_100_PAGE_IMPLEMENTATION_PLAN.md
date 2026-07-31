# MANGAI Cloud 漫画制作・100ページ対応実装計画

作成日: 2026-07-31

## 1. 目的

MANGAI Cloudを、市場分析や画像生成を個別に提供するツールではなく、漫画を企画から完成原稿まで制作できるサービスへ発展させる。

最終目標は、利用者が技術的なAI設定を意識せず、約100ページの漫画を次の工程で完成できることとする。

1. アイデアまたは市場分析から作品を開始する
2. 企画、シナリオ、ネームを作成・採用する
3. キャラクター、場所、画風を作品全体で維持する
4. コマ画像を生成し、必要な部分だけ修正する
5. セリフ、吹き出し、効果、トーンを編集する
6. 原稿を検査する
7. PDFおよび連番画像へ書き出す

本計画では、最初から100ページを無人一括生成する機能は作らない。章・話・シーンへ分割し、4〜8ページ単位で制作し、1ページ・1コマ単位で確認、修正、再開できる設計を採用する。

## 2. 製品方針

### 2.1 優先順位

1. 一般向け漫画を完成原稿まで制作できること
2. 8ページ作品で制作フローと出力品質を確立すること
3. 32ページ読切へ拡張すること
4. 100ページ長編へ拡張すること
5. 成人向けCloudは許可制機能として一般向けと区分し、Provider契約・安全対策・運用準備が完了した範囲だけ有効化すること
6. 成人向けDesktopを、ローカル生成・ローカル保存を優先する最終的な本命制作環境として完成させること

Stripe、Marketplace、追加の販売機能は、漫画原稿の完成品質に直接必要な対応より後へ置く。

### 2.2 入口を限定しない

市場分析は任意工程とし、利用者は次のいずれからでも制作を開始できるようにする。

- AIと売れ筋を検討する
- 自分のアイデアから作る
- 既存のシナリオを読み込む

### 2.3 AI設定を利用者へ露出しない

通常利用者にはProvider、モデル、Seed、技術的なPromptを原則表示しない。作品設定、採用済みシナリオ、ネーム、キャラクター設定からサーバー側で生成条件を構築する。

管理者だけがProvider、モデル、APIキー、上限、停止状態を管理する。

### 2.4 最終的な製品構成

| 製品 | 主な対象 | 生成方法 | 保存方針 | 役割 |
| --- | --- | --- | --- | --- |
| MANGAI Cloud | 一般向け漫画 | MANGAI管理の一般向けAPI | Supabase private storage | 最初に完成させるブラウザー制作環境 |
| MANGAI Cloud Adult Option | 許可された成人利用者 | 承認済み外部Provider | 成人向け専用境界・非公開 | 低スペック利用者向けの限定オプション |
| MANGAI Desktop Adult | 成人向け漫画 | Ollama／ComfyUIを優先、外部Providerは任意 | 作品・Prompt・参照画像を端末内保存 | 高機密・長編・高度修正を行う本命環境 |

Cloud Adult OptionはDesktop Adultを置き換えない。Desktopが利用できない利用者やローカル生成が困難なPC向けの補助経路とする。

認証、利用権限、契約状態、Provider承認情報はCloudと連携できるが、成人向け作品本文、Prompt、参照画像、生成画像、完成Pageは利用者の明示操作なしにCloudへ同期しない。

## 3. 現在地

### 3.1 再利用する実装

- 認証、ユーザー・管理者権限
- Cloud Project、Episode、Page、Canvas snapshot
- 市場分析、AI企画提案、シナリオ、ネームの生成・採用
- ネームからCloud Projectへのmaterialize
- コマ、吹き出し、縦横テキスト、素材、レイヤー、自動保存、Undo / Redo
- PNG、PDF、連番画像、販売パッケージ出力
- 永続AI Job、進捗、cancel、retry、費用・quota基盤
- 一般向け画像Provider基盤
- 許可制成人向け機能とDezgo／deAPI.ai adapter
- 管理画面のAPIキー保存・Provider停止

### 3.2 100ページ制作を妨げる主要不足

- 一般向け画像生成と成人向けProvider変更が単一の統合リリースへ揃っていない
- Cloud rendererが全Panel layerを最終原稿へ忠実に合成できない
- キャラクター・衣装・場所・小物・画風の作品全体管理が弱い
- 複数候補の比較、部分修正、inpainting、image-to-imageがない
- シナリオ変更後の下流成果物の無効化・差分更新がない
- 大量ページ向けの章・シーン管理、仮想化一覧、生成キュー操作がない
- 大規模PDF／ZIPの永続export Job、再開、分割生成がない
- 完成原稿preflightとEditor／exportの視覚的一致試験がない
- 成人向けCloudの正式な製品境界が旧文書と一致していない

## 4. 目標データ構造

既存の`cloud_projects`、`cloud_episodes`、`cloud_pages`、Canvas関連テーブルを置き換えず拡張する。

```text
作品 Cloud Project
├─ 作品設定 Work Bible
│  ├─ 画風 Style Bible
│  ├─ キャラクター Character Profiles
│  ├─ 衣装 Costume States
│  ├─ 場所 Location Profiles
│  ├─ 小物 Prop Profiles
│  ├─ 関係・口調・呼称
│  └─ 時系列・継続性ルール
├─ 章 Chapter
│  ├─ 話 Episode
│  │  ├─ シーン Scene
│  │  │  ├─ ページ Page
│  │  │  │  ├─ コマ Panel
│  │  │  │  │  ├─ レイヤー
│  │  │  │  │  ├─ 生成候補
│  │  │  │  │  ├─ 採用画像
│  │  │  │  │  └─ 修正履歴
│  │  │  │  └─ 原稿検査結果
└─ Export Job／完成版
```

追加候補:

- `cloud_work_bibles`
- `cloud_character_profiles`
- `cloud_character_states`
- `cloud_location_profiles`
- `cloud_prop_profiles`
- `cloud_chapters`
- `cloud_scenes`
- `cloud_continuity_facts`
- `cloud_panel_generation_candidates`
- `cloud_panel_generation_selections`
- `cloud_production_tasks`
- `cloud_page_locks`
- `cloud_export_jobs`
- `cloud_manuscript_preflight_results`

全テーブルで所有者確認、RLS、Soft delete、監査、冪等なmigration、rollbackを必須とする。

## 5. 目標アーキテクチャ

```text
制作UI
  ├─ 作品コックピット
  ├─ 設定資料
  ├─ シナリオ／ネーム
  ├─ Page／Panel Editor
  └─ 完成原稿検査
        ↓
Production Orchestrator
  ├─ Context Builder
  ├─ Continuity Checker
  ├─ Prompt Builder
  ├─ Provider Gateway
  ├─ Generation Queue
  ├─ Page Compositor
  └─ Export／Preflight Worker
        ↓
Supabase DB・Private Storage・Provider
```

### 5.1 Context Builder

100ページ全文を毎回AIへ送らず、対象シーンに必要な次の情報だけを組み立てる。

- 作品の画風
- 登場キャラクターと現在の衣装・状態
- 場所、小物、時刻
- 直前ページの出来事
- シーンの目的
- コマの構図、カメラ、表情、セリフ
- 禁止事項と内容区分

入力snapshotと参照した設定versionを生成Jobに保存し、後から再現できるようにする。

### 5.2 共通Page Compositor

Editor preview、PNG、PDF、ZIPで同一の描画契約を利用する。

- 全Panel layerの合成
- clipping、fit、offset、scale、rotation
- opacity、blend mode、mask、correction
- 吹き出し本体と尻尾
- 横書き、縦書き、ルビ、禁則、文字収まり
- 効果音、縁取り、トーン、集中線
- 画像decode失敗時の安全な代替表示

## 6. 実装フェーズ

## Phase M0: 統合基準線と方針確定

目安: 2〜3 iteration

目的: 分散した一般向け・成人向け・モニター向け変更を破壊せず棚卸しし、漫画制作の統合基準線を作る。

実装:

- 最新基準ブランチから漫画制作専用integration branchを作成
- 一般向け画像生成を先に統合
- 成人向けはFeature Flag既定停止で必要な契約だけ統合
- Cloud成人向け方針をADRと製品計画へ反映
- 古いFeature Flag名、readiness判定、operation typeを統一
- 漫画制作機能matrixとmigration manifestを更新
- 既存3ページfixtureを基準fixtureとして固定

完了条件:

- 一般向け制作フローが単一ブランチでbuild・test可能
- 本番既定値では成人向け機能が露出しない
- 一般／成人向けの許可条件が文書・コード・DBで一致する

## Phase M1: 8ページ完成原稿Vertical Slice

目安: 8〜12 iteration

目的: 一般向け8ページ作品を企画から完成PDFまで制作できるようにする。

実装:

1. 全レイヤー対応Page Compositor
2. Editor、preview、PNG、PDFの描画統一
3. 絵コンテからコマ画像生成条件を自動作成
4. 1コマにつき2〜4候補を生成・比較・採用
5. 採用画像を適切なPanel layerへ配置
6. ページ・コマ単位の生成状態と失敗再実行
7. 基本的なキャラクター設定表
8. 表紙、ページ順、空コマ、低解像度、文字overflowのpreflight
9. 8ページPDF／連番PNG出力

2026-07-31進捗:

- 完了: 1、2、3
- 完了: 4の複数候補受付・比較表示、5の候補採用配置、
  6の失敗候補だけの再実行
- 今回完了: 8の表紙、ページ順、空コマ、低解像度、文字overflowの
  preflightと、9の8ページfixtureによるPDF／連番PNG完走検証
- 継続: ページ全体の生成進捗と基本キャラクター設定表
- 候補生成は既存Queue・quota・moderation・private Storageを維持し、
  migrationなしで1コマ2〜4案を別Jobとして管理する
- 作品画面は8ページ基準、画像配置済みコマ数、要修正、確認推奨を表示し、
  問題のあるページへ直接移動できる

完了条件:

- 市場分析を省略しても作品を開始できる
- 8ページの全コマを生成・選択・再編集できる
- Editor、PNG、PDFの主要画素が一致する
- 失敗した1コマだけ再実行できる
- ブラウザー再読込後に制作を継続できる

## Phase M2: キャラクター・画風・世界観の一貫性

目安: 6〜10 iteration

目的: 同じキャラクターがページをまたいでも同一人物に見える確率を高める。

実装:

- Character Profile CRUD
- 正面・側面・全身・表情の参照画像
- 衣装、髪型、年齢、体格、配色、禁止変更項目
- Style Bible
- Location／Prop Profile
- シーンとコマへのcast・場所・小物割当
- Provider capabilityに応じた参照画像、Seed、style設定
- 生成結果のキャラクター・衣装・場所の継続性評価
- 採用済み画像からの参照更新は管理者／利用者の明示操作に限定

完了条件:

- 主要キャラクター2名を8ページで追跡できる
- 各コマが参照した設定versionを確認できる
- 衣装や場所の意図しない変更を警告できる

## Phase M3: 生成画像の修正ワークフロー

目安: 6〜10 iteration

目的: 全体を作り直さず、漫画として必要な修正を短時間で行えるようにする。

実装:

- 生成候補の履歴、比較、採用、差し戻し
- Image-to-Image
- マスク付きInpainting
- Outpainting
- 顔、手、表情、衣装、背景の修正preset
- ポーズ・構図制御
- 背景、人物、効果の分離生成
- correction layerとして非破壊保存
- Provider非対応機能の明確なfallback
- 修正前後の比較とUndo

完了条件:

- 顔・手・背景を別々に再生成できる
- 採用前画像へ戻せる
- 修正後もキャラクターProfileとの関係を維持する

## Phase M4: 32ページ読切対応

目安: 8〜12 iteration

目的: 章・シーン単位で32ページ読切を安定制作できるようにする。

実装:

- Chapter／Scene構造
- ページthumbnail、並べ替え、見開き表示
- 仮想スクロールと遅延読込
- 4〜8ページ単位のbatch生成
- queueの一時停止、再開、cancel、部分retry
- 制作状態: 未着手／生成中／要確認／要修正／確定
- 確定ページのlock
- シナリオ／ネーム変更時の影響範囲とstale表示
- 長時間export Job、進捗、再開、分割PDF結合
- Storage thumbnail、派生cache、未採用素材整理

完了条件:

- ブラウザーを閉じても生成・exportが継続する
- 失敗したページだけ再開できる
- 32ページを一度にDOM・メモリへ展開しない
- PDF生成がWeb request timeoutに依存しない

## Phase M5: 100ページ長編対応

目安: 10〜16 iteration

目的: 長編の連続性、進捗、コスト、保存容量を管理しながら100ページを完成できるようにする。

実装:

- 章・話・シーン・ページの作品コックピット
- 全体プロット、キャラクターarc、関係変化
- 伏線・回収、時系列、場所移動のContinuity Facts
- AIによるページ間連続性検査
- 口調・呼称・一人称の検査
- 前後ページ比較
- 未生成・要修正・確定ページ検索
- 作品単位の予想生成回数、費用、容量表示
- 月間／作品単位budgetとhard limit
- 増分バックアップと完成version固定
- 100ページpreflightと分割export
- 長編作品の復旧訓練

完了条件:

- 100ページを章・シーン単位で編集できる
- 任意の1ページ変更で全作品を再生成しない
- 途中停止後に未完了Jobだけ再開できる
- 低解像度、空コマ、文字切れ、ページ欠損を自動検出できる
- 完成版PDFと連番画像を生成できる

## Phase M6: 限定モニター・品質改善

目安: 5〜8 iteration

目的: 実利用者の作品制作で品質、コスト、操作性を測定する。

実装:

- 8ページ作品10件、32ページ作品3件、100ページ作品1件の段階試験
- Provider別の同一fixture比較
- キャラクター一致率、構図遵守率、修正率の記録
- 手・顔の失敗率
- 1採用コマ当たりの生成回数、費用、時間
- 離脱箇所と操作時間
- 生成拒否・障害・再開の運用訓練
- モニターからのページ・コマ単位feedback

完了条件:

- 重大なデータ消失がない
- 作品を途中から再開できる
- 主要な生成失敗に利用者自身で対処できる
- 目標コストと品質基準を責任者が承認する

## Desktop Adult Track

一般向けCloudのPhase M1を優先しながら、共通packageの互換性を維持する。Desktop固有機能はCloudの画面やServer Actionを移植せず、Electron main process、SQLite、OS keyring、ローカルファイルを利用する。

### Phase D0: Cloud／Desktop共通制作契約

目安: 3〜5 iteration

実装:

- `project-core`へChapter、Scene、Work Bible、Character Profileの共通manifestを定義
- `canvas-core`へPage Compositorの描画契約を定義
- `export-core`へ8／32／100ページexport contractを定義
- Cloud DBとDesktop SQLiteのadapterを分離
- 一般／成人向け区分、制作surface、生成targetをmanifestへ保存
- Cloud一般作品のDesktop import／export互換試験
- 成人向けProjectを一般向けCloud Storageへ送信しない否定試験

完了条件:

- 同じfixtureをCloudとDesktopで開き、主要Canvas要素を同等に描画できる
- 保存先や実行先が異なってもProject manifestを共有できる
- 成人向けデータの意図しないCloud同期を自動テストで拒否できる

### Phase D1: Desktop Adult 8ページ制作

目安: 6〜10 iteration

実装:

- Character／Style／Location BibleのSQLite保存
- Ollamaによるシナリオ・ネーム補助
- ComfyUIによるローカル画像生成
- Panel layerへの生成結果配置
- 顔・手・背景のローカルInpainting
- Image-to-Image、ControlNet、pose／composition制御
- 生成Jobの永続化、停止、再開、失敗retry
- 8ページPDF／連番画像出力
- 成人向けPrompt、画像、参照素材の診断ログ非露出

完了条件:

- 外部通信を遮断したPCで8ページ作品を完成できる
- アプリを終了しても生成Jobと制作状態を復元できる
- 成人向け素材がCloudへ送信されない

### Phase D2: 低スペック・外部Providerオプション

目安: 5〜9 iteration。Provider利用条件と承認証跡が開始条件。

実装:

- Dezgo、deAPI.ai等を交換可能なadapterとして接続
- BYOK APIキーをOS keyringへ保存
- Provider／モデルallowlistと規約version管理
- 送信前preview、費用上限、保持・学習利用条件の表示
- ローカル優先／外部利用のProject設定
- 失敗時の二重課金防止
- 1枚単位の送信と明示確認
- Prompt以外の参照素材送信はProvider capabilityと明示許可が揃う場合だけ解禁

完了条件:

- 外部送信なしでも制作を継続できる
- 利用者の明示承認なしに外部Providerへ送信されない
- Provider停止・承認失効時に待機Jobを安全に停止できる

### Phase D3: Desktop Adult 32〜100ページ対応

目安: 10〜16 iteration

実装:

- Chapter／Scene／Pageの大量作品UI
- ローカル生成Queueの優先順位、一時停止、再開
- 低VRAM preset、tiled VAE、CPU offload
- thumbnailと派生cache
- 増分backup、Project修復、世代管理
- 連続性検査と参照設定の局所抽出
- 32／100ページの分割exportと結合
- ディスク容量、生成時間、推定費用の事前確認
- 8GB／12GB／16GB以上のWindows実機profile

完了条件:

- 100ページ作品を端末内で章・シーン単位に編集できる
- 中断後に未完了のローカルJobだけ再開できる
- 低スペックpresetでアプリ全体がクラッシュしない
- backupから作品、素材、採用履歴を復旧できる

### Phase D4: Desktop製品公開

目安: 5〜8 iteration

実装:

- Windowsコード署名
- installer、uninstaller、自動更新
- Project暗号化と画面privacy機能の評価・実装
- 成人向け利用規約、年齢確認、利用許可
- SBOM、checksum、依存脆弱性確認
- クリーンWindows、更新、backup復旧E2E
- Ollama、ComfyUI、対象外部Providerの実機受入れ

完了条件:

- 署名済みWindows製品を新規PCへ導入できる
- 更新前後で100ページ作品を保持できる
- ローカル限定Projectが外部通信なしで制作・出力できる
- 外部Providerは承認済み条件だけで利用できる

## 7. 優先バックログ

| 優先 | Epic | 完了条件 |
| --- | --- | --- |
| P0 | 統合基準線 | 一般向け制作が単一ブランチで完走 |
| P0 | 共通Page Compositor | EditorとPNG／PDFが一致 |
| P0 | 8ページVertical Slice | 企画から完成原稿まで完走 |
| P0 | Character／Style Bible | 主要人物と画風を再利用可能 |
| P0 | 候補比較・部分retry | 失敗した1コマだけやり直し可能 |
| P0 | 原稿preflight | 空コマ・低解像度・文字切れを検出 |
| P1 | Inpainting／Image-to-Image | 顔・手・背景を部分修正可能 |
| P1 | Chapter／Scene | 32ページを構造化管理 |
| P1 | Batch Queue | 4〜8ページ単位で停止・再開可能 |
| P1 | 永続Export Job | 32〜100ページをtimeoutなしで出力 |
| P1 | Continuity Checker | 衣装・場所・時系列の不整合を警告 |
| P1 | Cloud／Desktop共通manifest | 同じ作品構造を両製品で扱える |
| P1 | Desktop Adult 8ページ | offlineで生成・修正・出力を完走 |
| P2 | 共同レビュー | ページ・コマ単位のコメント |
| P2 | Marketplace再統合 | 完成原稿品質確立後に再開 |
| 条件付き | 成人向けCloud／外部Provider | 契約・安全・費用・実E2E合格後のみ |

## 8. 品質指標

「APIから画像が返った」ことを完成条件にしない。以下を継続計測する。

- キャラクター一致率
- 衣装・場所の継続性
- ネーム構図の遵守率
- 1コマの初回採用率
- 1採用コマ当たりの生成回数
- 顔・手・文字の修正率
- Job失敗率・再開成功率
- 1ページ当たり生成費用
- Editor／PNG／PDFの視覚差分
- 8／32／100ページexport時間
- 作品再開成功率
- データ消失件数

目標値はPhase M1の実測を基準に設定し、Providerやモデルの広告値を使用しない。

## 9. テスト戦略

### 9.1 自動テスト

- schema、RLS、所有者分離、別ユーザー拒否
- migration forward、rollback、reapply、canonical schema
- Context Builderの設定version固定
- Provider mock、429、5xx、timeout、cancel、retry、idempotency
- 全レイヤー合成のpixel fixture
- Editor／PNG／PDFのvisual regression
- 文字overflow、低解像度、空コマpreflight
- 8／32／100ページfixtureのメモリ・処理時間検査
- Prompt、API key、成人向け入力のログ非露出

### 9.2 実サービスE2E

- 一般向けProviderで同一20コマを生成
- 画像品質、費用、時間、再生成率を記録
- 8ページ作品を最初からPDFまで完走
- Phase M4で32ページを完走
- Phase M5で100ページを完走
- 成人向けは許可された限定環境だけで別試験する

## 10. Release Gate

### 8ページ版

- 全工程を実ユーザーで完走
- Editor／exportの重大な差異なし
- キャラクターProfile利用可能
- 部分retry可能
- 原稿preflight合格

### 32ページ版

- batch生成の停止・再開
- 長時間export Job
- ページ一覧が大量DOMを生成しない
- シナリオ変更の影響ページを識別可能

### 100ページ版

- 章・シーン単位で制作可能
- 連続性検査が利用可能
- 1ページ変更で全体再生成不要
- 100ページPDF／連番画像出力成功
- バックアップから復旧成功
- 実測コストを責任者が承認

### Desktop Adult版

- offlineで8ページ作品を完成できる
- 32〜100ページの制作状態を端末内で復元できる
- Ollama／ComfyUIを既定経路として利用できる
- 成人向け作品・Prompt・参照画像を一般向けCloudへ送信しない
- 外部ProviderはBYOK、明示確認、承認済みモデル、費用上限を満たす
- Windows署名、更新、backup復旧、低スペック実機受入れに合格する

## 11. 最初の実装単位

次の順番で着手する。

1. 漫画制作integration branchと機能matrix作成
2. Cloud Page Compositorの現状fixtureを追加
3. 複数Panel layer、吹き出し尻尾、縦書きを含むgolden pageを作成
4. Editor previewとPNG／PDFを同じcompositorへ接続
5. Character Profile最小DB・RLS・管理画面
6. ネームPanelへcharacter／locationを割り当てる
7. 絵コンテから一般向け画像生成Jobを作る
8. 画像候補比較・採用・Panel layer配置
9. 8ページ原稿preflight
10. 実Providerを使った8ページE2E

Cloud Phase M1と並行して、共通manifestとPage CompositorのDesktop互換fixtureを維持する。Desktop固有UIの新規実装は、一般向けCloudの8ページVertical Sliceが安定した後にPhase D1として開始する。

## 12. 今回行わないこと

- 100ページの無人一括生成
- AI結果の無確認自動公開
- 初期段階での複数Provider自動最適化
- 漫画制作品質より先にStripe／Marketplaceを拡張すること
- Provider契約と安全対策が未確認の成人向け本番有効化
- 既存Project／Episode／Pageを別データモデルで作り直すこと

## 13. 計画全体の完了判定

MANGAIの100ページ漫画対応は、次のすべてを満たした時点で完了とする。

- 利用者がAIの技術設定を意識せず制作できる
- 同じ人物・衣装・場所を長編で管理できる
- 生成結果を1コマ・一部分単位で修正できる
- 100ページを途中保存、再開、差分更新できる
- Editorと完成原稿の表示が一致する
- 原稿不備を公開前に検出できる
- PDFと連番画像をtimeoutなしで出力できる
- 費用、容量、失敗、再実行を運用管理できる
- 一般向けと成人向けの権限・Provider・保存境界が明確である
- 成人向け作品をDesktopでoffline制作・修正・100ページ出力できる
