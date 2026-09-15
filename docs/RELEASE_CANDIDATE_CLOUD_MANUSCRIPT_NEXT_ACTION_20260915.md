# Cloud原稿編集「次に行う操作」導線 修正記録

更新日: 2026-09-15  
対象: MANGAI Cloud 一般向け制作フロー  
状態: `IMPLEMENTED / DRAFT_PR_READY / ALL_CI_PASSED / PRODUCTION_UNCHANGED`

## 1. 対象報告

Productionのモニター報告で、制作工程5「原稿編集」まで進んだ利用者が、画像生成を開始するために次に何を押せばよいか判断できない状態が確認された。報告データと画面はread-onlyで確認し、回答本文、作品、画像、生成Job、credit、報告状態は変更していない。

## 2. 原因

- 完成ガイドの主要ボタンは、画像未生成でも原稿チェック位置へ戻していた。
- 実際のページ選択欄までさらに移動する必要があり、最初の操作が一意に見えなかった。
- ページ未選択時の生成ボタンは無効になるだけで、無効理由と解除方法が近くに表示されていなかった。

## 3. 修正

- 未生成コマがある場合、完成ガイドの次操作を「画像生成するページを選ぶ」とし、ページ生成欄へ直接移動する。
- ページ生成欄の先頭へ「次に行う操作」と「画像生成するページを選ぶ」を常時表示する。
- 「ページを選択 → 見積りを確認 → 紫のボタンで開始」の3手順を表示する。
- 未選択時はボタンを「ページを選択してください」とし、ページ番号のチェック操作を案内する。
- 選択後は選択件数と、生成を止めている条件があればその確認先をaria-liveで案内する。
- 生成済みの場合は従来どおり原稿完成前チェックへ進む。

## 4. 安全境界

- Provider実行、画像生成、Job作成、credit予約・消費は行っていない。
- Production DB、Storage、作品、画像、モニター報告状態、通知は変更していない。
- 報告に含まれた複数画像添付の要望は本修正に含めない。これはDB／Storage契約、一覧UI、上限、後方互換、削除・rollbackを伴うため、独立した設計・実装タスクとして扱う。

## 5. 検証

- 集中テスト（既存Batch UI互換を含む）: 16/16成功
- Hub: 645/645成功
- Canvas: 26/26成功
- AI: 50/50成功
- Desktop: 230/230成功
- Desktop accessibility: 単独再実行で29画面blocking violation 0、visual checks成功
- Dependency boundaries: error 0、既存warning 2件
- lint: 成功
- typecheck: Hub／Desktop成功
- migration validator: 82/82成功
- Hub build: 成功
- Desktop build: 成功（既存のchunk size warningのみ）
- RC preflight: repository structure ready。外部設定と手動E2Eの既存PENDINGは不変
- `git diff --check`: 成功

初回CIは既存の「2ページPilot／4〜8ページ一括生成」案内文が見出し変更で失われたことを1件検出した。新しい次操作表示と併記して既存案内を保持し、関連回帰16/16で修正を確認した。

## 6. Merge後の運用

1. Vercel Previewで未生成作品の完成ガイドからページ生成欄へ直接移動できることを確認する。
2. Production反映後、対象利用者が画像生成を開始できることを確認する。
3. 対応完了通知やモニター報告状態の変更は、反映確認後に責任者の実行時明示承認を得て別工程で行う。
4. 複数画像添付は独立タスクで設計する。

## 7. PR／Preview証跡

- Draft PR: [#467](https://github.com/team478a/manga/pull/467)
- 実装HEAD: `58b7de7`
- Required Quality run `34916648485`: Core quality、Migration roundtrip成功
- Desktop Windows run `34916648430`: Windows build成功
- Vercel、Vercel Preview Comments: 成功
- Preview: https://mangai-hub-staging-1igxhtbx6-team478as-projects.vercel.app
