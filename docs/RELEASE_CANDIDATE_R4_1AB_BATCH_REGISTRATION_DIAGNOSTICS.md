# PR-R4-1ab 長編一括生成登録阻害の解消

## 結果

- Production `https://app.mang-ai.com` の一般向けモニター `test` で、作品 `b008b746-94c6-4e83-85dd-3bb0e379c96a` の19〜22ページ（4ページ／16コマ）を1回だけ開始した。
- 開始前は作品画風設定済み、主要人物3/3名設定済み、必要32 creditに対して残り100、モニターAI残り85、`flux-2-pro`／`bfl-flux2-2026-03`で阻害要因0だった。
- 開始は「一括生成を開始できませんでした。」でfail-closedになり、一括生成履歴0、利用／予約credit 0、Provider Job 0を確認した。再試行はしていない。
- 失敗経路は、準備済み入力のschema検証または`create_cloud_generation_batch_targets` RPCの永続登録までに限定できた。接続中のSupabase／VercelアカウントにはProduction log権限がなく、内部詳細は取得できなかった。

## 変更

- applicationで準備、入力schema検証、RPC永続登録を別の安全な失敗段階として扱う。
- RPCは既存signatureと原子的な登録挙動を維持し、権限、件数、payload、ページrevision、料金、panel、重複、insert件数を固定codeで分類する。
- 手動migration適用後に残り得るPostgREST function schema cacheへreloadを通知する。
- 固定codeだけを利用者向けDomain Errorへ変換する。未知のDB情報、Prompt、画像、内部payloadは画面へ出さない。
- rollbackは従来の単一`cloud_batch_targets_invalid`検証へ戻し、同じRPC権限とschema cache reloadを復元する。

## 不変条件

- URL、公開API、RPC signature、table schema、Storage、Feature Flagを変更しない。
- Provider、model、pricing値、credit単価、retry、timeout、rate limit、Scheduler頻度を変更しない。
- Canvas schema、PDF／PNG、成人向け境界、Desktopを変更しない。
- 登録失敗時にbatch target、Provider Job、credit予約を残さない原子性を維持する。

## 検証

- 集中テスト 16/16
- Hub 662/662、Canvas 26/26、AI 48/48、Desktop 182/182
- dependency boundary 0 errors（既存warning 2件）、lint、Hub／Desktop typecheck成功
- Desktop accessibility violations 0、Desktop production build成功
- migration checksum／forward・rollback validation 55/55、diff check成功
- Hub production buildは長いWindows作業パスでTurbopackのfilesystem上限に達したため、同一commitを短い物理worktreeで再確認する。
- `rc:preflight`のrepository structureはREADY。外部Secretと手動E2Eはローカル環境にないためPENDING。

## Production再受入れ

1. Draft PRの全CIとVercel Previewが成功し、責任者がmergeする。
2. Productionへ`202608130003_cloud_generation_batch_registration_diagnostics.sql`を適用する。
3. 同じ`test`作品で19〜22ページを1回だけ開始する。
4. 固定された段階別エラー、またはbatch target 16件の登録を確認する。
5. 登録成功時だけWorker処理、credit、生成画像、品質を継続監視する。

責任者確認前、Production migration適用前には再試行しない。
