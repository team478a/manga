# MANGAI Cloud 作品管理 Release計画

作成日: 2026-07-29
対象Release: Release 5
対象ブランチ: `codex/cloud-work-management-mvp`

## 1. 目的

マンガ下書きとして作成された一般向けCloud Projectを、公開・販売へ渡す前に、作品単位で整理・確認・承認できるようにする。

## 2. 実装範囲

1. Cloud Projectの作品管理一覧
2. Project情報、表紙、Episode、Page、Revisionの確認
3. Page単位の確認済み記録
4. 公開前チェックリスト
5. `draft`、`review_ready`、`approved`の状態管理
6. Project更新時の承認失効
7. Release 6「販売準備」への条件付き導線
8. 所有者RLS、revision競合、一般向け境界

## 3. 今回変更しない範囲

- 作品の一般公開
- Marketplace作品・商品の作成
- PDF・表紙画像のexport
- Stripe、購入、収益集計
- Canvas Editor本体
- Cloud AI Queue／Worker／Provider Gateway
- Desktop、成人向け製品境界

## 4. 完了条件

- 所有者がProject一覧から作品管理詳細を開ける
- 全Pageを現行revisionで確認済みにできる
- タイトル、説明、表紙、有効Page、Canvas保存、実行中Jobなしを検査できる
- 条件不足では公開前確認済みへ進めない
- 公開前確認済みからだけ販売準備承認へ進める
- Project revision更新後は承認が`draft`へ戻る
- 別利用者は状態・Page確認を参照、更新できない
- lint、typecheck、Hub test、migration往復、production build、CIが成功する

## 5. 公開前ゲート

Release 1〜4の外部E2E待ちは解除しない。Release 5もstacked Draft PRとして進め、対象Supabase適用、Feature Flag、実ブラウザE2E、責任者承認が揃うまでmergeしない。
