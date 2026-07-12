# 自動更新・公開配布

更新日: 2026-07-13

## 実装概要

MANGAI Desktopは`electron-updater`のNSIS更新に対応しています。配布版は起動5秒後に更新を確認し、利用者が明示的に「取得」を選ぶまでダウンロードしません。ダウンロード後は確認ダイアログを経て再起動・適用します。

開発版と通常ビルドは更新URLが空のため外部通信しません。更新用リリースビルドだけがHTTPS配布URLを`resources/update-config.json`へ埋め込みます。

## 画面状態

- 更新未設定／開発版: ボタン無効
- 確認中
- 最新版
- 更新あり
- ダウンロード中（進捗率）
- 再起動して更新
- エラー（秘密情報や内部スタックは表示しない）

## 更新用成果物の生成

PowerShellで配布先URLを設定して実行します。

```powershell
$env:MANGAI_UPDATE_URL = "https://downloads.example.com/mangai/"
npm run desktop:dist:win:update
```

`apps/desktop/release/`に最低限次の3ファイルが生成されます。

```text
latest.yml
MANGAI-Desktop-Setup-{version}-x64.exe
MANGAI-Desktop-Setup-{version}-x64.exe.blockmap
```

3ファイルを`MANGAI_UPDATE_URL`と同じHTTPSディレクトリへ配置します。新しいリリースでは先に`apps/desktop/package.json`のversionを上げてください。

## GitHub Releases

`.github/workflows/desktop-release.yml`を追加しています。`desktop-v*`タグまたは手動実行で、Windows上の型検査、Lint、16件の統合テスト、署名、Draft Release作成、更新ファイルのアップロードを行います。

必要なRepository Secrets:

- `WIN_CSC_LINK`
- `WIN_CSC_KEY_PASSWORD`

GitHubのリポジトリトークンはActionsの`github.token`を使用します。署名Secretsがない場合は公開前に停止します。

GitHub Releasesを更新元にするURL:

```text
https://github.com/{owner}/{repository}/releases/latest/download/
```

## 現在の状態

このローカルリポジトリにはGit remoteが設定されていないため、公開アップロードは実行していません。ダミーHTTPS URLによる`latest.yml`生成、URL埋め込み、ソース設定の自動復元までを確認しています。

実公開前に次を行います。

1. GitHub remoteを設定する
2. コード署名Secretsを登録する
3. Desktopのversionを更新する
4. `desktop-v{version}`タグをpushする
5. Draft Releaseの署名、ファイル、説明を確認して公開する
