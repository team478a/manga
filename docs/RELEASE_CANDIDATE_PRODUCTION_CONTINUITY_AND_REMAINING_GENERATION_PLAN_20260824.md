# Production人物連続性監査・残コマ生成計画

作成日: 2026-08-24
Branch: `codex/audit-r4-3-production-continuity`
Base: `7f4ccf1fcc8226ce81881d81d1c5862a82ab8e08`（PR #324 merge commit）

## 結論

PR #324は基準ブランチへ反映済みであり、短い必須セリフを可読配置へ直す実装契約は揃った。ただし、既存Production原稿は利用者が明示的に「追加生成なし修復」を実行して保存するまで自動変更されない。

人物・衣装・場所・小物・画風について、現行の一貫性チェックは「生成時にどの設定版と参照画像を使ったか」を監査できる。一方、顔や衣装の見た目の一致、類似構図、コマ間の視覚的連続性は画像ピクセルを判定しないため保証できない。販売可能品質へ進めるには、履歴監査とVisual Judge／人間レビューを別のゲートとして維持する必要がある。

## 確認済みの契約

- PR #324 merge commit: `7f4ccf1fcc8226ce81881d81d1c5862a82ab8e08`。
- 現行の一貫性チェックはCanvasの`sourceJobId`、生成Job入力、Character／World Profile、Style Bible、参照画像、コマ割当を照合する。
- 検出対象は、生成履歴不足、割当不足、設定版不足・旧版・混在、参照画像未使用、画風設定不足・旧版である。
- 画像ピクセルを解析しないため、顔、手、衣装、背景、構図の見た目の一致は判定しない。
- Visual Judgeには`continuityMatch`と`continuity_break`の契約があるが、Production原稿の自動完成判定へはまだ接続しない。
- 既存原稿の修復は明示操作のみで、Provider JobやAssetを追加せず、修復対象だけをCanvas revisionへ保存する。

## 既知のProduction証跡

2026-08-20のread-only監査で、対象作品は32ページ、157コマ中13コマに画像が配置され、144コマが未配置だった。完成原稿判定は1/32ページ、生成進捗上の画像配置完了は2/32ページだった。

22ページは画像4/4、必須セリフ1/1、revision 11/11、PNG成功まで確認済みだが、下段2コマに類似構図と人物・場面連続性の目視確認事項が残った。PR #324反映後のProduction画面については、今回ブラウザ接続が応答しなかったため再確認できていない。Productionへの書込み、修復、Provider実行、クレジット消費は行っていない。

上記のページ数・コマ数・credit情報は2026-08-20時点の証跡であり、次の実行前にread-onlyで再集計する。

## 今すぐ追加課金なしで進められる作業

1. 既存ページの一貫性チェックを開き、設定版・参照画像・割当の警告をページ単位で解消する。
2. 22ページで明示的な「追加生成なし修復」を1回実行し、Editor、原稿プレビュー、PNGのセリフが同じ1行横書きになることを確認する。
3. 既存候補のうち、品質確認済みで未採用の画像があれば、新規生成前に比較・採用可否を確認する。
4. 画像配置済み13コマを対象に、人間が人物、衣装、小物、場所、構図重複を確認し、再生成が本当に必要なコマだけを確定する。

これらはProduction書込みを含むため、実行時は対象作品・操作・回数を明示して責任者承認を得る。今回の監査では実行しない。

## 残り144コマの生成計画

全144コマを一括投入しない。Provider、model、pricingを変更せず、既存のページbatch、checkpoint、credit reservation、fail-closed契約を使う。

### 事前ゲート

- 最新の未配置コマ数、既存候補数、credit残高・予約数をread-onlyで再集計する。
- Character／World／Styleの固定版と参照画像割当を確定する。
- 各コマのPanel Specification、必須人物、背景、小物、構図、禁止文字を確認する。
- 生成前checkpointを作成し、対象ページと開始revisionを記録する。
- 選択中のProvider／modelに対する1コマ当たりcreditから、batch上限を計算する。古い残高や推測単価で開始しない。

### 実行単位

1. **Pilot**: 連続する2ページを選び、最大8〜12コマだけ生成する。
2. **品質判定**: candidate visual品質、人物参照の使用履歴、ページ間連続性、不要文字、構図重複を確認する。
3. **採用**: 合格候補だけを明示採用し、原稿プレビューとPNGを確認する。
4. **拡張**: Pilot合格後も4ページ単位を上限として繰り返す。各batchの間にcheckpointと残creditを確認する。

8〜12コマ／4ページは処理を安全に観測する運用上限であり、Providerの料金・同時実行設定は変更しない。実際のbatch件数は既存のcredit予約結果がより小さい場合、その値へ縮小する。

### 停止条件

- credit不足または予約失敗。
- 1件でも所有権、成人向け境界、Provider承認、Storage availabilityの失敗がある。
- 同一人物の参照画像または設定版が欠ける。
- 不要文字、顔・手、構図、連続性の重大不良がbatch内で繰り返される。
- Job失敗、タイムアウト、再試行が既存上限へ達する。
- Canvas revision、PNG、checkpointのいずれかが不一致になる。
- Productionの最新コマ数・残creditが本計画の前提と異なる。

## 視覚品質の次PR境界

次PRで実装を検討する場合も、まずread-onlyの「目視確認候補」表示に限定する。履歴ベースの一貫性チェックを画像判定へ置き換えない。

- 既存Visual Judge evidenceの`continuityMatch`を採用画像へ適用できるか監査する。
- 同一ページ／隣接ページの画像について、同一Asset IDと完全一致digestは決定的に検出する。
- perceptual similarityは誤検知条件と閾値をBenchmarkで固定するまで完成阻害に使わない。
- 自動不採用、自動再生成、自動credit消費は行わない。
- Visual Judge結果は人間の正解ラベルや履歴監査の代替にしない。

## ロールバック

- 今回は文書のみで、Production、DB、Storage、Provider、作品、Canvasへのロールバック対象はない。
- 将来の生成batchは開始前checkpointへページ単位で復元する。
- 不採用候補や失敗Jobを採用Canvasへ残さず、採用済みの合格Assetは別batchの失敗で破棄しない。
- 設定版・参照画像の変更は既存versionを削除せず、新版と生成Job入力の対応を保持する。

## 検証

- `cloud-continuity-review`: 4件成功。
- Character Identity／品質契約: 5件成功。
- Benchmark／Visual Judge境界: 14件成功。
- 合計: 23/23成功。
- `git diff --check`: 成功。

## 次の責任者判断

1. Production 22ページで追加生成なし修復を1回実行してよいか。
2. Productionをread-only再集計し、未配置コマ数・候補数・credit残高を更新してよいか。
3. Pilot対象の連続2ページと、既存Provider／model契約に基づく最大creditを承認するか。
4. 見た目の連続性検査を、先にread-only監査PRとして実装するか、人間レビューを先に行うか。

責任者の明示承認前に、Production修復、Provider実行、credit予約、次PRの公開は行わない。
