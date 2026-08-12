# PR-R4-1v FLUX単一コマ正方向Prompt

## 結論

PR #239のmerge後、Productionの一般向けモニター`test`で未生成コマ1つへ2候補を生成した。両候補の完了、credit確定、比較、採用、自動保存、再読込後の復元まで成功し、PR-R4-1uのtimeout／Scheduler阻害は解消した。

ただし、候補1は単一コマ・文字なしで採用可能、候補2は漫画ページ風の複数コマと吹き出し／疑似文字を含み、画像品質受入れは2件中1件だけの合格だった。Black Forest Labs公式仕様ではFLUX.2はnegative promptをサポートせず、避けたい語をPromptへ含めると逆に誘発し得る。現在のadapterは共通`negativePrompt`を`Avoid:`として正のPrompt末尾へ連結しており、漫画ページ、複数コマ、吹き出し、文字などをProviderへ明示していた。

本PRはBFLへ送るPromptを正方向の単一コマ描写だけにする。Provider、model、pricing、credit、retry、timeout、Scheduler、DB、Storageなどの外部契約は変更しない。

## Production受入れ結果

- 対象作品: `b008b746-94c6-4e83-85dd-3bb0e379c96a`
- 対象ページ: `d93cb4b1-29f3-482a-a1d8-5c2307d1aa88`のコマ2
- 2候補登録後: 残12／使用4／予約4
- Scheduler 1回目: `retrying requests=1 processed=1`。旧120秒を超えて正常継続した。
- Scheduler 2回目: `idle requests=3 processed=2`。両候補が100% completedとなった。
- 完了後: 残12／使用8／予約0。成功分だけ4 creditが確定した。
- 候補1: 1画面のモノクロ場面、文字なし。採用可能。
- 候補2: 複数コマ、吹き出し、疑似文字を含む。品質不合格。
- 候補1を採用し、画面の`保存済み`、再読込後の`AI背景レイヤー`、SVG内Storage pathと採用候補pathの一致を確認した。

## 原因

- 共通の`negativePrompt`は他Providerとの契約互換のため保持されている。
- BFL adapterが`prompt + "Avoid: " + negativePrompt`をFLUX.2へ送っていた。
- FLUX.2はnegative prompt非対応で、否定語を入力すると避けたい対象を描く方向へ誘導され得る。
- PR-R4-1rで追加した強い禁止語列が、BFLに対しては逆効果となった。

参考:

- https://docs.bfl.ai/guides/prompting_guide_flux2
- https://docs.bfl.ai/guides/prompting_guide_t2i_negative

## 修正

- BFL adapterは`input.prompt`だけを送信し、`negativePrompt`をProvider本文へ連結しない。
- 漫画コマPromptを「単一の連続した全面場面」「1つのcamera viewとmoment」「文字のない絵」として正方向に記述する。
- 背景、人物、効果の各target directionも禁止文ではなく、必要な余白、白背景、素材の形を正方向に記述する。
- 共通`negativePrompt`のschemaと生成は維持し、他Provider、保存済みJob、監査境界への互換性を保つ。

## 安全境界

- Black Forest Labsと既存FLUX modelを維持する。
- pricing version、credit単価、費用上限、retry回数、timeout、Scheduler頻度を変更しない。
- API key保存、DB、migration、RPC、Storage bucket／path、API、URL、Feature Flagを変更しない。
- Canvas schema、PDF／PNG、成人向け境界、Desktop codeを変更しない。
- Prompt、画像、API key、Provider response、利用者情報をログへ追加しない。

## 検証

- Prompt／BFL adapter集中: 29/29
- Hub: 645/645
- Canvas: 26/26
- AI: 48/48
- Supabase migration: 52/52
- deps、lint、Hub／Desktop typecheck: 成功
- Desktop production build: 成功
- Hub production build: 同一commitを短い物理worktreeで成功
- RC preflight: repository structure ready。ローカル外部設定は従来どおりpending
- git diff check: 成功

Desktop統合／a11yはローカルでElectron終了待ちとなり、結果出力前に外側timeoutで停止した。Desktop codeに差分はないため、Windows CIを最終判定にする。

## マージ後のProduction受入れ

1. 一般向けモニター`test`の同じ作品で、未生成コマ1つだけを選ぶ。
2. 2候補だけ生成し、両候補のcompletedとreserved credit 0を確認する。
3. 両候補が単一の全面場面で、複数コマ、枠線、吹き出し、文字、疑似文字を含まないことを目視確認する。
4. 1候補を採用し、自動保存、再読込、Storage asset pathの一致を確認する。
5. 2候補とも合格するまで、8ページ一括生成や長編完成原稿へ進まない。

## ロールバック

実装commitをrevertするとBFL adapterの従来`Avoid:`連結へ戻る。DB、migration、RPC、Storage data、Canvas dataの巻き戻しは不要。

## 停止条件

Draft PRのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsが成功した時点で責任者判断待ちとして停止する。マージ前に追加の有料画像Jobを実行せず、責任者確認前に次の漫画生成工程へ進まない。
