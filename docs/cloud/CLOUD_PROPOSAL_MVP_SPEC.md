# MANGAI Cloud AI企画提案MVP仕様

作成日: 2026-07-29
対象Release: Release 2

## 1. 入力契約

入力は所有者本人の`completed`市場分析Reportとする。Browserから所有者IDや任意の分析本文を指定させず、ServerでReportを再取得する。

引き継ぐ項目:

- ジャンル、想定読者、プラットフォーム、テーマ
- 参考作品、検討価格帯、連載／読切、ページ数
- 市場分析の差別化案、リスク、次企画への推奨条件
- 出典URLと取得日時

## 2. 出力

1回の生成で、方向性の異なる3候補を作る。

- `balanced`: 市場条件と制作実現性の均衡
- `differentiated`: 差別化を優先
- `focused`: 読者への訴求を絞る

各候補:

```ts
type CloudStoryProposalCandidate = {
  id: string;
  direction: "balanced" | "differentiated" | "focused";
  title: string;
  logline: string;
  readerPromise: string;
  protagonist: string;
  centralConflict: string;
  setting: string;
  theme: string;
  differentiation: string;
  formatPlan: string;
  salesPositioning: string;
  risks: string[];
  researchFindingKeys: string[];
  sourceUrls: string[];
};
```

候補は企画仮説であり、市場の事実ではない。画面にengine versionと生成日時を表示する。

## 3. 保存

### `cloud_story_proposal_runs`

- 所有者Profile ID
- 元市場分析Report ID
- `completed` status
- 3候補のJSON
- engine version
- 作成／完了日時

Runはimmutableとする。

### `cloud_story_proposal_selections`

- 所有者Profile ID
- 元市場分析Report ID
- Proposal Run ID
- 採用候補ID
- 採用時の候補snapshot
- 採用日時

市場分析Reportごとに採用は1件とし、Release 2では変更・削除しない。

## 4. 画面

- `/dashboard/proposals`: 企画Run履歴
- `/dashboard/research/[reportId]/proposal`: 引継ぎ確認と生成
- `/dashboard/proposals/[runId]`: 3候補の比較、採用、採用結果

市場分析未完了、他人のReport、不正UUID、Feature Flag停止中はDB詳細を露出せず停止する。

## 5. 安全性

- `adult`は処理しない。
- 根拠のない市場数値を生成しない。
- 参考作品の固有表現をタイトル・人物名・設定として模倣しない。
- PromptやReport本文を通常ログへ出さない。
- Supabaseエラー詳細を利用者へ返さない。
- JSON容量をServerとDBの両方で制限する。
- RLSに加えServer queryでも所有者を限定する。

## 6. 次工程

採用済みsnapshotだけをRelease 3「シナリオ生成」へ渡す。未採用Runからは次工程へ進めない。Release 2では遷移条件の表示までとし、シナリオ本文は生成しない。
