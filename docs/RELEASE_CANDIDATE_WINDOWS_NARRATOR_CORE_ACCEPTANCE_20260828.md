# Release Candidate Windows Narrator主要導線受入れ（2026-08-28）

## 結果

- Windows 11 Home 25H2 build 26200でNarratorを実機起動した。
- 日本語とEnglishの両localeで、Home、新規Project button、dialog名、Title編集欄、作成／Create buttonを読み上げ、利用者が音声を識別できることを確認した。
- Shift+TabでTitleから作成／Createへ移動し、TabでTitleへ循環した。Escape後は起動元の新規Project／New project buttonへfocusが戻った。
- UI Automationでは同じ要素の名前、button／dialog／editの役割、modal内focus、背面の非操作状態を確認した。
- English確認後、表示言語は日本語へ復元した。
- 2026-08-29の拡張サンプルで、日本語／Englishの書き出しdialogを各1回読み上げ、利用者が実音声を識別できることを確認した。生成ジョブは両localeでUI Automationの名前・役割・説明を確認した。

## 判定範囲

- 本受入れは、利用者音声確認が必要な主要導線を日本語／English各1回以上サンプリングしたものとする。
- `docs/desktop/NARRATOR_ACCEPTANCE.md`の拡張操作6〜27は、既存の29画面axe／keyboard／UI Automation証跡を維持する。今回の追加実音声サンプルは日本語／Englishの書き出しdialogに限定し、生成履歴の実状態や削除確認など他の拡張操作を実音声確認済みとは扱わない。
- RC停止条件のうち、主要導線の名前・役割・modal退出・focus復帰に違反はなかった。

## 安全境界

- Project作成・削除・編集なし
- Production、Hub、Provider、DB、Queue、Job、Asset、credit操作なし
- Windows表示設定、コントラストテーマ、アニメーション設定の変更なし

## 併用証跡

- Desktop a11y: 日本語／Englishを含む29画面、blocking violation 0
- `docs/RELEASE_CANDIDATE_WINDOWS_MANUAL_DISPLAY_ACCEPTANCE_20260828.md`
- `docs/RELEASE_CANDIDATE_WINDOWS_REDUCED_MOTION_ACCEPTANCE_20260828.md`
