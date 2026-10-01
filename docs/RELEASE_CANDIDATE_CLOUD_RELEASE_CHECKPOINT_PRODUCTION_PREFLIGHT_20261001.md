# Cloud完成版固定 Production事前監査と案内改善（2026-10-01）

## 結論

Productionの対象Cloud作品は、release checkpoint作成条件をまだ満たしていない。対象32ページの制作状態は、確定済み0、未着手24、確認待ち7、要修正1だった。画像snapshot欠落、実行中生成Job、編集ロックは0件で、現在の阻害要因はページ制作状態だけである。

この状態を作品所有者が画面だけで判断できるよう、完成版固定欄へ「未着手・生成中・確認待ち・要修正・確定済み」のページ数を表示し、既存の原稿チェックとページ別修正先へ案内する。完成条件、release checkpoint作成RPC、DB schema、API、生成処理、課金契約は変更しない。

## Production読み取り専用監査

対象はProduction Project `vmdsyxykcrgxcdbrwlkv`（`stockbusiness's Org` / `mangai-hub-staging` / `main PRODUCTION`）。個人情報、作品名、内部IDを結果へ返さない集計SELECTだけを実行した。

| 項目                           | 件数 |
| ------------------------------ | ---: |
| 対象作品                       |    1 |
| 対象ページ                     |   32 |
| 未着手                         |   24 |
| 生成中                         |    0 |
| 確認待ち                       |    7 |
| 要修正                         |    1 |
| 確定済み                       |    0 |
| 最新snapshot欠落               |    0 |
| queued / running生成Job        |    0 |
| 有効な編集ロック               |    0 |
| release checkpoint作成可能作品 |    0 |

ProductionのDB、ページ状態、checkpoint、Storage、publication、作品、商品、注文、決済、Stripe、Vercel設定、Provider、Job、Asset、credit、利用期限、通知設定は変更していない。

## 実装

- 原稿事前検査結果へ制作状態別ページ数を追加する。
- 完成版固定ガイドへ制作状態の内訳と「確定済みX/Yページ」を追加する。
- 未完了時は既存の原稿チェックへ移動し、ページ別の修正リンクを利用できるようにする。
- 事前検査結果を取得できない場合と完成条件未達時のfail-closedを維持する。

## 検証

- 集中テスト: 12/12成功
- Hub全テスト: 1201/1201成功
- 依存・module・codebase size検査: error 0（既知warning 2）
- Hub型検査: 成功
- ESLint: 成功
- migration / rollback静的検査: 92/92成功
- Hub Production build: 成功
- RC repository structure: `READY`
- 外部設定: `PENDING`、手動E2E: `REQUIRED`
- 新規監査文書Prettier: 成功
- `git diff --check`: 成功
- Production変更: 0件
- Provider実行: 0件
- credit予約・消費: 0

## 次の工程

1. Draft PRの全CIとVercel Preview成功を確認する。
2. merge後、作品所有者がページ別の原稿確認を行い、未着手24、確認待ち7、要修正1を解消する。
3. 全32ページが確定済みになった後、同じ読み取り専用条件で再監査する。
4. release checkpoint作成は、対象作品と実行操作を明示した責任者承認を得た別工程で行う。
