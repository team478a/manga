# Cloud出品確定 Release Candidate

作成日: 2026-09-29

Branch: `codex/cloud-marketplace-listing-completion-20260929`

Base: `origin/feature/manga-canvas-mvp`@`0d3bd245e22cfdb625084e954f2735d834f17985`（PR #567 merge commit）

## 結論

MANGAI Cloudの販売下書きから、作品公開と商品販売開始をCreator画面の1操作で原子的に確定できるようにした。従来は作品編集と商品編集を別々に保存する必要があり、途中失敗で作品だけ公開された状態が残り得た。

今回の変更は限定テスト販売の出品確定を完成させるもので、一般公開販売、自由購入、振込、精算確定を有効化しない。Production migration適用、実作品公開、商品active化、購入、決済は実施していない。

## 実装

### Creator画面

- 販売下書きに固定完成版がある場合、「出品を確定する」を表示する。
- 1回の操作で作品公開と商品販売開始を実行する。
- 完了後は公開作品、購入準備、注文・売上、限定テスト販売ガイドへ進める。
- 作品設定と商品設定を個別確認する既存入口も残す。

### 原子的なDB処理

`202609290001_cloud_marketplace_listing_publish`で`publish_cloud_marketplace_listing(uuid)`を追加した。次を同一transaction内で再検証する。

- ログイン済みProfileが所有する一般向けCloud Projectである。
- Projectに紐づく作品が1件だけで、archivedではない。
- 選択済み完成版が作品、Project、作成者と一致する。
- 完成版ページが宣言ページ数と一致し、1ページ目から連番でStorage pathを持つ。
- 商品が1件だけで、archivedではなく、価格と販売ファイルがある。
- 商品PDFが選択済み完成版のPDFと完全一致する。

条件成立時だけ、作品を`published`かつ公開、商品を`active`へ更新する。どちらかの更新に失敗した場合はtransaction全体をrollbackする。再実行時は同じ状態を返す冪等処理とし、`public`／`anon`からの実行権限を除去した。

## 安全境界

- 成人向け作品は対象外。
- 所有者不一致、作品・商品重複、完成版欠落、ページ欠落、PDF不一致はfail closed。
- 既存のCloud publication triggerと商品publication triggerを維持する。
- Stripe Checkout、注文作成、決済、返金、Provider、生成Job、creditを実行しない。
- Productionへmigrationを適用せず、作品・商品・利用者データを変更しない。

## 検証

- focused: 14/14
- Hub: 1160/1160
- Canvas: 26/26
- AI: 50/50
- Desktop: 407/407
- Desktop accessibility: 29画面、blocking violation 0
- dependency/module boundaries: error 0、既知warning 2
- lint: 成功
- Hub/Desktop typecheck: 成功
- migration static validation: 89/89
- PostgreSQL 16 migration roundtrip: 89件のforward、全rollback、再forward成功
- Web production build: 成功
- Desktop production build: 成功
- RC repository structure: READY
- 外部設定と手動E2E: 既知PENDING

## 次工程

commit、push、Draft PRを作成し、GitHub CIとVercel Previewの全成功で停止する。merge後、`202609290001_cloud_marketplace_listing_publish`のProduction適用には対象IDとchecksumを含む別の明示承認が必要。適用後の実作品出品確定と限定テスト購入も別承認単位とする。
