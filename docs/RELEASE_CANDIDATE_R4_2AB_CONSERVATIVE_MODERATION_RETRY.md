# PR-R4-2AB Provider moderation後の第2段階安全再構成

## 目的

PR #284反映後もBFL moderationで画像が返らない場合に、利用者を行き止まりにせず、背景・場所・構図をさらに穏やかな一般向け場面へ一度だけ再構成する。無制限なProvider再実行は許可しない。

## 基準

- Base: `origin/feature/manga-canvas-mvp` @ `d44fc8d`（PR #284 merge commit）
- Branch: `codex/fix-r4-2ab-conservative-moderation-retry`
- 対象: 対話型の失敗コマ再実行と一括生成の失敗Job再実行

## Production確認

- 対象: `test`モニター、ページ22、コマ1
- 開始状態: 画像4/4、セリフ1/1、生成中0、失敗0、Canvas revision 8、PNG成功、Credit 使用68／予約0／残32
- PR #284の端末背面契約を含む失敗候補を1件だけ再実行した。
- 受付後: Credit 使用68／予約2／残30。同じコマの重複再実行は抑止された。
- 公式Worker: [31921455570](https://github.com/team478a/manga/actions/runs/31921455570)、`status=idle requests=2 processed=1`、成功。
- 結果: `provider_moderation_blocked`、Assetなし。Creditは使用68／予約0／残32へ全額復元された。
- 最終状態: 画像4/4、セリフ1/1、生成中0、失敗1、Canvas revision 8、PNG成功。Canvas、公開、販売、設定は変更していない。
- Production DBは失敗分類、Prompt長、契約適用有無、置換対象項目の有無だけを読み取った。Prompt本文、画像、署名URL、API keyは取得・記録せず、DB書込は行っていない。

## 判明した原因

- 新Jobには第1段階の一般向け安全再構成とPR #284の端末背面契約が適用されていた。
- BFLはJobを受理したが、結果は`provider_moderation_blocked`となった。
- 現行Serviceは第1段階の安全再構成済みJobが再度拒否されると、同じ停止文言を返して再構成を許可しない。
- 実Jobには背景、場所、人物と背景の配置、構図が残る。Prompt本文を露出せず項目種別だけを確認した。

## 実装

- 第1段階の安全再構成がProviderで拒否された場合だけ、第2段階の保守的な再構成を作る。
- 背景、場所、構図、演出、動作、表情を、明るく整った一般向けの日常場面へ置換する。
- 短縮Provider JSONでもscene、background、variation、camera、quality gateを同じ方針へ置換する。
- 人物設定、衣装、参照Asset、対象コマ、Panel Specification、画像サイズ、端末背面契約を維持する。
- 第2段階済みJobが再度拒否された場合は必ず停止する。無制限な再実行を許可しない。
- 対話型再実行と一括生成再実行へ同じdomain関数を適用する。

## 不変条件

- URL、API response、DB、migration、RPC、Storage、Feature Flag
- Provider、model、pricing、credit単価、Worker自動retry回数、timeout、Scheduler
- Canvas schema、checkpoint、PNG／PDF、公開・販売状態
- 成人向け境界、Desktop

## 検証

- 集中テスト: 20/20
- Hub: 739/739
- Canvas: 26/26
- AI: 48/48
- 100ページ長編: 4/4
- dependency／module boundary: 成功（既存warning 2件）
- lint: 成功
- Hub typecheck: 成功
- migration: 59/59
- research eval: 成功
- Cloud漫画repository受入れ: 成功
- owner isolation: 成功
- workspace packages build: 成功
- Next.js Webpack production build: 成功
- RC preflight: repository structure ready。外部設定と手動項目は従来どおり環境依存
- `git diff --check`: 成功

## Merge後の受入れ

1. ページ22・コマ1の今回失敗したJobを1件だけ再実行する。
2. Creditが2だけ予約され、重複再実行が抑止されることを確認する。
3. 公式Workerを1回だけ実行する。
4. 失敗時は予約が全額復元されることを確認する。完成時は端末表示面、顔、人体、小物、物語構図を目視確認する。
5. 合格しない候補は配置せず不採用にする。
6. Canvas revision、PNG、公開・販売状態が意図せず変化していないことを確認する。

## ロールバック

このPRのcommitを通常のrevertで戻す。DB・migration・Storage・Canvas schemaは変更しないため、データrollbackは不要。PRを戻すと第1段階安全再構成後の再拒否は従来どおり停止する。
