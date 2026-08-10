# MANGAI PR-R4-1f 一括生成開始拒否の本番再現・修正証跡

最終更新: 2026-08-10

状態: `CI_RUNNING`

対象branch: `codex/fix-empty-generation-batch-on-rejection`

基準commit: `0754e0b09b7b530fb6de64974d5d1e1099c6887a`（PR #223 merge commit）

Draft PR: [#224](https://github.com/team478a/manga/pull/224)

## 1. 本番確認結果

Productionの既存一般向け検証作品を8ページへ拡張し、1ページ目2コマ、2〜8ページ目各1コマの合計9コマを保存した。画像配置は既存の1/9で、生成前のFREEプラン表示は使用4、予約0、残り16クレジットだった。

2〜8ページの7コマを一括生成対象として1回だけ送信した。対象作品は手動作成でAIネームとの関連がないため、既存の一般向け境界が最初の画像Job登録前に拒否した。Provider Job、Asset、画像、予約・使用クレジット、外部費用は増えていない。

拒否時に`cloud_generation_batches`だけが先に作成され、画面へ「処理中・完了0/0・待機0・処理中0・失敗0」が残る問題を再現した。検証で作成した0件Batchは同じ画面から中止し、「中止・0/0」への遷移を確認した。

同じsessionの市場分析は一般モニター利用資格の境界で拒否され、Report、Provider呼出し、保存、費用は発生していない。対象モニター本人のsessionが必要なため、市場分析とAIネーム由来8ページE2Eはpendingを維持する。

## 2. 修正

- 最初のQueue登録が失敗し、紐付け済みJobが0件の場合は、作成済みBatchを既存RPCで`canceled`へ補償してから元の安全なエラーを返す。
- Job作成後にBatch紐付けが失敗した場合は、未紐付けJobを既存キャンセル処理へ渡し、予約クレジットを残さない。
- canceledかつJob 0件のBatchは利用者向け履歴へ表示しない。DB上の監査可能な記録は削除しない。
- 1件以上を登録した後の部分失敗、pause／resume／cancel、失敗Job再実行の既存契約は維持する。

## 3. 変更しない境界

- DB、migration、RPC定義、Storage、API、URL、Feature Flag
- Provider、model、pricing、retry、timeout、Scheduler
- Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktop
- 一般向け所有者、AIネーム由来作品、moderation、quota、費用上限の既存条件

## 4. 本番データの変更範囲

- 既存の一般向け検証作品だけを1ページから8ページへ拡張した。
- 2〜8ページへ各1コマを追加し、合計9コマとした。
- 誤操作で追加された吹き出しはUndoまたは削除し、残存していないことを確認した。
- 0件Batchは削除せず中止した。
- Provider Job、Asset、画像、クレジット、価格、利用者権限、外部設定は変更していない。

## 5. 検証

| 検証 | 結果 |
|---|---|
| 一括生成／長編／制作状態の集中回帰 | PASS、15/15 |
| `npm run deps:check` | PASS、0 errors／既知2 warnings |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS、Hub／Desktop |
| `npm run research:eval` | PASS、抽出21/21・分類28/28 |
| `npm run rc:acceptance` | PASS、2 passed／11 pending／2 blocked |
| `npm run rc:validate` | PASS、Hub 625/625、Desktop 182/182、Canvas 26/26、AI 48/48、migration 50/50、Hub／Desktop build |
| `git diff --check` | PASS |

## 6. Rollback

1. 本PRのcommitをrevertすると、失敗時補償と0件履歴除外だけを元へ戻せる。
2. DB、migration、RPC、外部設定のrollbackは不要。
3. Productionの検証作品は一般公開作品ではない。追加ページを削除する必要がある場合は責任者確認後に製品UIから行い、無断でDB削除しない。

## 7. 停止条件

Draft PRの全CIとVercel Previewを確認した時点で停止する。R4-1はpendingを維持し、対象モニター本人による市場分析、AIネーム由来8ページE2E、checkpoint、Cloud text、2利用者owner isolation、Stripe test E2Eが揃う前にR4-2へ進まない。
