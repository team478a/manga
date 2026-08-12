# PR-R4-1w FLUX単一コマProduction受入れ

## 結論

PR #240のmerge commit `d0091a047e15877bb3049f066a1d8b6f261dc1c6`を含むProductionで、一般向けモニター`test`の未生成コマ1つへFLUX画像を2候補生成した。両候補が単一の全面場面となり、漫画ページ風の複数コマ、コマ枠、吹き出し、文字、疑似文字を含まなかった。PR-R4-1vの正方向Prompt修正は、限定した実Provider受入れに合格した。

候補生成、Scheduler、credit精算、比較、候補1の採用、自動保存、再読込後のレイヤー復元まで完走した。画像生成の単一コマ縦切りは利用可能と判断する。ただし2候補だけの検査であり、人物連続性、複数ページ一括生成、完成PDF／PNGの販売品質までは合格扱いにしない。

## 対象

- Production: `https://app.mang-ai.com`
- 利用者: 一般向けモニター`test`
- 作品: `b008b746-94c6-4e83-85dd-3bb0e379c96a`
- ページ: `d93cb4b1-29f3-482a-a1d8-5c2307d1aa88`（2ページ）
- コマ: 3コマ目
- Production基準: `d0091a0`（PR #240 merge commit）
- Scheduler run: https://github.com/team478a/manga/actions/runs/31647042128

## 実施結果

1. 未生成の3コマ目を選び、完成コマ2候補を登録した。
2. 登録前は残12／使用8／予約0、登録後は残8／使用8／予約4となった。
3. Productionの正規`Cloud AI Worker scheduler`を`feature/manga-canvas-mvp`で1回実行した。
4. Workflowは`status=idle requests=3 processed=2`で成功し、両候補がcompleted 100%となった。
5. 完了後は残8／使用12／予約0となり、成功した2候補の4 creditだけが確定した。
6. 候補1は、腕時計と証拠袋を1画面で描いたモノクロ場面だった。文字、吹き出し、複数コマなし。
7. 候補2も、腕時計と証拠袋を1画面で描いた別構図のモノクロ場面だった。文字、吹き出し、複数コマなし。
8. 候補1を採用し、画面が`保存済み`となることを確認した。
9. Production画面を再読込し、3コマ目に`AI背景レイヤー`が復元され、使用12／予約0を維持することを確認した。

## 合格範囲

- BFL／FLUX実Providerの2候補生成
- 単一コマ全面描画
- 複数コマ、枠、吹き出し、文字、疑似文字なし
- Schedulerのbounded batch完走
- credit予約から確定への遷移
- 候補比較と採用
- 自動保存と再読込後のレイヤー復元

## 未合格・次の課題

- 2候補だけのため、人物の顔・衣装・体格をまたぐ連続性は未評価。
- 現作品は32ページ／多数コマで、FREEプラン残8 creditでは未生成コマ全体の2候補生成を完走できない。
- 4〜8ページ一括生成、部分失敗からの再実行、pause／cancelは今回未実施。
- 8ページの完成原稿preflight、checkpoint、PDF／PNG目視一致は今回未実施。
- 一般ユーザー所有の生成成果物と`cloud-exports`署名付きURLの2利用者分離、Stripe test E2Eは別受入れとして残る。

次は追加の有料生成を先行せず、長編漫画を販売品質まで成立させるためのcredit／候補数／段階生成の運用条件を監査し、4〜8ページ受入れの対象範囲と必要creditを確定する。Provider、model、pricingを無断変更しない。

## 変更範囲

本PRはProduction受入れ証跡と進行台帳だけを変更する。application code、DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktopは変更しない。

## 検証

- PR #240: merged
- Production Scheduler: success、`idle requests=3 processed=2`
- Production候補: completed 2/2
- 品質: 単一場面・文字なし 2/2
- credit: 残8／使用12／予約0
- 採用、自動保存、再読込後の`AI背景レイヤー`: success
- repository: 文書差分だけ、`git diff --check`を実行する

## ロールバック

本PRは文書限定のためapplication rollbackは不要。Productionで採用した候補1は通常の利用者操作で作成された作品データとして保持し、削除しない。証跡訂正が必要な場合は本PRの文書commitだけをrevertする。

## 停止条件

Draft PRのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsが成功した時点で責任者判断待ちとして停止する。責任者確認前に長編credit条件の実装や4〜8ページ有料一括生成へ進まない。
