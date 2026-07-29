# MANGAI Cloud 販売準備MVP仕様

作成日: 2026-07-29
対象Release: Release 6

## 1. Feature Flag

`CLOUD_SALES_PREPARATION_MVP_ENABLED=true`のときだけ画面とServer Actionを有効化する。未設定・不正値はfalseとする。Release 1〜5のFeature Flagも有効であることを前提とする。

## 2. 開始条件

- 所有者本人の一般向けCloud Project
- `cloud_work_management_states.status = approved`
- 承認時の`expected_project_revision`が現行Project revisionと一致
- 削除されていないProject

## 3. 生成物

- 表紙Pageから生成するPNG
- 全有効Pageから生成するPDF
- `works`: `draft`かつ非公開
- `digital_products`: `paused`

作品・商品は既存の`source_project_id`を利用して冪等同期する。公開中作品または販売中商品は自動上書きしない。

## 4. 永続化

### `cloud_sales_preparations`

- owner profile、project（unique）
- 同期したProject revision
- work ID、product ID
- 販売価格
- 表紙URL、商品Storage path
- 同期日時

利用者はtableを直接更新せず、Release 5承認とrevisionを再検証するRPCだけを使用する。

## 5. 画面

- `/dashboard/sales-preparation`: 承認済みProjectと同期状態
- `/dashboard/sales-preparation/[projectId]`: 差分、価格、同期操作、作品・商品編集導線

Creator画面からの直接同期は廃止し、販売準備画面へ集約する。

## 6. 状態

| 状態 | 意味 |
| --- | --- |
| `未同期` | 承認済みだが作品・商品をまだ作成していない |
| `同期済み` | 現行の承認revisionで下書きを作成済み |
| `要再同期` | Project revisionまたは承認が同期時点から変わった |
| `公開・販売中` | 自動更新を停止し、既存管理画面での操作を要求 |

## 7. 安全境界

本Releaseは作品・商品を公開せず、Stripe処理や売上集計を実行しない。Storage upload後にDB同期が失敗した場合は新規ファイルを補償削除する。成人向けProjectはDBとServerの両方で拒否する。
