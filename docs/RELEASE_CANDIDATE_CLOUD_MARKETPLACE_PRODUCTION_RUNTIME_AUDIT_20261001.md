# Cloud Marketplace Production runtime設定監査

作成日: 2026-10-01  
Branch: `codex/cloud-marketplace-production-runtime-audit-20261001`  
Base: `0ee346b678e12dbe74e867cb314a80a156b7d2d2`（PR #586 merge commit）

## 結論

ProductionのCloud Marketplace購入runtimeは現在`停止中`である。Vercel Productionの環境変数名を値なしで確認した結果、checkout mode、Stripe本番設定、限定販売canary対象設定が存在しない。

コードは`MANGAI_MARKETPLACE_CHECKOUT_MODE`未設定時に`disabled`へfail closedする。商品・作品側も前回監査で適格active商品0件だったため、現時点で一般購入・限定販売・実決済は開始できない。

## 対象

- Vercel team: `team478as-projects`
- Vercel project: `mangai-hub-staging`
- Production URL: `https://app.mang-ai.com`
- Git base: PR #586 merge commit

Vercel project名に`staging`を含むが、Production URLが`https://app.mang-ai.com`の現行Production projectである。

## 設定名の確認結果

値は取得・表示せず、Productionへ登録された環境変数名と対象environmentだけを確認した。

### 存在を確認した関連設定

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CHECKOUT_CANCEL_SECRET`

### 未設定のためPENDINGとなる設定

- `MANGAI_MARKETPLACE_CHECKOUT_MODE`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `MANGAI_MARKETPLACE_LIVE_ACCESS`
- `MANGAI_MARKETPLACE_CANARY_PRODUCT_ID`
- `MANGAI_MARKETPLACE_CANARY_SELLER_PROFILE_ID`
- `MANGAI_MARKETPLACE_CANARY_BUYER_PROFILE_ID`
- `MANGAI_MARKETPLACE_CANARY_EXPIRES_AT`
- `MANGAI_MARKETPLACE_CANARY_PLAN_FINGERPRINT`

## 判定

| 判定項目                 | 状態      | 理由                                                     |
| ------------------------ | --------- | -------------------------------------------------------- |
| Checkout mode            | `PENDING` | mode未設定のためコード既定値`disabled`                   |
| Stripe live設定          | `PENDING` | 本番secretとwebhook secretが未設定                       |
| Canary access            | `PENDING` | `MANGAI_MARKETPLACE_LIVE_ACCESS=canary`が未設定          |
| 対象商品・販売者・購入者 | `PENDING` | 固定対象の環境変数が未設定                               |
| 期限・plan fingerprint   | `PENDING` | 24時間以内の期限と承認済みfingerprintが未設定            |
| DB schema                | `READY`   | 4 migrationすべて`APPLIED_CONTRACT_READY`                |
| 商品・作品               | `PENDING` | active 0件、paused 1件は作品未公開・非公開・完成版未固定 |

総合判定は`CANARY_NOT_CONFIGURED / CHECKOUT_DISABLED`。

## 管理画面確認

`https://app.mang-ai.com/admin/marketplace-canary`へ直接アクセスしたが、現在のChromeにはMANGAI管理者セッションがなくログイン画面へ遷移した。認証情報の入力・自動ログインは行っていない。

設定名監査とコード既定値によりruntime停止は確定できるため、管理画面の未確認によって結論は変わらない。管理画面の表示E2Eは管理者ログイン後に別途実施する。

## 一時ファイルの扱い

Vercel CLIのproject接続時に`.env.local`と`.vercel/`が一時作成された。`.env.local`の内容は表示せず、監査直後に次を削除・復元した。

- `.env.local`: 削除済み
- `.vercel/project.json`: 削除済み
- `.vercel/README.txt`: 削除済み
- CLIが追加した`.gitignore`の`.env*`: 削除して元の状態へ復元済み
- 最終`git status`: clean

秘密値、token、環境変数値は文書・Git・通常ログへ保存していない。

## 変更していないもの

- Vercel Production環境変数の追加・更新・削除
- Supabase DB、schema、RLS、作品、publication、商品、価格
- 商品active化、一般公開、Cloud完成版固定
- 注文、Stripe API、決済、webhook、返金
- Storage、販売ファイル
- Provider、生成Job、Asset、credit、利用期限、通知設定

## 次の順序

1. 管理者ログイン後に`/admin/marketplace-canary`を開き、停止中／PENDING表示が今回の監査と一致することを確認する。
2. 対象paused商品に紐づく作品の完成版checkpointを確認し、固定・公開する対象が正しいことを確定する。
3. 対象作品・操作・回数を含む明示承認後に、Cloud完成版固定と一般公開を行う。
4. read-only再監査後、別承認で商品をactive化する。
5. 固定buyer、販売者、商品、24時間以内の期限、plan fingerprint、Stripe live設定を準備し、完全な設定名と変更範囲を提示してProduction環境変数変更の承認を得る。
6. 管理画面の5条件がすべて`READY`になってから、1注文だけのcanary購入・決済を別承認で実施する。

Production環境変数変更、作品公開、完成版固定、商品active化、実購入・実決済は本監査PRの範囲外である。

## 検証

- Vercel Production環境変数名一覧: 取得成功、値は非表示。
- checkout modeのfail-closedコード確認: 未設定時`disabled`。
- canary必須設定9項目の存在確認: すべて未設定。
- checkout／canary／販売境界の集中テスト: 39 / 39成功。
- Supabase migration／rollback静的検証: 92 / 92成功。
- RC preflight: repository structure `READY`。外部設定は`PENDING`、手動E2Eは`REQUIRED`。
- 新規監査文書のPrettier確認: 成功。
- `git diff --check`: 成功。
- Production変更: 0件。
- 一時秘密ファイル: 削除済み。
- `git status`: clean。
