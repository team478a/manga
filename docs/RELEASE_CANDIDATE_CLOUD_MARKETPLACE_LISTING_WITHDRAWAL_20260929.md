# Release Candidate: Cloud出品の安全な販売停止（2026-09-29）

## 目的

Cloud版で販売開始した作品について、新規販売と一般公開を1操作で安全に停止する。販売停止後も固定完成版、注文履歴、購入済み利用者の閲覧・ダウンロード権を保持する。

## 実装内容

- Creator作品画面の販売設定完了欄へ、確認チェック付きの「販売を停止する」操作を追加した。
- `withdraw_cloud_marketplace_listing(uuid)`を追加し、所有する一般向けProject、単一作品、固定完成版、単一商品を同一transaction内で再検証する。
- transaction内で商品を先に`paused`へ変更し、その後に作品を非公開・下書きへ戻す。途中失敗は全体をrollbackし、完了状態への再実行は冪等とする。
- 販売停止後も、作品所有者と支払い済み購入者は固定完成版を閲覧できる。匿名利用者と未購入者は閲覧できない。
- 購入履歴へ「本文を読む」導線を追加し、既存のダウンロード導線を維持した。
- すでに開かれているStripe Checkoutは完了する可能性があるため、停止画面に明記した。注文・返金・決済状態を削除または改変する処理は追加していない。

## DB変更

- migration: `202609290002_cloud_marketplace_listing_withdrawal`
- forward SHA-256: `d16d53adb97bf255d6202b362182d1c0548e5f5a09ec953121a90c1fa7c5ea27`
- rollback SHA-256: `2c07ca356f98dcc023a05ada189f545cccae4104239a91162091d42e5f8dbe91`
- migration manifest、正規schema、静的migration検査、forward／rollback／再forward検査を同期した。

## 安全境界

- Production接続、migration適用、作品・商品状態変更、注文、Stripe、決済、返金、Storage、Provider、生成Job、credit、利用者データ変更は実施していない。
- 前段の`202609290001_cloud_marketplace_listing_publish`は責任者承認済みだが、Chrome連携のrequest-header policyエラーによりProductionへ未適用である。承認は取り消されていない。
- 本PRの`202609290002_cloud_marketplace_listing_withdrawal`は新しい変更であり、merge後にProduction適用の別承認が必要である。
- 販売停止は新規購入を防ぐが、停止前に開かれたCheckoutの完了を保証して遮断する遠隔取消処理ではない。

## 検証結果

- focused: 21/21
- Hub: 1164/1164
- Canvas: 26/26
- AI: 50/50
- Desktop: 407/407
- Desktop accessibility: 29画面、blocking violation 0
- dependency boundary: error 0、既知warning 2
- lint、Hub/Desktop typecheck: 成功
- migration static validation: 90/90
- PostgreSQL 16 roundtrip: 90 forward、全rollback、90 reforward、canonical schema二重適用、schema idempotency成功
- Hub production build、Desktop build: 成功
- RC preflight: repository structure READY。外部資格情報と手動E2Eは既知PENDING。
- `git diff --check`: 成功

## 次の停止点

commit、push、Draft PRを作成し、全GitHub CIとVercel Preview成功で停止する。Productionへの両migration適用、実作品の公開・販売停止、注文・決済操作はこのPRでは行わない。
