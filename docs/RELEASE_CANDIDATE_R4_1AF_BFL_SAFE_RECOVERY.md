# PR-R4-1af BFL一般向け生成の安全な復旧

## 目的

PR #253反映後のProduction長編一括生成で、Provider待機中のretry予算消費と重複POSTは解消した。一方、19〜22ページの16コマ中、21ページのコマ1・コマ2だけがBFL処理完了後に繰り返し拒否され、14/16で停止した。

このPRは、BFLのmoderation結果を待機扱いしないことと、投入後に拒否された一般向けコマを、外見・画風・背景・構図を保持した穏やかな間接表現へ変換して再登録できることを目的とする。

## Production証跡

- 対象: 一般向けモニター`test`、作品`b008b746-94c6-4e83-85dd-3bb0e379c96a`、19〜22ページ、16コマ。
- PR #253のProduction反映後、失敗2件だけを再登録した。
- 公式Worker runは、同一Provider JobのGET pollを継続し、待機中に通常retry回数を消費しなかった。
- 最終状態は完了14、失敗2、待機0、予約0、使用28、残り72 credit。
- 失敗対象は21ページのコマ1・コマ2。同じ対象が再実行後も`provider_rejected`となったため、偶発timeoutではなく入力依存の拒否と判断し、追加実行を停止した。
- Prompt、Provider応答、画像、Provider Job ID、API key、利用者情報は文書・ログへ記録していない。

## 実装

1. BFL公式`get_result`契約の`Request Moderated`と`Content Moderated`を明示的に認識する。
2. moderation結果は`provider_moderation_blocked`として即時終了し、固定段階・固定区分だけを診断へ渡す。
3. Provider Job IDが保存済みで、`provider_rejected`または`provider_moderation_blocked`となった失敗Jobだけを一般向け復旧対象とする。投入前のHTTP拒否には適用しない。
4. 復旧時は画像Promptから視覚表現に不要な人物の心理背景を外し、強い動作・演出を表情、距離、構図、照明による間接表現へ置換する。
5. project、page、target panel、人物外見version、画風version、世界観version、参照画像、画像寸法、candidate、idempotency、料金予約経路は維持する。

BFL公式契約: https://docs.bfl.ai/api-reference/utility/get-result

## 不変条件

- Provider、model、pricing、credit単価、retry回数、210秒timeout、30分上限、Scheduler頻度を変更しない。
- DB、migration、RPC、Storage、URL、公開API、Feature Flag、Canvas schema、PDF／PNGを変更しない。
- 一般向けCloudだけを対象とし、成人向け内容を外部Providerへ送らない。Desktopを変更しない。
- Prompt、画像、Provider応答本文、Provider Job ID、秘密値を通常ログへ追加しない。

## 回帰検証

- BFL `Request Moderated`／`Content Moderated`の即時停止、非retry、固定診断。
- Provider拒否後の一般向け復旧Prompt、二重変換防止、文章Job不変。
- durable batchのProvider投入後拒否にだけ復旧を適用する配線。
- Provider Job resume、待機中retry予算保持、30分上限、既存BFL／Worker回帰。
- 全品質ゲートとGitHub CI／Vercel Preview。

ローカル結果: focused 38/38、Hub 672/672、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y violations 0、deps、lint、全typecheck、research eval、migration 55/55、Cloud漫画repository、owner isolation、100ページ長編4/4、Webpack Hub build、Desktop build、RC structure、diff check成功。

## ロールバック

このPRのcommitをrevertする。DB rollback、Storage操作、Provider設定変更は不要。未処理Jobと既存失敗Jobの状態は変更されない。

## merge後の停止条件

Production反映後、既存batchの失敗2件だけを一度再登録する。公式Workerで16/16完了、予約credit 0、画像Asset 16件、21ページのコマ1・コマ2に候補が存在することを確認する。生成品質を確認するまで、対象を増やす8ページ生成や販売品質判定へ進まない。
