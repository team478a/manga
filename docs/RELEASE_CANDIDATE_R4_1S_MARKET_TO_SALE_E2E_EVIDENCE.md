# PR-R4-1s 市場分析から販売までのProduction E2E監査

## 結論

2026-08-12、Productionの一般向けモニター`test`で、市場分析から採用企画、採用シナリオ、採用ネーム、Cloud Creator原稿、販売下書き、公開一覧、購入画面までを連続確認した。

市場分析から32ページ／157コマのCreator原稿へ引き継ぐ制作経路は動作する。一方、実画像生成の再受入れ、原稿完成、完成PDF、公開、実決済、購入後ダウンロードは合格していない。したがって、現状を「本当に販売できる漫画生成」として合格にはしない。

検証中に作成した販売下書きは作品を非公開、商品を販売停止のまま維持した。一般公開、商品有効化、Stripe決済、購入、利用者データの削除は行っていない。

## 検証環境と安全境界

- 対象: `https://app.mang-ai.com`
- 基準: `feature/manga-canvas-mvp`のPR #236 merge commit `2afae102a16a93aa199db4ad6e8bf2d60f88ade7`
- 利用者: 一般向けモニター`test`
- 実Provider利用: 未生成コマ1つ、画像2候補だけを再受入れした
- 変更したProductionデータ: 画像Job 2件、非公開作品下書き1件、販売停止商品1件、生成PDF登録1件
- 実施しない操作: 作品公開、商品販売中への変更、購入、実決済、既存データ削除、Provider設定変更、credit追加
- 記録しない情報: 作品名、本文、Prompt、Report本文、利用者メール、DB ID、Storage URL、Provider response body

## E2E結果

| 工程 | 結果 | Production確認 |
| --- | --- | --- |
| 市場分析Report | PASS | 保存済みReportを表示でき、結果の必須セクションと次工程への導線を確認した |
| AI企画提案 | PASS | 3案比較runが存在し、1案が選択済みでシナリオ生成へ進めた |
| シナリオ | PASS | 採用済み企画から採用版シナリオを表示し、ネーム生成へ進めた |
| AIネーム | PASS | 採用版32ページを表示し、Creator下書きへの既存引継ぎを確認した |
| Creator原稿構造 | PASS | 32ページ、157コマ、revision 33を再読込後も確認した |
| 実画像生成 | FAIL | 未生成コマで2候補を生成したが、2件とも1%でfailedとなり、採用可能候補を得られなかった |
| credit解放 | PASS | 4 credit予約後、2件失敗により全額解放され、残16／使用4／予約0へ戻った |
| 原稿完成条件 | BLOCKED | 画像配置1/157、完成0/32、確定0/32、必須修正267、完了ガイド0/4 |
| durable PDF | PASS（fail-closed） | 全ページ確定前のPDF生成と完成版checkpointは無効化されていた |
| 販売下書き | FAIL（事前検査不足） | 未完成状態でも販売下書き、生成PDF、500円商品を作成できた |
| 公開一覧 | PASS（安全側） | 作成した非公開作品は一般作品一覧へ表示されなかった |
| 購入画面 | PASS（安全側） | 販売停止商品の直接checkoutは「現在購入できません」、入力と購入ボタン無効だった |
| 公開・実決済・購入後DL | NOT RUN | 未完成原稿を公開・販売せず、実決済も行わなかった |

## 画像生成とSchedulerの検出事項

画像2候補は最終的に両方failedとなった。credit予約は解放されたため二重課金はないが、PR #236で固定した単一コマ／文字なし品質を実画像で再受入れできていない。

SchedulerのProduction手動実行では次を確認した。

- run `31571082831`: success。ただし対象候補はqueuedのまま
- run `31571341056`: failure。1候補がfailed、1候補がqueued
- run `31571577483`: success。ただし残る対象候補はqueuedのまま
- run `31571810651`: failure。残る候補がfailed
- failure表示: `Worker応答の状態を確認できませんでした。`

コード上、`scripts/run-cloud-ai-worker-scheduler.mjs`は`completed`、`canceled`、`resolved`だけを継続可能状態、`idle`、`retrying`、`lease_lost`だけを停止状態として扱う。Workerが正規の終端状態`failed`を返すと未知状態としてworkflow自体を失敗させる。このため、通常のProvider最終失敗がScheduler障害として扱われ、同一run内の後続Job処理を妨げる。

