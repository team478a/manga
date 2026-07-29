# MANGAI Cloud シナリオ生成MVP仕様

作成日: 2026-07-29
対象Release: Release 3

## 1. 入力契約

入力は所有者本人の`cloud_story_proposal_selections`に保存された採用企画snapshotと、その選択に紐づく市場分析Reportとする。Browserから所有者ID、企画本文、ページ数を指定させず、Serverで再取得する。

## 2. 出力

```ts
type CloudScenarioResult = {
  engineVersion: "scenario-rules-v1";
  generatedAt: string;
  classification: "ai_inference";
  revisionFocus: "initial" | "pacing" | "character" | "clarity";
  title: string;
  logline: string;
  totalPages: number;
  characters: Array<{
    id: string;
    role: string;
    description: string;
    goal: string;
    change: string;
  }>;
  acts: Array<{
    act: 1 | 2 | 3;
    label: string;
    pageStart: number;
    pageEnd: number;
    purpose: string;
    turningPoint: string;
  }>;
  scenes: Array<{
    id: string;
    order: number;
    pageStart: number;
    pageEnd: number;
    heading: string;
    purpose: string;
    summary: string;
    characters: string[];
    dialogueGoal: string;
    visualBeat: string;
  }>;
  continuityChecks: string[];
  proposalTrace: {
    proposalSelectionId: string;
    candidateId: string;
    researchReportId: string;
    sourceUrls: string[];
  };
};
```

シナリオは制作仮説であり、市場の事実ではない。画面にengine version、生成日時、版番号、改稿方針を表示する。

## 3. 版管理

### `cloud_scenario_runs`

- 所有者Profile ID
- 企画採用ID、元市場分析Report ID
- 親Run ID（初稿は`null`）
- 企画採用内で単調増加する版番号
- 完了状態、結果JSON、engine version、作成／完了日時

Runはimmutable。改稿は既存行を更新せず、新しいRunを作成する。版番号採番はsecurity definer関数内でadvisory lockを取得して行う。

### `cloud_scenario_confirmations`

- 所有者Profile ID
- 企画採用ID
- 確定Scenario Run ID
- 確定時のScenario snapshot
- 確定日時

企画採用ごとに確定は1件とし、Release 3では変更・削除しない。

## 4. 画面

- `/dashboard/scenarios`: シナリオ版履歴
- `/dashboard/scenarios/[runId]`: 構成・人物・シーン・ページ配分、改稿、版確定
- 採用済み企画詳細: 初稿生成、既存シナリオへの導線

## 5. 安全性

- 一般向け企画だけを処理する。
- 参考作品の固有表現・人物・設定を模倣しない。
- Promptや創作本文を通常ログへ出さない。
- DB例外の詳細を利用者へ返さない。
- JSON容量をServerとDBの両方で制限する。
- 不正UUIDはDBへ照会しない。
- RLS、Server query、作成関数の三層で所有者を限定する。
- Feature Flag停止中は詳細URLでもDB照会前に停止する。

## 6. 次工程

確定済みScenario snapshotだけをRelease 4「マンガ生成」へ渡す。未確定Runからは次工程へ進めない。Release 3では遷移条件の表示までとし、画像・コマ・吹き出しは生成しない。
