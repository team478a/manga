# MANGAI Current Task

## 2026-07-31 一般向け漫画生成の最新Cloud基盤への統合

- 状態: `READY_FOR_REVIEW`
- Branch: `agent/manga-generation-integration-v1`
- Base: `feature/manga-canvas-mvp` (`ae1279e`)
- 対象: PR #87〜#90の一般向け漫画生成に必要な機能commit
- 完了: FLUXコマ生成、候補比較・採用・再実行、共通レイヤー合成、
  8ページ原稿検査、作品進捗、キャラクター設定、画風・場所・小物設定
- 検証: deps、lint、Hub/Desktop typecheck、Hub 312/312、Canvas 26/26、
  AI 44/44、Desktop 182/182、migration 32/32、production build成功
- 統合記録: `docs/cloud/MANGA_GENERATION_INTEGRATION_REPORT.md`
- 未完了: GitHub CI、Vercel Preview、staging migration、実Provider有料生成、
  8ページ実ブラウザ目視、責任者承認、マージ
- 次: 新しいDraft PRの全CI確認後、一般向けモニター用の実機受入れへ進む

## 2026-07-31 長編マンガ制作 M2-2: 画風・場所・小物設定

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `codex/manga-world-bible-v1`
- Base: `codex/manga-character-profiles-v1`（Draft PR #89）
- 実装:
  - 作品単位のStyle Bibleとversion snapshot
  - 場所・小物Profileの作成・更新・削除とversion snapshot
  - 画風、線、陰影、背景密度、構図ルール、固定特徴、配色、禁止変更
  - 画風を全コマ、名前が一致する場所・小物を対象コマへ自動適用
  - 生成Job入力へ利用したBible/Profile IDとversionを保存
  - 所有者RLS、所有者確認RPC、migration未適用時の安全な案内
- 変更しない範囲: 成人向け、Desktop、Provider、Worker、Stripe、Marketplace
- 検証: deps、lint、Hub/Desktop typecheck、Hub 311/311、migration 32/32、local roundtrip、production build、diff check成功
- 次: 参照画像、コマへの明示割当、継続性評価・警告
- 未実施: staging migration、実Provider生成、実ブラウザ確認、責任者承認、マージ

## 2026-07-31 長編マンガ制作 M2-1: 編集可能なキャラクター設定

- 状態: `IMPLEMENTED_AWAITING_REVIEW`
- Branch: `codex/manga-character-profiles-v1`
- Base: `codex/manga-production-m0-v1`（Draft PR #88）
- 実装:
  - 一般向けCloud作品ごとのCharacter Profile作成・更新・削除
  - 年齢、体格、髪、衣装、配色、固定特徴、追加・除外条件
  - 更新ごとの不変version snapshotと所有者RLS
  - 保存・削除中表示、空状態、migration未適用時の安全な案内
  - ネーム上の人物名と照合し、最新設定を画像生成条件へ自動反映
  - 生成Job入力へProfile IDとversionを保存
- 変更しない範囲: 成人向け、Desktop、Provider、Worker、Stripe、Marketplace
- 次: 参照画像、Style Bible、Location／Prop Profile、継続性警告
- 未実施: staging migration、実Provider生成、実ブラウザ確認、責任者承認、マージ

## 2026-07-31 長編マンガ制作 M1: キャラクター設定・作品全体進捗

