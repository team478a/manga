# Cloud成人向けAIネーム v1

## 利用フロー

1. 管理者が成人向け市場分析、AI企画、AIシナリオ、AIネームを順に許可する
2. 全体Kill Switchと対象PreviewのFeature Flagを有効にする
3. 利用者が成人向けシナリオを採用する
4. AIネーム画面で18歳以上・架空成人・合意・実在人物禁止・外部AI送信へ同意する
5. AIが初稿ネームを生成する
6. 利用者が修正版を作成し、履歴から1版を採用する
7. 成人向けCanvas／画像生成の手前で停止する

## 必要な環境変数

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLOUD_RESEARCH_MVP_ENABLED`
- `CLOUD_PROPOSAL_GENERATION_ENABLED`
- `CLOUD_SCENARIO_GENERATION_ENABLED`
- `CLOUD_STORYBOARD_GENERATION_ENABLED`
- `CLOUD_ADULT_RESEARCH_ENABLED`
- `CLOUD_ADULT_AI_PLANNING_ENABLED`
- `CLOUD_ADULT_SCENARIO_GENERATION_ENABLED`
- `CLOUD_ADULT_STORYBOARD_GENERATION_ENABLED`

OpenAI APIキーは管理画面からSupabase Vaultへ保存された既存設定を再利用する。Vercel環境変数やローカル`.env`へ複製しない。

## migration

- forward: `supabase/migrations/202607300008_cloud_adult_storyboard.sql`
- rollback: `supabase/rollbacks/202607300008_cloud_adult_storyboard.sql`

追加対象は、専用settings、consents、アクセス判定関数、管理関数、Storyboardの`content_class`および所有者RLSである。rollbackは成人向けデータ、同意、許可が存在する場合に停止し、データを暗黙削除しない。

## 管理者確認

1. migrationをstack順にstagingへ適用
2. `/admin/adult-research`で成人向けAIネームのDB設定を有効化
3. `/admin/users/[id]`で対象者へ`adult_storyboard`を許可
4. Preview branchだけにFeature Flagを設定
5. 同意、初稿、修正、履歴、採用を確認
6. 成人向け採用版にCanvasボタンが表示されないことを確認
7. 一般向けネームからは従来どおりCanvasへ進めることを確認
8. 390px、768px、1280pxで横overflowがないことを確認
