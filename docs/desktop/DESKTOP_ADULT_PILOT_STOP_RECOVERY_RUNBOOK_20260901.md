# MANGAI Desktop Adult Pilot 停止・復旧ランブック

作成日: 2026-09-01

## 1. 適用範囲と原則

本書は招待制Desktop Adult Pilotの緊急停止、配布停止、version失効判断、問い合わせ、復旧、アンインストール、作品データ保持を扱う。成人向けCloudや外部Providerを有効化する手順ではない。

- 停止時もProject、素材、Page、backupを自動削除しない。
- Prompt、参照画像、mask、生成画像、完成Page、秘密値、絶対pathを報告へ含めない。
- 新規招待、配布再開、修正版公開は責任者の明示承認が必要。
- Production、Cloud、Provider、creditを障害回避の代替経路として使用しない。

## 2. 現在利用できる停止手段

| 対象 | 現在の手段 | 限界 |
| --- | --- | --- |
| 実行中のlocal生成 | Desktopのキャンセルを使用し、設定画面でMANGAI管理Runtimeを停止してアプリを終了する | 端末ごとの操作が必要 |
| 新規配布 | GitHub Draft Releaseを公開しない。公開済み配布物は配布担当者が非公開化または取得経路から除外する | Repository／配布先の権限が必要 |
| 自動更新 | `latest.yml`／`beta.yml`と対応artifactを配布先から外す。GitHubでは対象Releaseを非公開化する | 取得済みinstallerや既存installは停止しない |
| 新規招待 | 招待台帳を`STOPPED`にし、URLやinstallerを新たに送らない | 既配布fileの回収は保証できない |
| 既存version | 利用者へ停止通知し、起動中のRuntime停止とアプリ終了を依頼する | 遠隔強制停止／version失効機構は未実装 |

遠隔強制停止を実装済みとして扱わない。重大な安全境界違反では、配布停止と個別停止連絡を直ちに行い、既存versionの技術的失効は別設計・レビュー・受入れが完了するまで`BLOCKED`と記録する。

## 3. 緊急停止手順

1. 受付者は発生時刻、ランダムなモニターID、Desktop version、操作種別、分類済みerror codeだけを記録する。
2. 新規招待を停止し、招待台帳の対象Stageとversionを`STOPPED`にする。
3. 配布担当者は対象Release／更新metadataの公開を停止する。削除ではなく、復旧調査に必要なchecksum、SBOM、署名結果を管理領域へ保持する。
4. 利用者へ「生成をキャンセルし、MANGAI管理Runtimeを停止し、アプリを終了する」と通知する。Cloudや外部Providerへ切り替えない。
5. Projectを削除せず、可能ならDesktopのProject backupを別のlocal保存先へ1回作成する。障害がデータ書込みに関係する場合はアプリ上の追加編集を避け、既存Project folderを読み取り専用で保全する。
6. 診断共有への同意がある場合だけ、内容非保持の診断fileを回収する。画面共有や作品fileの送付を標準手順にしない。
7. 責任者へ停止条件、影響version、影響端末数、データ消失有無、外部通信有無を報告する。

安全境界違反、回復不能なデータ消失、署名／checksum不一致、診断内容漏えいの疑いは`SEV-1`とし、原因未確定でも停止を優先する。起動不能や同一重大障害が2端末以上の場合も配布を停止する。

## 4. 作品データ保持とバックアップ

既定の作品領域は`Documents\MANGAI`であり、database、projects、assets、exports、logs、backupsを含む。利用者がProject作成時に別の保存先を選んだ場合、その保存先も保全対象である。

- アンインストール前に、各Projectのbackupを利用者が選んだ別local folderへ作成する。
- backup作成不能時はDesktopを終了し、`Documents\MANGAI`と別指定したProject保存先を別driveへfile copyする。移動や削除はしない。
- 保全copyの作成日時、元version、file数、合計容量を記録し、作品内容や絶対pathは共有台帳へ書かない。
- 復元確認は元Projectを上書きせず、Desktopの復元機能で別Projectとして行う。
- 保全完了を確認するまでProject削除、runtime root削除、cleaner実行、設定初期化を行わない。

NSIS設定には`deleteAppDataOnUninstall`の明示がなく、作品領域はinstall directory外にある。ただし、これだけをデータ保持保証とは扱わない。Pilotではアンインストール前backupとアンインストール後の作品領域確認を必須とする。

## 5. アンインストール手順

1. 実行中の生成をキャンセルする。
2. MANGAI管理Runtimeを停止し、Desktopを終了する。
3. 前節のbackupまたは保全copyを作成する。
4. Windowsの「設定 > アプリ > インストールされているアプリ」からMANGAI Desktopをアンインストールする。
5. `Documents\MANGAI`と別指定Project保存先が残っていることを確認する。消失や変更があれば再インストールや生成を行わず`SEV-1`として報告する。
6. ComfyUI runtimeとmodelはDesktop本体とは別のlocal AI rootである。通常のアプリ復旧では削除しない。削除が必要な場合はProject backup確認後に、別手順と責任者承認で対象rootを特定する。

## 6. 問い合わせ受付

内容非保持の受付項目:

- ランダムなモニターID
- Desktop version、Windows version、GPU種別、VRAM帯
- 操作種別と発生時刻
- 成功／失敗区分、分類済みerror code、再現回数
- Runtime／workflow version
- Projectを開けるか、backupを作成できるか、外部通信の疑いがあるか

Prompt、画像、作品名、登場人物名、自由記述の作品説明、秘密値、端末名、メール、絶対pathは送らない。追加調査で作品内容が必要になっても自動収集せず、共有範囲と削除期限を責任者が個別承認する。

## 7. 復旧と配布再開

1. 影響versionと原因を特定し、旧artifact、checksum、SBOM、署名結果を保持する。
2. 修正をFeature Flagまたは新versionで実装し、既存生成経路とProject形式の後方互換を維持する。
3. local test、署名、artifact整合性、クリーンWindows install、4方式生成、保存、Page配置、書き出し、backup／別Project復元、uninstall後保持を再受入れする。
4. 診断fileにPrompt、画像、秘密値、絶対pathがないことを再確認する。
5. まず内部端末、次に停止前Stageの1名だけで24時間以上確認する。段階を飛ばさない。
6. 責任者が原因、修正、再受入れ証跡、対象version、通知文を承認してからReleaseと招待台帳を`ACTIVE`へ戻す。

次のいずれかが残る場合は再開しない: 原因不明、データ復元未確認、Cloud／外部Provider送信疑い未解消、署名／checksum未確認、内容漏えい未解消、適格12GB端末の4方式受入れ未完了。

## 8. 停止通知テンプレート

> MANGAI Desktop Pilotの対象versionで確認が必要な事象が発生したため、新規生成と配布を停止しました。生成をキャンセルし、設定画面でMANGAI管理Runtimeを停止してアプリを終了してください。Projectやlocal AI rootは削除せず、可能であればProject backupを別のlocal保存先へ作成してください。Promptや画像を返信せず、モニターID、Desktop version、操作種別、発生時刻、表示されたerror codeだけをご連絡ください。再開は修正版の受入れと責任者承認後に案内します。

## 9. 完了判定

本ランブックにより公開計画の「緊急停止、配布停止、問い合わせ、アンインストール、作品データ保持」の手順は`READY`とする。遠隔強制停止を伴う「version失効」は`NOT_IMPLEMENTED / MANUAL_STOP_REQUIRED`であり、Pilot開始前に責任者がこの制約を承認する必要がある。
