# Cloud販売表示の確認導線

作成日: 2026-09-29  
Branch: `codex/cloud-marketplace-sales-preview-guidance-20260929`  
Base: `origin/feature/manga-canvas-mvp`@`4071e728`（PR #562 merge commit）

## 目的

販売設定を完了した利用者が、Creator作品画面から公開作品ページと購入準備画面を確認できるようにする。注文・決済を発生させず、テスト販売前の表示確認までを一続きにする。

## 実装

- 完成版固定、作品公開、商品active化がすべて完了した場合だけ「販売表示を確認できます」を表示する。
- 公開作品ページと購入準備画面への直接リンクを追加する。
- 画面閲覧では注文・決済が発生しないこと、購入操作は管理者指定の購入者アカウントで行うことを明記する。
- 未公開作品、paused商品、完成版未固定の状態では確認リンクを表示しない。

## 安全境界

- 追加したのはGET画面へのリンクと説明だけで、Server Actionや購入処理は変更していない。
- Production接続、DB mutation、publication固定、作品公開、商品active化、注文、Stripe、Storage object取得、Provider、生成Job、credit操作は行っていない。

## 検証

- focused: 6/6
- Hub: 1149/1149
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

Draft PRの全CIとVercel Preview成功で停止する。merge後のProduction公開操作、指定購入者によるcanary購入、Stripe決済はそれぞれ別の明示承認を必要とする。
