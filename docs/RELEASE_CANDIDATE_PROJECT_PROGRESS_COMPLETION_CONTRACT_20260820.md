# 生成進捗と販売原稿完成の表示契約 Release Candidate

作成日: 2026-08-20
Base: PR #322 merge commit `176facb48568809b4bf5461247de498942dfc84a`
Branch: `codex/fix-r4-3-project-progress-completion-contract`

## Production read-only監査

- 作品: `灰の証言者 第1話「燃え跡の罠」｜32P・8P並列制作連続性設計`
- 作品画面の生成進捗: 完成2/32ページ
- 完成原稿プレビュー: 完成1/32ページ（3%）、生成中0、未完成30、確認待ち1
- 画像配置: 13/157コマ
- 原稿チェック要修正: 276件
- 確認推奨: 0件
- credit: 使用80、予約0、残り20

Productionへの書込み、Provider実行、追加Job、追加credit消費は行っていない。

## 契約不整合

作品画面の生成進捗は、全ての表示対象コマに画像Assetがあれば`complete`としていた。一方、正式な販売原稿完成は次を検査する。

- 必須画像とAsset availability
- 必須セリフと吹き出し配置
- 生成画像の品質確認
- 保存revisionと最新revisionの一致
- PNG生成成功
- ページ制作状態

したがって、生成進捗の`complete`は販売原稿完成を意味しない。

## 修正

- 内部状態名を`complete`から`images_ready`へ変更する。
- 画面表示を「完成」から「画像配置完了」へ変更する。
- 集計表示を「画像配置完了 N/32ページ」とする。
- 正式な完成判定は原稿プレビューで確認する案内を追加する。
- 作品画面で重い全ページPNG完成判定を重複実行しない。

## 目視品質監査

### 20ページ

- 画像4/4、セリフ2/2、revision 4、PNG成功
- 4コマ全てが画像品質の目視確認待ち
- 短い縦書き1件の安全修復候補あり
- 完成原稿プレビューでは未完成

### 22ページ

- 正式完成判定は完了
- 画像4/4、セリフ1/1、revision 11、PNG成功
- 出力画像では吹き出し内セリフが実用サイズで読めない
- 下段2コマの人物構図が重複している
- 場面・衣装・人物の連続性に販売前確認が必要

技術的完成と販売可能品質は同義ではない。次PRではセリフ出力の可読性を先に扱い、人物連続性と残りコマ生成は分離する。

## 不変契約

Production、DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF生成処理、成人向け境界、Desktop製品コードは変更しない。

## 検証

- 集中テスト: 6/6
- dependency boundary: error 0（既存warning 2件）
- lint: 成功
- typecheck: 成功
- Hub test: 全件成功
- Canvas test: 26/26
- AI test: 48/48
- Desktop test: 182/182
- Desktop accessibility: violation 0
- Supabase migration検証: 61件成功
- Hub build: 成功
- Desktop build: 成功
- RC preflight: repository structure ready（外部設定は既存ローカル環境依存でPending）
- `git diff --check`: 成功
