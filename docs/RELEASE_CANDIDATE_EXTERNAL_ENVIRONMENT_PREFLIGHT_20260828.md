# Release Candidate 外部環境preflight（2026-08-28）

## 目的

Ollama、ComfyUI、Supabase stagingの実環境E2Eを開始する前に、必要な実行環境と隔離接続情報が揃っているかを、秘密値を表示せず判定する。

## 実装

- `npm run rc:external:preflight`: 設定とコマンドの存在だけを確認する。ネットワーク接続は行わない。
- `npm run rc:external:probe`: 準備済みのOllama／ComfyUIに対して状態確認GETだけを行う。生成、Queue登録、キャンセル、Asset保存は行わない。
- `npm run rc:preflight`: 上記3環境のconfiguration-only判定を通常のRC結果へ統合する。明示的な`rc:external:probe`を指定しない限り接続しない。
- `--strict`: 不足または到達不能を終了コード1にする。
- Ollama／ComfyUIの接続先は、loopbackへのHTTPまたはHTTPSだけを許可する。無効URL、資格情報を埋め込んだURL、暗号化されていないremote HTTPは接続前に拒否する。
- Supabase stagingは`MANGAI_DB_ENV=staging`、正しい形式のBranch ref／親Project ref、PostgreSQL接続契約、`psql`がすべて揃い、Branch refが親Project refと異なり、`PGHOST`または`PGUSER`がBranch refと一致するまでREADYにしない。
- URL、password、API key等の値は出力しない。

## 2026-08-28確認結果

| 対象 | 判定 | 根拠 |
| --- | --- | --- |
| Ollama | PENDING | 本体／対象モデル未導入、`OLLAMA_HOST`未設定 |
| ComfyUI | PENDING | 本体／model／workflow未導入、`COMFYUI_URL`未設定 |
| Supabase staging隔離接続 | PENDING | `mangai-hub-staging`自体はHealthyだが、Supabase Branchは`No branches`。ローカルにstaging DB接続契約と`psql`なし |

Supabase Dashboardは既存Chromeログインで読み取り専用確認した。表示中の`main`はProduction扱いのため、migration、SQL、Feature Flag、資格情報、Branch、利用者データを変更していない。

## 安全境界

- Production修復・変更なし
- Provider生成なし
- Queue／Job／Asset変更なし
- credit予約・消費なし
- Supabase Branch作成なし
- 秘密値の取得・表示・保存なし

## 検証

- 集中テスト: 10/10成功
- dependency／module／code-size境界: 成功（既存warning 2件、新規error 0件）
- lint／Hub・Desktop型検査: 成功
- Hub: 931/931成功
- Canvas: 26/26成功
- AI core: 48/48成功
- Desktop: 182/182成功
- Desktop a11y: 29画面、blocking violation 0
- Supabase migration: 74/74成功
- Hub／Desktop production build: 成功
- RC repository structure: READY
- configuration-only preflight: 想定どおり3対象PENDING
- `git diff --check`: 成功

実環境E2Eは、Ollama／ComfyUI導入または隔離Supabase Branchと接続契約の準備後に、同preflightを再実行してから開始する。
