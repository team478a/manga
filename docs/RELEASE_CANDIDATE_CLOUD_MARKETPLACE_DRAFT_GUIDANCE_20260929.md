# Cloud販売下書きの段階案内

## 1. 目的

Cloud作品から販売下書きを作成できない場合に、利用者が「原稿チェック」「完成版固定」「販売下書き作成」のどこまで進んでいるかを作品画面で判断できるようにする。

従来は原稿preflightが合格していても完成版checkpointが0件なら販売入力欄全体が無言で無効化され、次に完成版を固定する必要があることを把握しにくかった。

## 2. 実装

- `buildCloudMarketplaceDraftGuidance`を追加し、次の4状態を順序付きで判定する。
  - 原稿状態を取得できない
  - 原稿チェックが未完了
  - 原稿チェック済みだが完成版が未固定
  - 完成版を選択して販売下書きを作成可能
- 原稿未完了時は要修正件数と「原稿チェック」へのリンクを表示する。
- 完成版がない場合は「原稿チェックは完了しています。次に完成版を固定してください」と表示し、「バックアップと完成版」へ移動できるようにする。
- 販売入力欄と送信buttonは、原稿preflight合格と完成版checkpoint 1件以上の両方を満たす場合だけ有効にする。
- 判定不能時は従来どおりfail closedにする。

## 3. 変更範囲

- `src/lib/cloud-marketplace-draft-guidance.ts`
- `src/app/creator/[projectId]/page.tsx`
- `tests/cloud-marketplace-readiness.test.mjs`

DB schema、migration、release checkpoint保存、販売artifact生成、publication固定、商品状態変更の処理は変更していない。

## 4. 検証

- focused: 16/16成功
- Hub: 1146/1146成功
- Canvas: 26/26成功
- AI: 50/50成功
- Desktop: 407/407成功
- Desktop accessibility: 29画面、blocking violation 0
- dependency check: error 0、既知warning 2
- lint: 成功
- typecheck: 成功
- migration validation: 88/88成功
- Web build: 成功
- Desktop build: 成功
- RC preflight: repository structure成功。外部設定と手動E2Eは資格情報未注入の既知PENDING。
- `git diff --check`: 成功

## 5. Production安全境界

Computer UseによるProduction read-only再確認を試みたが、Chrome連携のrequest-header policy読込みエラーで画面へ接続できなかった。接続後の操作は0件で、Productionへrequestや変更を行っていない。

DB mutation、release checkpoint作成、販売下書き作成、publication固定、作品公開、商品active化、購入、Stripe、Storage object、Provider、生成Job、credit、利用者データの変更は行っていない。

## 6. 次の工程

Draft PRの全CIとVercel Preview成功を確認して停止する。merge後、利用者はProduction作品画面で未完了段階と次の移動先を確認できる。実際の完成版固定、販売下書き作成、作品公開、商品active化、購入はそれぞれ別の利用者操作または明示承認を必要とする。
