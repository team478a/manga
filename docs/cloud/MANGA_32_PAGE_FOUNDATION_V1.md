# MANGAI 32ページ制作基盤 v1

## 目的

Phase M4前半として、既存の作品・話・ページを壊さず、32ページ読切を章・シーン単位で整理できる基盤を追加する。

## 実装範囲

- `cloud_chapters`と`cloud_scenes`を追加する
- 既存の`cloud_episodes`へ`chapter_id`、`cloud_pages`へ`scene_id`を任意列として追加する
- 既存作品へ第1章と既定シーンを自動作成して関連付ける
- 新規作品では第1章・第1話・シーン1・1ページ目を同時作成する
- 章、話、シーン、ページを追加できる
- 同じ話の中でページをドラッグして並べ替え、別シーンへ移動できる
- ページを単ページ／見開きで確認できる
- ページカードは最初の12件だけ描画し、12件ずつ追加表示する

## 互換性

- 既存RPCの引数と戻り値は維持する
- migration未適用時は既存の話・ページ表示へfallbackし、構造編集だけを停止する
- 既存Canvas、Asset、画像生成、Export、成人向け、Desktopの契約は変更しない
- page numberは作品全体の順序、order indexは話内の順序として維持する

## 安全境界

- 所有者または編集権限を既存の`cloud_project_can_edit`で再検証する
- 異なる作品・異なる話へのドラッグ移動を拒否する
- DB内部エラーを利用者へ露出しない
- migrationは冪等、rollback可能、既存履歴を変更しない

## 完了条件

- 章・話・シーン・ページの階層を保存・再表示できる
- 32ページでも初期DOMへ12ページ分を超えて描画しない
- 同じ話内でページ順と所属シーンを変更できる
- 単ページ／見開きを切り替えられる
- migration forward、rollback、reapply、canonical schema検査を通過する
- Hub、Canvas、AI、Desktop、Production buildを含む品質ゲートを通過する

## 今回行わないこと

- Batch生成、Queue停止・再開・cancel
- 永続Export Job
- Storage thumbnail生成
- 実Provider有料生成
- Supabase stagingへのmigration適用
- PRのマージ

## 検証記録（2026-08-01）

- `npm run deps:check`: 成功
- `npm run lint`: 成功
- `npm run typecheck`: Hub／Desktopとも成功
- `npm run hub:test`: 354/354成功
- `npm run canvas:test`: 26/26成功
- `npm run ai:test`: 48/48成功
- `npm run desktop:test`: 182/182成功
- `npm run db:migrations:validate`: 35/35成功
- PostgreSQL 16 migration forward／rollback／reapply: 成功
- canonical schema二重適用とassertion: 成功
- `npm run build`: 成功
- `git diff --check`: 成功
