# PR-R4-2S Provider安全な座標フレーミング

- Draft PR: [#276](https://github.com/team478a/manga/pull/276)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-b52cd0-team478as-projects.vercel.app
- 状態: `READY_FOR_OWNER_REVIEW`

## 結論

PR #275反映後のProduction限定受入れでは、初回生成と一般向け安全再実行がともにProvider moderationで拒否され、新規画像は生成されなかった。各回の予約creditは全額解放され、追加課金はない。

直前のPR #274では安全再実行が成功しており、PR #275で追加した身体部位の英語列挙だけが主な差分である。過去にも同種の列挙でProvider moderationが発生しているため、外部契約を変えず、構図指定を座標と占有率へ置換する。

## Production受入れ証跡

- 基準: PR #275 merge commit `472894141718b355bd946761f564922abb46f577`
- 対象: Productionの`test`モニター、既存32ページ作品の22ページ・4コマ目
- 初回再制作: Worker [31883817067](https://github.com/team478a/manga/actions/runs/31883817067)が`status=idle requests=2 processed=1`で1 Jobを処理し、Provider moderation拒否
- 一般向け安全再実行: Worker [31883888494](https://github.com/team478a/manga/actions/runs/31883888494)が`status=idle requests=2 processed=1`で1 Jobを処理し、Provider moderation拒否
- credit: 使用50／予約0／残50 → 各回で予約2 → 各回とも全額解放 → 最終50／0／50
- Asset: 新規0。生成画像とProvider課金なし
- 保護: 候補採用、コマ配置、品質承認、Canvas revision、作品、公開・販売状態は変更していない
- 停止: 安全再実行失敗後は追加Provider呼出しを行っていない

Prompt、Provider応答、画像、API key、署名URLは記録しない。

## 原因判断

PR #274の安全再実行はProvider moderationを通過した。一方、PR #275は一枚絵契約に加え、`chest`／`waist`を含む身体部位の連続列挙を追加した。過去のPR-R4-2Nでも身体部位列挙を追加した直後に初回・安全再実行がともに拒否され、列挙の除去後に通過している。

したがって、今回の観測範囲では身体部位列挙が最有力原因である。Provider内部判定は公開されないため断定はせず、成功契約との差分を最小化する。

## 公式仕様との整合

Black Forest Labs公式ガイドは、複雑な制作ではJSON構造化Promptを使用し、`subjects.position`、`composition`、`camera.distance`で配置と画角を指定する方法を示している。また、重要事項を先頭へ置き、negative promptではなく望む内容を正方向で記述することを推奨している。

- [FLUX.2 Prompting Guide](https://docs.bfl.ai/guides/prompting_guide_flux2)
- [JSON Structured Prompting](https://docs.bfl.ai/guides/usecases_t2i_json_prompting)
- [Working Without Negative Prompts](https://docs.bfl.ai/guides/prompting_guide_t2i_negative)

## 実装

- 一般向け単一人物の短縮`scene`を中距離portraitへ戻す
- 身体部位の連続列挙を削除する
- `framing`を追加し、次を数値で固定する
  - 被写体高: 72%
  - 髪上端: 上から15%
  - 見えている上着の下端: 上から92%
  - 左右の環境余白: 各12%
- `subjects.position`、`composition`、`camera.distance`、`camera.focus`を同じ中距離・座標契約へ統一する
- 一続きの一枚絵を示す`output_type`／`canvas`、50mm、人物同一性、衣装、画風、背景、参照画像役割を維持する
- Provider拒否後の一般向け安全再実行では、保存済みPR #275以前の短縮JSONも新しい契約へ正規化する

## 不変契約

- URL、公開API、DB、migration、RPC、Storage、Feature Flag
- Provider、model、pricing、credit単価、retry回数、timeout、Scheduler
- target panel、source revision、参照Asset選択、Panel Specification
- Canvas schema、checkpoint、PNG／PDF、作品公開・販売
- 成人向け境界、Desktop

## 回帰テスト

- 初回短縮JSONが数値`framing`と同じposition／composition／cameraを持つ
- JSON全体に`chest`／`waist`を含まない
- 保存済み旧短縮JSONの安全再実行も同じ契約へ変換する
- 人物同一性、参照Asset ID、target panel、camera angle、50mmを維持する
- wide上書きにはクローズアップ契約を適用しない

## 検証

- 集中テスト: 32/32成功
- Hub: 728/728成功
- Canvas: 26/26成功
- AI: 48/48成功
- 100ページ長編: 4/4成功
- dependency／module boundary: 0 error、既存warning 2件
- lint、Hub typecheck: 成功
- migration manifest: 59/59成功
- research eval、Cloud漫画repository受入れ、owner isolation: 成功
- workspace package build、Next Webpack production build: 成功
- RC preflight: repository structure READY。外部secretと手動E2Eは既存どおりPENDING
- GitHub: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功

## ロールバック

本PRの2つのPrompt構築ファイルと2つのテストだけをrevertする。DB、migration、Storage、Canvas、既存作品の復元は不要。

## 停止条件

Draft PRとCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsの成功を確認して停止する。責任者merge前にProductionで追加生成しない。

merge後は同じ対象コマを1案だけ再制作する。初回がProvider moderation拒否の場合だけ一般向け安全再実行を1回許可し、それ以上は停止する。生成できた場合は、髪上端、両目、人物全体の中距離、左右背景余白、一続きの画面、疑似文字なしを目視し、合格前は候補を配置・採用しない。
