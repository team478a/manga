# Cloud限定テスト購入者導線 RC記録（2026-09-29）

## 結論

- 限定テスト販売の指定購入者が未ログインで購入準備画面を開いた場合、指定アカウントでログインし、同じ購入準備画面へ安全に戻れるようにした。
- 購入準備画面へ「購入からダウンロードまで」の3手順と購入履歴への導線を追加し、Stripe画面、完了画面、5分間有効な再ダウンロードURLの関係を明示した。
- ダッシュボードから購入履歴へ直接進めるようにし、テスト購入では実際の請求・売上・振込が発生しないことを購入履歴にも表示した。
- 一般公開販売、振込、精算確定は未提供のまま維持し、限定テスト購入を指定購入者・商品・期間に限定する既存境界を変更していない。

## 実装

### ログイン復帰

- `next`をログインフォームへ引き継ぎ、認証成功後に指定された内部pathへ戻す。
- 戻り先は同一originの相対pathだけを許可する。外部URL、protocol-relative URL、backslash、制御文字、`/login`、`/auth/*`は`/dashboard`へfail closedする。
- 認証失敗またはSupabase設定不足の場合も、安全に正規化した戻り先を保持する。

### 購入者案内

- live checkoutが有効で未ログインの場合だけ、指定購入者アカウントでのログインと購入準備画面への復帰を案内する。
- ログイン済みだが指定対象外の場合は、従来どおり購入不可として表示する。
- 購入準備画面で、アカウント・商品・価格確認、Stripe遷移、完了後のダウンロードまたは購入履歴からのURL再発行を案内する。
- ダッシュボードと購入準備画面から購入履歴へ移動できる。

### 利用範囲表示

- 先行販売購入者向け更新情報へ、管理者指定時のMANGAI内限定テスト販売と注文・売上確認を追記した。
- 成人向け制作、一般公開販売、振込、精算確定は先行利用対象外と明示した。

## 安全境界

- Production接続、DB mutation、migration、publication、作品・商品状態、注文、Stripe操作、Storage、Provider、生成Job、credit、利用者データは変更していない。
- 購入可否、自己購入禁止、canary対象、期間、商品状態、checkout modeの既存判定は緩和していない。
- 購入ボタンや決済処理は実行していない。

## 検証

- focused: 30/30
- Hub: 1154/1154
- Canvas: 26/26
- AI: 50/50
- Desktop: 407/407
- Desktop accessibility: 29画面、blocking violation 0
- migration: 88/88
- deps: error 0、既知warning 2
- lint、Hub／Desktop typecheck、Web／Desktop build: 成功
- RC preflight: repository structure READY。外部設定と手動E2Eは既知PENDING
- `git diff --check`: commit前に最終確認

## 次工程

commit、push、Draft PRを作成し、全GitHub CIとVercel Preview成功時点で停止する。Productionでの公開、購入、決済、注文作成は別承認単位とする。
