# MANGAI Cloud Dashboard ビジュアル刷新計画

作成日: 2026-07-29
対象Phase: Cloud UI-2
作業ブランチ: `codex/cloud-dashboard-redesign`
基盤ブランチ: `codex/cloud-ui-foundation`（Draft PR #48）

## 1. 目的

責任者提示の参考画面を基準に、ログイン後のMANGAI Cloudを「制作・販売を管理するSaaS」として認識できる情報密度と視覚階層へ刷新する。

## 2. デザイン原則

- compactな固定Headerと常設Sidebarで主要機能へすぐ移動できる
- 薄いラベンダー背景、白いCard、紫のaccentでCloud製品を識別する
- Dashboardは実データのKPI、最近の作品、次の操作を一画面に集約する
- 未実装の市場分析、AI提案score、架空の売上増減は表示しない
- public areaの購入・閲覧体験と、authenticated app areaの管理体験を分離する
- 390pxではHeaderをmobile menu、Sidebarを横スクロールnavへ変換する

## 3. 今回の実装範囲

- Cloud Headerのcompact化とCloud brand accent
- SectionShellの208px Sidebar化とapp background
- Dashboard／Creator／Admin navigationのgroup・icon表示
- DashboardのKPI:
  - 登録作品数
  - 公開作品数
  - 販売中商品数
  - クリエイター受取予定額
- 最近の作品table
- 実装済み機能へのquick action
- profile編集の継続配置
- 作品管理／デジタル商品管理／売上管理のSaaS UI統一
- CreatorのProject一覧／新規作成／ゴミ箱／Project詳細のSaaS UI統一
- Creatorのフォーム、Episode／Page操作列のmobile layout調整
- 390／768／1024／1440px レスポンシブ確認

## 4. 対象外

- 市場分析、AI企画提案、AI scoreなどの新機能
- 新しいDB query契約、migration、API、Server Action
- Stripe、認証、Marketplace業務ロジック
- Cloud Canvas Editor本体
- Desktop

## 5. 完了条件

- 既存テーブルに対するread-only queryだけでKPIが表示される
- Dashboardの主要情報が1440pxでfirst viewに収まる
- 390pxで横方向のpage overflowがない
- navigationの現在地が`aria-current`で判別できる
- lint、typecheck、Hub test、production buildが成功する
- stacked Draft PRを作成し、基盤PR #48より先にmergeしない
