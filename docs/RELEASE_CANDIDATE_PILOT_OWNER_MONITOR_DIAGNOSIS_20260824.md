# 2ページPilot 所有者・モニター枠診断

日付: 2026-08-24

## 結論

Productionの`test`モニター登録は正常に存在する。先のPilot画面でモニター枠が確認不可だったのは、作品所有者`test`ではなく管理者`tanaka`のセッションで他ユーザー作品を確認し、preflightが現在の操作profileのenrollmentを参照したためと判断できる。

## 管理画面read-only証跡

- 対象作品のクリエイター: `test`。
- `test`のCloud AI: Trial、trialing／admin、使用80、予約0、処理中Job 0、期限2026-09-12。
- `test`のモニター: active、89/100、残り11、期限2026-10-31、初回案内確認済み。
- 作品確認時のログイン表示: `tanaka`。
- 管理画面と作品画面のconsole error: 0件。

## Pilotへの影響

- 1–2ページは9コマで、モニター枠は9回必要。`test`の残り11回内に収まる。
- 必要creditは18、Cloud AI残りは16のため2不足する。
- 作品所有者本人のセッションでもcredit不足は残り、現時点では開始できない。
- 管理者セッションで生成を開始すると操作profileのquota／monitor境界と混同するため、実行してはならない。

## 残る停止条件

1. Storyboard materializationを持たない既存作品のVisual Readiness方針決定。
2. 画風と人物設定の正本決定・保存。
3. 2 credit不足の解消方法と最大creditの責任者承認。
4. Production migration `202608240001`の適用確認／適用承認。
5. `test`本人セッションでの最終read-only preflight。

## 不変

モニター招待条件、Cloud AI Plan、credit、作品、Canvas、DB、Storageを変更していない。Provider、Worker、Job、保存、生成は0件。
