# MANGAI 長編作品の連続性管理 v1

更新日: 2026-08-01

## 目的

32〜100ページの制作で、衣装、居場所、人物関係、時系列、小物、口調・呼称と伏線の状態を見失わないようにする。外部AIを呼ばなくても確定的に判定できる範囲を先に提供し、将来のAI連続性検査の入力根拠にする。

## 実装

- ページ範囲付きの`cloud_continuity_facts`
- 提示、回収予定、回収実績を持つ`cloud_plot_threads`
- 所有者と作品編集権限を二重確認する保存・削除RPC
- 同じ対象・項目・重複ページ範囲に異なる値がある場合の矛盾警告
- 回収予定ページを過ぎた伏線と、回収ページ未記録の警告
- 一貫性画面での登録、一覧、削除、伏線状態更新
- migration未適用環境では、従来の画像生成履歴チェックを維持するfallback

## 判定境界

この版は登録済みの構造化事実だけを比較する。画像の見た目、自然言語本文の意味、事実として登録されていない設定は推測しない。根拠のないAI判定を利用者へ断定表示しない。

## セキュリティ

- RLSのSELECTは現在のプロフィールと作品閲覧権限を要求
- 書き込みRPCは現在のプロフィールと作品編集権限を要求
- `security definer`関数は`search_path=public,pg_temp`を固定
- RPCは`anon`と`public`から実行権限を剥奪
- Server ActionはUUID、文字数、ページ範囲をDBアクセス前に検証
- 内部DBエラーは利用者へ露出しない

## Database

- forward: `supabase/migrations/202608010008_cloud_narrative_continuity.sql`
- rollback: `supabase/rollbacks/202608010008_cloud_narrative_continuity.sql`
- migration番号: 40本目

## 検証

- Hub `379/379`、Canvas `26/26`、AI `48/48`
- dependency境界、Lint、Hub/Desktop型検査、Desktop統合・a11y
- 40 migrationの静的検査、実DB forward／rollback／reapply
- canonical schema二重適用、data idempotency、production build、`git diff --check`

## 外部作業

Supabase環境へのmigration適用、実作品を用いた画面確認、運用語彙の調整は責任者確認後に行う。本ブランチから外部環境への適用は行わない。
