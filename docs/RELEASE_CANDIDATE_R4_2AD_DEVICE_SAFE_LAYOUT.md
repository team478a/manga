# PR-R4-2AD ネーム構図から端末表示面を除外

## 判定

- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#287](https://github.com/team478a/manga/pull/287)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-f5e0c4-team478as-projects.vercel.app
- Branch: `codex/fix-r4-2ad-device-safe-layout`
- Base: `origin/feature/manga-canvas-mvp` @ `a3d957a`（PR #286 merge commit）
- 対象: クローズアップ用の短縮Provider契約に含める`layout`だけを安全化する。

## PR #286 merge後のProduction受入れ

- `test`モニターの既存作品、ページ22・コマ1で通常生成の最小比較単位である2候補を1回だけ登録した。
- 1候補は既存backend契約で`autoAdopt`となり目視確認前にCanvasを変更するため、手動比較を維持できるUI最小値の2候補を選択した。
- Creditは使用70／予約0／残30から、登録時に使用70／予約4／残26、完了後に使用72／予約0／残28となった。
- 公式Worker [31926041721](https://github.com/team478a/manga/actions/runs/31926041721)を`run` modeで1回だけ実行した。`status=idle requests=3 processed=2`で成功し、1候補は完成、1候補は失敗して予約2 Creditが復元された。
- 完成候補は704×1024 PNG。上着の胸ポケットと端末を寄りで捉える元ネームの構図へ戻り、PR #286の構図維持は有効だった。
- 一方、端末の表示面がカメラを向き、日本語・疑似文字・通話UIが描かれたため販売品質不合格とした。候補は追加生成なしで不採用にし、失敗候補は再実行していない。
- 最終状態は画像4/4、セリフ1/1、生成中0、Canvas revision 8／latest 8、PNG成功。候補採用、Canvas配置、公開・販売・設定の変更はない。
- Production DB、既存32ページ作品の確定データ、PNG／PDF、Feature Flag、Provider設定は変更していない。

## 原因

PR #286で追加した`layout`は、相対配置だけでなく「スマートフォンの表示面をカメラへ向ける」という描画指示もそのまま含んでいた。これは同じ短縮契約の後段にある「端末は背面または側面だけをカメラへ向ける」という品質条件と競合し、Providerが表示面と文字UIを補完する原因になった。

## 修正

- クローズアップの`layout`に端末・画面語がない場合は既存値を完全に維持する。
- 端末・画面語がある場合は、その語より前の位置anchor（例: 上着の胸ポケット）だけを残す。
- 端末は1個、背面または側面をカメラへ向け、表示面を人物側または画面外へ向ける短い正方向契約へ置換する。
- 元ネーム本文、人物設定、画風、参照Asset、候補差分、安全再構成、moderation、費用制御は変更しない。
- Prompt全体は既存の2,000文字未満を維持する。

## 回帰テスト

- 端末構図から胸ポケットanchorを保持する。
- 端末名と「表示面をカメラへ向ける」をProvider `layout`へ渡さない。
- 背面／側面をカメラへ向け、表示面を人物側／画面外へ向ける。
- 端末を含まない既存クローズアップ構図はそのまま維持する。
- 通常生成、対話型再実行、一括生成、安全再構成の関連53テストを成功させる。

## 検証

- 関連テスト: 53/53成功
- Hub: 741/741成功
- Canvas: 26/26成功
- AI: 48/48成功
- 100ページ長編: 4/4成功
- dependency／module boundary、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository、owner isolation、workspace packages、Webpack production build、RC structure、diff check: 成功
- Desktop test／a11y／build: ローカル既知制約`@napi-rs/keyring`型宣言不足で停止。変更はDesktop非依存であり、GitHub ActionsのWindows buildを正式判定にする。
- 初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments: すべて成功。最終文書同期HEADでも同じ5チェックを再確認して停止する。

## 不変契約

URL、API request／response、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、retry回数、timeout、Scheduler、Canvas schema、Canvas revision、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktopを変更しない。Prompt、画像、署名URL、API keyを文書・ログへ記録しない。

## ロールバック

通常のPR revertで`layout`の端末向け変換だけを戻せる。DB、Storage、migration、Canvas、既存Assetのロールバックは不要。

## merge後の受入れ

- 責任者のmerge前は追加のProduction生成を行わない。
- merge後にページ22・コマ1で2候補を1回だけ生成する。1候補は自動採用される既存契約のため使用しない。
- 端末の背面／側面、画像内文字なし、人体、小物単一性、元ネーム構図を4項目品質ゲートで目視する。
- 合格前は候補採用・Canvas配置・公開・販売へ進まない。失敗時は追加課金生成を止め、得られた証拠から次の最小修正を判断する。