## 販売下書きの重大な事前検査不足

Creator画面は以下の未完成状態でも「販売下書きを作成」を有効にしていた。

- 完了ガイド0/4
- 必須修正267
- 画像配置1/157
- 完成0/32
- 確定0/32

操作すると非公開作品、販売停止商品、生成PDFの登録が成功した。公開とcheckoutは安全側に閉じているが、未完成原稿を販売準備artifactへ変換できるため、販売準備の合格条件として不十分である。

コード監査でも次を確認した。

- `src/app/creator/[projectId]/page.tsx`は原稿完成状態に関係なく販売下書きactionを表示する
- `src/lib/cloud-marketplace.ts`は既存の公開済み作品／販売中商品の上書き防止だけを行い、原稿完成preflightを行わない
- `src/modules/cloud-creator/export/prepare-project-export.ts`はページが1件以上あれば販売用artifactを生成できる

UI無効化だけではServer Action直呼びを防げない。Creator表示、Server Action/application、artifact作成境界の少なくともサーバー側で同じ完成条件を強制する必要がある。

## 販売可能原稿までのcredit不足

現在の実設定では画像2候補で4 creditを予約したため、1候補は2 creditである。Creatorは未生成コマの候補数を最低2件とする。

- 未生成: 156コマ
- 最低候補: 156 × 2 = 312件
- 最低追加credit: 312 × 2 = 624 credit
- 現在の残credit: 16

同じmodel／job type／価格を全コマへ適用する前提では、現在の一般向けモニター枠だけで32ページを完成できない。実際の一括生成では再生成、Inpainting、背景・人物・効果の分離生成も加わり得るため、624は品質再試行を含まない下限である。

## 優先修正案

1. **P0: 販売準備preflightをサーバー側で強制する。** 全ページ確定、current revision一致、pending／running画像Jobなし、必須修正0、durable export可能を満たさない場合は販売下書き作成を拒否する。UIも理由付きで無効化する。
2. **P0: 実画像生成失敗を解消して再受入れする。** PromptやProvider response本文を記録せず、固定stage／分類／HTTP statusで失敗点を特定する。修正後は未生成コマ1つ、2候補だけで単一コマ、文字なし、採用、保存、再読込を確認する。
3. **P1: Schedulerが`failed`を既知の終端状態として扱う。** 正常なJob失敗でworkflow全体を異常終了せず、最大処理件数まで後続Jobへ進む回帰テストを追加する。
4. **P0: 長編のcredit成立条件を決める。** 32ページ／157コマの最低候補生成を可能にするmonitor plan、予算上限、一括生成単位、停止・再開、費用表示を責任者判断する。
5. **P1: まず8ページ完成版で販売E2Eを通す。** 画像生成、全修正解消、全ページ確定、durable PDF、非公開下書き、責任者確認、公開、Stripe test購入、購入履歴、再downloadを順に通し、その後32ページへ拡張する。

## 回帰テスト

- 販売下書きapplication test: 未確定ページ、必須修正、pending／running Job、古いrevisionをそれぞれ拒否する
- 正常系: 完成preflight済み原稿だけが非公開作品／販売停止商品／durable PDFを作れる
- 冪等性: 同じ完成revisionの再同期で重複作品・商品・課金を作らない
- Scheduler test: `failed`を受けても次Jobへ進み、上限またはidleで正常終了する
- checkout test: 非公開作品、販売停止商品、無効ファイルは購入sessionを作らない
- Production受入れ: 8ページ完成版で公開前後、Stripe test購入、購入履歴、署名付き再downloadまで確認する

## ロールバックと停止条件

- 今回はapplication code、DB schema、migration、RPC、Storage設定、API、URL、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG仕様、成人向け境界、Desktopを変更しない。
- 検証用作品は非公開、商品は販売停止のままにする。責任者確認なしに有効化・公開しない。
- 画像Job 2件はfailed、reserved credit 0であり再実行しない。
- PR-R4-1sは監査文書と進行文書だけを変更する。
- 全CIとVercel Preview成功後に停止し、P0修正は別Draft PRで行う。
- P0販売preflight、実画像生成、長編credit成立条件が解消するまで「市場分析から本当に販売できる漫画生成」を完了扱いにしない。
