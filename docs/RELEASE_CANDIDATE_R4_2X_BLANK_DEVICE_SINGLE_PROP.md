# PR-R4-2X 端末無記名・小物単一化契約

作成日: 2026-08-16
Branch: `codex/accept-r4-2x-page22-quality-gate`
Base: `origin/feature/manga-canvas-mvp` @ `e844143`（PR #280 merge commit）
Draft PR: [#281](https://github.com/team478a/manga/pull/281)

## 目的

PR #280の採用品質ゲートをProductionのページ22へ適用し、再制作画像の採否を確認する。確認で再現した端末画面の疑似文字と端末の重複を、外部契約を変えずにProvider向けの正方向生成契約で抑止する。

## Production受入れ結果

- 対象は`test`モニターのページ22。開始時はCanvas revision 7、使用56／予約0／残44だった。
- コマ1を2案生成した。公式Worker [31914291083](https://github.com/team478a/manga/actions/runs/31914291083)は成功したが、端末画面の疑似文字、顔・口元の生成文字があり、2案とも追加生成なしで不採用とした。
- コマ3を2案生成した。公式Worker [31914514888](https://github.com/team478a/manga/actions/runs/31914514888)は成功し、正立、無記名面、人体、小物、物語構図の4項目を満たす1案を品質確認・配置した。Canvas revisionは7から8へ進み、保存とPNG成功を確認した。もう1案は追加生成なしで不採用とした。
- コマ1を上半身・目線の高さ・中央配置で2案だけ再試行した。公式Worker [31914739580](https://github.com/team478a/manga/actions/runs/31914739580)は成功し、1 Jobは生成失敗、1案は正立したが端末が重複し、端末画面にも生成文字が残ったため不採用とした。
- 最終Creditは使用64／予約0／残36。保留Jobと予約残はない。公開・販売状態は変更していない。
- 完成判定はコマ1、コマ2、コマ4の目視確認、未配置生成画像2件、自動配置確認が残り、ページ全体は未完成。コマ3は完成判定の目視確認対象から外れた。

## 原因境界

- R4-2Wの短縮Promptは正立、自然な重力、人体、清潔な描画面を要求するが、端末表示を無記名の反射面にする条件と、小物の個数を一つに固定する条件は明示していなかった。
- 長文Promptにも平面を無地の素材面にする一般条件はあるが、端末displayと小物の重複を直接制約していなかった。
- Production証跡では、構図調整後も端末画面の疑似文字と端末の重複が同時に再現した。追加の課金生成で探索せず、Prompt契約の最小修正を先に行う。
- Prompt本文、Provider応答、署名URL、利用者画像、API keyは文書へ記録しない。

## 実装

1. 短縮Provider JSONの`quality_gate`へ、各小物を一つにすることと端末画面を無記名にすることを追加する。既存の2,000文字未満を維持する。
2. 長文Promptへ、端末displayを反射と光だけの無記名ガラス面にする正方向条件を追加する。
3. 長文Promptへ、必要な各小物をネーム指定位置に一つだけ置く正方向条件を追加する。
4. 短縮・長文の両経路を回帰テストで固定する。

## 回帰境界

- 変更なし: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- 生成対象、候補数、Providerへの参照画像、課金契約、保存契約は変更しない。
- 本PR中は追加のProduction Provider生成を行わない。merge後にコマ1だけを必要最小限で再制作する。
- コマ3の採用済み画像とCanvas revision 8を維持する。

## 検証

- 集中31/31、Hub 735/735、Canvas 26/26、AI 48/48、100ページ長編4/4が成功した。
- dependency／module boundary、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository、owner isolation、workspace packages、Webpack production build、RC structure、diff checkが成功した。
- Desktopローカルtypecheckは既存の`@napi-rs/keyring`型宣言不足で停止した。変更範囲外のためWindows CIを正式判定にする。
- Draft PR [#281](https://github.com/team478a/manga/pull/281)を作成した。Draft／MERGEABLE。CIとVercel Previewは実行中。

## 停止条件

- Draft PRを作成し、Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsを確認する。
- Production変更が上記受入れ結果以外にないこと、予約Creditが0であることを確認する。
- 責任者のmerge前にコマ1の追加Production生成と次工程へ進まない。