- 状態: `IMPLEMENTED`
- Branch: `codex/manga-production-m0-v1`
- Draft PR: [#88](https://github.com/team478a/manga/pull/88)
- 実装:
  - 採用シナリオから人物名、役割、望み、恐れ、葛藤、変化を読み取り、
    作品画面へ基本キャラクター設定表として表示
  - キャラクター情報を複製DBへ保存せず、既存のシナリオ→ネーム→作品参照を利用
  - 対象コマの人物設定を画像生成Promptへサーバー側で自動追加
  - ページごとの画像配置数、待機中、処理中、失敗Jobを作品画面へ集約
  - 最新のコマ別Jobだけを採用し、古い失敗Jobを現在状態へ混入させない
  - 完成、生成中、要確認、未着手を日本語表示し、対象ページへ直接移動
- セキュリティ: 所有者RLS下の既存データだけを利用。service-role、秘密値、
  Provider内部エラー、技術Promptは利用者画面へ表示しない
- 変更しない範囲: DB、migration、Provider、Worker、成人向け、Desktop、販売処理
- 検証: deps、lint、Hub/Desktop typecheck、集中テスト16/16、
  Hub 302/302、production build、diff check成功
- 次: 実ブラウザで8ページ作品の設定表・進捗・Editor→PDFを責任者確認し、
  M1受入れ完了後にM2の編集可能な外見・衣装・場所・画風Profileへ進む
- 未実施: 実ブラウザ確認、実Provider有料生成、責任者承認、マージ

## 2026-07-31 長編マンガ制作 M1: 8ページ原稿チェック・書き出し検証

- 状態: `IMPLEMENTED`
- Branch: `codex/manga-production-m0-v1`
- Draft PR: [#88](https://github.com/team478a/manga/pull/88)
- 実装:
  - 作品画面で表紙、ページ順、空コマ、画像素材欠落を自動確認
  - 背景画像の仕上がり解像度不足を警告
  - 縦書き・横書き・ルビを含む文字layoutでoverflowを検出
  - 8ページ基準と画像配置済みコマ数を表示
  - 修正項目から対象ページの編集画面へ直接移動
  - 問題件数が多い作品は表示上限と残件数を保持
  - 8ページfixtureを実際に8ページPDFと`001.png`〜`008.png`へ出力
- セキュリティ: 所有者RLS下のCanvasとAssetメタデータだけを読み、
  Storage本体やservice-roleを原稿チェックに使用しない
- 変更しない範囲: 販売処理、DB、migration、Provider、Worker、成人向け、Desktop
- 検証: lint、Hub typecheck、原稿チェック5/5、8ページ出力3/3、
  Hub 295/295、production build、diff check成功
- 次: 実ブラウザでM1全体の画面・生成・書き出しを受入れ確認
- 未実施: 実ブラウザ確認、実作品でのPDF目視比較、責任者承認、マージ

## 2026-07-31 長編マンガ制作 M1: コマ候補の比較・採用・再実行

- 状態: `IMPLEMENTED`
- Branch: `codex/manga-production-m0-v1`
- 対象: 一般向けCloud Canvasのネーム連動コマ画像生成
- 実装:
  - 1コマにつき2〜4候補を一度の操作で受付
  - ネームの構図を維持しつつ、表情、視線誘導、背景を変えた候補を生成
  - 完成候補をサムネイルで比較し、選んだ候補をコマの背景layerへ配置
  - 失敗理由やProvider内部情報を表示せず、失敗候補だけ再実行
  - 利用枠不足などで一部だけ受付できた場合は、完了数を安全に案内
  - 再読込後もJobの`targetPanelId`から採用先と再実行対象を復元
- 変更しない範囲: DB、migration、Provider、Worker、成人向け、Desktop
- 検証: lint、Hub typecheck、集中テスト12/12、Hub 287/287、
  production build、diff check成功
- 次: ページ／全8ページの進捗表示、基本キャラクター設定表、原稿preflight、
  8ページfixtureによるPDF／連番PNGの完走検証
- 未実施: Draft PR、CI、Vercel Preview、実Provider有料生成、責任者画面確認

## 2026-07-31 長編マンガ制作 M0: Cloudページ合成基盤

- 状態: `IMPLEMENTED`
- Branch: `codex/manga-production-m0-v1`
- Base: `codex/cloud-general-image-v1` (`56ab885`)
- 計画:
  [`MANGA_100_PAGE_IMPLEMENTATION_PLAN.md`](cloud/MANGA_100_PAGE_IMPLEMENTATION_PLAN.md)
- 対象: 一般向けCloud Canvasの編集表示、プレビュー、PNG/PDF、販売パッケージ
- 実装:
  - ブラウザとServer書き出しが同じSVGページ合成器を利用
  - コマ内の背景・人物・小物・効果・トーン・補正を順番どおりに合成
  - cover/contain/manual、位置、倍率、回転、透明度、blend modeを反映
  - mask layer、斜め・曲線コマ、吹き出し尻尾、縦横文字・ルビを反映
  - 編集画面のコマ表示を最上位画像1枚から全レイヤー合成へ変更
  - Export時に最上位だけでなく必要な全レイヤーAssetを収集
  - 旧`flattened_legacy`だけのPageは従来画像へfallback
- Desktop方針:
  同じCanvas schemaと描画規則を維持し、将来の成人向けDesktopへ作品を
  引き渡せる境界を保持。今回Desktopコードと成人向けProviderは変更しない
- 検証: deps、lint、Hub typecheck、Hub 284/284、production build、
  Cloud Canvas集中テスト5/5、diff check成功
- 未実施: Draft PR、CI、Vercel Preview、実ブラウザでの編集→保存→PDF比較

## 2026-07-31 一般向けモニターWebマニュアル同期

- 状態: `READY_FOR_REVIEW`
- Branch: `codex/cloud-monitor-guide-sync-v1`
- Base: `feature/manga-canvas-mvp` (`ee6e2ca`、PR #92 merge後)
- 対象: 利用者向けWebマニュアル、スタッフ向け運用マニュアル、Cloud共通サイドバー
- 実装:
  - 利用者向けマニュアルを現在の8工程へ同期
  - 実装済みの工程1〜6へマニュアルから直接移動できる導線を追加
  - 販売準備・収益管理を「準備中」と明示
  - スマートフォン操作とFeature Flag停止時の案内を追加
  - Cloud共通サイドバーへ常設の「使い方」リンクを追加
  - スタッフ向け完走条件を一般向け6工程へ更新
- 変更しない範囲: DB、migration、認証、AI生成・保存ロジック、Feature Flag、成人向け境界、Desktop
- 検証: deps:check、lint、Hub typecheck、集中テスト5/5、Hub test 279/279、production build、git diff check成功
- 注記: `npm ci`の既存依存監査でhigh severity 11件。今回の表示・文書変更とは分離して扱う
- Draft PR: [#93](https://github.com/team478a/manga/pull/93)
- Preview: `https://mangai-hub-staging-git-codex-cloud-mo-eaf18e-team478as-projects.vercel.app`
- CI: 実装commit `25aaa92`でCore quality、Migration roundtrip、Windows build、Vercel成功
- 未実施: 責任者によるPreview画面確認・承認・マージ

## 2026-07-31 一般向け制作工程の利用入口修正

- 状態: `READY_FOR_REVIEW`
- Branch: `codex/cloud-workflow-entrypoints-v1`
- Base: `feature/manga-canvas-mvp` (`38c1481`、PR #91 merge後)
- 対象: Cloud共通サイドバー、企画・シナリオ・ネームの工程入口
- 実装:
  - 実装済みのAI企画提案・シナリオ作成・ネーム作成をクリック可能に変更
  - 各Feature Flagを個別に確認し、有効時は「利用可能」、無効時は「停止中」と表示
  - 利用者本人の一般向け制作データから最新の進行先を安全に解決
  - 前工程が未完了の場合は、必要な工程と遷移ボタンを表示
  - 他利用者データおよび成人向けデータを工程入口の候補から除外
  - 現在の制作進行表示を、閲覧中の工程に合わせて更新
- 変更しない範囲: DB、migration、AI生成・保存ロジック、成人向け境界、Desktop
- 検証:
  - deps:check: PASS
  - lint: PASS
  - Hub typecheck: PASS
  - 集中テスト: PASS（4/4）
  - Hub test: PASS（279/279）
  - Hub production build: PASS
  - git diff --check: PASS
- 注記: `npm ci`の既存依存監査でhigh severity 11件。今回の変更とは分離して扱う
- Draft PR: [#92](https://github.com/team478a/manga/pull/92)
- 未実施: CI、Vercel Preview、本番Feature Flag確認

## 2026-07-31 一般向け制作工程の表示整理

- 状態: `IMPLEMENTED`
- Branch: `codex/cloud-workflow-labels-v1`
- Base: `feature/manga-canvas-mvp` (`7eb783f`)
- 対象: Cloud共通サイドバー、Dashboard、`/creator`、シナリオ採用画面
- 実装:
  - 「マンガ生成」を「ネーム作成」と「原稿編集」へ分離
  - 原稿編集を制作ステップ5、作品管理をステップ6へ整理
  - 販売準備と収益管理へ「準備中」を表示
  - AI企画提案・シナリオ作成・ネーム作成へ「前工程の完了後」を表示
  - 企画・シナリオ・ネームの詳細URLに応じて現在工程を正しく強調
  - DashboardのRelease 1表記を「一般向けモニター」へ変更
  - `/creator`を「原稿編集」として案内し、初回3ステップも原稿編集用に統一
- 変更しない範囲: DB、API、認証、制作・保存ロジック、Feature Flag、Desktop
- 検証:
  - 集中テスト: PASS（11/11）
  - deps:check: PASS
  - lint: PASS
  - Hub typecheck: PASS（共通package build後）
  - Hub test: PASS（278/278）
  - Hub production build: PASS
  - git diff --check: PASS
- 注記: `npm ci`の既存依存監査でhigh severity 11件。今回の表示変更とは分離して扱う
- 未実施: push、Draft PR、CI、Vercel Preview、責任者画面確認
## 2026-07-31 一般向けクラウド画像生成Provider接続

- 状態: `IMPLEMENTED_LOCAL`
- Branch: `codex/cloud-general-image-v1`
- Base: 最新`feature/manga-canvas-mvp` (`7eb783f`)
- 対象: 一般向けRelease 6のコマ画像生成、`/admin/cloud-ai`
- 実装:
  - BFL FLUX.2固定版の非同期API adapter
  - 管理画面からAPIキー・モデル・有効状態を保存
  - APIキーをSupabase Vaultへ保存し、service-role限定で復号
  - Provider価格と原価上限をmigrationで登録
  - BFLのpolling URL・画像URLをHTTPSかつBFL domainへ限定
  - 既存の一般向けモデレーション、quota、Queue、Worker、画像検査、
    private Storage、コマ配置を維持
  - モニター公開チェックへ画像Provider設定とWorker実行条件を追加
  - Worker停止・短い署名Secretをpreflightで秘密値なしに拒否
  - 画像生成受付中はボタンを無効化し、二重Job登録を防止
- migration:
  `202607310004_cloud_general_image_provider.sql`
- 成人向け境界:
  成人向け画像はBFLへ送信せず、将来の独立GPU/VPS APIまで停止
- 文書:
  [`CLOUD_GENERAL_IMAGE_PROVIDER_V1.md`](cloud/CLOUD_GENERAL_IMAGE_PROVIDER_V1.md)
- 検証: deps、lint、Hub/Desktop typecheck、research eval、Hub 283/283、
  migration 30/30、production build、diff check成功
- migration roundtrip: ローカルDocker停止中のためGitHub CIで確認
- 未実施: 実API有料生成、staging migration、Draft PR、CI、Preview、
  責任者確認、本番公開

## 2026-07-31 クラウド制作の日本語化・初回ガイド

- 状態: `IMPLEMENTED`
- Branch: `codex/cloud-creator-ja-guide-v1`
- Base: `feature/manga-canvas-mvp` (`3d16839`)
- 対象: `/creator`、作品作成、作品構成、ゴミ箱、ページ編集、共通Header
- 実装:
  - 利用者向けの`Project`、`Episode`、`Page`を「作品」「話」「ページ」へ統一
  - `Cloud Creator`を「クラウド制作」へ変更
  - `/creator`配下を紫基調の`CloudWorkflowShell`へ統合し、左サイドバーを表示
  - 制作ワークフローのステップ4「マンガ生成」からクラウド制作へ遷移
  - Creator配下のButton、Card、FormをDashboardと同じ紫基調へ統一
  - 入口へ「作品作成→話とページの整理→ページ編集」の3ステップガイドを追加
  - 作品がない場合は「作品づくりを始める」を最初の操作として強調
  - エラー・完了メッセージとページ編集の主要英語表記も日本語化
- 変更しない範囲: DB、API契約、認証、制作・保存ロジック、Desktop
- 検証: deps、lint、Hub typecheck、集中テスト、Hub 278/278、
  production build、diff check成功
- 注記: root `typecheck`のHub部分は成功。Desktop部分はworktree内の
  Desktop依存未導入により実行不可で、今回のHub表示変更とは無関係
- 未実施: Draft PR、CI、Vercel Preview、責任者画面確認

## 2026-07-31 招待メール文面の管理画面編集

- 状態: `IMPLEMENTED`
- Branch: `codex/cloud-monitor-email-template-v1`
- Base: `feature/manga-canvas-mvp` (`506cf2b`)
- 管理画面: `/admin/general-monitors/email`
- 実装:
  - APIキーを再入力せず、招待メールの件名・本文を保存・変更
  - 宛名、利用開始URL、期限、AI利用上限の安全な差し込み
  - 利用開始URLがない本文、改行を含む件名、未知の差し込み項目を保存拒否
  - 文面変更を監査ログへ記録し、既存APIキーはVaultへ保持
  - migration未適用時も従来の既定文面で招待送信を継続
- migration:
  `202607310003_cloud_general_monitor_email_template.sql`
- 検証: deps、lint、Hub typecheck、Hub 275/275、migration 29/29、
  production build、diff check成功
- 未実施: Draft PR、CI、migration適用、Production redeploy

## 2026-07-31 モニター操作の処理中フィードバック

- 状態: `READY_FOR_REVIEW`
- Branch: `codex/cloud-action-pending-feedback-v1`
- Base: `feature/manga-canvas-mvp` (`6ebdbaa`)
- Draft PR: [#83](https://github.com/team478a/manga/pull/83)
- Preview:
  `https://mangai-hub-staging-hvbsecmo4-team478as-projects.vercel.app`
- 対象: モニター招待・再送・停止、利用許可更新、フィードバック対応、
  招待メール設定、利用者フィードバック送信、初回モニター開始
- 実装:
  - 共通`PendingSubmitButton`でクリック直後にスピナーと用途別メッセージを表示
  - Server Action完了までボタンを無効化し、二重送信を防止
  - `aria-busy`と`aria-disabled`で支援技術へ処理中状態を通知
- 変更しない範囲: Server Action、認証、DB、API、Feature Flag、Desktop
- 検証: deps、lint、Hub typecheck、Hub 274/274、production build、diff check、
  Core quality、migration roundtrip、Windows build、Vercelが成功
- 未実施: 責任者承認、merge、Production redeploy

## 2026-07-31 一般向けモニター本番統合

- 状態: `READY_FOR_REVIEW`
- Branch: `codex/cloud-monitor-production-v1`
- Base: `feature/manga-canvas-mvp`
- 統合元: `codex/cloud-general-monitor-beta-v1`
- 本番URL: `https://app.mang-ai.com`
- 対象: 一般向けRelease 1〜6、モニター招待・運用、Webマニュアル、
  管理画面Provider設定、公開前readiness check
- 除外: Stripe、課金、販売、Marketplace、成人向け公開、Desktop
- 成人向け境界: Productionの成人向けFlagは未設定または`false`を必須とする
- 文書:
  [`CLOUD_GENERAL_MONITOR_PRODUCTION_INTEGRATION.md`](cloud/CLOUD_GENERAL_MONITOR_PRODUCTION_INTEGRATION.md)
- 検証: deps、lint、typecheck、research eval、Hub 272/272、
  migration 28/28、production build、Production相当preflight、diff checkが成功
- 未実施: Draft PR、CI、責任者承認、protected branch merge、本番migration、
  Production redeploy、実招待

## 2026-07-31 一般向けモニター・本番限定公開チェック

- 状態: `READY_FOR_REVIEW`
- 管理者画面: `/admin/general-monitors/readiness`
- 追加内容:
  - 一般向け制作Feature Flag、成人向け停止、モニターDB、AI接続、招待メール、
    招待先HTTPS URLを秘密値なしで一括判定
  - `NEXT_PUBLIC_SITE_URL`と`MONITOR_INVITE_SITE_URL`が同じHTTPS本番originで
    あることを検査し、Previewや別ドメインへの誤招待を防止
  - 登録済み、利用中、初回確認済み、未完了フィードバック件数の表示
  - スタッフ1名 → 2〜3名 → 残りの順で段階公開する手順
  - モニター管理、スタッフマニュアル、各設定画面への導線
- 境界: 設定値、APIキー、内部DBエラーは表示しない。招待、Feature Flag変更、
  migration適用、本番公開は自動実行しない
- 検証:
  - 本番公開保護の集中テスト: PASS（9/9）
  - deps:check: PASS
  - lint: PASS
  - Hub typecheck: PASS
  - Hub test: PASS（272/272）
  - migration静的検証: PASS（28/28）
  - Hub production build: PASS
  - git diff --check: PASS
- 公開形態: 一般公開ではなく、本番環境上の招待制・無料・段階公開
- 外部確認: protected branchの承認とCI成功後に本番へ反映し、管理者画面の
  全項目が正常であることと、スタッフ1名の招待・メール受信・市場分析保存を確認する

## 2026-07-31 約10名モニター向けWebマニュアル

- 状態: `READY_FOR_REVIEW`
- 利用者向け: `/dashboard/monitor/guide`
- スタッフ向け: `/admin/general-monitors/guide`
- 内容:
  - 最初の5分、制作5工程、完了の目印、フィードバック、トラブル、安全上の注意
  - 約10名の同一コホート招待、日次確認、問い合わせ対応、停止判断、完了条件
  - スマートフォンで操作できるアンカーメニューと折りたたみFAQ
- 境界: 一般向け限定。成人向け、Stripe、販売、Marketplaceは変更しない
- 検証:
  - Webマニュアル集中テスト: PASS（8/8）
  - lint: PASS
  - typecheck: PASS（Hub）
  - hub:test: PASS（269/269）
  - Hub production build: PASS
  - git diff --check: PASS
- 未実施: Preview上での390px・768px・1280px実画面確認

## 2026-07-31 一般向けモニター招待メール

- 状態: `READY_FOR_REVIEW`
- Provider: 管理画面で設定するResend Email API
- APIキーと送信元は`/admin/general-monitors/email`で保存・変更し、Supabase Vaultだけを正本にする
- migration: `202607310002_cloud_general_monitor_email_provider`
- 招待登録と同時に登録メールアドレスへ自動送信
- 有効な招待は管理画面から再送可能
- 送信失敗と招待登録失敗を区別して表示
- API token、Provider response、内部エラーは画面へ露出しない
- 外部作業: Resendの認証済み送信ドメイン、API key、送信元、Preview URLの確認
- 検証:
  - 集中テスト: PASS（9/9）
  - deps:check: PASS
  - lint: PASS
  - typecheck: PASS（Hub + Desktop）
  - research:eval: PASS
  - hub:test: PASS（267/267）
  - db:migrations:validate: PASS（28/28）
  - Hub production build: PASS
  - 一般向けモニターpreflight: PASS（テスト値、値非表示）
  - git diff --check: PASS
- 未実施: Preview Supabaseへのmigration適用、実Resend送信、1〜3名の実機E2E、PR merge、本番公開

## 2026-07-31 一般向けモニター運用機能強化

- 状態: `READY_FOR_REVIEW`
- Branch: `codex/cloud-general-monitor-beta-v1`
- Draft PR: [#80](https://github.com/team478a/manga/pull/80)
- migration: `202607310001_cloud_general_monitor_operations`
- 追加内容:
  - 初回オンボーディングと本人の確認日時
  - 期限3日前、AI残り5回以下、停止・期限切れ・上限到達の警告
  - 管理者用の招待メール文面
  - フィードバックの未対応・対応中・対応済み管理
  - モニター一覧CSV出力
- 境界: Stripe、成人向け、本番公開は変更しない

## 2026-07-30 一般向け限定モニター公開

- 状態: `IMPLEMENTED_VALIDATING`
- Branch: `codex/cloud-general-monitor-beta-v1`
- Base: `codex/cloud-panel-image-generation-v1`（Draft PR #73）
- 対象: 一般向け市場分析、AI企画、シナリオ、ネーム、Canvas、コマ画像
- 除外: Stripe、販売、Marketplace、成人向け、本番公開
- migration: `202607300006_cloud_general_monitor_beta`
- 文書:
  - [`CLOUD_GENERAL_MONITOR_BETA_PLAN.md`](cloud/CLOUD_GENERAL_MONITOR_BETA_PLAN.md)
  - [`CLOUD_GENERAL_MONITOR_BETA_ACCEPTANCE.md`](cloud/CLOUD_GENERAL_MONITOR_BETA_ACCEPTANCE.md)
  - [`CLOUD_GENERAL_MONITOR_BETA_RUNBOOK.md`](cloud/CLOUD_GENERAL_MONITOR_BETA_RUNBOOK.md)

管理者による招待、期限、工程横断の累計AI上限、即時停止、利用者フィードバックを追加した。外部migration適用、Feature Flag変更、実API実行、モニター招待は未実施。

## 基本情報

- 更新日: 2026-07-30
- 状態: `READY_FOR_REVIEW`
- リポジトリ: `team478a/manga`
- Base: `codex/cloud-storyboard-canvas-materialization-v1` (`80b71f6`, Draft PR #72)
- Branch: `codex/cloud-panel-image-generation-v1`
- Draft PR: [#73](https://github.com/team478a/manga/pull/73)
- Vercel Preview: [Release 6 Preview](https://mangai-hub-staging-git-codex-cloud-pa-e0d887-team478as-projects.vercel.app)
- 仕様: [`docs/cloud/CLOUD_PANEL_IMAGE_GENERATION_V1.md`](cloud/CLOUD_PANEL_IMAGE_GENERATION_V1.md)
- 計画: [`docs/cloud/CLOUD_RELEASE6_IMPLEMENTATION_PLAN.md`](cloud/CLOUD_RELEASE6_IMPLEMENTATION_PLAN.md)

## 現在の目的

Release 5で作成したCanvas下書きのコマを選ぶだけで、採用ネームから一般向け漫画画像の生成条件をServer側で組み立て、既存Cloud AI Queueへ安全に登録する。利用者にはPrompt、Provider、モデル、解像度の知識を要求しない。

## 実装済み

- 選択コマと元ネームのページ・コマ対応解決
- ネームの画角、構図、人物、背景、動作、感情からServer側Promptを作成
- セリフ、吹き出し、文字を画像へ描かない生成指示
- コマ縦横比に応じた生成寸法の自動決定
- 既存moderation、quota、Provider Registry、Queueを通る専用API
- Jobへ対象panel IDを非公開入力として保存し、PromptをClientへ返さない履歴契約
- 完了Assetを生成対象コマへ配置するCanvas導線
- loading、disabled、error状態
- Feature Flag、UUID、所有者、Release 5由来Project、一般向け境界
- Release 6 preflightとモックProvider自動テスト

## 安全境界

- `CLOUD_PANEL_IMAGE_GENERATION_ENABLED`未設定時は認証・DB・Providerアクセス前にfail closed。
- Release 5の一般向けProjectと所有者本人だけを許可する。
- 既存moderation、quota、料金予約、Provider停止判定を迂回しない。
- PromptをClient response、URL、画面、ログへ返さない。
- 本番Provider、Worker、Feature Flag、有料生成は責任者が明示的に有効化する。
- Desktop、Stripe、Marketplace、成人向け画像生成は変更しない。

## 検証結果

- Release 6集中テスト: PASS（10/10）
- deps:check: PASS
- lint: PASS
- typecheck: PASS（Hub + Desktop）
- research:eval: PASS
- hub:test: PASS（254/254）
- canvas:test: PASS（26/26）
- ai:test: PASS（44/44）
- desktop:test: PASS（182/182）
- desktop:test:a11y: PASS（違反0、既存color contrast要手動確認）
- db:migrations:validate: PASS（25/25、Release 6追加migrationなし）
- Hub production build: PASS
- Desktop build: PASS
- git diff --check: PASS
- GitHub Core quality: PASS
- GitHub migration roundtrip: PASS
- GitHub Windows build: PASS
- Vercel Preview: READY
- rc:preflight: STRUCTURE READY、外部設定と手動E2Eは未実施
- Release 6 preflight: 想定どおりFAIL（ローカルに限定公開用環境変数を設定していない）
- 実Provider有料生成E2E: 未実施（停止条件）

## 責任者が後で行うこと

1. Release 2〜5のstacked migrationとFeature Flagを対象Preview環境で確認
2. Release 6 Preview branchだけで`CLOUD_PANEL_IMAGE_GENERATION_ENABLED=true`
3. 既存Cloud画像Provider、pricing、quota、Workerが検証用設定で動作することを確認
4. Release 5由来Canvasでコマを選び、AIおまかせ生成を1件実行
5. 完了Assetが元の対象コマへ配置され、保存・再表示できることを確認
6. Promptや内部Provider情報が画面・Network response・ログへ露出しないことを確認
7. 390px、768px、1280pxで横overflowと操作不能がないことを確認

## 注意事項

- Release 5 PR #72が未mergeのため、Release 6 PRのbaseはRelease 5 branchにする。
- migration適用、Feature Flag有効化、有料API実行、PR merge、本番公開は行わない。
- Release 6は一般向けコマ画像生成だけを対象とし、成人向け画像生成は含まない。
