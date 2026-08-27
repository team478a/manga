# Release Candidate Windows Display Preflight（2026-08-28）

状態: `AUTOMATED_PREFLIGHT_PASSED / HIGH_CONTRAST_DEFECT_FIXED / WINDOWS_MANUAL_ACCEPTANCE_PENDING`

## 目的

Windows実機の表示倍率150%とコントラストテーマを変更する前に、MANGAI Desktopだけを隔離したChromium実行条件で29画面・状態のアクセシビリティ監査、横あふれ、主要キーボード操作を再現可能に検証する。

## 実行環境

- Microsoft Windows 11 Home 25H2、build 26200。
- 通常のWindows表示倍率は100%（AppliedDPI 96）。OS全体の設定は変更していない。
- MANGAI Desktop `0.1.0`、base `a629528`。
- 外部Provider、Hub、Production、credit、利用者データを使用しない隔離テストデータ。

## 追加した検証

`npm run desktop:test:display-acceptance`は、既存の29画面axe／visual harnessを次の2条件で実行する。

1. `--force-device-scale-factor=1.5`。runtimeで`devicePixelRatio >= 1.49`を必須にする。
2. `--force-high-contrast`。runtimeで`(forced-colors: active)`を必須にする。

両条件でdocument横あふれを拒否し、既存の主要キーボード・dialog・Project grid visual check 21項目を維持する。フラグが有効にならない場合は成功扱いにしない。

## 検出と修正

初回の強制カラー実行は、暗色テーマの固定semantic tokenがWindowsのCanvas背景へ残り、Homeを含む複数画面でseriousな色コントラスト違反を検出して停止した。

`forced-colors: active`で背景、文字、境界、選択、入力、button、linkをWindows system colorへ対応付けた。再実行では29画面すべてでblocking violation 0、横あふれ0、visual check 21/21となった。

## 結果

| 条件 | runtime証明 | axe blocking | 横あふれ | visual check |
| --- | --- | ---: | ---: | ---: |
| 150%相当 | devicePixelRatio 1.5 | 0 | 0 | 21/21 |
| 強制カラー | forcedColors active | 0 | 0 | 21/21 |

## 判定境界

この結果は自動preflightであり、Windows設定アプリから実際に150%／コントラストテーマを有効化した人の目視確認を代替しない。`windows-scale-150`と`windows-high-contrast`はRC台帳でpendingを維持する。Narrator日本語／Englishも、実音声の確認が必要なためpendingを維持する。

## 全体検証

- 表示受入れ契約 2/2、150%相当／強制カラー各29画面、blocking violation 0、visual／keyboard各21/21。
- Hub 919/919、Canvas 26/26、AI 48/48、Desktop 182/182。
- 通常テーマのDesktop accessibility 29画面、violation 0。
- Supabase migration 74件。
- dependency boundary、lint、Hub／Desktop型検査、Hub／Desktop production build、RC structure、`git diff --check`成功。
- `rc:preflight`の外部設定・手動E2Eは差分外としてpendingを維持した。

## 安全境界

Windowsの表示設定、Narrator設定、他アプリ、Production、Supabase、Vercel、Provider、Job、Asset、credit、決済、利用者データは変更していない。
