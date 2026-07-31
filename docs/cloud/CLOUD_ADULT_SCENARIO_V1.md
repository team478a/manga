# Cloud成人向けAIシナリオ v1

成人向けAI企画で採用した1案を、人物、三幕構成、ページ範囲付きシーンへ具体化します。一般向けと成人向けは`content_class`で保存時から分離されます。

## 利用者体験

1. 成人向けAI企画を1案選ぶ。
2. 成人向けシナリオ画面へ進む。
3. 初回だけ、18歳以上・架空の成人・合意・実在人物禁止・外部AI送信を確認する。
4. AIが初稿シナリオを作成する。
5. 履歴から内容を再表示し、修正指示で別版を作成する。
6. 制作する版を採用する。

利用者には一般向け／成人向けの区分をバッジで表示します。APIキーや内部判定ロジックは表示しません。

## 管理手順

1. migration `202607300007_cloud_adult_scenario.sql`を対象DBへ適用
2. Preview branch限定で`CLOUD_ADULT_SCENARIO_GENERATION_ENABLED=true`を設定
3. 管理画面「成人向け市場分析の運用」で成人向けAIシナリオのDB設定を有効化
4. ユーザー詳細で「成人向けAIシナリオ機能」を許可
5. 利用者がシナリオ画面で専用条件へ同意

事前確認は`npm run cloud:adult-scenario:preflight`で行います。秘密値そのものは出力しません。

## 停止境界

成人向けシナリオは採用まで可能です。成人向けAIネーム、Canvas、画像生成は本版では利用できません。画面、Server Action、RLSの三層で一般向けネーム工程への混入を拒否します。

## 未実施

- Supabase stagingへのmigration適用
- Vercel PreviewのFeature Flag有効化
- 有料OpenAI API呼出
- 実データE2E
- PR merge、本番公開
