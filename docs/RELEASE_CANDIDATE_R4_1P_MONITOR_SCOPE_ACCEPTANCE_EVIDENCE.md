# PR-R4-1p モニター公開範囲・Production一連動作検証

## 結論

2026-08-12、PR #233 merge後のProduction `https://app.mang-ai.com` と最新正本commit `924b833`を、表示名`test`のactiveモニター本人sessionで検証した。

一般向けモニターへ公式に公開されている範囲は、市場分析、AI企画提案、シナリオ作成、ネーム作成、原稿編集、作品管理の6工程である。販売準備と収益管理はメニュー上「準備中」で、モニターテスト対象外である。

実Providerを含む縦型操作では、保存済み市場分析の再表示、3企画生成・採用、32ページシナリオ生成・採用まで成功した。ネーム初稿は通常実行と1回だけの再実行がともに約3分でタイムアウトし、利用数は各試行で加算された。ネームが作成できないため、本人ownerのAIネーム由来作品、画像候補、候補採用、画像付きPDFまで進めない。

別に一般向け手動作品を新規作成し、1ページ、コマ追加、自動保存、再読込復元、1ページPNG成功を確認した。一方、手動作品の画像候補生成は正規のAIネーム由来条件でJob前拒否された。また、Canvas品質評価とモニター状況画面の不具合報告は、どちらもProductionで保存に失敗した。

したがって、安定して利用可能と実測できた縦型範囲は「市場分析→AI企画→シナリオ採用」までである。ネーム以降とモニターフィードバックは公開済みUIであるが、現時点でモニターへ完走可能とは案内できない。

## 基準

- Base: `origin/feature/manga-canvas-mvp` / `924b833`（PR #233 merge commit）
- Branch: `codex/release-r4-1p-monitor-scope-acceptance`
- Draft PR: [#234](https://github.com/team478a/manga/pull/234)
- Vercel Preview: https://mangai-hub-staging-git-codex-release-3bd30f-team478as-projects.vercel.app
- 確認日: 2026-08-12（Asia/Tokyo）
- Production: `https://app.mang-ai.com`
- ログイン中表示名: `test`
- モニター状態: active、期限2026-10-31、AI利用上限100
- 変更範囲: 証跡、CURRENT_TASK、handoff、RC台帳、roadmap

個人のメールアドレス、Report本文、Prompt、生成本文、API key、secret、Job IDは記録しない。

## モニター公開範囲と実測

| 工程 | 公開状態 | 今回の実測 |
|---|---|---|
| 市場分析 | 公開済み | 保存済みReport 2件、履歴、詳細、出典、再表示、企画引継ぎを確認。PASS |
| AI企画提案 | 公開済み | 実Providerで3案生成し、本命案を採用・保存。PASS |
| シナリオ作成 | 公開済み | 実Providerで32ページ／12シーンの初稿を生成し、採用・保存、ネーム引継ぎを確認。PASS |
| ネーム作成 | 公開済み | 32ページ初稿が通常実行・再実行とも約3分でタイムアウト。2回とも利用数加算。BLOCKED |
| 原稿編集 | 公開済み | 一般向け手動作品、1ページ、コマ追加、自動保存、再読込、1ページPNGはPASS。AIネーム由来ではないため画像候補は安全拒否 |
| 作品管理 | 公開済み | route表示成功。公開作品登録は0件で、縦型作品はネーム未生成のため未到達 |
| 販売準備 | モニター対象外 | メニュー上「準備中」 |
| 収益管理 | モニター対象外 | メニュー上「準備中」 |

## Production一連動作

### 成功

- Headerとサイドメニューへ`test`を表示し、マイページへ遷移できた。
- active、AI利用2/100、期限2026-10-31、保存済みReport 2件、次工程準備完了を確認した。
- 保存済みReportから企画3案を実生成し、1案を採用・保存した。
- 採用企画から32ページ／12シーンのシナリオを実生成し、採用・保存した。
- シナリオ採用後、ネーム作成URLへ正しく引き継がれた。
- 一般向け手動作品を作成し、第1話・1ページ目の自動作成を確認した。
- コマを1件追加し、「保存中」から「保存済み」へ変化後に再読込してコマ1が復元された。
- 1ページPNGで「PNGを書き出しました。」を確認した。
- PDFは原稿未確定のためdisabledで、preflight境界が機能した。

### 阻害・不具合

1. 32ページのAIネーム初稿を生成できない。
   - 通常実行、画面案内に従った再実行の2回とも、約3分後に「ネーム生成に時間がかかっています。しばらくしてから再実行してください。」となった。
   - 利用数は2/100から、企画、シナリオ、ネーム1回目、ネーム再実行の計4回分が加算され、6/100となった。
   - 完成したネーム版やCanvas materializationは作成されていない。
2. 手動作品の2候補画像生成はJob前に安全拒否された。
   - 「AIシナリオからネームを採用し、そのネームから作成した本人の作品」が必要と案内された。
   - Cloud画像creditは使用0／予約0／残り20のまま。Provider、Job、Asset、費用は発生していない。
3. Canvas品質フィードバックを保存できない。
   - ページ全体を「このまま採用できる」として送信したが、「品質フィードバックを保存できませんでした。」となった。
4. モニター状況画面の不具合報告も保存できない。
   - 必須項目を入力して送信したが、「フィードバックを保存できませんでした。」となった。
   - 同画面の送信履歴も「一時的に確認できません」と表示された。

品質評価APIとモニター報告Server Actionの双方が同じ保存先を利用するため、個別画面ではなく共通フィードバック保存経路のProduction障害と判定する。個人情報、秘密値、内部DBエラー本文は取得していない。

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

- 市場分析の保存済み履歴・詳細・再表示
- 市場分析からAI企画3案生成・比較・採用
- 採用企画から32ページシナリオ生成・確認・採用
- 手動Cloud作品の作成、Canvas基本編集、自動保存・再読込、1ページPNG

### 修正まで完走用途として案内しない

- 32ページAIネーム生成
- AIネームからのCanvas下書き作成
- コマ画像2〜4候補、候補採用、再生成、部分修正、layer生成、一括生成
- 画像付き4〜8ページ、完成版固定、完成原稿PDF
- Canvas品質評価とモニター状況画面からの意見・不具合送信
- 販売準備、収益管理、Stripe決済、成人向けCloud制作、Desktop固有機能

## 次の安全な順序

1. Productionネーム生成の約3分タイムアウトと、失敗試行の利用数加算を診断・修正する。
2. `cloud_general_monitor_feedback`へ至る品質評価APIとモニター報告Server Actionの共通保存障害を診断・修正する。
3. 修正後、同じtestモニターで既存採用シナリオからネーム生成を1回だけ再実行する。
4. 生成ネームを本人ownerのCanvasへmaterializeし、1コマ2候補、比較、採用、保存・再読込を確認する。
5. 4〜8ページで一括生成、checkpoint、完成版、PDF／PNGを確認する。
6. 一般ユーザー所有成果物・署名付きexport URLのowner isolationとStripe test E2Eを別工程で行う。

## ロールバック

本PRは文書と台帳だけを変更する。commitをrevertすれば記録だけが戻る。Productionに正規作成した企画、シナリオ、一般向け手動テスト作品、AI利用記録は削除していない。Provider、設定、DB schema、Feature Flagは変更していない。
