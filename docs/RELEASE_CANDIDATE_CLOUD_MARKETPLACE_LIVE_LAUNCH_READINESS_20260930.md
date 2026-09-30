# Cloud Marketplace 限定販売開始判定 Release Candidate

## 結論

- 状態: `IMPLEMENTED / LOCAL_ALL_GATES_PASSED / PRODUCTION_UNCHANGED`
- Branch: `codex/cloud-marketplace-launch-readiness-20260930`
- Base: `a32d3cd33e8213bb73ca7637ad404cadd28af6f3`（PR #581 merge commit）
- 管理者のProduction canary画面で、設定済みの限定販売対象が実際に開始条件を満たすかを1つの`READY`／`PENDING`判定として確認できる。
- この変更は読み取り専用であり、販売開始、注文作成、決済、設定変更、商品変更、Productionデータ変更を行わない。

## 実装内容

限定本番の設定だけでなく、設定された固定対象について次の5条件を照合する。

1. 限定本番のcheckout設定、canary対象、期限が有効である。
2. 対象商品が1件に特定でき、販売中、50〜1,000円、販売ファイル設定済みである。
3. 紐づく作品が一般向け・公開済みで、Cloud作品の場合は完成版publicationが固定されている。
4. 販売者と指定購入者が別の登録アカウントで、販売者権限が有効である。
5. 同じ商品・販売者・購入者について、処理中または支払済みの本番注文が存在しない。

判定はdomainの純粋関数へ分離した。管理者認証後にrepositoryが必要列だけをSELECTし、取得不能、対象不一致、期限切れ、複数候補などは推測せず`PENDING`へfail closedする。

## 情報保護と非変更範囲

- 画面へ表示するのは各条件の成否と固定された日本語理由だけである。
- 商品、作品、販売者、購入者の内部ID、氏名、メール、販売ファイル、canary fingerprintは返却・表示しない。
- 生のSupabase／Stripeエラー、環境変数、秘密鍵は表示しない。
- INSERT、UPDATE、UPSERT、DELETE、RPC、Stripe呼出し、Storage object取得は行わない。
- DB schema、migration、RLS、Webhook、注文状態、商品状態、設定値は変更していない。
- Production接続、実注文、実決済、Provider実行、生成Job、credit予約・消費は0件。

## 検証

- 新規domain／repository契約: 4/4成功。
- checkout／canary／inventoryを含む集中テスト: 35/35成功。
- Hub: 1198/1198成功。
- Canvas: 26/26成功。
- AI: 50/50成功。
- Desktop: 407/407成功。
- Desktop accessibility: 29画面、blocking violation 0。
- migration静的検査: 92/92成功。
- dependency boundary: error 0、既知warning 2。
- lint、全体typecheck、Web build、Desktop build、RC repository structure、diff check成功。

`rc:preflight`の外部Supabase／Stripe設定と手動E2Eは、ローカルへ秘密情報を置かない既存方針により`PENDING`のままである。これは今回のコード品質ゲート失敗ではない。

## 次の停止条件

Draft PRを作成し、GitHubのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsがすべて成功した時点で停止する。

実際の限定販売canary、Production設定変更、注文作成、実決済、一般購入者への開放は本PRに含めず、それぞれ別の明示承認単位とする。
