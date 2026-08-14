# PR-R4-2F Provider生成コマの再制作品質

## 目的

PR #262反映後のProduction限定受入れで再現した、人体と小物の融合、画像内の疑似文字、不自然な非正立人物を、外部契約を変えずに抑制する。販売品質へ届かない生成物を安全に却下し、同じ失敗Jobから重複課金を起こさず対象コマだけ再制作できるようにする。

## Production受入れ結果

- 対象: 一般モニター`test`の既存作品、22ページ。
- PR #262 merge commit: `9fbf2281636f2582e9aca528fa0dcafb9a47f464`。
- 品質確認済みの正常画像1件だけを承認し、上下反転／小物融合の2画像を却下して各1回だけ再制作した。
- 1回目はProvider処理失敗で終了し、予約creditは全解放された。同じ2件だけをUIの既存retry契約で各1回再実行した。
- Worker run [31802403441](https://github.com/team478a/manga/actions/runs/31802403441) は`status=idle requests=3 processed=2`で成功した。
- creditは実行前`使用28／予約4／残り68`、完了後`使用32／予約0／残り68`。重複Job登録と予約残りはない。
- 新しい2画像はどちらもProvider生成完了したが、1枚目は人物の不自然な吊り下がりとバッグ上の疑似記号、2枚目は胸部へ端末が融合し画面内疑似文字が残った。
- 2画像は`手動確認待ち`のまま配置・承認していない。Production DB、migration、公開作品、販売状態は変更していない。
- 追加の有料再実行は停止した。

## 原因

1. BFL FLUX.2はnegative prompt非対応で、共通禁止語はProviderへ送信していない。現行の正方向Promptは単一場面・正立・無記名を要求していたが、平面上の非記号化、小物と人体／衣服の物理的分離、非正立動作の例外条件が不足していた。
2. 品質却下後の再制作は同じ`candidateCount=1`条件を再送し、前候補と異なる品質修正条件を追加していなかった。
3. 承認済み画像には品質確認の取消し導線がなく、未配置の手動確認候補には却下して再制作する導線がなかった。
4. 古いfailed Jobの再実行ボタンは、同じコマの後続Jobが生成中または候補確認待ちでも再度押せた。

## 実装

- 通常の正立動作と、ネームが落下・転倒等を明示する非正立動作を分ける。非正立時も紙面と地平線を正立させ、対象人物だけを重力・関節が読める意図的な姿勢にする。
- 小物の持ち方、手指との接触、衣服との境界、実物らしい大きさ、無地で非記号的な平面を日英の正方向Promptへ追加する。
- 品質却下からの再制作へ、前候補と異なる構図、姿勢・重力、小物接触、無地表面を優先する既存`compositionInstruction`を付与する。
- 未配置候補へ「この候補を使わず作り直す」、承認済み画像へ「品質確認を取り消して作り直す」を追加する。既存owner限定品質ログへ`rejected`を記録してから1案だけ登録する。
- 同じコマにqueued／running Jobまたは未解決の完成候補がある間、古いfailed Jobや旧画像からの重複再制作を無効化する。

## 不変契約

- URL、公開API、DB、migration、RPC、Storage、Feature Flag。
- Provider、model、pricing、credit単価、retry回数、timeout、Scheduler頻度。
- Canvas schema、保存revision、PNG／PDF形式、checkpoint、公開・販売guard。
- 成人向け境界、Desktop。
- Prompt、画像、Provider応答、秘密値をClient responseまたはlogへ追加しない。

## ローカル検証

- 集中テスト: 41/41成功（Prompt、非正立判定、通常の「落ち着く」誤判定防止、品質導線、重複登録防止、ページ完成fixture）。
- Hub 714/714、Canvas 26/26、AI 48/48、100ページ長編4/4: 成功。
- `deps:check`、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository受入れ、RC structure、`git diff --check`: 成功。
- Hub production build: 標準Turbopackは既知のWindowsパス長上限で停止。同一sourceの`next build --webpack`は成功。
- Desktop typecheck／test／a11y: 既存`@napi-rs/keyring`型宣言不足でbuild前に停止。Desktop差分はなく、GitHub Windows CIを正式結果とする。

## merge後の限定受入れ

1. Production反映を確認する。
2. 22ページの手動確認待ち2候補を新導線で却下する。既に承認済みだが疑似文字がある1画像も、承認取消し導線で却下する。
3. 3コマを各1案だけ再制作し、追加連打しない。
4. Workerを既存契約で処理し、予約解放、重複Jobなし、候補表示を確認する。
5. 原寸目視で正立／意図した非正立、人体、小物接触、疑似文字、人物連続性を確認する。合格画像だけ配置・承認する。
6. ページ完成判定、原稿preview、PNG、PDF、公開・販売guardを確認する。

実Providerの画質は確率的であり、本PRだけで一度の生成成功を保証しない。限定受入れで再び同系統の失敗が出た場合は追加課金を止め、参照画像・Panel Specification・Provider選定を含む次の設計判断へ切り替える。
