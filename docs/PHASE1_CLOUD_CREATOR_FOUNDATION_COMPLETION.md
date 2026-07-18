# MANGAI Cloud Creatorデータ基盤 Phase 1完了報告

完了日: 2026-07-18

## 結論

一般漫画を扱うCloud Creatorのデータ基盤を実装し、Phase 1の完了条件を満たしました。成人向け作品はCloudへ保存・importできず、Desktopローカル専用というPhase 0の境界を維持します。

## 実装済み

- Project、Episode、Page、Asset、Canvas snapshot、Project version、共同作業者候補のDB schema
- 所有者、公開・限定公開利用者、承認済み共同作業者、管理者を分離するRLS
- 一般向けProjectだけを許可するDB制約、共通Zod contract、Server再検証
- private `cloud-assets` bucket、5分署名URL、所有者／Project／Asset UUID namespace
- 1 Asset 20MB、Project合計2GB、MIME、画像decode、寸法、SHA-256検証
- Page revisionによる楽観lock、Canvas snapshot復元、Project version履歴
- Soft deleteと30日以内の復元。削除済みデータは所有者・管理者以外へ非公開
- Desktop一般作品の`Cloud移行Project.json`生成とCloud import API
- forward／rollback migration、正規schema、CI assertion、staging preflight拡張

## 完了条件の確認

| 完了条件                                      | 結果 | 検証方法                                     |
| --------------------------------------------- | ---- | -------------------------------------------- |
| 別ユーザーが非公開Projectと素材を取得できない | 合格 | PostgreSQL RLS否定テスト、Storage policy検査 |
| Page変更を再読込後に復元できる                | 合格 | snapshot保存・読取RPCテスト                  |
| 競合更新を上書きせず検出できる                | 合格 | stale revisionの`revision_conflict`検証      |
| 成人向けmanifestをimportできない              | 合格 | Zod、API契約、PostgreSQL RPC否定テスト       |

## 検証範囲

- PostgreSQL 16: forward適用、RLS／RPC動作、全rollback、再適用
- `supabase/schema.sql`: 新規DBへ2回適用し、冪等性とstaging preflight assertionを確認
- Hub: TypeScript、ESLint、21/21テスト、本番build
- Desktop: TypeScript、ESLint、83/83統合テスト、本番build、日英29画面・状態のaxe違反0件
- 共通core: ai-core 35/35、canvas-core 25/25

実Supabase stagingへの適用、認証済みブラウザーによるE2E、運用バックアップからの復元は、接続情報と外部環境が必要なRC受入れ項目です。Phase 1のローカル実装完了とは分離して追跡します。

## 次のフェーズ

Phase 2ではProject一覧、新規作成、Episode／Page管理、Asset Library、Canvas配置から実装し、一般向け3Page作品をブラウザーだけで作成・再編集・書き出せる状態を目指します。
