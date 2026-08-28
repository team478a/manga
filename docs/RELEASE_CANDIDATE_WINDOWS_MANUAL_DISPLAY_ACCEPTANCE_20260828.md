# Release Candidate Windows実表示受入れ 2026-08-28

## 結論

`WINDOWS_SCALE_150_PASSED / WINDOWS_HIGH_CONTRAST_PASSED / NARRATOR_PENDING / SETTINGS_RESTORED`

Windows 11の実設定で150%表示とコントラストテーマを適用し、MANGAI DesktopのHome、command palette、Editorを確認した。両受入れは合格した。Narrator日本語・Englishの音声確認は別の未完了RC gateとして維持する。

## 環境と範囲

- Windows 11 Home 25H2 build 26200
- MANGAI Desktop 0.1.0、base `f0ea450`（PR #377 merge commit）と本修正
- 150%対象display: 1920×1080（通常時100%）
- コントラストテーマ: Windows「夕暮れ」
- 確認方法: 実画面の目視、keyboard操作、Windows UI Automation
- Production、外部Provider、生成Job、Asset、credit、利用者データ操作: 0件

## 150%表示

Windowsのdisplay scaleを100%から150%へ変更してDesktopを起動した。

- Homeの主要操作が表示され、keyboardで到達できた。
- command paletteの選択肢、focus、accessible nameを確認した。
- Editorのheader、navigation、panel、toolbar、footerが表示された。
- document全体を横スクロールしなければ主要操作へ到達できない状態はなかった。Canvas内部の編集用scrollbarは想定内とした。

結果: `PASSED`

## Windowsコントラストテーマ

Windowsのコントラストテーマ「夕暮れ」を実際に適用してDesktopを起動した。

- button、input、tab、選択状態、focus境界を識別できた。
- Home、command palette、Editorの主要操作とaccessible name／roleを確認した。
- 初回Tabで表示されるskip linkの文字が背景と同化するRC停止不具合を検出した。
- forced-colors時のskip linkへ`Highlight` border、`Canvas` background、`CanvasText` textを指定した。
- build後に同じ実テーマで再起動し、「メインコンテンツへ移動」の文字とfocus境界が視認できることを確認した。

結果: `PASSED_AFTER_FIX`

## 復元と残件

- 実機検証後、display scaleを100%へ復元した。
- コントラストテーマを「なし」へ戻して適用し、通常のWindows配色へ復元した。
- Narrator日本語・Englishは音声内容を人が確認する必要があるため`pending`のまま。高コントラストと150%表示の合格をNarrator合格へ読み替えない。

正本のチェックリストとRC台帳は`docs/desktop/NARRATOR_ACCEPTANCE.md`および`docs/desktop/RC_ACCEPTANCE_STATUS.json`へ同期する。

## 検証

- 集中契約: 3/3
- Hub: 919/919、Canvas: 26/26、AI: 48/48、Desktop: 182/182
- axe: 通常／150%相当／強制カラーの各29画面でblocking violation 0
- visual／keyboard: 各variant 21/21、document横あふれ0
- Supabase migration: 74件
- dependency boundaries、lint、Hub／Desktop typecheck、Hub／Desktop production build、RC structure、`git diff --check`: 成功
- RC preflight: repository structure READY。外部設定と手動E2Eは既知のpendingを維持
