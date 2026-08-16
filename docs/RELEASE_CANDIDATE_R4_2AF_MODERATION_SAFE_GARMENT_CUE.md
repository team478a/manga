# PR-R4-2AF moderation安全な衣服表現

## 判定

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#289](https://github.com/team478a/manga/pull/289)
- Vercel Preview: [確認済み](https://mangai-hub-staging-git-codex-fix-r4-2-b509b2-team478as-projects.vercel.app)
- Branch: `codex/fix-r4-2af-moderation-safe-garment-cue`
- Base: `origin/feature/manga-canvas-mvp` @ `713bb47`（PR #288 merge commit）
- 対象: 端末を含むクローズアップの通常生成と一般向け安全再実行で使う小物表現だけを安全化する。

## PR #288 merge後のProduction受入れ

- `test`モニターの既存作品、ページ22・コマ1で手動比較可能な最小2候補を1回だけ登録した。
- Creditは使用76／予約0／残24から、登録時に使用76／予約4／残20、完了後に使用76／予約0／残24へ全額復元された。
- 公式Worker [31930333853](https://github.com/team478a/manga/actions/runs/31930333853)を`run` modeで1回だけ実行した。`status=idle requests=3 processed=2`でWorkflow自体は成功した。
- 2 Jobはいずれも`provider_moderation_blocked`、Assetなし、Provider課金0で終了した。画像を生成できなかったため品質採用判定へは進んでいない。
- 失敗Job再実行、追加生成、候補採用、Canvas配置は行っていない。
- 最終状態は画像4/4、セリフ1/1、生成中0、失敗表示1、Canvas revision 8／latest 8、PNG成功。公開・販売・設定は不変。
- Production DB、既存32ページ作品の確定データ、PNG／PDF、Feature Flag、Provider設定は変更していない。

## 原因

PR #288で端末・画面・UI語は除外できたが、代替表現の`concealed prop`は「隠された小物」という曖昧な意味をProviderへ与える。PR #287では同じネームとProviderで2候補が完成し、PR #288反映後の限定差分で2候補ともmoderation停止したことから、この曖昧な小物表現が最有力原因と判断した。また、一般向け安全再実行の品質補強は端末・表示面の語を再導入しており、再実行でも同種の停止または画面UI生成へ戻る可能性があった。

## 修正

- `concealed`、hidden、端末、電話、画面、display、UI等をProvider向け通常Promptへ渡さない。
- 胸ポケット等の安全な位置anchorを維持し、ポケットの縫い目、自然な布のふくらみ、近くに添えた手だけを描く。
- 人物動作はポケットへ視線を向ける姿勢だけで表現する。
- 一般向け第1・第2段階安全再実行から端末表裏の指示を除き、同じ衣服表現へ統一する。
- 端末を含まないクローズアップ、人物同一性、参照Asset、候補差分、Provider・費用契約は変更しない。
- 通常の短縮Promptは既存の2,000文字未満を維持する。

## 回帰テスト

- 胸ポケット等の位置anchorを維持する。
- 通常の短縮Provider JSON全体から端末・画面・UI・`concealed`等を除外する。
- `layout`と人物`action`を無害な衣服・姿勢表現へ変換する。
- 一般向け第1・第2段階安全再実行の正方向Promptにも端末・表示面語を含めない。
- negative prompt、人物同一性、参照Asset、既存のretry段階数を維持する。
- 通常生成、対話型再実行、一括生成、安全再構成の関連53テストを成功させる。

## 検証

- 関連テスト: 53/53成功
- `npm run deps:check`: 成功（0 errors、既存warning 2件）
- `npm run lint`: 成功
- `npm run typecheck:hub`: 成功
- `npm run hub:test`: 741/741成功
- `npm run canvas:test`: 26/26成功
- `npm run ai:test`: 48/48成功
- `npm run db:migrations:validate`: 59 migration／rollback成功
- research eval、100ページfixture、Cloud漫画repository acceptance、owner isolation: 成功
- package build、Next.js production build: 成功
- `npm run rc:preflight`: repository structure ready。外部設定と手動E2Eはローカル環境未設定のためpending。
- Desktop test／a11y／build: 今回の差分外にある既知の`@napi-rs/keyring`型宣言不足でローカル停止。GitHub Windows buildで判定する。
- `git diff --check`: 成功
- GitHub Actions: Core quality、Migration roundtrip、Windows buildが成功。
- Vercel、Vercel Preview Comments: 成功。Previewを確認済み。

## 不変契約

URL、API request／response、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、retry回数、timeout、Scheduler、Canvas schema、Canvas revision、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktopを変更しない。Prompt、画像、署名URL、API keyを文書・ログへ記録しない。

## ロールバック

通常のPR revertで通常生成と安全再実行の衣服表現だけを戻せる。DB、Storage、migration、Canvas、既存Assetのロールバックは不要。

## merge後の受入れ

- 責任者のmerge前は追加のProduction生成と失敗Job再実行を行わない。
- merge後、今回失敗したページ22・コマ1のJobを1件だけ再実行する。新規2候補は作成しない。
- moderationを通過した場合は、元ネーム構図、端末本体・画面UI・画像内文字なし、人体、小物単一性を目視確認する。
- 合格前は候補採用・Canvas配置・公開・販売へ進まない。再び失敗した場合は追加課金生成を止める。
