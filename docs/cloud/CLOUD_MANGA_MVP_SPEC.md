# MANGAI Cloud マンガ下書き生成MVP仕様

作成日: 2026-07-29
対象Release: Release 4

## 1. 入力

所有者本人の`cloud_scenario_confirmations`と、そこへ固定されたScenario snapshotだけを入力とする。未確定Runからは生成しない。

## 2. 出力

```ts
type CloudMangaPlanResult = {
  engineVersion: "manga-layout-rules-v1";
  generatedAt: string;
  classification: "ai_inference";
  title: string;
  totalPages: number;
  projectSettings: {
    ageRating: "全年齢";
    readingDirection: "rtl";
    width: 1600;
    height: 2400;
    dpi: 300;
  };
  scenarioTrace: {
    confirmationId: string;
    scenarioRunId: string;
    proposalSelectionId: string;
  };
  pages: Array<{
    pageNumber: number;
    sceneId: string;
    sceneHeading: string;
    sceneSummary: string;
    pageRole: "opening" | "development" | "turning_point" | "climax" | "resolution";
    layoutId: "single" | "top_one_bottom_two" | "four_equal" | "six_equal";
    panelCount: 1 | 3 | 4 | 6;
  }>;
};
```

Pageは1から連続し、ScenarioのScene page rangeを漏れなく割り当てる。Scene境界と作品の冒頭・末尾は大きいコマを優先し、中間ページは3〜6コマの規則ベース案を割り当てる。

## 3. 永続化

### `cloud_manga_generations`

- 所有者Profile ID
- Scenario confirmation ID（unique）
- Scenario Run ID
- 作成したCloud Project ID（unique）
- 完了状態
- 生成結果JSON、engine version、完了日時

作成RPCはScenario、所有者、trace、Page数、Scene範囲を再検証し、Cloud Project、Episode、全Page、revision 0 Canvas snapshot、Project versionを原子的に作成する。

## 4. Canvas下書き

- Project: 一般向け、private、右綴じ、1600×2400px、300dpi
- Episode: `第1話`
- Page: Scenario page数と同数
- Canvas: Pageごとのlayoutに対応する1／3／4／6コマ
- Panel image、吹き出し、テキストは空

Scenario本文はCanvasへ埋め込まず、マンガ生成詳細画面でScene指示として表示する。これによりCanvas出力へ制作メモが混入することを防ぐ。

## 5. 画面

- `/dashboard/manga`: 保存済みマンガ下書き履歴
- `/dashboard/manga/[generationId]`: Scenario trace、ページ構成、Canvas導線
- 確定Scenario詳細: 下書き生成または既存下書きへの導線
- `/creator/[projectId]`: 既存Project管理
- `/creator/[projectId]/pages/[pageId]`: 既存Canvas Editor

## 6. 制限

- 1〜200Page
- 一般向けのみ
- 1Confirmationにつき1Project
- 外部画像生成は自動実行しない
- 生成結果全体をAI推論・制作仮説として表示する

## 7. 次工程

Canvasで編集可能なProjectが作成された時点でRelease 4の引継ぎを完了する。作品管理・公開前状態の整理はRelease 5で扱う。
