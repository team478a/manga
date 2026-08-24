# Production品質イベント5xx再送loop修正

作成日: 2026-08-24
Branch: `codex/fix-production-quality-event-5xx`
Base: `35c358f`（PR #327 merge commit）

## Production証跡

Vercel Logsで`app.mang-ai.com`の`POST /api/creator/manga-quality-events`が同一ミリ秒帯に多数500となることを確認した。参照元は対象作品22ページ、deploymentは`dpl_EjYtBf2cCPF7xDsqSAFz8Jd7vMBR`、environmentはProduction、branchは`feature/manga-canvas-mvp`だった。

品質イベントは生成や課金ではなく、完成候補の表示・採用・不採用を保存するテレメトリである。22ページのCanvas修復保存、Provider、creditへの失敗ではない。

## 原因と修正

Editorは完成Assetを持つJobごとに`displayed`を送る。失敗時に送信済みSetからJob IDを削除していたため、3秒周期の生成Job更新で同じJob群を再送した。

- `displayed`は画面session内でJobごとに1回だけ試行し、失敗しても自動再送可能へ戻さない。
- RPCが`P0001 / cloud_generation_job_not_found`を返す場合だけ、所有者として記録不能な旧Jobの表示テレメトリとして非致命化する。
- `selected`／`rejected`は品質承認契約なので非致命化しない。
- relation／function不足、権限、未知RPCエラーなども握り潰さない。

## 不変境界

API payload、DB schema、migration、RPC、RLS、Storage、Provider、model、pricing、credit、生成Job、Canvas、PNG／PDFを変更しない。Productionへの書込みも行っていない。

## 検証

- 集中テスト: 4/4成功
- dependency boundary: error 0、既存warning 2件
- lint: 成功
- Hub／Desktop typecheck: 成功
- Hub全回帰: 833/833成功
- `git diff --check`: 成功

## Production受入れ

mergeとProduction反映後、22ページを1回だけ再読込し、同routeの連続5xxが再発しないことをVercel Logsでread-only確認する。Provider実行、credit予約、生成、Canvas修復は行わない。
