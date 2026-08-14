# PR-R4-2B 構造化セリフ自動配置

## 目的

画像生成Job完了ではなく、採用Storyboardのセリフが正しいページ・コマ・吹き出しへ永続配置された状態を作る。今回のPRはセリフ・ナレーション配置だけを扱い、ページ完成判定と4ページ原稿プレビューはPR-R4-2Cへ残す。

## 正本と対応

- 本文は`cloud_story_storyboard_versions.result.pages[].panels[].dialogue[]`から取得する。
- `cloud_pages.page_number`とStoryboardの`pageNumber`を一致させる。
- Storyboard panel配列順と`PageCanvas.panels`配列順を一致させる。
- コマ内の既存吹き出しは中心座標で判定し、上から下、同じ段は右から左の順に使う。
- runtimeで自由文章やProvider出力からセリフを推測しない。

## 配置と保護

- speech、thought、narrationを優先し、それぞれ既存のellipse、rounded、narration boxへ対応させる。
- 既存の空吹き出しを再利用し、不足時だけ対象コマ内へ新規作成する。
- `textObjects.parentBalloonId`を必須関連として保存する。
- 縦書き、改行保持、42pxから18pxまで2px刻みの自動fitを行う。
- 18pxでも収まらない、panel／balloon／textがlocked、別の手動本文がある、親なし本文がある、page finalizedの場合は上書きせずblockerにする。空かつ未固定の既存textObjectは再利用する。
- exact同一本文は配置済みno-opとし、再処理で重複させない。
- sound effectの高度配置は今回行わず、対応不能としてblockerにする。

## 永続化と実行順

1. 画像Jobを完了する。
2. PR-R4-2Aで対象画像をCanvasへ採用する。
3. 同じbatch／pageの全targetが`auto_placed`か確認する。
4. 採用Storyboardと最新Canvasを読み込む。
5. 純粋domainでballoons／textObjectsだけを更新する。
6. service-role RPCがpage rowをlockし、revision、finalized、全画像ready、owner、Storyboardを再確認する。
7. snapshot、page revision、project revision、version event、配置台帳を単一transactionで保存する。

画像途中ではセリフ配置を記録せず、page revisionも進めない。Worker中断分は次回runで1ページずつ回収する。

## 外部契約

変更しないものはURL、公開API、既存RPC、Storage、Feature Flag、Provider、model、pricing、credit、生成retry／timeout、Scheduler頻度、Canvas schema、PDF／PNG、成人向け境界、Desktopである。新規RPCはservice roleだけに許可する。本文、Prompt、画像、秘密値は台帳・manifest・logへ記録しない。

## 回帰テスト

- ページ／コマ対応、空吹き出し再利用、吹き出し不足時のコマ内生成
- speech／thought／narration型、縦書き、改行、font fit、最小font blocker
- exact再処理no-op、手動本文・親なし本文・locked・finalized保護
- 全画像ready前のno-op、文章生成Job非依存、Worker順序と中断回収
- owner RLS、service-role限定、revision transaction、非テキストCanvas不変
- migration forward／rollback／reapply

## Rollback

1. Workerを停止し、新しいdialogue placement処理を呼ばない版へ戻す。
2. `supabase/rollbacks/202608140003_cloud_page_dialogue_placements.sql`を適用し、新規RPCと台帳を削除する。
3. 自動配置で作成済みのsnapshotは履歴として保持する。必要なら既存checkpoint復元またはCanvas revision履歴から責任者が明示的に戻す。
4. PR-R4-2Aの画像Asset／panelLayer、Provider Job、credit、既存手動本文は削除しない。

## 停止条件

Draft PRの全CIとVercel Previewを確認した時点で停止する。Production migration適用と4ページ実Provider受入れは責任者判断後に行い、成功を確認するまでProduction受入れ済みとは扱わない。PR-R4-2Cへは責任者確認前に進まない。
