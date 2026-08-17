# RELEASE CANDIDATE: PR-R4-3A-5 Mobile Offline Human Review

作成日: 2026-08-17

状態: `DRAFT_PR_OPEN / MOBILE_OFFLINE_PACKAGE_READY / CI_RECHECK_PENDING / SECURE_TRANSFER_PENDING`

## 1. 目的

Candidate Visual Benchmarkのprivate Reviewer A/B packageを、スマートフォン幅のブラウザでも独立評価できるようにする。Production UIや外部review serviceは作らず、既存ZIPへ自己完結型`review.html`を追加する。

## 2. 実装

- package manifestへoptionalな`review_ui`契約を追加する。
- 新規package generatorは`mangai-mobile-offline-review-v1`の`review.html`を同梱する。
- 候補画像、参照画像、Panel Specification、判定、確信度、欠陥、コメント、前後移動をmobile-firstで表示する。
- 下書きをpackage／slot単位で端末内保存し、既存`mangai-human-review-v2`回答JSONを保存・画面表示・再読込できる。
- 最終回答は既存CLI validatorを必須とし、UIの簡易検査だけで正式採用しない。

## 3. 安全契約

- CSPで`connect-src 'none'`とし、ネットワーク送信を禁止する。
- 外部script、CSS、画像、font、analytics、APIを持たない。
- 正解label、相手Reviewer回答、AI監査、Prompt、source group／family、split、Provider情報、URL、秘密値を含めない。
- validatorはremote resource、network policy欠落、embedded manifest／template／order／intended不一致を拒否する。
- private画像と回答をGit、Production DB、Storage、公開artifactへ保存しない。

## 4. 受入れ証跡

- 集中テスト: R4-3A-4／A-5 合計16件成功
- Batch 01 Reviewer A: 28件、package validator成功
- Batch 01 Reviewer B: 28件、package validator成功
- Reviewer A SHA-256: `35C645AF7420DC77CA646BCC329B8A16A1791227BF88D1C0D3BA89BD515ADB18`
- Reviewer B SHA-256: `1EBC84D05712115EDB337FE6DF97169EE5BBEF892566C8385BFB02804A9C96B9`
- private label leakage: 0
- Reviewer A leakage: 0
- C2PA Content Credentials: 保持
- 390×844 viewport: 28ケース全画像表示・前後移動成功
- 入力: Reviewer ID、独立確認、verdict、confidence、defect、comment動作確認
- 出力: 28 records、正しいslot／reviewer、既存response v2形状を確認
- Repository gate: 集中16/16、Hub 781/781、Canvas 26/26、AI 48/48、dependency、lint、Hub型検査、migration 59本、Webpack Hub build、RC structure preflight成功
- Local environment limits: 通常Turbopackは既知のWindows path lengthで停止。Desktop typecheck／test／a11y／buildは差分外の既知`@napi-rs/keyring`型宣言不足で停止し、GitHub Windows CIを正式判定とする

画面検証で作成した全件goodのテストJSONは品質判定ではなく、正式Human responseへ採用していない。

## 5. 未完了

- private ZIPをスマートフォンへ渡す安全な配布経路
- 人間による権利確認28件
- 別々のHuman Reviewer A/Bによる56レビュー
- 不一致裁定と正式assembly

正式Benchmarkは0/140のままである。

## 6. 不変境界

Production、既存作品、DB、migration、RPC、RLS、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、runtime Visual Judge、自動修復、Canvas、checkpoint、PNG／PDF出力、成人向け境界、Desktopを変更しない。

## 7. rollback

このPRをrevertすると新規packageから`review.html`と`review_ui`がなくなる。既存v2 package／responseはoptional契約により影響を受けない。private派生ZIPはGit外にあり、誤った版はquarantineへ退避する。

## 8. 停止条件

Draft PR、全CI、Vercel Preview成功後に停止する。安全な配布先とHuman Reviewer A/Bの割当てが決まるまで画像を外部送信せず、正式140件へ加算せず、R4-3Bへ進まない。

## 9. CI復旧

Draft PR [#296](https://github.com/team478a/manga/pull/296)はDraft／MERGEABLE。旧実行ではMigration roundtrip、Vercel、Vercel Preview Commentsが成功し、Previewは[Ready／SSO保護](https://mangai-hub-staging-o7kn6q1i1-team478as-projects.vercel.app)だった。Core quality／Windows buildの失敗原因は、2026-08-17 00:00 UTCに既存`DEZGO_PRICING_VALID_UNTIL`とテスト用成人Provider policyが同時失効し、成功系fixtureが壁時計へ依存していたことだった。

PR #297がoptionalな決定的時計を導入し、Productionの実時刻とfail-closedを変えずに該当テストを修正して基準ブランチへマージ済み。merge commit `f9aff56666731f25a1c678d65a080c15b7da46ae`をPR #296へ通常mergeし、最終HEADで全CIとVercel Previewを再確認する。
