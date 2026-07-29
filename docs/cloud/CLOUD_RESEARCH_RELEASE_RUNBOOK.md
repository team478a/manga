# MANGAI Cloud 市場分析MVP公開・受入れ手順

作成日: 2026-07-29

対象: Release 0＋Release 1

対象ブランチ: `codex/cloud-release1-integration-v1`

対象PR: [#65](https://github.com/team478a/manga/pull/65)

## Release 1.1 成人向け市場分析オプション

成人向け市場分析は一般向けRelease 1とは独立した許可制オプションとして扱う。

### 追加設定

- `CLOUD_ADULT_RESEARCH_ENABLED=false`を初期値とする
- migration `202607290008_cloud_adult_research_option.sql`適用前に有効化しない
- `SUPABASE_SERVICE_ROLE_KEY`をVercel Server環境だけに設定する
- `npm run cloud:release1:preflight`で値を表示せず設定状態を確認する

### 有効化手順

1. DB backupを確認する
2. migration `202607290008`を適用する
3. `/admin/adult-research`が「DB Kill Switch: 停止」を表示することを確認する
4. `/admin/users/[id]`からテスト利用者へ`legacy_purchase`または`admin_grant`を付与する
5. Previewだけで`CLOUD_ADULT_RESEARCH_ENABLED=true`へ変更する
6. `/admin/adult-research`からDB Kill Switchを有効化する
7. テスト利用者本人が18歳以上確認・専用規約同意を行う
8. 成人向け市場分析の作成、保存、履歴、再表示を確認する
9. 一時停止後、新規作成と過去Report再表示が拒否されることを確認する

### 緊急停止

最初に`/admin/adult-research`のDB Kill Switchを停止する。続いてVercelの`CLOUD_ADULT_RESEARCH_ENABLED=false`へ変更する。一般向け市場分析は停止しない。

## 1. 目的

市場分析MVPを、DB適用前は停止した状態から安全に有効化し、入力・実行・保存・履歴・再表示・所有者RLSを確認する。

この手順が完了するまではPRをDraft解除・mergeせず、Release 2のAI企画提案本体へ着手しない。

## 2. 前提条件

- 統合Draft PRのRequired Quality、Migration roundtrip、Windows build、Vercelがすべて成功
- 対象Supabase ProjectとVercel Projectを明示している
- Supabaseのバックアップまたは復元可能な状態を確認済み
- 一般向け試験データだけを使用
- 利用者Aと、RLS確認用の別利用者Bを準備
- `CLOUD_RESEARCH_MVP_ENABLED`は未設定または`false`

秘密値、利用者の創作内容、メールアドレスを検証記録へ貼り付けない。

## 3. 適用前確認

1. 対象Supabase Project名とProject Refを記録する。
2. 対象Vercel Project名とDeployment URLを記録する。
3. Feature Flag停止中に次を確認する。
   - Dashboardに「停止中」が表示される。
   - `/dashboard/research/new`でFormを実行できない。
   - 詳細URLと企画引継ぎURLがDBを参照せず市場分析一覧へ戻る。
4. migration静的検査とPR CIが成功していることを確認する。

```powershell
npm run db:migrations:validate
npm run cloud:release1:preflight
gh pr checks <統合Draft PR番号> --repo team478a/manga
```

preflightは値を出力せず、設定項目ごとの`PASS`、`FAIL`、`SKIP`だけを表示する。
`CLOUD_RESEARCH_MVP_ENABLED`未設定時は必ず失敗する。検索と出典検証は任意であり、
無効時は`SKIP`として手動出典入力を継続できる。

## 4. Supabase migration適用

対象ファイル（順番を変更しない）:

`supabase/migrations/202607290001_cloud_market_research.sql`

`supabase/migrations/202607290007_cloud_research_quality_v2.sql`

Supabase SQL Editorで対象Projectを再確認してから、各ファイル全体を順番に1回実行する。途中の文だけを分割実行しない。

適用後、次の読み取り専用SQLで確認する。

```sql
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'cloud_market_research_reports';

select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'cloud_market_research_reports'
order by policyname;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'cloud_market_research_reports'
order by grantee, privilege_type;
```

合格条件:

- `rls_enabled = true`
- owner readとowner insertの2 Policyが存在
- `authenticated`は`SELECT`と`INSERT`のみ
- `authenticated`に`UPDATE`または`DELETE`がない

## 5. Vercel Feature Flag有効化

DB確認が成功した後にだけ、対象Preview環境へ次を設定する。

```text
CLOUD_RESEARCH_MVP_ENABLED=true
```

任意機能は次のFlagで個別に有効化する。未設定または`false`なら手動出典入力を使用する。

```text
CLOUD_RESEARCH_SOURCE_VERIFICATION_ENABLED=false
CLOUD_RESEARCH_SEARCH_ENABLED=false
```

出典検証を有効にする場合は`CLOUD_RESEARCH_SOURCE_ALLOWED_HOSTS`、検索を有効にする場合は
`BRAVE_SEARCH_API_KEY`をServer環境だけへ設定する。いずれかを有効にする場合は
`SUPABASE_SERVICE_ROLE_KEY`と`CLOUD_RESEARCH_SEARCH_RATE_LIMIT_SECRET`も必要である。

対象外Projectや他branchへ一括適用しない。設定後に対象Deploymentを再デプロイし、
`npm run cloud:release1:preflight`がPASSすること、新しいDeployment IDとURLを記録する。

## 6. 利用者Aの縦型E2E

一般向け区分で、次を順番に確認する。

1. Dashboardから市場分析を開始できる。
2. 必須制作条件を入力できる。
3. HTTPS出典、取得日時、確認事実を1〜5件入力できる。
4. HTTP URL、価格逆転、重複URL、不正日時が拒否される。
5. 一般向けRelease 1のE2Eでは一般向け区分を使用する。成人向けオプションは本書冒頭のRelease 1.1手順で別途確認する。
6. 正常入力を実行するとReport詳細へ遷移する。
7. 9分析項目、事実／入力条件・AI推論区分、根拠URL件数が表示される。
8. 履歴へ戻ると新しいReportが先頭に表示される。
9. 履歴から同じReportを再表示できる。
10. 完了ReportからだけAI企画提案の準備画面へ進める。
11. 企画生成本体は実行されず、Release 2予定表示に留まる。

ブラウザConsole、Vercel Log、通常アプリLogに入力本文や出典事実メモが出ていないことも確認する。

## 7. 利用者BのRLS E2E

1. 利用者AのReport IDだけを控える。入力本文は共有しない。
2. 別利用者Bでログインする。
3. 利用者AのReport詳細URLを開く。
4. Report本文が表示されず、404相当になることを確認する。
5. 利用者Bの履歴に利用者AのReportがないことを確認する。

Supabase SQL Editorの`postgres` Roleによる直接参照はRLS利用者試験の代替にしない。

## 8. レスポンシブ・アクセシビリティ受入れ

390px、768px、1280pxで次を確認する。

- Page全体に横スクロールが発生しない。
- ワークフローNavは狭幅時にNav内部だけ横スクロールできる。
- labelを選択すると対応Form controlへFocusする。
- Tab／Shift+Tabだけで全入力・実行・履歴・再表示へ移動できる。
- 入力エラーが`alert`として通知される。
- 保存成功messageと停止状態がStatusとして通知される。
- Focus ring、本文、Button、Badgeの文字が判読できる。

構造回帰は`tests/cloud-research-ui.test.mjs`で自動検査する。実ブラウザ390px確認は本手順の受入れ記録へ残す。

## 9. 失敗時の停止・ロールバック

最初にFeature Flagを`false`へ戻して再デプロイし、新規実行を停止する。DB rollbackより先にアプリを停止する。

`supabase/rollbacks/202607290001_cloud_market_research.sql`はテーブルを削除するため、保存済みReportがある状態ではデータを失う。

```sql
select count(*) as report_count
from public.cloud_market_research_reports;
```

- `report_count > 0`: rollback SQLを実行しない。Feature Flag停止を維持し、バックアップ・データ移行・修正版適用を判断する。
- `report_count = 0`: 対象Projectとバックアップを再確認した場合だけrollbackを検討する。

本番で自動rollbackしない。失敗ログに入力本文や秘密値を転記しない。

## 10. 完了承認記録

```md
- Supabase Project:
- Vercel Deployment:
- migration適用日時:
- Feature Flag有効化日時:
- 利用者A 縦型E2E: PASS / FAIL
- 利用者B RLS E2E: PASS / FAIL
- 390px / 768px / 1280px: PASS / FAIL
- Log秘匿確認: PASS / FAIL
- 実施者:
- 責任者承認:
- 未解決事項:
```

すべてPASSかつ責任者承認後にのみ、統合Draft PRのDraft解除とmerge判断へ進む。
