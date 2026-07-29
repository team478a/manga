# MANGAI Cloud 成人向け企画ブリーフ実装報告

作成日: 2026-07-29

## 1. 結論

成人向け市場分析を完了した許可利用者が、外部AIを使わずに企画条件を入力・保存・履歴表示・再表示できる縦型機能を実装した。一般向け市場分析と一般向けRelease 2のAI企画提案には影響しない。

## 2. 権限モデル

利用には次の三層をすべて要求する。

1. Release 1市場分析Flag
2. 成人向け市場分析のFlag、DB Kill Switch、個別許可、18歳以上確認、専用規約同意
3. 成人向け企画Flagと`adult_planning`機能単位許可

UI、Server Action、RLSの各層で同じ境界を強制する。許可停止後は新規保存だけでなく一覧と直リンク再表示も拒否する。

## 3. 主な変更

- `cloud_adult_feature_grants`: 成人向け機能単位許可
- `cloud_adult_planning_briefs`: 本人所有の企画ブリーフ
- `can_use_cloud_adult_feature(feature_key)`: DB共通判定
- `set_cloud_adult_feature_grant(...)`: 管理者限定・監査付き付与RPC
- 成人向けReportの企画画面、履歴、詳細画面
- 管理者の利用者詳細画面に企画機能権限を追加
- `CLOUD_ADULT_PLANNING_ENABLED`
- 秘密値を表示しないRelease 1 preflight
- migration、rollback、canonical schema、実DB RLS検査

## 4. 利用者へ表示しない情報

- 市場分析の内部評価ロジック
- 出典URL
- DB／Providerの内部エラー
- 管理者の権限メモ
- Secret、Service Role Key

## 5. 明示的な対象外

- AIによる企画案、文章、台詞の自動生成
- 成人向け画像生成
- 外部Providerへの成人向け内容送信
- Stripe購入完了からの自動許可
- シナリオ生成、マンガ生成、公開、販売

## 6. migration

- forward: `supabase/migrations/202607290009_cloud_adult_planning_option.sql`
- rollback: `supabase/rollbacks/202607290009_cloud_adult_planning_option.sql`
- manifest: 20 migration

rollbackは企画ブリーフが存在する場合に停止し、利用者データを黙って削除しない。

## 7. ローカル検証

- `npm run deps:check`: PASS
- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run research:eval`: PASS
- `npm run hub:test`: PASS（185/185）
- `npm run db:migrations:validate`: PASS（20/20）
- `npm run build`: PASS
- `git diff --check`: PASS
- PostgreSQL 16 migration forward／rollback／reapply／canonical schema: PASS
- 実DB所有者RLS挙動: PASS
- 秘密値を表示しないpreflight: PASS

## 8. 公開前の残作業

1. 親PR #66の内容確認
2. stacked Draft PRのCIとPreview確認
3. stagingへのmigration適用
4. Preview環境でのFeature Flag設定
5. 管理者付与、本人保存、履歴、再表示、権限停止の実機E2E
6. 機能単位の販売・付与運用承認

本番Flag有効化、migration適用、本番公開は本変更では実施しない。
