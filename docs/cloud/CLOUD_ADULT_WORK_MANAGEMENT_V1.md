# Cloud成人向け作品管理 v1

## 実装結果

採用済み成人向けネームから作成したCanvas Projectを、本人限定の非公開作品として一覧・詳細管理できる縦型機能を追加した。

### 利用者機能

- `/dashboard/adult-works`で成人向け作品だけを一覧表示
- タイトル、説明、制作状態、非公開メモを保存
- 下書き、編集中、確認中、完成、保管の状態管理
- Project編集、Canvas編集、本編PDF、連番画像への導線
- loading、empty、error、not found状態
- 一般向け作品管理との明示的な切り替え

### 境界

- 成人向け作品の正本は`cloud_projects`であり、公開用`works`へ複製しない。
- `content_class=adult`、`visibility=private`、`age_rating=18歳以上`を更新時にも固定する。
- RLSとServer側検証の両方で所有者本人だけを許可する。
- 公開、共同編集、Marketplace、販売パッケージ、Cloud画像生成への導線を提供しない。
- 外部Providerへ作品情報を送信しない。

### 運用制御

- 環境Flag: `CLOUD_ADULT_WORK_MANAGEMENT_ENABLED`
- DB Kill Switch: `cloud_adult_work_management_settings.enabled`
- 既存の成人向けネーム許可・同意が前提
- 管理画面: `/admin/adult-research`
- preflight: `npm run cloud:adult-work-management:preflight`

## Migration

- forward: `202607300010_cloud_adult_work_management.sql`
- rollback: `202607300010_cloud_adult_work_management.sql`
- 追加:
  - `cloud_adult_work_management_settings`
  - `cloud_adult_work_records`
  - `can_use_cloud_adult_work_management()`
  - `set_cloud_adult_work_management_enabled(...)`
  - `update_cloud_adult_work(...)`
  - 成人向けProject登録triggerと既存Project backfill

## 検証

- deps:check: PASS
- lint: PASS
- typecheck: PASS
- research:eval: PASS
- hub:test: PASS（278/278）
- 集中テスト: PASS（4/4）
- migration静的検証: PASS（30件）
- Hub production build: PASS
- `git diff --check`: PASS
- preflight: ローカル環境変数未設定のため想定どおりFAIL。値は表示していない。

## 未実施

- Supabase stagingへのmigration適用
- Preview環境のFeature Flag／DB Kill Switch有効化
- 所有者・別ユーザーでの実機E2E
- 390px、768px、1280pxのPreview目視確認
- PR merge、本番公開
