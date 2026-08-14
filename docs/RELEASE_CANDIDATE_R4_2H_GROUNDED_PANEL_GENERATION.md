# PR-R4-2H 参照付き単一コマ生成

## Production受入れで判明した問題

- PR #264 merge後、一般モニター`test`の22ページで問題3コマだけを各1案再制作した。
- `adult_content`の自己拒否は解消し、Worker run `31809744470`は`status=completed requests=3 processed=3`で成功した。
- creditは使用32→38、予約6→0、残り62。重複Jobはない。
- 原寸確認では、1枚が無関係な複数場面と生成文字、1枚が顔切れ、1枚が救助動作の人体・接触破綻となり、販売品質へ届かなかった。
- 新しい3候補は配置・承認していない。既存の正常画像、Canvas、公開・販売状態は変更していない。追加有料生成は停止した。

## 原因

1. Panel Specificationは保存と品質評価に使われていたが、Provider Promptでは同じ項目が通常文中に分散し、登場人数・一つの瞬間・構図の優先順位が弱かった。
2. BFL FLUX.2はnegative prompt非対応で、`日本漫画用`等の広い画風語が単一場面指定より強く解釈されると、複数場面や生成文字へ逸脱し得る。
3. 参照画像は関連対象をDB作成順に8件で先に切っていた。古い画風・場所素材が多い作品では、人物同一性の参照がProvider入力から落ちる可能性があった。
4. Providerへ渡す参照画像の役割がPromptに記述されず、参照画像のカメラ・構図を新規場面へ誤って持ち込む余地があった。

## 実装

- Panel SpecificationをPrompt生成前に確定し、同じ値から登場人数、人物、動作、表情、場所、小物、構図、画角、カメラをまとめた「一枚の場面画像」契約を作る。
- 生成契約をPromptの先頭と最終確認直前へ配置し、Providerの長い入力でも一つの瞬間・一つの視点を維持する。
- 冒頭を「枠のない一枚の長方形モノクロインク画像」とし、編集用文字は後工程で追加する正方向指示へ固定する。
- 参照画像を最大32件のbounded supersetとして読み、Domain policyで人物各2件、画風1件、場所1件、小物1件の順に最大8件へ絞る。FLUX.2 Kleinの4件上限でも人物参照が先に残る。
- 参照画像は人物同一性・衣装・画風・場所・小物の形だけに使い、場面と構図は生成契約を優先することを日英でProviderへ伝える。

## 不変契約

- URL、公開API、DB、migration、RPC、Storage、Feature Flag。
- Provider、model、pricing、credit、retry、timeout、Scheduler頻度。
- Canvas schema、保存revision、checkpoint、PNG／PDF、公開・販売guard。
- 成人向け検知とfail-closed境界、Desktop。
- Prompt、画像、参照画像URL、秘密値、Provider応答をClient responseまたはlogへ追加しない。

## 検証

- 集中24/24、Hub全体、Canvas 26/26、AI 48/48、100ページ長編4/4: 成功。
- dependency／module／codebase size、Lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository受入れ: 成功。
- workspace packages build、Next.js Webpack production build、RC structure、`git diff --check`: 成功。
- Desktop typecheck／test／a11y／buildは既存`@napi-rs/keyring`型宣言不足でbuild前に停止した。Desktop差分はなく、GitHub Windows CIを正式結果とする。
- Production DB、migration、既存作品、Provider Job、creditを本PRの実装確認では変更していない。

## merge後の限定受入れ

1. Production反映後、対象作品に人物または画風の参照画像が登録され、対象コマの人物名とProfileが一致することを先に確認する。
2. 22ページの未配置不良候補から1コマだけを1案再制作する。追加連打しない。
3. 登録Jobの予約2、Worker完了後の予約0、重複Jobなしを確認する。
4. 原寸で単一場面、文字なし、登場人数、人物同一性、動作、人体・接触を確認する。
5. 合格時だけ配置・承認し、残り2コマへ進む。不合格なら追加課金せず、Provider／model／pricingを含む責任者判断へ切り替える。

責任者reviewとmerge前にProductionの追加生成を行わない。

## Draft PR

- [PR #265](https://github.com/team478a/manga/pull/265)
- CI／Vercel Preview確認中。
