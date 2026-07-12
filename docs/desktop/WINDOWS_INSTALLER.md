# Windowsインストーラー

更新日: 2026-07-12

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
- 自動更新と公開配布先は未設定です。

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
