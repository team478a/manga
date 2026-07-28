# MANGAI Current Task

## 基本情報

- 更新日: 2026-07-29
- 状態: `IN_PROGRESS`（Phase Cloud UI-2 実装・ローカル検証完了、stacked Draft PR作成前）
- リポジトリ: `team478a/manga`
- Base: `codex/cloud-ui-foundation`（Draft PR #48）
- Branch: `codex/cloud-dashboard-redesign`
- 実装計画: [`docs/design/CLOUD_DASHBOARD_REDESIGN_PLAN.md`](design/CLOUD_DASHBOARD_REDESIGN_PLAN.md)

## 今回の目的

責任者提示の参考画面を基準に、MANGAI Cloudのログイン後画面を、制作・販売状況を一画面で把握できるSaaS型Dashboardへ刷新する。

PR #48の共通UI基盤を前提とし、Desktopおよび業務ロジックには触れない。

## 完了した実装

- 紫系Cloud brand tokenとapp用shadow
- 56pxのcompactなCloud Header
- 208px Sidebarと薄いラベンダーのapp background
- Dashboard／Creator／Admin navigationのgroup・icon・active表示
- 共通Buttonの`brand` variant
- Dashboardの実データKPI:
  - 管理中作品数
  - 公開作品数
  - 販売中デジタル商品数
  - 支払い済み注文の累計クリエイター売上
- 最近の作品table
- 未読通知、実装済み機能へのquick action
- Creator／Admin role向けCloud Creator導線
- profile編集機能の継続配置
- Cloud UI-2構造回帰テスト

## 変更していないもの

- Cloud Canvas Editor本体
- Cloud AI Queue／Worker、Provider Gateway
- Supabase migration、DB、Storage、RLS
- Stripe、認証処理、Marketplace業務ロジック、API契約
- `apps/desktop/**`
- 成人向け製品境界

## 検証

- `npm run lint`: PASS
- `npm run typecheck`: PASS（Hub + Desktop。Desktopコード変更なし）
- `npm run hub:test`: PASS（124/124）
- `npm run build`: PASS
- 1440px: compact Headerを実表示確認
- 390px: Header／認証画面を実表示し、`scrollWidth === clientWidth`を確認
- `git diff --check`: PASS

## 未完了・次の作業

1. commit／pushし、PR #48をbaseにstacked Draft PRを作成する
2. Vercel Previewの認証済みDashboardを390／768／1024／1440pxで目視確認する
3. CIを確認する
4. 責任者が実画面を確認し、承認する

## 禁止事項

- Desktop関連の新規実装、Phase D3-Dへの着手
- 対象外の業務ロジック、API、DB、Storage、決済、認証の変更
- 架空のKPI、成長率、市場分析、AI提案scoreの表示
- `feature/manga-canvas-mvp`または`codex/cloud-ui-foundation`への直接push
- force push
- PR #48より先のmerge
- 全CI成功・レスポンシブ確認・責任者承認前のmerge

## 次担当者が最初に読むファイル

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`
4. 本ファイル
5. `docs/HANDOFF_LOG.md`
6. `docs/design/CLOUD_UI_FOUNDATION_PLAN.md`
7. `docs/design/CLOUD_DASHBOARD_REDESIGN_PLAN.md`
8. `docs/design/CURRENT_UI_AUDIT.md`
9. `docs/design/UI_REDESIGN_PLAN.md`
10. `docs/design/DESIGN_SYSTEM.md`
