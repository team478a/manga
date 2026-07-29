# MANGAI Cloud 販売準備 Release計画

作成日: 2026-07-29
対象Release: Release 6
対象ブランチ: `codex/cloud-sales-preparation-mvp`

## 1. 目的

Release 5で承認した一般向けCloud Projectから販売用PDFと表紙を生成し、既存Marketplaceの非公開作品・停止中商品へ安全に同期する。

## 2. 実装範囲

1. 承認済みProjectの販売準備一覧
2. Project revision、承認、既存作品・商品の差分確認
3. 販売価格の入力
4. 販売用PDF・表紙の生成
5. 非公開作品・停止中商品の冪等同期
6. 同期revisionと作品・商品IDの記録
7. 商品・作品編集画面への導線
8. 所有者RLS、revision競合、一般向け境界

## 3. 今回変更しない範囲

- 作品の自動公開
- 商品の自動販売開始
- Stripe Checkout・Webhook
- 売上集計
- Canvas Editor本体
- Cloud AI Queue／Worker／Provider Gateway
- Desktop、成人向け製品境界

## 4. 完了条件

- Release 5承認済みの現行revisionだけが販売準備へ進める
- PDF・表紙を生成して非公開作品・停止中商品を1組だけ作成できる
- 再同期では同じ作品・商品を更新し、重複を作らない
- 公開中作品・販売中商品を上書きしない
- Project更新で以前の同期を古い状態として表示する
- 別利用者と成人向けProjectは参照・同期できない
- lint、typecheck、Hub test、migration往復、production build、CIが成功する

## 5. 公開前ゲート

Release 1〜5の外部E2E待ちは解除しない。Release 6もstacked Draft PRとして進め、対象Supabase適用、Feature Flag、実ブラウザE2E、責任者承認が揃うまでmergeしない。
