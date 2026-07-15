# 自動更新・公開配布

更新日: 2026-07-15

## 実装概要

MANGAI Desktopは`electron-updater`のNSIS更新に対応しています。配布版は起動5秒後に更新を確認し、利用者が明示的に「取得」を選ぶまでダウンロードしません。ダウンロード後は確認ダイアログを経て再起動・適用します。

更新チャンネルは`Stable`と`Beta`から選択できます。既定はStableで、選択値は`{Documents}/MANGAI/settings/update.json`へ保存します。Stableは正式版だけ、Betaは`-beta.N`形式の先行版と正式版を受け取ります。確認中、ダウンロード中、適用待ちはチャンネルを変更できません。

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

既存の`release/`を上書きせず検証する場合は、Desktop配下の単一フォルダー名を指定できます。

```powershell
$env:MANGAI_UPDATE_URL = "https://downloads.example.com/mangai/"
$env:MANGAI_RELEASE_OUTPUT = "release-rc-update"
npm run desktop:dist:win:update
npm run rc:windows-artifacts -- release-rc-update metadata
```

検証コマンドはmetadataのversion、installer名、SHA-512、ファイルサイズとblockmapを照合します。公開用の署名も同時に必須とする場合は末尾へ`signed`を追加します。

Beta版はDesktopのversionを`1.2.0-beta.1`のように設定します。チャンネルはversionから自動判定され、明示値とversionが矛盾する場合はビルドを停止します。

```powershell
$env:MANGAI_UPDATE_URL = "https://downloads.example.com/mangai/"
$env:MANGAI_RELEASE_CHANNEL = "beta"
npm run desktop:dist:win:update
```

`apps/desktop/release/`に最低限次の3ファイルが生成されます。

```text
latest.yml（Stable）またはbeta.yml（Beta）
MANGAI-Desktop-Setup-{version}-x64.exe
MANGAI-Desktop-Setup-{version}-x64.exe.blockmap
```

3ファイルを`MANGAI_UPDATE_URL`と同じHTTPSディレクトリへ配置します。generic配布先では`latest.yml`と`beta.yml`を同じ基点に置きます。新しいリリースでは先に`apps/desktop/package.json`のversionを上げてください。

## GitHub Releases

`.github/workflows/desktop-release.yml`は`desktop-v*`タグまたは手動実行で、Windows上の型検査、Lint、統合テスト、署名、Draft Release作成、更新ファイルのアップロードを行います。タグは`desktop-v{package.jsonのversion}`との完全一致を要求します。通常versionはStable、`-beta.N`はBetaとしてmetadataを生成し、それ以外のprerelease表記を拒否します。

必要なRepository Secrets:

- `WIN_CSC_LINK`
- `WIN_CSC_KEY_PASSWORD`

GitHubのリポジトリトークンはActionsの`github.token`を使用します。署名Secretsがない場合は公開前に停止します。

GitHub Releasesを更新元にするURL:

```text
https://github.com/{owner}/{repository}/releases/latest/download/
```

GitHub公開ビルドはリポジトリ名も`update-config.json`へ埋め込みます。DesktopはGitHub providerを使うため、Stableは正式Release、Betaは公開済みPrereleaseを検索できます。Draftのままではどちらのチャンネルにも配信されません。Beta版は確認後にGitHub上でPrereleaseとして公開してください。

## 現在の状態

このローカルリポジトリにはGit remoteが設定されていないため、公開アップロードは実行していません。2026-07-15にダミーHTTPS URLと分離出力先を使い、`latest.yml`生成、URL埋め込み、metadataのSHA-512・サイズ照合、ソース設定の自動復元までを確認しました。検証用URLを含む成果物は正式配布フォルダーへ昇格していません。Authenticodeは`NotSigned`のため、署名必須検証は意図どおり失敗します。

実公開前に次を行います。

1. GitHub remoteを設定する
2. コード署名Secretsを登録する
3. Desktopのversionを更新する
4. `desktop-v{version}`タグをpushする
5. Draft Releaseの署名、ファイル、説明を確認して公開する
