# 連続2ページ生成Pilot契約

日付: 2026-08-24

## 目的

残り144コマの段階的生成計画で承認された「連続2ページPilot」を、既存の4〜8ページ通常batchの安全境界を緩めずに選択可能にする。

## 変更

- 生成単位を「ページ番号が連続する2ページ」または「4〜8ページ」とする。3ページは拒否する。
- 2ページ選択時はアプリpreflightとDB RPCの両方でページ番号の連続性を検証する。
- 既存の最大64コマ、Canvas snapshot、人物・画風、Provider・model・料金版、quota、作品／全体費用上限、モニター利用枠、moderationを維持する。
- UIで2ページPilotと4〜8ページ通常batchを区別して説明する。
- 既存migrationは変更せず、追加migrationとfail-closed rollbackを用意する。2ページbatchが存在する場合、旧制約へのrollbackは停止する。

## 非対象

- Productionへのmigration適用
- Production作品、Canvas、DB、Storageの変更
- Provider実行、生成Job登録、credit予約／消費
- Pilot対象ページや最大creditの決定

## 受入れ

- 連続2ページはpreflightを通過できる。
- 非連続2ページと3ページは拒否される。
- 4〜8ページの既存通常batchは維持される。
- migration forward／rollback／reapply、canonical schema、アプリ全品質ゲートが成功する。
- Draft PRの全CIとVercel Previewが成功した時点で停止する。
