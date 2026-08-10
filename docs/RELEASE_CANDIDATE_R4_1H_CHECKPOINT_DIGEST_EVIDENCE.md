# PR-R4-1h Production checkpoint digest修正証跡

確認日: 2026-08-10

対象:

- Production: `https://app.mang-ai.com`
- Supabase project: `mangai-hub-staging` / `vmdsyxykcrgxcdbrwlkv`
- 検証作品: `R2C Provider Image Acceptance 2026-08-06`
- Base: `c1660e21b13d5e9a11e1f2a56e9df9329e828ab5`（PR #225 merge commit）

## 1. Production再現

作品画面で「バックアップを作成」を実行すると、`作品バックアップ用migrationを適用してください。`と表示され、checkpointは作成されなかった。再実行前後でProvider Job、Asset、credit、費用は変化していない。

## 2. 対象DB照合

対象Supabaseで次を読み取り確認した。

- `cloud_project_backup_blobs`、`cloud_project_checkpoints`、`cloud_project_checkpoint_pages`、`cloud_project_checkpoint_restores`が存在する。
- `create_cloud_project_checkpoint(uuid,text,text)`と`restore_cloud_project_checkpoint(uuid,uuid)`が存在する。
- RPC引数名はapplication呼出しと一致する。
- 4 tableはRLS有効、2 RPCは`authenticated`へEXECUTE許可済み。
- Productionで開いた作品IDが同じSupabase projectに存在する。別DB接続ではない。
- PostgREST schema cache reload後も同じ失敗を再現した。RPC未認識ではない。

## 3. 原因

Production作品ownerの認証contextを設定したDB transaction内で作成RPCを呼び、最後に必ずROLLBACKする診断を実施した。RPCは次の内部エラーで停止した。

```text
ERROR: 42883: function digest(bytea, unknown) does not exist
QUERY: v_canvas_hash:=encode(digest(convert_to(v_canvas::text,'UTF8'),'sha256'),'hex')
CONTEXT: PL/pgSQL function create_cloud_project_checkpoint(uuid,text,text)
```

`create_cloud_project_checkpoint`はSecurity Definerとして`search_path=public,pg_temp`に固定されている。一方、Supabaseの`pgcrypto.digest`は`extensions` schemaにあるため、未修飾`digest()`を解決できなかった。applicationは42883をRPC未適用として表示していたため、migration不足と同じメッセージになった。

診断transactionはエラー時も永続化されず、checkpoint件数は0のままである。

## 4. 修正

追加migration `202608100001_cloud_project_checkpoint_digest_schema.sql`でRPC signature、権限、固定`search_path`、入力、manifest、hash方式を変えず、2箇所の呼出しだけを`extensions.digest(...)`へ明示修飾する。

canonical schemaとmigration assertionも同じ条件へ同期し、今後未修飾へ戻った場合はMigration roundtripを失敗させる。

追加migrationの関数置換とProduction作品のcheckpoint作成を同一DB transaction内で実行し、修正後RPCがUUIDを返すことを確認した。最後にROLLBACKし、診断labelのcheckpoint件数が0、関数定義も修正前へ戻ったことを確認した。Production DBへ修正はまだ永続適用していない。

## 5. 外部契約

変更しないもの:

- RPC名、引数、戻り値、権限、Security Definer、search path
- table、RLS、Storage、API、URL、Feature Flag
- Provider、model、pricing、credit、retry、timeout、Scheduler
- Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktop

## 6. rollback

`supabase/rollbacks/202608100001_cloud_project_checkpoint_digest_schema.sql`を適用すると直前の関数定義へ戻る。ただし未修飾`digest()`の既知障害も再発するため、緊急時以外はrollbackせず、Production checkpoint受入れをpendingへ戻す。

## 7. merge後のProduction再受入れ

1. 対象Supabaseへ追加migrationを適用する。
2. function definitionに`extensions.digest`が2箇所あることを確認する。
3. Productionで通常checkpointを1件作成する。
4. 作品を1回保存して2件目を作成し、差分表示を確認する。
5. 復元前自動checkpoint、復元履歴、Canvas再読込を確認する。
6. checkpoint／restore件数とowner境界をDBで照合する。

本PRではProductionへ追加migrationを適用しない。Draft PRの全CIとVercel Preview成功後に停止し、mergeとProduction適用後に再受入れする。
