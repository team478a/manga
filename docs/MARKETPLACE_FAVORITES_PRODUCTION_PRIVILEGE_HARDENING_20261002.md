# Marketplaceお気に入り Production権限hardening

## 1. 発生状況

責任者承認に基づき、2026-10-02にSupabase Production Project `vmdsyxykcrgxcdbrwlkv`へ`202610020001_marketplace_favorites`を1回適用した。適用前はtable不存在・policy 0件、適用後はtable、RLS、buyer-work一意制約、index、owner限定3 policy、row 0件を確認した。

適用後の権限postflightで、Productionの`ALTER DEFAULT PRIVILEGES`により新規tableへ自動付与された権限が残り、`authenticated`と`service_role`にmigrationが明示していない`TRUNCATE`、`REFERENCES`、`TRIGGER`が存在し、`authenticated`には`UPDATE`も存在することを検出した。UPDATE policyはないため通常APIからのUPDATEはRLSで拒否されるが、最小権限契約には違反する。

## 2. 原因

`202610020001`は`public`と`anon`だけを`revoke all`した後に必要権限をgrantしていた。grantは既存権限を縮小しないため、Productionの既定付与を除去できなかった。CIの隔離Postgresには同じProduction default privilegeがなく、従来assertionもUPDATEだけを確認していたため検出できなかった。

## 3. 修正

追加migration `202610020002_marketplace_favorites_privilege_hardening`で次を行う。

- Forward SHA-256: `06c90f210ded5410b2f3be319599510a01ceb1ddb1e8f4e6c4e752c770edc7ad`
- Rollback SHA-256: `916a64f51d71ed5880eee99e74818ece7af9e4231def32bb77821b0864096869`

- `public`、`anon`、`authenticated`、`service_role`からtable権限を一旦すべてrevokeする。
- `authenticated`へSELECT／INSERT／DELETEだけを再付与する。
- `service_role`へSELECT／INSERT／UPDATE／DELETEだけを再付与する。
- canonical schemaとSQL assertionを同じ契約へ同期する。
- assertionはUPDATEに加え、TRUNCATE／REFERENCES／TRIGGERの不存在も確認する。

rollbackでも危険な既定権限を再付与せず、前migrationが意図した最小権限を維持する。全rollbackでは続く`202610020001` rollbackがtableを削除する。

## 4. Production適用

Hotfix PR #612をmerge commit `9d8191389489bfc1b89ba8f45fcb69a2da11baaf`でmergeした後、責任者がforward SHA-256 `06c90f210ded5410b2f3be319599510a01ceb1ddb1e8f4e6c4e752c770edc7ad`を指定してProductionへの1回適用を承認した。local checksum一致を再確認し、`202610020002`を1回適用した。

適用後のread-only postflight結果:

- authenticated: SELECT／INSERT／DELETEのみ
- service_role: SELECT／INSERT／UPDATE／DELETEのみ
- public／anon: table権限なし
- authenticatedのUPDATE／TRUNCATE／REFERENCES／TRIGGER: すべてなし
- service_roleのTRUNCATE／REFERENCES／TRIGGER: すべてなし
- RLS: 有効
- owner限定policy: 3件を維持
- 一意制約とindex: 維持
- お気に入りrow: 0件

作品、商品、publication、注文、決済、Provider、credit、利用期限は変更していない。Supabase CLIのProduction linkはpostflight後に解除した。

## 5. ローカル検証

- お気に入り権限の集中テスト: 3/3成功
- Hub全テスト: 1240/1240成功
- migration／rollback静的検証: 94/94成功
- Hub typecheck、ESLint、依存境界: 成功（依存境界の既知warning 2件、error 0件）
- Next.js Production build: 成功
- `git diff --check`: 成功
