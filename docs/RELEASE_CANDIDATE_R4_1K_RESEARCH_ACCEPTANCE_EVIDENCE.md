# PR-R4-1k Production市場分析RLS受入れ 証跡

## 結論

PR #228 merge後の追加migrationをProductionへ適用し、対象モニターの認証contextで保存済み市場分析4件を所有者RLS経由で参照できることを確認した。報告画面の原因だった`stack depth limit exceeded`は再現しない。

対象本人の認証情報は保有していないため、本人ブラウザでのクリック操作と新規AI市場分析は実行していない。既存Report再表示のDB／RLS阻害要因は解消済みであり、本人による再確認を最終条件とする。

## merge確認

- PR: [#228](https://github.com/team478a/manga/pull/228)
- merge commit: `acac27a`
- base: `feature/manga-canvas-mvp`
- 修正migration: `202608110001_profile_admin_rls_recursion.sql`

## Production migration

適用前は`public.is_admin()`が`SECURITY INVOKER`、関数設定なしだった。merge済みmigrationを適用し、次を確認した。

- `SECURITY DEFINER`: true
- `search_path`: `public, pg_temp`
- `authenticated`のEXECUTE: true
- 関数signatureとadmin判定条件: 変更なし

## 対象モニターRLS受入れ

対象profileに対応するAuth user claimをtransaction内で設定し、`authenticated` roleで検証した。

- `current_profile_id()`が対象profileへ解決: true
- `is_admin()`: false
- 参照可能profile: 自分の1件
- 参照可能市場分析Report: 自分の4件
- 他ownerの参照可能Report: 0件
- 直近Report: completed、input object、findings array 12件を確認

Report本文、利用者入力、Prompt、メールアドレス、認証情報は証跡へ記録していない。

## データ不変確認

migration適用と受入れ試験の前後で対象モニターの業務データは変更していない。

- enrollment: active
- AI利用数: 9
- usage ledger: 9件
- 市場分析Report: 4件
- 新規Provider呼出し、credit消費、Report作成: なし

## Production UI回帰

既存の管理者sessionで次を再読込し、Server errorやRLS再帰がないことを確認した。

- `/admin/users`: 11ユーザーを表示
- `/admin/general-monitors`: 対象モニターをactive、AI利用9/50で表示
- `/dashboard`: サイドメニュー、ログイン名、制作状況を表示
- `/creator`: クラウド制作画面を表示

## 自動検証

- 集中テスト: 14/14成功
- migration validation: 52/52成功
- `git diff --check`: 成功
- full `rc:validate`: 成功
  - Desktop: 182/182
  - Hub: 629/629
  - migration validation: 52/52
  - Hub／Desktop production build: 成功

## 残る本人確認

対象モニター本人に次を依頼する。

1. ブラウザを再読込する。
2. 「市場分析履歴へ」から既存の直近Reportを開く。
3. 既存Reportが表示され、AI企画提案への導線が見えることを確認する。
4. 必要な場合だけ新規市場分析を1件実行し、保存、詳細、再読込、履歴再表示を確認する。

本人確認前に追加のAI利用数を運営側で消費しない。R4-2へ進まない。
