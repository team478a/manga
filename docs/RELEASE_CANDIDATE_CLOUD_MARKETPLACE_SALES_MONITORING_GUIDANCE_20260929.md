# Cloud注文・売上確認導線

作成日: 2026-09-29  
Branch: `codex/cloud-marketplace-sales-monitoring-guidance-20260929`  
Base: `origin/feature/manga-canvas-mvp`@`749096f7`（PR #563 merge commit）

## 目的

テスト販売後に、出品者がCreator作品画面から売上管理へ進み、注文がどの作品・商品に対するものか確認できるようにする。

## 実装

- 販売設定完了時の確認導線へ「注文・売上を確認」を追加した。
- 売上管理の注文一覧で、購入者、作品名、商品名、金額、手数料、受取額、状態、テスト／本番区分を確認できるようにした。
- 注文取得列を明示し、紐づく商品・作品の名称だけを既存owner境界内で読み取る。
- テスト注文を本番受取予定額へ含めない既存集計を維持した。

## 安全境界

- 既存RLS下の読み取りと画面表示だけを変更し、注文作成・更新、Stripe、作品・商品状態は変更していない。
- Production接続、DB mutation、publication固定、作品公開、商品active化、購入、Storage object取得、Provider、生成Job、credit操作は行っていない。

## 検証

- focused: 10/10
- Hub: 1150/1150
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

Draft PRの全CIとVercel Preview成功で停止する。merge後のProduction公開操作、指定購入者によるcanary購入、Stripe決済は別の明示承認を必要とする。
