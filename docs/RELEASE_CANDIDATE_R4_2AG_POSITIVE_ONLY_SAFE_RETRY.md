# PR-R4-2AG 正方向だけのProvider安全再構成

## 判定

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#290](https://github.com/team478a/manga/pull/290)（Draft／MERGEABLE）
- Vercel Preview: [確認済み](https://mangai-hub-staging-git-codex-fix-r4-2-b9d25a-team478as-projects.vercel.app)
- Branch: `codex/fix-r4-2ag-positive-only-safe-retry`
- Base: `origin/feature/manga-canvas-mvp` @ `7cb9f02`（PR #289 merge commit）
- 対象: 端末を含むクローズアップの通常生成と、Provider拒否後の第1・第2段階安全再構成に渡す正方向Promptだけを安全化する。

## PR #289 merge後のProduction受入れ

- `test`モニターの既存作品、ページ22・コマ1で、前回失敗した最新Jobを1件だけ再実行した。新規候補は作成していない。
- Creditは使用76／予約0／残24から、受付時に使用76／予約2／残22、完了後に使用76／予約0／残24へ全額復元された。
- 公式Worker [31932216482](https://github.com/team478a/manga/actions/runs/31932216482)を`run` modeで1回だけ実行した。`status=idle requests=2 processed=1`でWorkflow自体は成功した。
- 再実行Jobは`provider_moderation_blocked`、Assetなし、Provider課金0で終了した。追加再実行、追加生成、候補採用、Canvas配置は行っていない。
- 最終状態は画像4/4、セリフ1/1、生成中0、失敗表示1、Canvas revision 8／latest 8、PNG成功。公開・販売・設定は不変。

## 原因

PR #289で端末・画面・UI・隠蔽語は除外したが、第1段階安全再構成の正方向Promptには、禁止対象を「避ける」と説明する文と携帯品・ポケットの間接表現が残っていた。BFL adapterはnegative promptを送らずpositive promptだけを送るため、禁止対象を否定する説明もProvider判定へ直接渡る。通常生成と第1段階再構成が連続してmoderation停止した結果から、正方向Promptを穏やかな描写だけに限定する必要がある。

## 修正

- 通常の端末検出時は、端末・胸ポケット等の位置anchorをProviderへ残さず、人物と背景の相対配置、自然な衣服、手、画面外への視線だけへ置換する。
- 第1段階安全再構成は、禁止対象や回避命令を説明せず、穏やかな人物、距離、構図、自然光だけを正方向に指定する。
- 出力品質補強から携帯品・ポケット・事故等の語を除き、衣服の自然な縫い目、布の陰影、力の抜けた手だけを指定する。
- 第2段階安全再構成も、穏やかな余韻と日常環境だけを正方向に指定する。
- PR #289以前に保存された第1段階安全再構成Jobも後方互換で認識し、旧い禁止説明を除去してから第2段階へ進める。
- negative prompt、人物同一性、参照Asset、候補差分、最大2段階の既存retry契約は変更しない。

## 回帰テスト

- 通常の短縮Provider JSON全体から端末・画面・UI・隠蔽・ポケット語を除外する。
- 通常Promptは既存の2,000文字未満を維持する。
- 第1・第2段階の正方向Promptから、禁止対象の説明、携帯品、ポケット、事故、non-graphic等の否定表現を除外する。
- 旧版第1段階Promptを検出し、二重の第1段階ではなく第2段階へ変換する。
- 人物同一性、参照Asset、negative prompt、retry上限を維持する。
- 通常生成、対話型再実行、一括生成、安全再構成の関連54テストを成功させる。

## 検証

- 関連テスト: 54/54成功
- Hub: 742/742成功
- Canvas: 26/26成功
- AI: 48/48成功
- `deps:check`、lint、Hub型検査、59 migration／rollback、research eval、100ページfixture、Cloud漫画repository acceptance、owner isolation、package build、Next.js Webpack build、diff check: 成功
- RC preflight: repository structure ready。外部設定と手動E2Eはローカル環境外のため保留
- Desktop test／a11y／build: 差分外の既知の`@napi-rs/keyring`型宣言不足でローカル停止。GitHub Windows buildを正式判定とする
- GitHub Actions: 初回HEADのCore quality、Migration roundtrip、Windows buildが成功。Windows CIではDesktop test、Accessibility、Windows application buildも成功
- Vercel／Vercel Preview Comments: 初回HEADで成功
- 最終文書同期HEADでも同じ5チェックを再確認して停止する

## 不変契約

URL、API request／response、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、retry回数、timeout、Scheduler、Canvas schema、Canvas revision、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktopを変更しない。Prompt、画像、署名URL、API keyを文書・ログへ記録しない。

## ロールバック

通常のPR revertで通常生成と安全再構成の正方向表現だけを戻せる。DB、Storage、migration、Canvas、既存Assetのロールバックは不要。

## merge後の受入れ

- 責任者のmerge前は追加のProduction生成と失敗Job再実行を行わない。
- merge後、今回失敗した最新Jobを1件だけ再実行する。新規候補は作成しない。
- 完成した場合は、元ネームの人物・構図、端末・画面UI・画像内文字なし、人体、衣服を目視確認する。
- 合格前は候補採用・Canvas配置・公開・販売へ進まない。再び失敗した場合は追加課金生成を止め、参照画像を含むProvider入力の切り分けへ進む。
