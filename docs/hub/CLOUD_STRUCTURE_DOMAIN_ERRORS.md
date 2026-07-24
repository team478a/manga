# Cloud Structure Domain Error

更新日: 2026-07-24

## 対象

Cloud CreatorのEpisode／Page追加、Episode名変更、並び替え、論理削除を対象とします。
画面操作はREST APIではなくNext.js Server Actionを経由します。

## DB signal対応

| DB signal                        | Domain Error code   | 利用者向け結果               |
| -------------------------------- | ------------------- | ---------------------------- |
| `cloud_project_not_editable`     | `PERMISSION_DENIED` | Episode／Pageの編集を拒否    |
| `cloud_episode_not_editable`     | `PERMISSION_DENIED` | Episode／Pageの編集を拒否    |
| `cloud_page_not_editable`        | `PERMISSION_DENIED` | Episode／Pageの編集を拒否    |
| `last_episode_cannot_be_deleted` | `VALIDATION_ERROR`  | 最後のEpisode削除を拒否      |
| `last_page_cannot_be_deleted`    | `VALIDATION_ERROR`  | 最後のPage削除を拒否         |
| `invalid_move_direction`         | `VALIDATION_ERROR`  | 不正な移動方向を拒否         |
| その他                           | `INTERNAL_ERROR`    | 操作別の安全なfallbackを表示 |

DB固有signalの解釈は`structure-errors.ts`だけで行います。ServiceとServer Actionは
DBメッセージの部分一致で分岐しません。

## Server Action

Server ActionはDomain Errorの利用者向けメッセージだけをredirect先へ渡します。
未知の例外、DB接続エラー、内部メッセージは操作別fallbackへ置き換えます。
既存のredirect先、成功メッセージ、revalidation範囲は変更しません。

## 互換性

- DB migrationなし
- RPC名、引数、戻り値の変更なし
- Server Action引数と画面仕様の変更なし
- 最後のEpisode／Pageを残す既存のDB invariantを維持

## Rollback

`structure-errors.ts`の追加とStructure Service／Server Actionの変更をrevertします。
DB、保存データ、RPCには影響しません。
