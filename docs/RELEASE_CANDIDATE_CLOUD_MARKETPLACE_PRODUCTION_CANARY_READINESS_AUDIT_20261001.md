# Cloud Marketplace Production canary readiness 実環境監査

作成日: 2026-10-01  
Branch: `codex/cloud-marketplace-production-canary-readiness-audit-20261001`  
Base: `04014fd35ff8ea0e24915016b513cf3aa6f72b10`（PR #585 merge commit）

## 結論

Production schema は Cloud Marketplace に必要な4 migrationすべてで`APPLIED_CONTRACT_READY`だが、限定販売canaryはまだ開始できない。

Productionには商品が1件あるものの`active`商品は0件で、1件は`paused`である。この商品は価格、販売ファイル、作品所有者、一般向け区分、販売者権限を満たす一方、紐づく作品が未公開・非公開で、Cloud完成版も固定されていない。したがって、商品を有効化する前に作品公開とCloud完成版固定を明示的に確認する必要がある。

## 対象環境

- Organization: `stockbusiness's Org`
- Project: `mangai-hub-staging`
- Project ref: `vmdsyxykcrgxcdbrwlkv`
- Branch: `main`
- Environment badge: `PRODUCTION`
- Role: `postgres`
- Canonical application origin: `https://app.mang-ai.com`

Project名に`staging`を含むが、Supabase Dashboardで`main PRODUCTION`を確認した既存のProduction正本である。

## 読み取り結果

### 商品・候補件数

| 項目                             | 件数 |
| -------------------------------- | ---: |
| 確認した商品                     |    1 |
| active商品                       |    0 |
| canary条件を満たすactive商品     |    0 |
| 適格active販売者                 |    0 |
| paused商品                       |    1 |
| そのまま有効化できるpaused商品   |    0 |
| 公開済み一般向け作品             |    0 |
| 商品未登録の公開済み一般向け作品 |    0 |

### paused商品1件の条件別充足

| 条件                               |  充足 |
| ---------------------------------- | ----: |
| 価格50〜1,000円                    | 1 / 1 |
| 販売ファイルあり                   | 1 / 1 |
| 商品と作品の所有者一致             | 1 / 1 |
| 一般向け区分                       | 1 / 1 |
| 販売者roleが`creator`または`admin` | 1 / 1 |
| 作品statusが`published`            | 0 / 1 |
| 作品が公開状態                     | 0 / 1 |
| Cloud完成版が固定済み              | 0 / 1 |
| 全条件を満たし有効化可能           | 0 / 1 |

## 開始判定

総合判定は`PENDING`。

- schema契約: `READY`（4 / 4 migration）。
- canary候補商品: `PENDING`（適格active商品0件）。
- 公開済み一般向け作品: `PENDING`（0件）。
- Cloud完成版固定: `PENDING`（対象paused商品0 / 1件）。
- checkout runtime、固定buyer、販売者・購入者の分離、同一対象の既存live注文: MANGAI管理者セッションが現在のChromeにないため、今回の画面監査では`NOT_EVALUATED`。ただし商品・作品条件が既に不成立のため、開始可否の`PENDING`結論は変わらない。

## 実施方法と安全境界

Supabase SQL Editorで、個別ID、氏名、メール、タイトル、販売ファイルURLを返さない集計`SELECT`だけを実行した。

1. 商品、作品、販売者roleを結合し、active／paused／適格候補／公開作品を件数集計。
2. paused商品の価格、ファイル、所有者、公開作品、完成版固定、販売者roleを件数集計。
3. paused商品に紐づく作品の`published`、公開状態、一般向け区分、Cloud完成版固定を件数集計。

2回目の集計ではEditor置換が旧SQLへ追記され、構文エラーで0行となった。DML／DDL／RPCは含まず、変更は発生していない。全文選択後に正しい集計`SELECT`へ置換し、1行の匿名集計結果を取得した。

次は実施していない。

- `INSERT`、`UPDATE`、`DELETE`、DDL、RPC
- 作品公開、Cloud完成版固定、商品active化
- Vercel環境変数、canary target、期限の変更
- 注文作成、Stripe API、実決済、返金
- Storage取得、販売ファイルの閲覧・ダウンロード
- Provider、生成Job、Asset、credit、利用期限、通知設定の変更

## 次の安全な順序

1. MANGAI管理者セッションで`/admin/marketplace-canary`を開き、checkout modeとruntime canary設定を読み取り確認する。
2. paused商品に紐づく作品について、完成版checkpointとページ構成を確認し、固定対象が正しいことを確定する。
3. Cloud完成版固定と一般公開を、対象作品・操作・回数を含む別の明示承認後に実施する。
4. 再監査で公開済み一般向け作品、完成版固定、paused商品の有効化前条件がすべて`READY`になったことを確認する。
5. 商品active化を別承認で実施し、再び適格active商品が1件だけであることを確認する。
6. 販売者と異なる固定buyer、24時間以内の期限、承認済みplan fingerprintを準備し、Production環境変数変更を別承認で行う。
7. 管理画面の5条件がすべて`READY`になってから、1注文だけの実canary購入・決済を別承認で実施する。

作品公開、完成版固定、商品active化、Production環境変数変更、実購入・実決済は、この監査PRの範囲外である。

## 検証

- Production schema監査: 4 / 4 `APPLIED_CONTRACT_READY`（PR #585で記録済み）。
- Production商品・作品・販売者の匿名集計: 成功。
- 限定販売readiness集中テスト: 28 / 28成功。
- Supabase migration／rollback静的検証: 92 / 92成功。
- RC preflight: repository structure `READY`。外部設定は未投入のため`PENDING`、手動E2Eは`REQUIRED`。
- 新規監査文書のPrettier確認: 成功。
- `git diff --check`: 成功。
- Production変更: 0件。
- Stripe／Storage／Provider／Job／credit操作: 0件。
- MANGAI管理画面の手動表示: 管理者未ログインのため`NOT_EVALUATED`。
