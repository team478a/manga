# Cloud限定テスト販売ガイド Release Candidate

作成日: 2026-09-29  
Branch: `codex/cloud-marketplace-test-sale-guide-20260929`  
Base: `origin/feature/manga-canvas-mvp`@`46889073573c599013f5efd13fc4bdf254f0506b`（PR #564 merge commit）

## 結論

MANGAI Cloudで実装済みの販売下書き、作品公開、商品販売開始、公開表示確認、注文・売上確認を、利用者が一続きで確認できる限定テスト販売ガイドへまとめた。

一般公開販売としては扱わず、管理者が販売者、商品、指定購入者、利用期間を確認した場合だけ購入確認へ進む境界を維持する。今回の変更は案内表示と画面遷移だけであり、Productionデータ、販売状態、注文、決済を変更しない。

## 変更内容

### 1. 制作ワークフロー

- 「販売準備」を`準備中`から`限定提供`へ変更し、限定テスト販売ガイドへ接続した。
- 「収益管理」を`限定提供`へ変更し、`/dashboard/sales`へ接続した。
- 商品編集では販売準備、売上管理では収益管理を現在工程として表示する。

### 2. 利用者向け8手順

1. 原稿チェックを解消し、全ページを確定する。
2. 完成版を固定する。
3. 完成版と価格を選び、販売下書きを作成する。
4. 作品を公開する。
5. 商品を販売中にする。
6. 管理者による販売者、商品、指定購入者、利用期間の確認を待つ。
7. 指定購入者が案内期間内に確認する。
8. 販売者が売上管理で注文区分、作品・商品、状態を確認する。

### 3. 入口

- 完成PDFができた後の案内から、MANGAI内テスト販売と外部出品を選べる。
- 作品一覧から、MANGAI内テスト販売と外部出品の各手順へ進める。
- 販売設定完了後のCreator作品画面から、公開作品、購入準備、注文・売上、テスト販売手順を確認できる。

## 安全境界

- 購入操作は、管理者から案内された指定購入者だけが行う。
- 販売者本人の自己購入、対象外アカウント、案内期間外の購入を案内しない。
- 公開作品ページと購入準備画面の閲覧だけでは注文・決済は発生しない。
- テスト注文は注文一覧へ表示するが、本番の受取予定額へ加算しない。
- 一般公開販売、振込、精算確定は未提供と明記する。
- 成人向け作品は一般向けCloudマニュアルの対象外である。

## 検証

- focused: 13/13
- Hub: 1151/1151
- Canvas: 26/26
- AI: 50/50
- Desktop: 407/407
- Desktop accessibility: 29画面、blocking violation 0
- dependency/module boundaries: error 0、既知warning 2
- lint: 成功
- Hub/Desktop typecheck: 成功
- Supabase migration validation: 88/88
- Web build: 成功
- Desktop build: 成功
- RC repository structure: READY
- `git diff --check`: 成功

外部設定と手動E2Eは既知のPENDINGである。

## 実施していない操作

- Production接続・DB mutation
- checkpoint作成、完成版固定、作品公開、商品active化
- 注文、Stripe Checkout、Webhook、振込、精算
- Storage object読取り・変更
- Provider実行、生成Job、credit操作

## 次工程

Draft PRの全GitHub CIとVercel Preview成功を確認して停止する。merge後も、Productionでの公開、商品active化、購入、決済はそれぞれ別の明示承認単位とする。
