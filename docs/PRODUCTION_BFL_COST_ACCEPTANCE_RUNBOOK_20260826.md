# Production BFL原価guard 1 Job受入れrunbook

## 目的と承認範囲

`202608250006_bfl_flux2_pro_cost_guard.sql`適用後、参照付きBFL `flux-2-pro` 1 Jobだけで予約上限、Provider実額反映、差額解放を確認する。責任者承認済み上限は予約`$0.180`。自動retry、別Job、Production修復、追加credit予約は範囲外とする。

## 実行前の停止条件

- PCから対象Supabase project `vmdsyxykcrgxcdbrwlkv`へアクセスできない。
- remote migration一覧を読み取れない、または想定外のdriftがある。
- `bfl-flux2-pro-2026-08`が有効でない、BFL設定が無効、queueが0件でない。
- 一般向け固定素材、参照画像、対象ownerを一意に確認できない。
- 予約見積りが`$0.180`を超える。

いずれかに該当したら変更・生成せず停止し、秘密値やPromptを含めず状況だけを記録する。

## 手順

1. remote migration一覧を読み取り、未適用分と順序を記録する。
2. manifest順に未適用migrationだけを適用する。既存migrationは変更せず、各適用後にschema検査を行う。
3. 管理画面で`bfl-flux2-pro-2026-08`が有効、予約額が最大`$0.180`、queueが0件であることを確認する。
4. 一般向け固定Projectの参照付き1コマだけを送信する。二重送信を避け、自動retryは行わない。
5. Job終端後、Provider／model／pricing version、予約額、実額、解放額、Asset 1件、重複Jobなしを確認する。
6. moderation、timeout、Provider失敗でも再送しない。予約解放だけを確認して停止する。

## 記録する証跡

- migration適用前後のversion一覧とschema検査結果
- Job状態遷移、予約額、実額、解放額（秘密値、Prompt、Provider Job IDは除外）
- Asset件数、queue件数、重複送信なし
- 実費と承認上限の比較

Production修復や追加試験が必要になった場合は、別の明示承認を得る。
