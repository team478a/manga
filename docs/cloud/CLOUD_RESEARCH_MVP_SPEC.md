# MANGAI Cloud 市場分析MVP仕様

作成日: 2026-07-29  
対象Release: Release 1

## 1. 目的

漫画制作前に、想定市場と読者を証拠付きで整理し、次のAI企画提案へ渡せるReportを作る。

## 2. 入力

| 項目 | 必須 | 制約 |
| --- | --- | --- |
| ジャンル | 必須 | 1〜80文字 |
| 想定読者 | 必須 | 1〜300文字 |
| 公開プラットフォーム | 必須 | 1〜120文字 |
| 一般／成人向け区分 | 必須 | `general` / `adult` |
| テーマ | 必須 | 1〜300文字 |
| 参考作品 | 必須 | 1〜500文字 |
| 価格帯 | 必須 | 下限0円、上限1,000,000円、下限≦上限 |
| 連載／読切 | 必須 | `series` / `one_shot` |
| ページ数 | 必須 | 1〜2,000Page |

### 出典

最低1件、最大5件。各出典に次を必須保存する。

- HTTPS出典URL
- 出典名
- 取得日時
- 出典から利用者が確認した事実メモ

Release 1は任意URLのServer-side取得を行わない。取得日時と事実メモは利用者が確認して入力する。これによりSSRF、robots、利用規約、動的Page解析の不確実性をRelease 1へ持ち込まない。

## 3. 分析結果

次を保存・表示する。

- 市場需要
- 競合度
- 読者像
- 人気テーマ
- 差別化案
- 価格帯
- 販売チャネル
- リスク
- 次の企画への推奨条件

各項目は以下の構造を持つ。

```ts
type ResearchFinding = {
  label: string;
  summary: string;
  classification: "fact" | "ai_inference";
  sourceUrls: string[];
};
```

Release 1の分析engineは`research-rules-v1`。入力条件と事実メモから定性的な整理だけを行い、市場規模、販売数、成長率などの数値を生成しない。

## 4. 保存契約

`cloud_market_research_reports`へ次を保存する。

- 所有者Profile ID
- `completed` status
- 入力JSON
- 出典JSON
- 結果JSON
- engine version
- 作成日時、完了日時

ReportはRelease 1ではimmutableとする。修正する場合は新しいReportを実行する。

## 5. 権限

- 認証済み利用者だけが作成できる。
- 所有者だけが一覧・詳細を取得できる。
- Service Roleは運用目的で参照可能。
- Browserからowner IDを指定させず、Serverで現在Profileを設定する。

## 6. Feature Flag

`CLOUD_RESEARCH_MVP_ENABLED`

- `true`: 有効
- 未設定または`false`: 無効
- 無効時はDashboardの状態表示、入力画面、Server Actionの三層で停止する。
- 対象Supabaseへmigrationを適用してから`true`へ切り替える。

## 7. 成人向け境界

入力UIは作品区分を必須で記録する。`adult`の場合、Cloud上の分析実行は`CONTENT_REJECTED`として停止し、MANGAI Desktop Adultを案内する。成人向け入力を一般向けCloud AIや外部Providerへ送らない。

## 8. AI企画提案への遷移

- 未実行・失敗: disabled
- `completed` Report詳細: 次工程の推奨条件を表示し導線をenabled表示
- Release 1では遷移先は「Release 2で提供予定」の説明Pageとし、企画生成処理は実装しない。

## 9. 非機能要件

- Prompt、出典の事実メモ、利用者入力を通常ログへ出さない。
- 未知例外の詳細を利用者へ返さない。
- URLはHTTPSだけを許可する。
- 入力とJSONの容量をServer validationとDB制約で制限する。
- 390pxでPage全体の横スクロールを発生させない。
