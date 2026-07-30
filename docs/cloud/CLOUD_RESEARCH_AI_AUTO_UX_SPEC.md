# Cloud Research AI Auto UX

更新日: 2026-07-30

## 目的

市場や販売の知識がない利用者でも、簡単な希望だけから「今、どんな漫画が買われる可能性が高いか」と具体的な商品設計を得られるようにする。出典URLや確認事実は利用者へ入力させない。

## 利用者フロー

1. ジャンルとテーマ・読後感を選ぶ。両方とも「AIにおまかせ」を選択できる。
2. 作品イメージは必要な場合だけ入力する。
3. 読者、販売先、連載形式、価格帯、ページ数に希望がある場合だけ詳細設定を開く。初期値はすべてAIおまかせとする。
4. 「どんな作品が売れやすいか調べる」を押す。
5. Serverが管理設定とAPIキーを取得し、OpenAI Responses APIへ一般向け制作条件を送信する。
6. 異なる2ドメイン以上のWeb引用と構造化された12項目が揃った場合だけReportを保存する。
7. 「今、狙う作品」「買われる理由」「おすすめの商品設計」を最初に表示し、詳細結果をその後に表示する。
8. 利用者画面は結果だけを表示し、内部評価ロジックと出典情報は表示しない。

## 管理者フロー

1. migration適用後、`/admin/research-ai`を開く。
2. OpenAI APIキーを入力する。
3. `gpt-5.6-terra`（推奨）、`gpt-5.6-sol`、`gpt-5.6-luna`からmodelを選ぶ。
4. 実行状態を有効にして保存する。
5. 保存後は設定済み状態だけを確認でき、キー本体と末尾文字は再表示されない。

## 秘密値設計

- APIキーは`vault.create_secret`または`vault.update_secret`でSupabase Vaultへ保存する。
- `cloud_research_ai_settings`にはVaultのUUID、model、実行状態だけを保存する。
- 復号RPCは`service_role`だけが実行できる。
- 管理操作監査にはaction、model、実行状態、日時だけを記録する。
- rollbackはVault secretまたはAI生成Reportが残る場合にfail closedする。

## AI分析契約

- Responses API
- `store: false`
- Web search tool
- JSON Schemaによる12項目のStructured Output
- privacy-preservingな` safety_identifier`
- 60秒timeout
- 利用者ごとに1分3回のServer側rate limit
- 異なる2ドメイン以上の引用URLが必須
- 直近12か月の情報を優先
- 需要と競合の両面を調べ、人気だけでなく差別化できる市場の隙間を探す
- 今狙う作品、買われる理由、おすすめの商品設計、市場需要、競合、読者、人気テーマ、差別化、価格、販売先、リスク、次の企画条件
- 出典で確認できない市場規模、販売数、成長率、順位などの数値を生成しない
- 売上を保証する表現を使用しない

## 成人向け境界

今回の管理キーは一般向け市場分析専用である。成人向け入力はProvider設定の取得前に拒否し、外部送信しない。成人向けAI分析を提供する場合は、外部Provider名・送信項目・保存期間を示した明示同意と、管理者による機能単位許可を別フェーズで設計する。

## 適用手順

1. `supabase/migrations/202607300001_cloud_research_ai_provider.sql`をstagingへ適用する。
2. `/admin/research-ai`でAPIキーを登録する。
3. modelを選択し、実行状態を有効にする。
4. 一般ユーザーで`/dashboard/research/new`から分析を実行する。
5. 履歴と詳細再表示を確認する。

キーはVercel環境変数へ追加しない。既存の`SUPABASE_SERVICE_ROLE_KEY`はServerでVault RPCを呼ぶために引き続き必要である。
