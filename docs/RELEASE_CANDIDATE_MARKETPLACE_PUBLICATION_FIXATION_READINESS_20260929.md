# Marketplace Cloud完成版固定 readiness

## 目的

ProductionのCloud作品について、完成版固定を実行する前に、固定候補が存在するかと阻害条件を匿名件数だけで確認できるようにする。

## 実装

- 管理画面 `/admin/marketplace-canary` に「Cloud完成版固定の準備確認」を追加した。
- admin認証後、Production runtime／正規origin guardを通過した場合だけ、次のmetadataをread-onlyで取得する。
  - Cloud由来の作品
  - 作品に紐づく商品
  - Cloud Project
  - release checkpoint
  - checkpoint page番号
- 作品が一般向け・非公開・draft・未固定で、Project所有者と作品所有者が一致し、作品に商品が1件だけ存在してpausedであり、所有者が作成したrelease checkpointのmanifestと連番ページが完全な場合だけ固定候補とする。
- 監査上限を超えた部分inventory、商品重複、ページ欠落、所有者不一致、公開済み／固定済み作品はfail closedで候補にしない。

## 表示範囲

管理画面には次の件数とREADY／PENDINGだけを表示する。

- 確認したCloud作品
- 未公開・未固定の作品
- 所有者一致の作品
- paused商品に紐づく作品
- release checkpoint
- ページ構成が完全なrelease checkpoint
- 固定可能な作品
- 固定後に更新対象となるpaused商品

利用者、作品、商品、Project、checkpointの識別子、氏名、メール、名称、説明、file path、Storage path、秘密値は取得・表示しない。

## 安全境界

- DB操作はSELECTだけで、insert／update／delete／upsert／RPCを行わない。
- Storage objectを読み取らない。
- Stripe、Provider、生成Job、creditへアクセスしない。
- 管理画面に完成版固定buttonを置かない。
- readinessがREADYでも自動固定しない。実際の固定は利用者のCloud制作画面で完成版を選択する別工程とする。
- 作品公開、商品active化、canary購入はそれぞれ別の明示承認を必要とする。

## 検証

- focused: 14/14
- Hub: 1141/1141
- Canvas: 26/26
- AI: 50/50
- Desktop: 407/407
- Desktop accessibility: 29画面、blocking violation 0
- dependency boundary: error 0、既知warning 2
- lint、全typecheck、Web build、Desktop build: 成功
- Supabase migration: 88/88
- RC preflight: repository structure READY。外部資格情報未注入と手動E2Eは既知PENDING

## 次工程

このPRをmergeし、Production管理画面で匿名件数とREADY／PENDINGをread-only確認する。完成版固定は、候補内容を別工程で確認し、責任者の明示承認を得るまで実行しない。
