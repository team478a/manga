# MANGAI PR-R4-1c Production編集ロック再受入れ証跡

最終更新: 2026-08-10

状態: `READY_FOR_DRAFT_PR`

対象branch: `codex/release-r4-1c-page-lock-acceptance`

基準commit: `d40d8d4f4e30ff57fcb160f7842afb7b780069d5`（PR #220 merge commit）

## 1. 判定

PR #220をProductionへ反映した後、既存の一般向け検証作品で同一タブ再読込、作品画面からの再入場、別タブ排他を認証済み実ブラウザから確認した。

同一タブは最大約2分の自己lock待機を発生させず即時復帰し、別タブは従来どおり編集を遮断した。元タブの継続編集、保存済み表示、既存生成Asset表示も維持されたため、編集ロック修正のProduction再受入れは合格とする。

R4-1全体は完了扱いにしない。checkpoint migration、Cloud Editor文章Job、対象モニター本人の市場分析、8ページ制作・PDF、Scheduler、2利用者owner isolation、Stripe test E2Eが残るため、`hub-production-acceptance`はpendingを維持する。

## 2. 実行条件

- Production domain `https://app.mang-ai.com`の既存認証済みsessionを使用した。
- PR #220のmerge commitに対するVercel deployment成功を確認してから実施した。
- R4-1bで使用した既存一般向け検証作品の、保存済みAI背景画像を持つページを使用した。
- ページ内容、Canvas、Asset、作品状態、Provider設定、credit、外部設定は変更していない。
- 編集leaseの取得と更新だけが発生する。検証タブ終了後は既存の120秒server leaseで失効する。

## 3. Production実機結果

| 確認 | 結果 |
|---|---|
| 初回入場 | PASS。lock警告なし、`保存済み`を確認 |
| 同一タブ即時再読込 | PASS。lock警告0件、確認中表示0件、`保存済み`1件 |
| 作品画面から同一タブ再入場 | PASS。待機なしで同じ編集画面へ復帰し、lock警告なし |
| 別タブ同時入場 | PASS。`このページは別の画面で編集中です`1件と作品画面への退避導線を確認 |
| 元タブ継続 | PASS。別タブ終了後もlock警告0件、`保存済み`1件 |
| 既存生成結果 | PASS。既存の生成候補画像表示を維持 |
| データ変更 | PASS。ページ内容、Canvas、Asset、作品状態を変更していない |
| 外部費用 | PASS。Provider呼出し、Job、credit予約・確定、決済なし |

## 4. 契約確認

Productionで次の境界を確認した。

- 同一タブ／同一ページは`sessionStorage`の同じUUID tokenを再利用する。
- 別タブは異なるtokenとなり、既存RPCの`cloud_page_locked`境界で遮断される。
- API URL、request／response、DB schema、migration、RPC署名、lease 120秒は変更していない。
- 自動DELETEを行わず、閉じたタブは既存lease expiryで解放する。

## 5. 残件

1. 対象Supabase projectのmigration manifest照合とcheckpoint再受入れ。
2. Cloud text Gateway readiness照合後の文章Job 1件再受入れ。
3. 対象一般モニター本人sessionで市場分析の保存・一覧・再読込・フィードバック送信。
4. AIネーム由来8ページ以上の制作、候補操作、画像編集、一括生成、checkpoint、復元、PDF／PNG。
5. Scheduler、2利用者owner isolation、Stripe test E2E。

上記が揃うまでR4-1と`hub-production-acceptance`をpendingとし、R4-2へ進まない。

## 6. 自動検証

| 検証 | 結果 |
|---|---|
| `npm run rc:acceptance` | PASS。2 passed／11 pending／2 blocked、schema valid |
| `npm run rc:preflight` | PASS。repository structure READY。外部資格情報と手動E2Eは既知のpending |
| `npm run rc:validate` | PASS。Hub 624/624、Desktop 182/182、Canvas 26/26、AI 48/48、migration 50/50、Hub／Desktop build |
| `git diff --check` | PASS |

## 7. Rollback

- 本PRは証跡文書と受入れ台帳だけのため、commitのrevertで戻せる。
- PR #220のapplication修正をrollbackする場合は同PRのmerge commitを別工程でrevertし、同一タブ編集ロック項目を未解決へ戻して再受入れする。
- Production test data、DB、Storage、Provider、外部設定は変更していないため、本PR固有のdata rollbackは不要。
