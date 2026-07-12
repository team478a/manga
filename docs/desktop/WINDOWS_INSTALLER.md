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

- コード署名証明書をまだ設定していないため、生成EXEは未署名です。
- ブランド用 `.ico` が未提供のため、現在はElectron既定アイコンです。
- 自動更新と公開配布先は未設定です。

一般公開前にコード署名、ブランドアイコン、インストール／アンインストールE2E、自動更新方針を確定してください。
