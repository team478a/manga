# PR-R4-2G 一般漫画Promptと成人向け検知の語彙衝突修正

## Productionで確認した事象

- PR #263 merge後、一般モニター`test`のページ22で不良コマを1案だけ再制作しようとした。
- 品質却下は保存されたが、生成Jobは登録されず、画面は`adult_content`による送信前拒否を表示した。
- 使用32、予約0、残り68で、新規Provider Job、Provider課金、Storage Assetは発生していない。残り2件は操作していない。
- 切り分け中に不良候補1件を誤配置したが、EditorのUndoで直前Canvasへ戻し、保存済みを確認した。公開・販売状態は変更していない。

## 原因

R4-2Fで落下・吊り下がり等の非正立動作へ追加した英語の正方向Promptに`explicitly described`が含まれていた。一般Cloud Promptの既存fail-closed検知は成人向け語として`explicit`を遮断するため、非正立動作の一般漫画PromptがProvider登録前に自己拒否していた。

## 修正

- 非正立動作の意味を維持したまま、英語表現を`clearly described`へ変更する。
- 落下構図の完成Promptに成人向け遮断語が含まれず、既存`moderateGeneralCloudPrompt`が`allow`を返す回帰テストを追加する。

## 不変契約

- 成人向け検知pattern、fail-closed判定、一般／成人向け境界は変更しない。
- URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF、checkpoint、Desktopは変更しない。
- Prompt、画像、秘密値、Provider応答をlogへ追加しない。

## ローカル検証

- 集中23/23、Hub 714/714、Canvas 26/26、AI 48/48、100ページ長編4/4。
- dependency／module／codebase size、Lint、Hub typecheck、migration 59/59、research eval。
- Cloud漫画repository受入れ、workspace package build、Next.js Webpack production build、RC structure。

## Draft PR／CI

- Draft PR: [#264](https://github.com/team478a/manga/pull/264)（Draft／MERGEABLE）
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。
- Vercel deployment: https://vercel.com/team478as-projects/mangai-hub-staging/84qDxxD1emsNu6s18yQ6ZNsbPiL5

## merge後の限定受入れ

1. Production反映後、ページ22の問題3コマだけを各1案再制作する。
2. 登録時に`adult_content`で拒否されず、使用32／予約6となることと、重複Jobがないことを確認する。
3. 公式Workerで同じ3 Jobだけを処理し、予約解放、候補表示、実画像品質を確認する。
4. 良品だけを配置・承認する。1件でも販売品質に届かない場合は追加再生成せず、参照画像／Panel Specification／Provider選択の次判断へ進む。

責任者reviewとmerge前にProduction再生成を行わない。
