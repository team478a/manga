# Windowsインストーラー

更新日: 2026-07-15

## 生成

リポジトリルートから次を実行します。

```powershell
npm run desktop:dist:win
```

展開版のみを確認するとき:

```powershell
npm run desktop:pack:win
```

成果物は `apps/desktop/release/` に生成されます。

```text
MANGAI-Desktop-Setup-{version}-x64.exe
MANGAI-Desktop-Setup-{version}-x64.exe.blockmap
win-unpacked/
```

生成後は、version、ファイルサイズ、blockmap、Authenticode状態を検証します。

```powershell
npm run rc:windows-artifacts
```

署名済みRCとして判定する場合は`Signed`ではなく有効な`Valid`署名を必須にします。

```powershell
npm run rc:windows-artifacts -- signed
```

2026-07-15に現行コードから0.1.0のNSISインストーラーとblockmapを再生成し、通常検証に成功しました。Authenticodeは`NotSigned`であり、コード署名完了前の内部確認用成果物です。古い更新metadataは現行の更新無効インストーラーと混同しないよう配布フォルダーから除外しています。

## インストール／アンインストールE2E

WindowsのクリーンなCIでは、NSISのsilent install、実行ファイル、Desktop・Start Menuショートカット、アンインストール登録、silent uninstall、残存物の削除を自動確認します。既存のMANGAI Desktopを検出した場合は上書きせず停止します。

ローカル実行はシステムへ一時的にインストールするため、明示的に`allow-local`を指定します。製品データへ触れないようアプリ本体は起動しません。

```powershell
npm run rc:windows-installer-e2e -- allow-local
```

2026-07-15に現行0.1.0インストーラーで実行し、インストールからアンインストール後の登録・ショートカット消失まで成功しました。

## 配布設定

- App ID: `jp.mangai.creator.desktop`
- Product Name: `MANGAI Desktop`
- Windows x64 / NSIS
- ユーザー単位インストール
- インストール先を選択可能
- デスクトップとスタートメニューへショートカット作成
- ASAR有効
- `better-sqlite3`をASAR外へ展開し、対象Electron ABI向けに再構築

`npm install`後のpostinstallでもネイティブ依存を現在のElectronへ合わせます。

## 現在の配布前課題

- コード署名証明書をまだ取得・設定していないため、通常コマンドで生成するEXEは未署名です。
- 自動更新基盤とGitHub Actionsは実装済みですが、Git remoteと実公開先は未設定です。

一般公開前に信頼されたコード署名証明書、インストール／アンインストールE2E、自動更新方針を確定してください。

## ブランドアイコン

`build/icon.svg`を原稿として、`build/icon.png`とWindows用マルチサイズ`build/icon.ico`を管理しています。濃緑の角丸背景、漫画原稿、MANGAIの「M」、制作追加を示すオレンジのプラス記号で構成しています。

## 署名ビルド

署名証明書のPFXファイルまたはbase64値を`WIN_CSC_LINK`、パスワードを`WIN_CSC_KEY_PASSWORD`へ設定します。これらはGit管理ファイルへ書かず、CIの暗号化シークレットまたはビルド端末の一時的な環境変数から渡してください。

```powershell
$env:WIN_CSC_LINK = "C:\secure\mangai-code-signing.pfx"
$env:WIN_CSC_KEY_PASSWORD = "<ローカルまたはCIのシークレットから設定>"
npm run desktop:dist:win:signed
```

署名コマンドは証明書が未設定なら生成前に停止し、Electron Builderの`forceCodeSigning`を有効にします。これにより署名版として実行した処理から未署名EXEが誤って出力されることを防ぎます。

生成後は次で署名状態を確認します。

```powershell
Get-AuthenticodeSignature apps/desktop/release/MANGAI-Desktop-Setup-0.1.0-x64.exe
```

公開前の最終判定では手動確認に加えて次を実行してください。

```powershell
npm run rc:windows-artifacts -- signed
```
