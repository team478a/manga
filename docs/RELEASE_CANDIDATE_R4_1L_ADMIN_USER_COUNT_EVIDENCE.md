# PR-R4-1l 管理画面ユーザー件数整合性 証跡

## 結論

Productionの管理画面TOPがProfile 12件を数える一方、ユーザー一覧は削除済みAuthアカウントを除外して11人を表示していた。管理画面TOPと一覧を同じAuth可視判定へ統一し、削除済みAuthアカウントとAuth参照を失ったProfileを登録ユーザー件数から除外する。

市場分析のRLS再帰修正後に行った読み取り専用の横断監査で発見した表示不整合であり、市場分析Report、一般モニター資格、保存、Provider、creditには影響しない。

## 基準と範囲

- Base: `origin/feature/manga-canvas-mvp` / `3fd2d54`（PR #229 merge commit）
- Branch: `codex/fix-admin-user-count-consistency`
- Draft PR: [#230](https://github.com/team478a/manga/pull/230)
- 対象: 管理画面TOPの登録ユーザー数、ユーザー一覧の可視判定、account application／repository
- 対象外: DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas、PDF／PNG、成人向け境界、Stripe、Desktop

## 原因

管理画面TOPは`profiles`の全行を直接countしていた。ユーザー一覧はSupabase Auth Adminのdirectoryと照合し、`deleted_at`のあるAuthアカウントとAuth directoryに存在しないProfileを除外していたため、同じ「登録ユーザー数」に異なる条件が使われていた。

## 修正

- ProfileとAuth directoryから可視ユーザーを決める純粋なapplication関数を追加する。
- ユーザー一覧の既存filterを共通関数へ置き換える。
- 管理画面TOPはrepository経由で同じAuth directoryを参照し、共通関数で件数を計算する。
- Supabase Admin環境変数がない環境は従来どおりProfile件数を表示する。
- Auth directory取得障害時は不正確な件数を表示せず「確認」と表示する。

## 検証

- 集中テスト: 13/13成功
- full `rc:validate`: 成功
- Hub: lint、typecheck、632/632 tests、production build成功
- Desktop: lint、typecheck、182/182 tests、renderer build成功
- migration: 52/52 validation成功
- GitHub: Core quality、Migration roundtrip、Windows build成功
- Vercel／Vercel Preview Comments: 成功
- Preview: https://mangai-hub-staging-git-codex-fix-admi-61f545-team478as-projects.vercel.app

## Productionへの影響と確認

このPRは読取集計だけを変更する。ユーザー、Profile、招待、モニター、Reportを作成・更新・削除しない。merge後のProductionでは管理画面TOPと`/admin/users`の件数一致を読み取り専用で確認する。

## ロールバック

PRのcommitをrevertすると、管理画面TOPだけがProfile全件countへ戻る。DB・Auth・利用者データのrollbackは不要。
