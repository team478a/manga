# PR-R4-1aa-1 長編一括生成ビジュアル準備ゲート

- Draft PR: [#247](https://github.com/team478a/manga/pull/247)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-ff0747-team478as-projects.vercel.app

## 結論

Productionの一般向けモニター`test`で4ページ一括生成を開始する前に、採用ネームで必要な主要人物の外見設定と作品画風が未設定であることを確認した。現行Promptは未設定項目を自然補完するため、この状態で16コマを生成すると人物、衣装、線、陰影、背景密度がページ間で不安定になる可能性が高い。

本PRでは有料の長編一括生成だけにビジュアル準備ゲートを追加する。設定が不足する場合はProvider Jobやbatch targetを作成せず、設定画面への導線と不足人物名を表示する。単一コマ生成の外部挙動は変更しない。

## Production監査

- 対象: 一般向けモニター`test`
- 作品: `b008b746-94c6-4e83-85dd-3bb0e379c96a`
- 一括生成候補: 19〜22ページ、4ページ、16コマ、1候補／コマ
- 必要credit: 32、現在残り8、最大予約費用$0.48
- 対象主要人物: `城戸真琴`、`榊圭吾`、`城戸湊`
- キャラクター設定: 0件
- 作品画風: 未設定
- 参考画像: 0件
- 連続性台帳: 事実0件、伏線0件
- 既存採用画像: 3件、review済み3件、issue 0件
- 生成前バックアップ: `作業バックアップ・32ページ・2026/8/13 4:22:55`
- 実Provider Job、batch target、credit消費: 追加なし

## 判定条件

採用scenarioに定義され、選択ページの採用storyboardに登場する人物だけを対象とする。群衆などscenarioに定義されない一般名は一括生成を阻害しない。

主要人物は、現行versionに以下がすべて存在する場合だけ設定済みと判定する。

- 年齢感
- 体格
- 髪
- 衣装
- 1件以上の固定特徴

作品画風は、現行versionに以下がすべて存在する場合だけ設定済みと判定する。

- 画風
- 線
- 陰影
- 背景密度
- 構図ルール

色指定と追加Promptは任意とする。準備状態、採用storyboard、scenarioを読めない場合はfail-closedで開始を拒否する。

## 実装

- domain preflightが選択ページの必須人物、不足人物、画風設定状況を合算する。
- application serviceが採用storyboard／scenarioと人物・画風の現行versionを読み、準備状態をdomainへ渡す。
- 長編一括生成画面が設定数、不足人物名、画風・人物設定へのリンクを表示する。
- 既存Server Actionは同じpreflight結果を再確認するため、画面を迂回してもbatch登録前に拒否する。

## 不変条件

DB、migration、RPC、Storage、公開API、URL、Feature Flag、Provider、model、pricing、credit単価、retry、timeout、Scheduler頻度／上限、Canvas schema、PDF／PNG、成人向け境界、Desktopは変更しない。

## 検証

- 集中・関連テスト: 29/29成功
- Hub test: 657/657成功
- Canvas test: 26/26成功
- AI test: 48/48成功
- Desktop test: 成功
- Desktop accessibility: violations 0
- dependency check、lint、Hub／全体typecheck: 成功
- migration validation: 54/54成功
- Hub production build: 短い物理worktreeで成功
- Desktop build、RC repository structure、`git diff --check`: 成功
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments: 成功
- PR状態: Draft、MERGEABLE

元worktreeのHub buildだけはWindows長path上限で失敗した。短縮worktreeで依存関係を実体インストールし、同一commitのNext.js production build、TypeScript、21 static pagesを完走した。ジャンクションを使った初回短縮試行はTurbopackがworkspace外symlinkを拒否したため、検証結果には採用していない。

## merge後のProduction受入れ

1. 管理者が`test`へ既存Trialを30日付与し、Cloud AI残りcreditが32以上であることを確認する。
2. 作品画風を保存する。
3. `城戸真琴`、`榊圭吾`、`城戸湊`の外見・衣装・固定特徴を保存する。
4. 一括生成preflightのビジュアルblockerとcredit blockerが0であることを確認する。
5. 19〜22ページの4ページ／16コマを1回だけ生成し、人物同一性、衣装、構図、ページ間連続性、保存復元、credit精算を検証する。

この受入れに合格するまで、8ページ完成原稿／販売品質受入れへ進まない。
