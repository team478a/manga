# PR-R4-2E 生成原稿の最終品質ゲート

## 目的

PR-R4-2A〜2Dで生成画像の自動配置、セリフ配置、完成判定、販売連携まで接続したが、画像が存在するだけでは上下反転、画像内の疑似文字、人体崩れなどを販売原稿から排除できなかった。本PRは外部Provider、価格、credit、DB形式を変更せず、生成品質を改善し、人が確認していない生成画像を完成原稿として固定しない。

## 監査結果

- BFL FLUX.2はnegative promptを受け付けないため、共通禁止語はProviderへ送信されない。
- 現行のルールベース品質評価はAsset実体と寸法を確認するが、実画像の意味的判定証拠は生成していない。
- 1候補の一括生成はJob完了後に自動配置され、品質評価の表示bandに関係なくCanvasへ入る。
- 既存の`cloud_manga_quality_logs`は、利用者による候補の表示、採用、却下をowner限定で保存できる。
- OpenAI VisionをWorkerへ追加すると、コマごとの新しい有料処理を既存Cloud AI価格・credit台帳の外で実行することになるため、本PRでは追加しない。

## 実装

### 生成条件

- 正立方向を日英で明示し、人物の頭部を上、足元を下、自然な重力方向へ固定する。
- 画面内の線と形を人物、背景、小物、光、影として意味のある絵柄だけに限定する。
- 顔、手指、関節を自然な人体構造で仕上げる最終確認を追加する。
- FLUX.2へnegative promptを送らない既存境界を維持する。

### 原稿品質確認

- 自動配置された生成画像は、利用者が原稿Editorで「この画像を品質確認済みにする」を押すまでページを`review_required`とする。
- 確認証拠は既存`cloud_manga_quality_logs.event_type='selected'`を使用し、新規table／migrationを追加しない。
- `rejected`が最新の場合は完成扱いにせず、「このコマだけ作り直す（1案）」から対象コマだけを明示的に再生成する。
- 手動配置時は画像配置と品質確認を同時に記録する。品質ログ保存が失敗してもCanvas配置を破棄せず、再確認を要求する。
- 完成判定、release checkpoint、PNG／PDF、公開・販売は既存の共通server guardを通るため、未確認画像を含む原稿はすべて同じ境界で停止する。

### セリフ配置

- 自動会話吹き出しをコマ幅の44%へ縮小し、複数セリフを右・左へ交互配置する。
- 自動文字の最大サイズを42pxから32pxへ下げる。最小18pxと収容不能blockerは維持する。
- 自動吹き出しを完全不透明にし、画像上で本文の可読性を保つ。
- 既存の手動本文、locked要素、既存吹き出し形状は上書きしない。

## 外部契約

変更しないもの:

- URL、公開API、Canvas schema、既存DB、migration、RPC、Storage path
- Provider、model、pricing、credit、retry、timeout、Scheduler頻度
- Feature Flag、PDF／PNG形式、成人向け境界、Desktop
- Prompt、画像、Provider response、API keyをログへ出さない境界

## 回帰検証

- 正立方向、自然な人体、意味のある絵柄だけを正方向Promptへ含める。
- BFL向け正方向Promptへ漫画ページ、複数コマ、疑似文字の語を追加しない。
- 自動吹き出しはコマ幅の半分未満、左右分散、最大32px。
- 未確認の自動配置画像は`review_required`、確認済み画像は品質blockerなし。
- 既存4ページfixtureは4/4 complete、PNG 4枚、4ページPDFを維持する。
- 品質確認UI、選択／却下event、完成判定repositoryの接続を固定する。

実行結果:

- 集中テスト 54/54、Hub 711/711、Canvas 26/26、AI 48/48、長編100ページfixture 4/4: 成功
- dependency／module境界、lint、Hub typecheck、migration 59/59、research eval: 成功
- Cloud漫画repository preflight、RC structure preflight、`git diff --check`: 成功
- Next.js Webpack production build: 成功
- 標準Turbopack build: 既知のWindows長いパス上限で停止。同一sourceのWebpack buildとVercel Previewを正式確認に使う。
- Desktop依存の通常再構築: Visual Studio C++環境不足で停止。`--ignore-scripts`で依存解決後も既存`@napi-rs/keyring`型宣言不足でDesktop型検査／test開始前に停止したため、GitHub Windows CIを正式結果とする。

## Pull Request／CI

- Draft PR: [#262](https://github.com/team478a/manga/pull/262)
- 状態: Draft、MERGEABLE
- Commit: `4bcdd8947d712f177cb61c230eec4dfb7312ce7b`
- Core quality: 成功
- Migration roundtrip: 成功
- Windows build: 成功
- Vercel: 成功
- Vercel Preview Comments: 成功
- Vercel deployment: [成功したPreview deployment](https://vercel.com/team478as-projects/mangai-hub-staging/9DPtY51tHu77KUhqhmEZBcWy4smy)
- 現在のChrome／Vercel CLIは別Vercelアカウントに接続されているため、deployment Dashboardは404となり直接Preview aliasを取得できなかった。GitHubのVercel deployment checkは成功済みであり、Productionへは接続していない。

## Productionとロールバック

- 本PR中はProduction DB、既存32ページ作品、Provider Job、credit、公開作品を変更しない。
- application差分をrevertすると従来の完成判定と配置UIへ戻る。DB rollbackとdata migrationは不要。
- 既存の生成画像、Canvas revision、品質eventは削除しない。

## merge後の限定受入れ

1. 既存ページ22を開き、4コマが目視確認待ちになることを確認する。
2. 採用可能な画像だけを品質確認済みにする。
3. 上下反転または画像内疑似文字のあるコマだけを1案で作り直す。
4. 新候補で正立方向、単一場面、画像内疑似文字なし、人体を確認して配置・承認する。
5. ページ完成、原稿preview、PNG、PDF、checkpoint、販売準備gateを順番に確認する。

追加の有料生成は、mergeとProduction反映後に問題コマだけへ限定する。
