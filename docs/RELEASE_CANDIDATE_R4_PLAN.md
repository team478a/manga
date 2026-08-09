# MANGAI PR-R4 Release Candidate統合計画

最終監査日: 2026-08-10

対象ブランチ: `feature/manga-canvas-mvp`

実装基準: `78f4503f6ca235c1c949cddc33c91e7efcc34fa3`（PR #216 merge commit）

## 1. 目的

R0〜R3で完了したコード整備を前提に、MANGAI Hub／Cloud漫画制作／MANGAI DesktopをRelease Candidateとして判定できる証拠を揃える。R4では新機能追加を目的にせず、自動検証と実環境受入れを分離し、未実施を成功扱いしない。

R4は、残件を細かなPRへ再分割せず、次の3工程へ統合する。

| 工程 | 範囲 | 完了条件 |
|---|---|---|
| PR-R4-0 | 現在地、RC台帳、実環境受入れ手順、停止条件の統合 | 文書差分だけでDraft PR、全CI、Vercel Preview成功 |
| PR-R4-1 | Hub／Supabase／Vercel／Stripeの実環境受入れ | 一般向けCloud制作と決済の必須E2Eを実施し、証拠を台帳へ記録 |
| PR-R4-2 | Desktop実AI、アクセシビリティ、Windows配布、最終RC判定 | 必須項目を完了または責任者が明示的にwaiveし、strict判定成功 |

工程をまとめても、実環境の種類、資格情報、費用承認、Windows証明書の境界は混ぜない。R4-1とR4-2はそれぞれ単独でrollbackできるDraft PRとする。

## 2. 現在の基準

- PR-R0、R1、R2A、R2B、R2C、R3の対象PRは`feature/manga-canvas-mvp`へマージ済みで、各工程の実装は完了。
- R3最終PR #216のmerge commitは`78f4503f6ca235c1c949cddc33c91e7efcc34fa3`。
- PR #216最終HEADではHub 620/620、Canvas 26/26、AI 48/48、Desktop 182/182、axe 29画面・違反0、migration 50/50、Hub／Desktop build、GitHub全CI、Vercel Previewが成功。
- release preflightのリポジトリ構造はREADY。外部資格情報と手動E2Eは未完了であり、コード品質ゲート成功で代替しない。
- `docs/desktop/RC_ACCEPTANCE_STATUS.json`の正本状態は2 passed、11 pending、2 blocked。

## 3. 外部契約と不変条件

R4で受入れのためだけに次を変更しない。

- URL、App Router、Server Action、API、response status／body
- Supabase schema、migration、RLS、RPC、Storage bucket／path／TTL
- Auth、owner isolation、Feature Flag名／default
- Provider、model、pricing、credit、retry、timeout、Scheduler
- Canvas schema、PDF／PNG／ZIP／販売package形式
- Stripe product／price／webhook event契約
- Desktop IPC、SQLite schema、project形式、update channel
- 一般向けCloudと成人向けDesktopの製品境界

受入れで不具合が見つかった場合は、その修正だけを別の小さなDraft PRとして切り出す。R4受入れ記録と無関係なリファクタリングを同じPRへ含めない。

## 4. 証拠の共通ルール

- `passed`は実施日、確認者、再現可能な証拠を必須とする。
- `waived`は責任者、理由、承認日を必須とする。
- 資格情報不足、費用未承認、証明書待ちは`pending`または`blocked`のままにする。
- API key、secret、token、個人情報、Prompt本文、生成画像、署名秘密鍵をPR、ログ、スクリーンショットへ残さない。
- 証拠には環境名、commit、操作結果、件数、時刻、失敗時の安全なエラー分類だけを残す。
- 自動テスト成功を実ブラウザ、実Provider、実Windows端末、実決済の代替にしない。
- 正式状態は`docs/desktop/RC_ACCEPTANCE_STATUS.json`、詳細手順は`docs/desktop/RELEASE_CANDIDATE_ACCEPTANCE.md`を正本とする。

## 5. PR-R4-0 現状・RC台帳・計画統合

### 5.1 変更対象

- 本書を新設する。
- `docs/CURRENT_TASK.md`をPR-R4-0へ同期し、PR-R3-5bをMERGEDへ更新する。
- `docs/HANDOFF_LOG.md`と`docs/AI_HANDOFF.md`へ現在地と停止条件を記録する。
- `docs/PROJECT_STATUS_AND_ROADMAP.md`へ2026-08-10時点の現状を追記する。
- RC台帳の監査日と、既に成功済みのローカル品質ゲート証拠だけを更新する。

### 5.2 明示的な除外

application code、DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktop codeを変更しない。実Provider呼出し、実決済、production書込み、Windows署名も行わない。

### 5.3 回帰確認

- RC台帳schema検証: `npm run rc:acceptance`
- release構造確認: `npm run rc:preflight`
- dependency boundary、lint、typecheck、tests、migration、buildの標準品質ゲート
- Draft PRのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments

## 6. PR-R4-1 Cloud／Supabase／Vercel／Stripe統合受入れ

R4-1は同じstaging基準commitを使い、読み取り確認から開始する。productionへの破壊的操作や本番課金は行わない。

### 6.1 事前条件

