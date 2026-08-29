# クリーンWindows最終受入れ

更新日: 2026-08-28

## 目的

一般公開する署名済みMANGAI Desktopを、Windows Sandbox、初期化済みVM、または新規PCで最終確認します。既存PC上の自動installer E2Eは事前検査であり、この実機受入れの代替にはしません。

## 事前判定

```powershell
npm run rc:clean-windows-acceptance
npm run rc:clean-windows-acceptance:strict
```

通常commandは現在のpending／blocked理由を表示します。`strict`は全証跡が揃うまで終了コード1となります。結果の正本は`CLEAN_WINDOWS_ACCEPTANCE.json`です。

実機確認後は、秘密値を含まない証跡JSONを明示的に取り込みます。

```powershell
npm run rc:clean-windows-evidence:import -- C:\secure-transfer\clean-windows-evidence.json
```

取り込みは、RC台帳のコード署名と署名付き自動更新が先に合格している場合だけ許可されます。成功時は受入れstatusとRC台帳のクリーンWindows項目を同期します。

証跡形式は`mangai.clean-windows-evidence` version 1です。`operatorRole`は`release-operator`固定とし、氏名、メール、端末名、APIキー、Prompt、画像、署名鍵を含めません。端末識別が必要な場合はランダムな端末ラベルのSHA-256だけを`machineIdSha256`へ記録します。

## 必須条件

1. 信頼された証明書で旧版と新版のinstallerおよび製品EXEが署名され、Authenticodeが`Valid`である。
2. 署名済み2versionとHTTPSの公開更新URLを用意する。
3. 個人データや既存MANGAIインストールがないクリーンWindows環境を使う。
4. installer、blockmap、更新metadata、SBOM、SHA-256一覧を事前検証する。

## 手順

1. 旧版をinstallし、SmartScreenと署名者表示を確認する。
2. 起動してProjectを作成し、3Page以上、画像、吹き出し、縦書き・横書きを保存する。
3. PDFを書き出し、Page順、寸法、画像、文字を確認してSHA-256を記録する。
4. アプリ内更新から新版へ更新し、versionとAuthenticodeを確認する。
5. 更新後もProject、素材、Page、吹き出し、文字、書き出しが保持されることを確認する。
6. アプリをuninstallし、実行ファイル、shortcut、登録情報が消えることを確認する。利用者Projectは自動削除されないことを確認する。

APIキー、Prompt本文、画像本文、個人情報、署名鍵は証跡へ記録しません。Production、Provider、creditはこの受入れでは操作しません。

## 現在の判定

信頼されたコード署名証明書と署名済み2versionがないため`BLOCKED`です。未署名installerのローカルinstall・製品版起動・uninstall E2Eは成功済みですが、クリーンWindows最終受入れを合格にはしません。
