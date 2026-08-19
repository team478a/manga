# Provider拒否後の構図情報再混入修正 Release Candidate

## 結論

PR #314のProduction反映後、再読込loopは停止し、対象22ページのコマ1は実画像の生成・品質確認・採用・保存に成功した。一方、コマ2は通常候補と最初の一般向け安全再構成の双方がBFLのpoll段階で`request_moderated`となった。

通信、API key、Worker、DB、Storage、credit予約、Provider submitの障害ではない。最初の安全再構成に元の場面構図が残る経路を修正対象とする。

## Production証跡

- 対象: `test`の既存22ページ
- PR #314反映確認: 再読込loop停止、ブラウザerror／warning 0
- 開始状態: Canvas revision 9、画像2/4、PNG成功、残りcredit 24
- コマ1: 2候補登録、完成1・失敗1。完成候補を目視品質確認し、品質承認後に採用
- 保存結果: Canvas revision 10、画像3/4、PNG成功
- コマ2: 2候補とも終端失敗。失敗Jobから最初の一般向け安全再構成を1回実行したが終端失敗
- Vercel診断: 3件ともBFL `flux-2-pro`、stage `poll`、outcome `request_moderated`
- 最終credit: 使用78、予約0、残り22
- 最終状態: コマ2未配置、ページ未完成。追加Provider実行を停止

Prompt本文、画像、Provider応答本文、Provider Job ID、API key、署名付きURLは本書へ記録していない。

## 原因

既存の最初の一般向け安全再構成は、動作、感情、演出、追加指定と一部Provider契約を置換していた。しかし次の情報は元の物語表現を保持し得た。

- 短縮Provider契約の`layout`
- 詳細Promptの場所
- 詳細Promptの背景
- 詳細Promptの人物と背景の配置
- 詳細Promptの構図／構図調整

そのため、安全再構成後もProvider拒否要因を再送する可能性があった。

## 修正

- 短縮Provider契約の`layout`を既存の一般向けmoderationと危険表現検査へ通す
- 安全なlayoutは維持する
- 危険なlayoutだけを、人物と背景の相対配置を維持する安全なfallbackへ置換する
- 詳細Promptの場所・背景・構図も同じ基準で検査し、危険な場合だけ穏やかな一般向け表現へ置換する
- 人物同一性、参照画像ID、画風、対象コマ、出力設定は維持する

## 回帰テスト

- 最初の安全再構成で危険なProvider `layout`を再送しない
- 最初の安全再構成で危険な場所・背景・構図を再送しない
- 安全化後のPromptはローカル一般向けmoderationを通過する
- 人物設定、参照画像、画風、target panel契約を維持する
- 二重変換せず、第2段階の保守的再構成契約も維持する

## 品質ゲート

- 集中テスト: 10/10 成功
- dependency／module boundary: error 0、既存warning 2件
- lint: 成功
- Hub／Desktop typecheck: 成功
- Hub test: 823/823 成功
- Canvas test: 26/26 成功
- AI test: 48/48 成功
- Desktop test: 182/182 成功
- Desktop a11y: violation 0
- Supabase migration validation: 61件成功
- research eval: 成功
- Cloud漫画repository受入れ: 成功
- Hub build: 成功
- Desktop build: 成功
- RC preflight: structure ready。外部設定Pendingは既存ローカル環境依存
- `git diff --check`: 成功

## 不変契約

API、URL、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry回数、timeout、Scheduler、Canvas schema、PNG／PDF、成人向け境界、Desktop製品コードは変更しない。

## 停止条件と次の受入れ

Draft PRとCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsの成功を確認して停止する。merge前にProductionのProvider再実行を行わない。

- Draft PR: [#315](https://github.com/team478a/manga/pull/315)（Draft／MERGEABLE）
- 初回HEAD: `0eb4221bc16d9ef8d172cef86ce64a7e8b471876`
- Core quality: 成功
- Migration roundtrip: 成功
- Windows build: 成功
- Vercel: 成功
- Vercel Preview Comments: 成功
- Preview: [Ready](https://mangai-hub-staging-i5v3lf5yw-team478as-projects.vercel.app)
- Preview `/login`: 正常表示、ブラウザログ0件

merge後は、対象コマ2の失敗Jobに対する安全再構成を1回だけ実行する。完成した場合は画像品質、不要文字、向き、人体、採用、Canvas保存、PNGを確認する。再度Providerに拒否された場合は追加課金再試行を止め、Provider別の入力最小化または別モデル選定を次PRとして判断する。

## merge後Production受入れ

- PR #315 merge commit: `09a3bfddc476d5a37f8821f2ec6cc767f531d9a3`
- Production deployment: Ready
- 開始状態: revision 10、画像3/4、セリフ1/1、生成中0、失敗1、PNG成功、使用78・予約0・残り22 credit
- 対象: 修正前に作成されたコマ2の元失敗Job 1件。既に安全再構成済みの失敗Jobは選んでいない
- Worker: [run 32313830268](https://github.com/team478a/manga/actions/runs/32313830268)、`mode=run`、成功
- Provider結果: BFL `flux-2-pro`で完成。`request_moderated`再発なし
- 目視品質: 正立、疑似文字・読めない文字・吹き出し・ロゴなし、顔・手指・関節・小物接触に目立つ破綻なし、登場人物と構図が一場面として成立
- 採用: 販売原稿チェック4項目を確認し、品質承認後にコマ2へ配置
- 保存結果: revision 11、画像4/4、セリフ1/1、生成中0、失敗0、PNG成功
- Preview: 4コマすべての画像表示を確認
- Browser logs: 0件
- 最終credit: 使用80、予約0、残り20

先行の[run 32313790385](https://github.com/team478a/manga/actions/runs/32313790385)はworkflow dispatchの既定`mode=check`による設定確認だけで、Provider通信・Job処理・credit変更はない。

Provider拒否の阻害は解消した。ただしページ一覧が22ページを「完成・画像配置4/4」とする一方、編集画面の完成バナーは「手動確認待ち／自動配置結果に確認が必要」を残している。画像品質確認、Canvas保存、PNG出力は成立しているため、追加Provider実行はせず、adoption、dialogue placement、production statusのどれが残存sourceかを次工程でread-only監査する。

## Production証跡同期PR

- Draft PR: [#316](https://github.com/team478a/manga/pull/316)（Draft／MERGEABLE）
- 初回HEAD: `9f70280bd6ecb8351a5c3c2263ea2f5c4560464c`
- Core quality: 成功
- Migration roundtrip: 成功
- Windows build: 成功
- Vercel: 成功
- Vercel Preview Comments: 成功
- Preview: [Ready](https://mangai-hub-staging-2hg5soz33-team478as-projects.vercel.app)
- Preview `/login`: タイトル、メール、パスワード、ログイン導線を確認。ブラウザログ0件

最終証跡同期HEADでも同じ5チェックを確認して停止する。責任者確認前に追加Provider実行や残存statusの推測修正を行わない。
