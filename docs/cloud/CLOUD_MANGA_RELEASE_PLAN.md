# MANGAI Cloud マンガ下書き生成 Release計画

作成日: 2026-07-29
対象Release: Release 4
対象ブランチ: `codex/cloud-manga-mvp`
Base: `codex/cloud-scenario-mvp`（Draft PR #52）

## 1. 目的

確定済みシナリオを、既存Cloud Canvas Editorで編集できる一般向けCloud ProjectとPage下書きへ変換する。外部AI Providerがなくても、シナリオ確定からページ構成確認、Canvas編集開始までを完走可能にする。

## 2. 実装範囲

1. `CLOUD_MANGA_MVP_ENABLED` Feature Flag
2. 確定済みScenario snapshotだけを入力にする
3. `manga-layout-rules-v1`によるページ別シーン割当・コマ割り案
4. Cloud Project、Episode、Page、初期Canvas snapshotの原子的作成
5. 生成履歴・詳細・ページ構成確認
6. 各Pageから既存Cloud Canvas Editorを開く導線
7. Workflow shellとDashboardへのRelease 4状態表示
8. 所有者RLS、Scenario trace照合、重複生成防止
9. migration、rollback、canonical schema、manifest、テスト

## 3. 今回含めないもの

- 外部AI Providerによる画像生成の自動実行
- Cloud AI Queue／Worker／Provider Gatewayの変更
- Cloud Canvas Editor本体の変更
- 吹き出し本文・完成画像の自動生成
- 公開、販売準備、Stripe、Marketplace
- Desktopおよび成人向け処理

既存Canvas上の手動画像生成機能は維持するが、Release 4作成処理から自動投入しない。

## 4. 安全境界

- 一般向け・所有者本人・確定済みScenarioだけを処理する。
- BrowserからScenario本文、所有者ID、Project ID、Page IDを受け取らない。
- Projectと全Pageはsecurity definer RPC内の単一transactionで作成する。
- 1つのScenario confirmationから作成できる下書きは1件とする。
- 最大200Pageとし、大量行作成による資源枯渇を防ぐ。
- 生成内容は`ai_inference`として保存・表示する。
- Prompt、創作本文、画像、個人情報を通常ログへ出さない。
- Feature Flag未設定時は画面・Actionともfail closedにする。

## 5. 完了条件

- 確定Scenario → マンガ下書き生成 → 保存 → 履歴 → 再表示 → Canvas起動が完走する。
- 未確定Scenario、別利用者、成人向け、201Page以上を拒否する。
- 全PageがScenarioのいずれかのSceneへ追跡できる。
- Page番号が1から連続し、ProjectのPage数と生成結果が一致する。
- 同じConfirmationの再送信で重複Projectを作らない。
- lint、typecheck、Hub test、migration検証、production build、CIが成功する。
- 外部Supabase／実ブラウザ受入れ完了まではDraftを維持し、mergeしない。
