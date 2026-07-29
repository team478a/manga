# MANGAI Cloud Release 1 統合報告

作成日: 2026-07-29

## 1. 統合単位

- Repository: `team478a/manga`
- Base: `origin/feature/manga-canvas-mvp` (`7615d06`)
- Branch: `codex/cloud-release1-integration-v1`
- 目的: 市場分析だけを限定公開できる独立したRelease 1
- 状態: Draft PR・Preview・全CI確認まで作業中。merge・本番反映は禁止

## 2. 統合したPRとcommit

| PR | 内容 | 元commit | 統合commit |
| --- | --- | --- | --- |
| #50 | Release 0＋1 市場分析MVP | `ebecd6b`、`b351a020`、`2a38db3e`、`6aa5274e`、`5983ac11`、`3143c41e`、`4f2354de` | `86237bc`、`cee4ccf`、`bc4ceae`、`d72ecba`、`08b371a`、`2347197`、`0101ef4` |
| #56 | Research Quality v2 | `fe8f4d79` | `4221cad` |
| #57 | 安全な出典Server検証 | `e3bb3270` | `7ccec79` |
| #58 | 検索候補収集 | `b3dc8a83` | `86e2bda` |
| #59 | 事実候補抽出 | `79557025` | `6f9c4f8` |
| #60 | 複数出典照合 | `32bc98ae` | `4f7350a` |
| #61 | Research Evaluation v1 | `b5891564` | `0482ca8` |
| #62 | Result-only UI | `4cfae3ae`、`9844076a` | `63ee1c2`、`86fc3f4` |

各commitは既存PRを変更せずcherry-pickした。PR #56の競合だけ手動解決し、Release 2〜6のmigration・テスト・進捗文書を除外した。

## 3. 明示的に除外した変更

- PR #48〜#49
- PR #51〜#55
- PR #63〜#64
- PR #56〜#62に含まれる旧stack専用の`CURRENT_TASK.md`／`HANDOFF_LOG.md`更新commit
- Release 2〜6のmigration `202607290002`〜`202607290006`
- Desktop、Cloud Canvas Editor、Cloud AI Queue／Worker
- Stripe、Marketplace
- AI企画提案本体、シナリオ生成、マンガ生成、作品管理、販売準備、収益ダッシュボード

既存PRのrebase、force push、Close、mergeは行っていない。

## 4. 競合解決

- `supabase/migrations/manifest.json`: 既存16 migrationを維持し、Release 1の`202607290001`と品質v2の`202607290007`だけを追加。
- `supabase/tests/assert_migrations.sql`: 市場分析と品質v2だけを検査し、Release 2〜6のassertionを除外。
- `docs/CURRENT_TASK.md`、`docs/HANDOFF_LOG.md`: 旧履歴を残し、独立統合状態を最上部へ記録。
- PR番号依存: 公開runbookをPR #50単体から統合Draft PR基準へ変更。

## 5. 公開前ハードニング

| 要件 | 対応 |
| --- | --- |
| Feature Flag未設定時DB前fail closed | Dashboard・一覧・新規・検索・詳細・引継ぎRouteでFlagを認証／DBより先に評価 |
| 検索API未設定 | 手動出典入力を継続し、検索導線を非表示 |
| 出典検証未設定 | 手動確認で継続できる案内を表示 |
| loading／empty／error／not found | Route状態Componentと回帰テストを追加 |
| 成人向け拒否 | `CONTENT_REJECTED`境界と回帰テストを維持 |
| 不正UUID | 永続化層でDB照会前に拒否 |
| 内部エラー秘匿 | Domain errorへ変換し、error画面も詳細・stack・digestを表示しない |
| 別利用者Report | profile ID条件、RLS、モック統合テストで拒否 |
| 390／768／1280 | 固定幅・overflow構造検査を追加 |
| migration検査 | forward／rollback／reapply／canonical schemaをCI対象に維持 |
| preflight | 秘密値を出力せず`PASS`／`FAIL`／`SKIP`だけを表示 |
| runbook | 2 migration、任意機能、手動フォールバック、停止順を更新 |

## 6. migration

Release 1統合で追加するのは次の2本だけ。

1. `202607290001_cloud_market_research.sql`
2. `202607290007_cloud_research_quality_v2.sql`

両方にrollbackがあり、manifestは全18 migrationのforward／rollback checksumとcanonical schema checksumを保持する。

## 7. Feature Flag・環境変数

値は本報告へ記録しない。

### 必須

- `CLOUD_RESEARCH_MVP_ENABLED`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

### 任意: 出典検証

- `CLOUD_RESEARCH_SOURCE_VERIFICATION_ENABLED`
- `CLOUD_RESEARCH_SOURCE_ALLOWED_HOSTS`（有効時必須）

### 任意: 検索

- `CLOUD_RESEARCH_SEARCH_ENABLED`
- `BRAVE_SEARCH_API_KEY`（有効時必須）

### 任意機能有効時のServer保護

- `SUPABASE_SERVICE_ROLE_KEY`
- `CLOUD_RESEARCH_SEARCH_RATE_LIMIT_SECRET`
- `CLOUD_AI_RATE_LIMIT_SECRET`（既存fallback）

## 8. 検証結果

| Gate | 結果 |
| --- | --- |
| 市場分析集中テスト | PASS（28/28） |
| migration静的検証 | PASS（18/18） |
| `npm run deps:check` | PASS（5 packages、21 source files） |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS（共有package生成後、Hub＋Desktop） |
| `npm run research:eval` | PASS（抽出21/21、分類28/28、漏洩0） |
| `npm run hub:test` | PASS（174/174） |
| `npm run db:migrations:validate` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS |
| migration roundtrip | PASS（ローカルDocker PostgreSQL 16） |
| GitHub CI | Draft PR作成後に確認 |
| Vercel Preview | Draft PR作成後に確認 |

## 9. 外部環境でのみ完了できる事項

- Supabase stagingへの2 migration適用
- 実Vercel環境変数でのpreflight
- 認証済み入力・保存・履歴・再表示E2E
- 別利用者によるRLS実機確認
- 390px、768px、1280pxの実ブラウザ確認
- Feature Flag有効化と限定公開判断
- 責任者承認

詳細は[`CLOUD_RELEASE1_BETA_ACCEPTANCE.md`](CLOUD_RELEASE1_BETA_ACCEPTANCE.md)を参照する。
