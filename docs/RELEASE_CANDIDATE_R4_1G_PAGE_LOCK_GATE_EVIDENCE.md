# PR-R4-1g Cloud Canvas編集lease確認ゲート証跡

## 判定

- 状態: `CI_RUNNING`（R4-1全体はpending）
- 日付: 2026-08-10
- Base: `feature/manga-canvas-mvp` / `0f704d80095edcac41d7279e2f5236489f52e1f0`（PR #224 merge commit）
- Branch: `codex/fix-page-edit-lock-checking-gate`
- Draft PR: [#225](https://github.com/team478a/manga/pull/225)

## Production再現

認証済みProduction sessionで既存検証作品 `R2C Provider Image Acceptance 2026-08-06` のページ3からページ4へ遷移した。ページ切替後に履歴と選択は正しく初期化された一方、編集leaseの状態が`checking`の間もキャンバス、ツール、Undoなどの編集UIが操作可能だった。確認表示が通常フロー内にあったため、確認完了時にレイアウトも移動した。

ページ3のコマ名は再現確認のため一時的に変更し、直ちに元の`コマ1`へ戻して保存済みを確認した。Provider呼出し、生成Job、Asset、credit、課金、外部設定の変更は行っていない。

## 原因

`CloudCanvasEditor`は`pageLockState`を`checking`から開始するが、既存の遮断overlayは`locked`だけに表示していた。`checking`は通常フロー内の通知だけ、`unavailable`は通知も遮断もなく、server lease取得前または確認不能時にクライアントがfail-openになっていた。また、編集UIだけを視覚的に覆っても、windowへ登録されたUndo／Redo／削除ショートカットは別途遮断が必要だった。

## 修正

- `pageLockState === "acquired"`になるまで編集UI全体へ`inert`と`aria-hidden`を適用する。
- `checking`、`locked`、`unavailable`を固定overlayで表示し、確認完了前のレイアウト移動をなくす。
- `checking`は完了待ち、`locked`は既存の別画面編集案内、`unavailable`は安全のため編集不能として再読込と作品画面への導線を表示する。
- windowのUndo／Redo／削除ショートカットもlease取得前は処理しない。
- ページIDまたはtokenが変わる場合はlease状態を`checking`へ戻してから取得する。

API、DB、migration、RPC、Storage、Feature Flag、lease token形式、120秒lease、60秒更新、Canvas schema、Provider、model、pricing、retry、timeout、Scheduler、PDF／PNG、成人向け境界、Stripe、Desktopは変更しない。

## 回帰検証

- 集中テスト: 15/15成功
- lint: 成功
- Hub／Desktop typecheck: 成功
- dependency boundary: 0 errors（既存承認済み2 warnings）
- research eval: 21/21 extraction、28/28 classification
- `npm run rc:acceptance`: 2 passed、11 pending、2 blocked
- full `npm run rc:validate`: 成功
  - Hub: 626/626
  - Desktop: 182/182
  - Canvas: 26/26
  - ai-core: 48/48
  - Supabase migration: 50/50
  - Hub／Desktop production build: 成功

full RC初回はDesktopのComfyUIキャンセルテスト1件が、並列テスト中にSQLite接続を閉じられて失敗した。該当AIテスト単独30/30成功後、同一のfull RCを再実行してDesktop 182/182を含め完走した。今回変更したHub編集コードとの再現関係はない。

## ロールバック

本PRの`CloudCanvasEditor.tsx`と静的回帰テストだけをrevertする。DB、migration、RPC、Storageや本番データの復元作業は不要。ただしrevertすると`checking`／`unavailable`中の編集操作が再びfail-openになるため、障害時も別の遮断手段を用意せずに戻さない。

## 停止条件

Draft PRの最終HEADでCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsを確認して停止する。R4-1と`hub-production-acceptance`はpendingを維持し、責任者確認前にR4-2へ進まない。
