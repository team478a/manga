# ページ要修正の再確認操作 Release Candidate

作成日: 2026-08-20
Branch: `codex/fix-r4-3-page-revision-review-action`
Base: PR #320 merge commit `6095eadda7168a544118f080e154cb7b29bc0b84`

## Production受入れ結果

PR #320のProduction反映後、`test`アカウントの既存22ページをread-onlyで確認した。

- 画像: 4/4
- 構造化セリフ: 1/1、`auto_placed`
- 生成中: 0
- 失敗: 0
- 保存revision／最新revision: 11／11
- PNG: 成功
- credit: 使用80、予約0、残り20
- 完成阻害理由: `ページ制作状態が「要修正」です。`

Productionの作品、Canvas、DB、Storage、制作状態、Provider、creditは変更していない。

## 原因と方針

`cloud_pages.production_status=revision_required`は、利用者による修正完了確認が必要なfail-closed状態である。既存の長編制作管理には`review_required`へ戻す操作があるが、対象ページの編集画面からは到達しにくい。

完成判定による自動解除は行わない。完成阻害sourceがページ要修正の場合だけ、編集画面に明示操作を提供する。

## 実装契約

- 完成阻害理由へ`manualReviewSource`を付与する。
- `page_revision`の場合だけ「修正完了として再確認」を表示する。
- 操作は既存の所有権検査済み`setCloudPageProductionStatus`を使い、`review_required`へ遷移する。
- 成功・失敗とも対象編集ページへ戻り、関連ページをrevalidateする。
- セリフ配置・候補採用由来の手動確認には操作を表示しない。
- `revision_required`の完成guard自体は維持する。

## 変更しない契約

API、URL、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF処理、成人向け境界、Desktop製品コードは変更しない。

## 回帰検証

- 集中テスト: 18/18
- dependency boundary: error 0、既存warning 2件
- lint: 成功
- typecheck: 成功
- Hub: 827/827
- Canvas: 26/26
- AI: 48/48
- Desktop: 182/182
- Desktop a11y: violation 0
- migration: 61件
- Hub build: 成功
- Desktop build: 成功
- RC preflight: repository structure ready。外部設定Pendingは既存ローカル環境依存
- `git diff --check`: 成功

## Merge後の限定受入れ

責任者の明示承認後、対象22ページで「修正完了として再確認」を1回だけ操作する。次を確認する。

1. `revision_required`が`review_required`へ遷移する。
2. 完成バナーが「ページ完成」になる。
3. 画像4/4、セリフ1/1、revision 11、PNG成功を維持する。
4. Provider呼出し、追加Job、追加credit消費がない。

異常時は新たな書込みやProvider実行を止め、直前状態と表示理由を記録する。

## Draft PRとPreview

- Draft PR: [#321](https://github.com/team478a/manga/pull/321)
- 状態: Draft、MERGEABLE
- 実装HEAD: `85c53adc093a2e77a7c0f1149e568a24ca81d4fb`
- Core quality: 成功
- Migration roundtrip: 成功
- Windows build: 成功
- Vercel: 成功
- Vercel Preview Comments: 成功
- Preview: [Ready](https://mangai-hub-staging-3bm8mokot-team478as-projects.vercel.app)
- Preview保護: Vercel Authentication有効。未認証HTTPはVercelログインへ転送される。
