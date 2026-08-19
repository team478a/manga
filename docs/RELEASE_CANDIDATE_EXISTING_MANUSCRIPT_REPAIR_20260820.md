# MANGAI Existing Manuscript Repair Release Candidate

作成日: 2026-08-20
Branch: `codex/fix-r4-3-existing-manuscript-repair`
Base: `feature/manga-canvas-mvp` @ `54d621ddb06c58e5753842e54afd6698ee171917`

## 目的

PR #312より前に保存された原稿へ残る不採用画像、短い縦書きの複数列化、逆転した背景layer順を、画像の追加生成やcredit消費なしで本人が明示修復できるようにする。

## Production事前確認

- PR #312 merge commitを含むProduction deployment `8tcUkjUEgobU8pTX5UNxbFtsaxYE`がReadyかつ`app.mang-ai.com`のCurrentであることを確認した。
- `test`の対象作品22ページを再読込し、不採用画像3件をページ完成blockerが検出することを確認した。
- Canvasには短文`（証拠を）`の縦2列表示と、複数のAI背景layerが残っていた。
- 確認は読取だけで、Production作品、Canvas、画像、Storage、DB、Provider、creditを変更していない。

## 実装契約

1. ページ読込時に既存Canvasを自動変更しない。
2. 「既存原稿を修復」の明示操作だけで次を1回のCanvas historyへ記録する。
   - `quality_review_status=rejected`のJob由来layerを除去する。
   - 6文字以下、改行なし、表示中、未lock、吹き出し関連済みの縦書きだけを1列へ縮小する。
   - 作成日時が有効かつ一意な背景layerだけを古い順から新しい順へ並べ替える。
3. 本文、座標、領域、吹き出し、Canvas schemaは変更しない。
4. 日時欠損・同値の背景stackは推測で変更しない。
5. 新規背景候補は旧背景より前面、人物・小物・効果・補正より背面に採用する。
6. 操作は既存Undoとautosaveを使用し、Provider APIを呼ばない。

## 回帰検査

- 集中: 60/60
- dependency/module boundary: error 0、既存warning 2
- lint: 成功
- Hub/Desktop typecheck: 成功
- Hub: 820/820
- Canvas: 26/26
- AI: 48/48
- Desktop: 182/182
- Desktop accessibility: violation 0
- Supabase migration validation: 61件
- Hub build: 成功
- Desktop build: 成功（既知のbundle size warningのみ）
- RC preflight: Repository structure READY。外部設定と手動E2EのPendingは既存ローカル環境依存
- `git diff --check`: 成功

## 不変範囲

DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF処理、成人向け境界、Desktop製品コードを変更しない。

## Preview受入れ

Draft PR作成後に記録する。PreviewがProduction DBを参照するため、対象ページでは修復候補数、ボタン表示、console errorなしだけを確認し、修復ボタンを押さない。

## Rollback

本PRをrevertする。schemaやDB変更がないためmigration rollbackは不要。merge後に利用者が修復保存したCanvasは通常のCanvas revision／checkpoint契約で復元し、DBを手作業で書き換えない。

## 停止条件

Draft PR、全CI、Vercel Previewの確認後に停止する。責任者確認前にmergeせず、Productionの対象ページを修復しない。
