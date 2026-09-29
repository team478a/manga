# Cloud販売開始までの進捗案内

作成日: 2026-09-29  
Branch: `codex/cloud-marketplace-sales-guidance-20260929`  
Base: `origin/feature/manga-canvas-mvp`@`6fa56e76`（PR #561 merge commit）

## 目的

販売下書きを作成した利用者が、作品公開と商品販売開始のどちらを先に行うべきか判断できるようにする。Creator作品画面だけで、テスト販売に必要な残工程と次の遷移先を確認できる状態にする。

## 実装

- 完成版固定、作品公開、商品販売開始を順番に判定する純粋関数を追加した。
- 販売下書きがある作品では、3工程それぞれの完了／未完了を表示する。
- 完成版固定後は作品編集画面の公開設定へ、作品公開後は商品編集画面の販売設定へ案内する。
- 作品公開と商品active化が完了した場合は「販売設定完了」と表示し、商品確認へ移動できる。
- 完成版未固定や状態取得不能はfail closedとし、工程を飛ばすリンクを表示しない。

## 安全境界

- 表示と遷移案内のみで、作品、publication、商品、注文、決済を変更しない。
- 既存のサーバー側制約（完成版固定後に作品公開、作品公開後に商品active化）を緩和しない。
- Production接続、DB mutation、Storage object取得、Stripe、Provider、生成Job、credit操作は行っていない。

## 検証

- focused: 5/5
- Hub: 1148/1148
- Canvas: 26/26
- AI: 50/50
- Desktop: 407/407
- Desktop accessibility: 29画面、blocking violation 0
- dependency/module/codebase checks: error 0（既知warning 2）
- lint、全typecheck、Supabase migration 88/88、Web build、Desktop build成功
- RC repository structure: READY
- 外部設定と手動E2E: 既知のPENDING
- `git diff --check`: 成功

## 次工程

Draft PRの全CIとVercel Preview成功で停止する。merge後、Productionでの完成版固定、作品公開、商品active化、canary購入はそれぞれ別の明示承認を必要とする。
