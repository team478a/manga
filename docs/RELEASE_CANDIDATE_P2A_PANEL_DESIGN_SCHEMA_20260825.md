# P2-A コマ意味設計schema Release Candidate

## 結論

既存Canvas、Storyboard、生成Jobを変更せず、編集可能なコマ意味設計とappend-only revision履歴を追加した。保存はowner境界、現行Canvas内panel、optimistic revisionをDBで検証する。Providerや生成処理は変更しない。

## 基準

- Base: PR #350 merge commit `845df71d862827a8849a17185fb61b867ef1cab6`
- Branch: `codex/p2a-panel-design-schema`
- Migration: `202608250004_cloud_panel_designs.sql`（manifest 70件）

## 実装

- `cloud_panel_designs`: project／page／panelごとの現在revisionと64KiB以下のschema v1設計JSON
- `cloud_panel_design_versions`: 保存ごとのappend-only snapshot
- 意味項目: 読み順、場所／時間／天候、人物version／行動／表情／ポーズ／視線／位置、camera、小物version／持ち手／左右、dialogue参照、連続状態、生成方向、変更理由
- owner RLSはread only。書込みはowner再確認付きRPCまたはservice roleに限定
- 新規保存はexpected revision `null`、更新は現在revision一致を必須とし、lost updateを拒否
- 対象panelが当該pageの現行Canvas snapshotに存在しない場合は拒否
- データ存在時のrollbackを停止

## 検証

- 集中2/2、Hub 861項目／865 tests
- Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0
- PostgreSQL 16 forward／rollback／reapply、canonical schema二重適用
- migration 70件の静的検査、deps、lint、全型検査、Hub／Desktop build、RC structure、diff check

## 境界

- UI、materialization、prompt compilerは後続P2-B／C
- Production、Provider、Worker、Job、Storage、credit操作0件
