# PR-R4-2M Provider構図契約・参照役割の構造化

## 判定

- Branch: `codex/fix-r4-2m-provider-framing-contract`
- Base: `c7615a6bf9022cfd22376ff0d00199b22d6161b9`（PR #269 merge commit）
- 状態: `IN_PROGRESS`
- 対象: Providerへ送る単一コマ生成Promptの構図契約と参照画像の役割
- Production変更: R4-2M実装後はなし

## PR #269反映後の限定受入れ

Productionの`test`モニターで、ページ22の有効な「この候補を使わず作り直す（1案）」を1回だけ実行した。

- 生成Job: 1件
- Worker: GitHub Actions `31864612499`
- Worker結果: `status=idle requests=2 processed=1`
- Credit: 使用42→44、予約0→2→0、残り56
- 重複登録: なし
- 継続Worker: なし
- 配置／品質承認: なし
- 追加生成: なし

生成されたAsset `1e1fd972-ce78-4bb0-b700-126cd693c35d.png`は704×1024で、頭頂、髪、両目が画面外へ切れ、鼻下、口、顎、首、肩だけを表示した。下部に`証拠を`という生成文字も混入しており、販売品質未達である。

## 参照画像の切り分け

作品の画風参照として保存されているAsset `84dce883-e71a-4e6b-8efa-465e36e4f366`を目視した。完全な頭部と全身を含む着座人物の清潔な無記名画像であり、頭部cropや文字混入はない。したがって、今回の出力不良は参照画像そのものの汚染ではない。

## 根因

1. R4-2Lの頭肩・10%余白契約より後に、画角が単純な`クローズアップ`として再指定され、Providerが極端な顔寄りとして解釈できた。
2. 参照選択は人物／画風等を区別していたが、Providerへ実際に送る`input_image`、`input_image_2`以降と各役割を対応付けていなかった。
3. 構図、crop、無記名描画面の重要条件が長い自然言語Promptに分散し、Provider向けの最優先契約として構造化されていなかった。

## Provider仕様の根拠

- [FLUX.2 image editing](https://docs.bfl.ai/flux_2/flux2_image_editing): 入力画像による編集と複数参照を扱う。
- [FLUX.2 prompting guide](https://docs.bfl.ai/guides/prompting_guide_flux2): 複雑な制御には構造化JSON Promptを推奨する。
- [Editing and ControlNets](https://docs.bfl.ai/guides/usecases_editing_controlnets): 複数参照画像では各入力の役割を明示する。
- [Unified prompting basics](https://docs.bfl.ai/guides/prompting_unified_basics): FLUX.2はnegative promptをサポートしない。

既存Provider adapterは参照Assetを選択順に`input_image`、`input_image_2`以降へ送る。この送信順をPrompt側の`Input image N`へ対応させる。negative promptのProvider送信は追加しない。

## 実装

### Provider control contract

Promptの先頭へJSONを置き、次を一つの最優先契約として伝える。

- 枠のない単一のモノクロ漫画場面
- 一つの瞬間、一つの視点
- 正本の登場人数
- 実効画角とカメラ角度
- 清潔な線画と自然な陰影
- セリフと吹き出しを後工程で重ねるための無記名描画面

人物あり`close_up`は「頭部全体・首・肩まで入るミディアムクローズアップ」へ変換し、髪全体、両目、鼻、口、顎、首、両肩の付け根と頭部周囲10%余白を要求する。日本語の画角表示と英語契約を同じ意味へ統一し、後段で単純な`クローズアップ`へ戻さない。

### Indexed reference roles

選択済み参照をProvider送信順に列挙し、各`Input image N`の用途を限定する。

- character: 人物同一性、顔、髪型、体格、衣装
- style: 線、インク質感、陰影、トーン
- location: 建築、材質、環境の同一性
- prop: 形状、材質、寸法、識別要素

参照画像のカメラ構図、crop、人物配置、Canvas layoutはコピーせず、Provider control contractを優先する。

## 回帰テスト

- `close_up` PromptがProvider JSON契約から始まる。
- JSON契約に無記名描画面と頭部周囲10%余白を含む。
- 日本語・英語ともミディアムクローズアップへ統一される。
- 画風参照が`Input image 1`の画風限定役割になる。
- 人物参照が`Input image 1`の人物同一性限定役割になる。
- 既存の参照Asset IDとPanel Specificationを維持する。

## 検証結果

| Gate | 結果 |
|---|---|
| 集中テスト | 27/27 成功 |
| Hub test | 成功 |
| Canvas test | 26/26 成功 |
| AI test | 48/48 成功 |
| 100ページ長編 | 4/4 成功 |
| Dependency boundaries | 成功（既存warning 2件、error 0） |
| Lint | 成功 |
| Hub typecheck | 成功 |
| Migration validate | 59/59 成功 |
| Research eval | 成功 |
| Cloud漫画repository受入れ | 成功 |
| Owner isolation | 成功 |
| Workspace package build | 成功 |
| Next.js Webpack production build | 成功 |
| RC structure preflight | 成功（外部設定・手動E2Eは既存どおりpending） |

## 外部契約と停止条件

URL、公開API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、retry、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、成人向け境界、Desktopを変更しない。

R4-2M実装後のProduction Provider E2E、画像配置、品質承認、DB／Storage／作品内容の変更は行わない。Draft PR、Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsが成功した時点で停止する。merge前にProductionで追加生成しない。
