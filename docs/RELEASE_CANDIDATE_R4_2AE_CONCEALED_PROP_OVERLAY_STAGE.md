# PR-R4-2AE 端末を直接描かず編集要素を分離

## 判定

- 状態: `IMPLEMENTED_LOCAL`
- Draft PR: 作成前
- Vercel Preview: 確認前
- Branch: `codex/fix-r4-2ae-concealed-prop-overlay`
- Base: `origin/feature/manga-canvas-mvp` @ `b9ac507`（PR #287 merge commit）
- 対象: 端末・表示面を含むクローズアップ用短縮Provider契約だけを安全化する。

## PR #287 merge後のProduction受入れ

- `test`モニターの既存作品、ページ22・コマ1で手動比較可能な最小2候補を1回だけ登録した。1候補は既存backend契約で自動採用されるため使用していない。
- Creditは使用72／予約0／残28から、登録時に使用72／予約4／残24、完了後に使用76／予約0／残24となった。
- 公式Worker [31928823358](https://github.com/team478a/manga/actions/runs/31928823358)を`run` modeで1回だけ実行した。`status=idle requests=3 processed=2`で成功し、2候補とも完成した。
- 候補1は胸ポケットと端末の寄りを維持し、端末背面をカメラへ向けた。PR #287の端末向き契約は部分的に有効だった。一方、端末脇に日本語風・疑似文字の効果音が生成されたため不合格とした。
- 候補2は胸ポケットの寄りを維持したが、端末表示面、英字氏名、通話UIとアイコンを生成したため不合格とした。
- 2候補とも「追加生成なしの不採用」にした。候補採用、Canvas配置、失敗Job再実行、追加生成は行っていない。
- 最終状態は画像4/4、セリフ1/1、生成中0、失敗0、Canvas revision 8／latest 8、PNG成功。公開・販売・設定は不変。
- Production DB、既存32ページ作品の確定データ、PNG／PDF、Feature Flag、Provider設定は変更していない。

## 原因

PR #287は端末の向きを正方向で指定しており、候補1では背面を描けた。しかし、短縮Provider契約で端末・表示面・UIという語を使い続ける限り、Providerが端末前面や文字UIを補完する候補が残る。また、画像内の文字・効果音を後段編集で追加する責務が短縮契約上明示されず、Providerが疑似文字を絵へ直接描いた。

## 修正

- 端末・表示面を含むクローズアップでは、端末語より前の安全な位置anchorだけを保持する。
- Providerへ端末、電話、画面、display、UI等の語を渡さず、物語上の小物は衣服・ポケット・手の輪郭だけで存在を示す。
- `layout`だけでなく人物の`action`に端末語がある場合も、姿勢と視線で隠れた小物へ反応する短い契約へ置換する。
- `overlay_stage`で文字・効果音等の編集要素は後段追加と明示し、生成画像本体を絵だけへ限定する。
- 端末を含まないクローズアップ、詳細Prompt、Provider、model、費用・実行契約は変更しない。
- Prompt全体は既存の2,000文字未満を維持する。

## 回帰テスト

- 胸ポケット等の位置anchorを保持する。
- 短縮Provider JSON全体から端末、画面、display、UI等の語を除外する。
- `layout`と人物`action`の両方を安全化する。
- 編集要素を後段へ分離する`overlay_stage`を含める。
- 端末を含まない既存クローズアップの動作を維持する。
- 通常生成、対話型再実行、一括生成、安全再構成の関連53テストを成功させる。

## 検証

- 関連テスト: 53/53成功
- Hub: 741/741成功
- Canvas: 26/26成功
- AI: 48/48成功
- 100ページ長編: 4/4成功
- dependency／module boundary、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository、owner isolation、workspace packages、Webpack production build、diff check: 成功
- Desktop test／a11y／build: ローカル既知制約`@napi-rs/keyring`型宣言不足で停止。変更はDesktop非依存であり、GitHub ActionsのWindows buildを正式判定にする。
- RC structure、GitHub Actions、Vercel Preview: Draft PR作成後に確認する。

## 不変契約

URL、API request／response、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、retry回数、timeout、Scheduler、Canvas schema、Canvas revision、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktopを変更しない。Prompt、画像、署名URL、API keyを文書・ログへ記録しない。

## ロールバック

通常のPR revertで、端末語を含む短縮`layout`／`action`の置換と`overlay_stage`追加だけを戻せる。DB、Storage、migration、Canvas、既存Assetのロールバックは不要。

## merge後の受入れ

- 責任者のmerge前は追加のProduction生成を行わない。
- merge後にページ22・コマ1で2候補を1回だけ生成する。1候補は自動採用される既存契約のため使用しない。
- 元ネーム構図、端末本体・画面UI・画像内文字なし、人体、小物単一性を目視確認する。
- 合格前は候補採用・Canvas配置・公開・販売へ進まない。失敗時は追加課金生成を止め、得られた証拠から次の最小修正を判断する。
