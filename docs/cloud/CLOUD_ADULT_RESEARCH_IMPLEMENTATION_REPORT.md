# MANGAI Cloud 成人向け市場分析オプション 実装報告

## 1. 結論

成人向け市場分析を、一般向けRelease 1から独立した許可制オプションとして実装した。成人向け画像・本文生成、成人向け作品公開、Stripe自動連携は追加していない。

## 2. 実装した利用条件

次の条件をすべて満たす利用者だけが成人向けReportを作成・再表示できる。

1. 一般向け市場分析Feature Flagが有効
2. 成人向け市場分析Feature Flagが有効
3. DB Kill Switchが有効
4. 管理者による個別許可が`approved`
5. 個別許可が有効期限内
6. 本人が18歳以上を確認
7. 本人が現行の専用規約へ同意

アプリ表示だけでなくRLSでも同じ条件を強制する。一般向けReportはこの権限状態の影響を受けない。

## 3. 管理機能

- `/admin/adult-research`: 環境Flag、DB Kill Switch、許可数の確認と全体停止
- `/admin/users/[id]`: 個別許可、停止、期限切れ、許可理由、期限、管理者メモ
- 許可理由: `purchase`、`legacy_purchase`、`admin_grant`、`campaign`
- Service Role専用RPCで権限更新と監査ログを同一transactionへ保存

## 4. 利用者機能

- `/dashboard/research/adult-access`: 利用状態確認、18歳以上確認、専用規約同意、同意解除
- `/dashboard/research/new`: 全条件を満たす場合だけ成人向け選択を有効化
- 履歴と詳細に一般／成人向け区分を表示
- 同意解除、権限停止、期限切れ、全体停止後は過去の成人向けReportも再表示不可

## 5. DB変更

Migration: `202607290008_cloud_adult_research_option.sql`

- `cloud_adult_research_settings`
- `cloud_adult_research_entitlements`
- `cloud_adult_research_consents`
- `cloud_adult_research_audit_logs`
- `can_use_cloud_adult_research()`
- `set_cloud_adult_research_entitlement(...)`
- `set_cloud_adult_research_enabled(...)`

Rollbackは成人向けReportが存在する場合に停止し、データを誤って削除しない。

## 6. 環境変数

```text
CLOUD_RESEARCH_MVP_ENABLED
CLOUD_ADULT_RESEARCH_ENABLED
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

成人向けFlagを有効にする場合、preflightはService Role設定も要求する。値はログへ表示しない。

## 7. 検証結果

- `npm run deps:check`: PASS
- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run research:eval`: PASS
- `npm run hub:test`: PASS（180/180）
- `npm run db:migrations:validate`: PASS（19/19）
- `npm run build`: PASS
- migration forward／rollback／reapply／canonical schema: PASS（PostgreSQL 16）
- `git diff --check`: PASS

## 8. 公開前に必要な責任者作業

1. 成人向け専用規約本文を承認する。
2. stagingへmigrationを適用する。
3. 既存購入者を`legacy_purchase`として個別許可する。
4. Previewだけで環境FlagとDB Kill Switchを有効にする。
5. 管理者許可、本人同意、作成、履歴、再表示、停止後拒否を実機確認する。
6. ログ秘匿と別利用者参照拒否を確認する。
7. 問題がなければ限定公開の対象者と期間を承認する。

本実装では本番Feature Flag有効化、staging migration適用、外部APIの有料実行、本番公開を行っていない。
