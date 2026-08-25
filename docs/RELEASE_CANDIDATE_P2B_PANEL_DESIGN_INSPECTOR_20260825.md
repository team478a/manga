# P2-B コマ設計materialization・Inspector

## 結論

P2-Aのversion付きコマ設計正本を、既存Canvasから選択・編集・保存できる。既存設定からのmaterializationは利用者が押した場合だけ下書きを作り、確認して保存するまでDBを変更しない。

## 実装

- ownerページの現在設計を取得する`GET /api/creator/panel-designs`。
- assignment、continuity state、最新panel specificationから下書きを返す明示`POST`。
- P2-A RPCへoptimistic revision付きで保存する`PUT`。
- Canvasの選択コマへ追従するInspector。未作成、保存revision、人物・小物件数を表示する。
- 場面、天候、camera、構図、継続状態、生成方向、変更理由を編集する。
- P2 migration未適用時はInspectorだけを安全に停止する。

## 境界

- 自動backfill、ページ一括materialization、既存正本の上書きはしない。
- Canvas、Storyboard、Job input、Prompt compiler、Provider経路は変更しない。
- Provider／model固有値をコマ設計へ保存しない。
- Production、Provider、Worker、Job、Storage、creditを操作しない。

## 検証

- 集中テスト4/4。
- Hub 867/867、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0。
- migration 70件、deps、lint、全型検査、Hub／Desktop build、RC structure、diff check成功。
- `npm audit`の5件とmodule warning 2件は既存・差分外。CI結果はPR証跡へ同期する。

## 次

P2-CでFeature Flagを既定OFFにしたまま、コマ設計revisionを単一／batch生成入力へ固定する。P2-Bのmerge前には開始しない。
