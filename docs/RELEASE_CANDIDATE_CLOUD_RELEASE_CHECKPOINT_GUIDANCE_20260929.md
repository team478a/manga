# Cloud完成版固定の阻害理由案内

## 1. 目的

Cloud作品の完成版を固定できないとき、利用者が次に修正する場所を作品画面だけで判断できるようにする。従来は「原稿チェックの要修正を解消し、全ページを確定してください」という共通案内だけで、画像未生成、ページ未確定、設定変更後の再確認、生成処理中のどれが残っているかを完成版固定欄から判別できなかった。

## 2. 実装

- 原稿preflightを入力にする`buildCloudReleaseCheckpointGuidance`を追加した。
- 完成版固定欄へ、要修正の総数と次の主要な阻害理由を件数付きで表示する。
  - 画像未生成のコマ
  - 画像生成が完了していないページ
  - 未確定のページ
  - 設定変更後の再確認が必要なページ
- 案内から同じ作品画面の「原稿チェック」へ移動できるようにした。表紙、ページ順、素材、文字、品質検査など他の要修正は原稿チェックの詳細で確認する。
- preflightを取得できない場合は、完成条件を確認できない旨を表示して完成版固定をfail closedにする。
- 固定buttonの有効条件は従来と同じ`CloudManuscriptPreflightReport.ready`であり、案内追加によって条件を緩和しない。

## 3. 変更範囲

- `src/lib/cloud-release-checkpoint-guidance.ts`
- `src/app/creator/[projectId]/ProjectCheckpointPanel.tsx`
- `src/app/creator/[projectId]/page.tsx`
- `tests/cloud-release-checkpoint-guidance.test.mjs`
- `tests/cloud-project-checkpoint.test.mjs`

DB schema、migration、release checkpointの保存処理、publication固定処理は変更していない。

## 4. 検証

- focused: 15/15成功
- Hub: 1145/1145成功
- Canvas: 26/26成功
- AI: 50/50成功
- Desktop: 407/407成功
- Desktop accessibility: 29画面、blocking violation 0
- dependency check: error 0、既知warning 2
- lint: 成功
- typecheck: 成功
- migration validation: 88/88成功
- Web build: 成功
- Desktop build: 成功
- RC preflight: repository structure成功。外部設定と手動E2Eは資格情報未注入の既知PENDING。
- `git diff --check`: 成功

## 5. Production安全境界

この変更ではProductionへ接続していない。DB mutation、release checkpoint作成、完成版固定、作品公開、商品active化、購入、Stripe、Storage object、Provider、生成Job、credit、利用者データの変更は行っていない。

## 6. 次の工程

Draft PRの全CIとVercel Preview成功を確認して停止する。merge後は対象利用者がProduction作品画面で阻害理由を確認できる。実際のrelease checkpoint作成、完成版固定、作品公開、商品active化、購入はそれぞれ別の明示承認を必要とする。