- 対象Vercel deploymentとSupabase projectを明示し、Preview／staging／productionを混同しない。
- migration manifestと適用済みmigrationを照合する。
- Provider readiness、Worker secret、Scheduler、Storage bucket、Stripe test modeを秘密値非表示で確認する。
- 一般モニター利用者は招待状態だけでなくAuth user、profile、monitor grant、owner relationを別々に確認する。

### 6.2 Hub／Cloud漫画制作E2E

1. ログイン、サイドメニューのアカウント名、マイページ遷移、ログアウトを確認する。
2. 市場分析を保存し、再読込後も同じownerに表示されることを確認する。
3. 市場分析から企画、シナリオ、ネームへ進み、各段階の保存・再開を確認する。
4. コマ画像生成、2〜4候補比較、候補採用、再生成を確認する。
5. Image-to-Image、Inpainting、Outpainting、構図制御、マスク提案を確認する。
6. 背景・人物・効果の分離生成、透明レイヤー、一括生成、停止・再開を確認する。
7. ページ制作状態、長編制作、連続性、作品予算、チェックポイント、差分・復元を確認する。
8. 8ページ以上のPDF／PNGを書き出し、順序、内容、owner境界を確認する。
9. 2利用者で作品、分析、生成候補、Storage、書き出しURLのowner isolationを確認する。

### 6.3 Stripe test mode E2E

1. test modeの商品からCheckout Sessionを作成する。
2. 成功、キャンセル、非同期成功、非同期失敗、Payment Intent失敗、全額返金を確認する。
3. webhookの重複・順不同でも注文状態が後戻りしないことを確認する。
4. 未払い、別注文metadata、期限切れ、別ownerでダウンロードできないことを確認する。
5. 実在カード、本番課金、本番refundは使用しない。

### 6.4 R4-1停止条件

- 必須Cloud E2Eと`stripe-test-e2e`の証拠を台帳へ記録する。
- 不具合修正が必要なら受入れ記録と分離したDraft PRで修正し、再受入れする。
- 最終HEADの全CIとVercel Preview成功後、責任者確認待ちで停止する。
- 確認前にR4-2へ進まない。

## 7. PR-R4-2 Desktop／Windows配布／最終RC統合受入れ

### 7.1 Desktop実環境

- 実Ollamaで診断、Creator Chat、停止、再送信、再生成、履歴再読込を確認する。
- 実ComfyUIで診断、1件生成、素材登録、キャンセル、失敗表示、再実行を確認する。
- 複数Page PDF、連番画像ZIP、販売packageを製品版画面から生成し、Hub importまで確認する。
- Hub staging端末認証、失効、scope、非公開下書き取得を確認する。

### 7.2 アクセシビリティ実機

- Windows Narratorの日本語／英語。
- Windows高コントラスト。
- 表示倍率150%。
- キーボードのみの主要制作、設定、書き出し、Hub連携操作。

### 7.3 Windows配布

- 信頼された証明書でinstaller、uninstaller、更新対象を署名する。
- クリーンWindowsへinstall、起動、作品作成、書き出し、uninstallを確認する。
- 署名済み旧versionから署名済み新versionへ公開update URL経由で更新する。
- checksum、SBOM、update metadata、Authenticodeを機械検証する。

`windows-code-signing`と`signed-auto-update`は、信頼された証明書、署名済み2version、公開update URLが揃うまでblockedのままとする。blockedをローカルunsigned artifactの成功で代替しない。

### 7.4 最終判定

次をすべて満たした場合だけ`npm run rc:acceptance:strict`を実行してRC承認候補とする。

- pendingとblockedが0、または責任者が根拠付きで明示waiveした。
- `npm run rc:validate`、全CI、Vercel production／Preview確認が成功した。
- Sev 1／Sev 2の未解決不具合がない。
- 外部契約、owner isolation、一般／成人向け境界に差分がない。
- rollback、障害時連絡、配布物hash、署名者、release versionが記録済み。

## 8. R4対象外

- 成人向けDezgo dispatcherのproduction接続と成人向け生成受入れ。
- 非成人向けDezgo 10枚E2EはBYOK・費用承認がある場合だけ実施し、一般RCを停止させるかは責任者が明示判断する。
- Dependabotを含む依存更新。個別に互換性・脆弱性を監査し、R4受入れへ無断で混ぜない。
- 旧漫画制作PRの追加merge、close、comment、rebase、force push。必要な変更は後続の統合PRで既に取り込まれているため、旧PRを操作しない。
- 新機能、UI redesign、architecture再編。

## 9. rollback

- R4-0は文書commitを単独revertする。実データrollbackは不要。
- R4-1／R4-2の証拠更新は各PRを単独revertできる単位にする。
- staging test dataを削除する場合は対象IDとownerを読み取り確認し、製品データと分離する。
- 不具合修正は別PRをrevertし、受入れ台帳を`pending`へ戻して再検証する。
- migration、Storage移動、Stripe本番操作が必要になる変更はR4受入れPRへ含めない。

## 10. 残作業と停止条件

R4-0完了後の統合残件はR4-1とR4-2の2工程。ただし実行可能性は資格情報、外部サービス、費用承認、実Windows環境、信頼された証明書に依存する。

各工程はDraft PRを作成し、最終HEADの全CIとVercel Previewを確認して停止する。責任者が直前工程を確認・mergeするまで次工程へ進まない。最終RC承認は`RC_ACCEPTANCE_STATUS.json`のstrict判定と責任者承認の両方を必要とする。
