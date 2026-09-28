# Marketplace Cloud完成版migration 管理画面readiness

## 目的

VercelのSensitiveなProduction Supabase資格情報を運営端末へ取り出さず、管理者が`202608140004_cloud_work_publications`の適用前条件をProduction画面で確認できるようにする。

## 管理画面

- URL: `https://app.mang-ai.com/admin/marketplace-canary`
- `requireAdmin()`通過後だけreadiness repositoryを実行する。
- `VERCEL_ENV=production`と`https://app.mang-ai.com`のruntime guardをDB接続前に検査する。
- 表示するのはschema状態、6つのREADY／PENDING、匿名件数だけである。
- 作品、商品、Project、利用者のID、名称、メール、file path、環境値、秘密値は表示しない。
- migration適用buttonやDB mutation経路を持たない。

## 判定条件

CLIと管理画面は同じdomain判定を共有し、次をすべて満たす場合だけ適用前READYとする。

1. 依存schemaが揃っている。
2. publication 2 tableと`works`のpublication 3列がすべて未適用である。
3. Cloud-linked作品とactive商品が各100件以内である。
4. 未固定の公開済み／published Cloud作品がない。
5. Cloud-linked作品に紐づくactive商品がない。
6. 同一Cloud Projectに複数作品が紐づいていない。

部分適用、既に適用済み、101件以上、危険な既存データ、provider read errorはfail closedである。適用済みの場合は再適用せず、管理画面へ「適用済み」と表示する。

## 情報・操作境界

- Supabase queryはschema probeと件数監査のSELECTだけである。
- 個人情報列、作品本文、画像、Storage pathを取得しない。
- Storage、Stripe、Provider、生成Job、creditへアクセスしない。
- 作品公開、publication固定、商品active化、注文作成、決済、migration適用を行わない。
- READYでも原本SHA-256の再照合と責任者の実行時明示承認を別途必要とする。

## Production接続試行

Vercel CLIからProduction envをrepository外の一時ファイルへ取得してCLI preflightを再試行したが、Sensitive値は取得できず、`NEXT_PUBLIC_SUPABASE_URL`不足で接続前に停止した。Supabase requestは0件。一時ファイルは削除済みで、ProductionとVercel設定は変更していない。

## 検証

- focused 23/23。
- Hub 1135/1135、Canvas 26/26、AI 50/50、Desktop 407/407。
- Desktop a11y 29画面、blocking violation 0。
- dependency／module boundary error 0（既知warning 2）。
- lint、全typecheck、migration 88/88、Hub Production build、Desktop build、RC repository structure、`git diff --check`成功。

## 次工程

merge後、Production管理者として`/admin/marketplace-canary`を開き、Cloud完成版migration適用前確認のschema状態・6判定・匿名件数を記録する。画面がREADYでもmigration適用は行わず、対象IDとSHA-256を示した別の明示承認を待つ。
