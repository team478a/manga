# MANGAI Cloud 作品管理MVP仕様

作成日: 2026-07-29
対象Release: Release 5

## 1. Feature Flag

`CLOUD_WORK_MANAGEMENT_MVP_ENABLED=true`のときだけ画面とServer Actionを有効化する。未設定・不正値はfalseとする。

## 2. 対象

- 所有者本人の一般向けCloud Project
- 削除されていないProject、Episode、Page
- マンガ下書き生成Projectと手動作成Projectの両方

## 3. 状態

| 状態 | 意味 |
| --- | --- |
| `draft` | 制作・確認中 |
| `review_ready` | 現行revisionの公開前チェック完了 |
| `approved` | Release 6へ渡すことを利用者が承認 |

`approved`へは`review_ready`からだけ遷移できる。Project revisionが変わった場合は自動的に`draft`へ戻す。

## 4. Page確認

Page確認時に、その時点の`cloud_pages.revision`を保存する。Pageが再編集されrevisionが変わると、以前の確認記録はチェック未完了として扱う。

## 5. 公開前チェック

- Project名がある
- Project説明がある
- 有効な表紙Pageが設定されている
- Pageが1〜200件
- 全PageにCanvas snapshotがある
- 全Pageが現行revisionで確認済み
- 実行中または待機中のCloud AI Jobがない
- 操作時のProject revisionが最新

不足項目が1つでもある場合、`review_ready`または`approved`へ遷移しない。

## 6. 永続化

### `cloud_work_management_states`

- owner profile、project（unique）
- status
- expected project revision
- Release 6向けメモ
- review ready／approved日時

### `cloud_work_page_reviews`

- owner profile、project、page（unique）
- 確認時のPage revision
- 500文字以内の確認メモ
- 確認日時

利用者は両tableを直接更新せず、所有者・revision・公開前条件を再検証するRPCだけを使用する。

## 7. 画面

- `/dashboard/projects`: Cloud Project作品管理一覧
- `/dashboard/projects/[projectId]`: 公開前チェック、Page確認、状態遷移
- `/creator/[projectId]`: 編集を続ける
- Release 5承認後のみRelease 6準備完了を表示

## 8. 安全境界

本Releaseでは`works`、`digital_products`、公開状態、販売ファイルを作成・変更しない。成人向けProjectは既存境界とRPCの両方で拒否する。
