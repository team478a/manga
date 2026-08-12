# PR-R4-1p モニター公開範囲・Production一連動作検証

## 結論

2026-08-12、PR #233 merge後のProduction `https://app.mang-ai.com` と最新正本commit `924b833`を検証した。

一般向けモニターへ公式に公開されている範囲は、次の6工程である。

1. 市場分析
2. AI企画提案
3. シナリオ作成
4. ネーム作成
5. 原稿編集
6. 作品管理

販売準備と収益管理はメニュー上「準備中」で、モニターテスト対象外である。関連routeが存在しても公開済み工程とは判定しない。

管理画面の公開条件はすべて「準備完了」で、一般向けFeature Flag、成人向け停止、monitor DB、市場分析AI、BFL画像生成、Worker、価格、Resend、Production originを利用可能と表示した。しかし、今回の実操作ではCloud文章Jobが登録できず、既存32ページ作品もAIネーム由来の本人所有関係を満たさず画像候補生成前に拒否された。したがって、6工程のUIは公開済みだが、市場分析から画像付き完成原稿PDFまでのProduction縦型E2Eは未完了である。

## 基準

- Base: `origin/feature/manga-canvas-mvp` / `924b833`（PR #233 merge commit）
- Branch: `codex/release-r4-1p-monitor-scope-acceptance`
- Draft PR: [#234](https://github.com/team478a/manga/pull/234)
- Vercel Preview: https://mangai-hub-staging-git-codex-release-3bd30f-team478as-projects.vercel.app
- 確認日: 2026-08-12（Asia/Tokyo）
- Production: `https://app.mang-ai.com`
- ログイン中表示名: `tanaka`
- 変更範囲: 証跡、CURRENT_TASK、handoff、RC台帳、roadmap

個人のメールアドレス、Report本文、Prompt、生成結果、API key、secret、Job IDは記録しない。

## モニター公開範囲

| 工程 | 公開状態 | 今回の実測 |
|---|---|---|
| 市場分析 | 公開済み | 履歴・新規導線を表示。現在sessionはmonitor利用枠がなくReport 0件。対象本人の保存・詳細・再読込はPR-R4-1oで責任者報告によりPASS |
| AI企画提案 | 公開済み | routeと案内を表示。現在sessionは市場分析未完了のため前工程待ち |
| シナリオ作成 | 公開済み | routeと案内を表示。現在sessionは企画未採用のため前工程待ち |
| ネーム作成 | 公開済み | routeと案内を表示。現在sessionはシナリオ未採用のため前工程待ち |
| 原稿編集 | 公開済み | 作品一覧、32ページ作品、Canvas、保存済み復帰、二重編集lock、画像候補UIを表示 |
| 作品管理 | 公開済み | routeを表示。現在sessionの管理対象作品は0件 |
| 販売準備 | モニター対象外 | メニューとマニュアルは「準備中」。直接routeの存在を公開判定へ含めない |
| 収益管理 | モニター対象外 | メニューとマニュアルは「準備中」。直接routeの存在を公開判定へ含めない |

## 管理画面の公開状態

- システム設定: テスト公開可能
- 登録済み: 9名
- 利用中: 9名
- 初回確認済み: 4名
- 未完了の声: 0件
- Queue処理待ち: 0件
- Queue実行中: 0件
- 24時間以内の失敗: 0件
- OpenAI市場分析: 設定済み／有効
- Black Forest Labs画像生成: 設定済み／有効
- Resend: 利用可能
- 成人向け機能: 停止

上記は設定readinessであり、利用者E2Eの成功を代替しない。

## Production一連動作

### 正常確認

- Headerとサイドメニューに`tanaka`を表示し、マイページへ遷移できた。
- Dashboard、使い方、市場分析、企画、シナリオ、ネーム、原稿編集、作品管理を表示できた。
- AIネームから作成した旨を表示する32ページ作品を開き、全32ページと64コマのCanvas下書きを読み込めた。
- 1ページ目は保存済みで復帰し、同じページを別タブで開くと「別の画面で編集中」として編集を遮断した。
- 390px、768px、1280pxでDashboard、使い方、原稿一覧、Canvasの12条件に横overflowがなかった。
- Production公開・認証route smokeは9/9成功した。

### 完走阻害

1. 32ページ作品の1コマを選択し、最小の2候補生成を1回だけ送信した。
   - 「AIシナリオからネームを採用し、そのネームから作成した本人の作品」を要求する境界で拒否された。
   - `cloud_story_storyboard_projects`に対するproject／owner関連確認より先へ進んでいない。
   - Provider呼出し、Job、Asset、credit予約、費用は発生していない。表示は使用4／予約0／残り16のまま。
2. 一般向けの短い文章生成を1回だけ送信した。
   - 「登録に失敗しました。」となり、Job登録前に停止した。
   - Provider呼出し、credit予約、費用は発生していない。
3. 作品は画像配置0/64コマ、完成0/32ページ、要修正135件だった。
   - 完成原稿PDFはdisabledで、生成・候補採用・全ページ確定後まで開始できない。
4. 1ページPNGボタンは押下したが、画面内Blob downloadをブラウザ検証が捕捉できず、成功表示または取得ファイルを確認できなかった。
   - PNGは今回PASSにしない。以前のProduction 1ページPNG成功証跡は別記録として維持する。

## 品質検証

- full `npm run rc:validate`: PASS（Desktop integration tests、Hub 632/632、migration 52/52、Hub／Desktop production build）
- `npm run deps:check`: PASS（dependency境界0 error、module境界0 error／既存warning 2件、size regression 0）
- `npm run research:eval`: PASS（抽出21/21、分類28/28、禁止情報leak 0）
- `npm run cloud:manga:acceptance:repo`: PASS（artifact、responsive structure、owner isolation 7/7）
- `npm run cloud:longform:acceptance`: PASS（100ページfixture 4/4）
- `npm run canvas:test`: PASS（26/26）
- `npm run ai:test`: PASS（48/48）
- `npm run cloud:production:routes`: PASS（read only 9/9）
- `npm run rc:acceptance`: 2 passed／11 pending／2 blocked
- Draft PR初回HEAD: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsすべて成功
- `npm audit`: root 5件（moderate 1／high 4）、Desktop 9件（moderate 2／high 7）。lockfile由来の既知依存警告として記録し、自動更新は行わない。

## 現在の判定

### モニターへ案内できる

- 一般向け作品だけを対象にした6工程の画面確認
- 対象本人による市場分析の保存・履歴・再表示
- 原稿編集のCanvas下書き、保存・再読込、二重編集防止
- 作品構造、32ページ表示、原稿チェック、checkpoint UI、長編管理UI

### 完成保証を付けず限定案内する

- AI企画、シナリオ、ネームの縦型工程
- 画像候補、採用、再生成、部分修正、layer生成、一括生成
- PDF／PNG書き出し

画面とrepository契約は存在するが、対象モニター本人による市場分析から画像付き完成原稿までの通し受入れは未完了である。

### モニターへ案内しない

- 販売準備
- 収益管理
- Stripe決済
- 成人向けCloud制作
- Desktop固有機能

## 次の安全な順序

1. 実monitor sessionで市場分析→企画→シナリオ→ネーム→Canvas下書きを同一ownerで新規作成する。
2. そのmaterializationから1コマ2候補を生成し、比較・採用・再生成を確認する。
3. Cloud text model／pricing／Gatewayを正本手順で設定し、短い文章Job 1件を完了させる。
4. 4〜8ページで画像配置、保存、再読込、checkpoint、PDF／PNGを確認する。
5. 一般ユーザー所有の生成成果物と署名付きexport URLのowner isolationを確認する。
6. Stripe test mode E2Eを別工程で行う。

## ロールバック

本PRは文書と台帳だけを変更する。commitをrevertすれば記録だけが戻る。Productionの作品、Report、Job、Asset、credit、Provider、設定を変更・削除しない。
