# Release Candidate Windowsアニメーション効果OFF受入れ 2026-08-28

## 結論

`WINDOWS_ANIMATION_EFFECTS_OFF_PASSED / SETTINGS_RESTORED / NARRATOR_PENDING`

Windows 11の実設定でアニメーション効果をOFFにし、MANGAI Desktopの主要操作がanimationを前提にせず理解・操作できることを確認した。Narrator日本語・Englishの音声確認は別gateとしてpendingを維持する。

## 環境

- Windows 11 Home 25H2 build 26200
- MANGAI Desktop 0.1.0、base `b45bad2`（PR #378 merge commit）
- 表示倍率100%、コントラストテーマ「なし」
- 確認方法: 実画面の目視、keyboard操作、Windows UI Automation
- Production、外部Provider、生成Job、Asset、credit、利用者データ操作: 0件

## 受入れ内容

Windows設定の「アクセシビリティ > 視覚効果 > アニメーション効果」をONからOFFへ変更した。

- Homeの主要操作、Projectカード、状態表示が欠けず表示された。
- command paletteが即時に開き、検索入力、候補、選択状態、件数を識別できた。
- Escapeでcommand paletteが閉じ、起動buttonへfocusが戻った。
- 新規Project dialogが即時に開き、入力、選択、Cancel、作成操作を識別できた。
- Escapeでdialogを閉じられた。
- 操作結果や状態理解にtransition、点滅、移動animationを必要とする箇所はなかった。

結果: `PASSED`

## 復元と境界

- 検証後、Windowsのアニメーション効果をONへ復元した。
- Narratorは検証終了時に停止した。
- Ollama／ComfyUI本体と対象モデルはこのPCに存在しないため、両実環境E2Eはpendingを維持した。
- Narrator日本語・Englishは利用者による音声内容確認が必要なためpendingを維持した。

## 検証

- 集中契約: 3/3
- Hub: 920/920
- dependency boundaries、lint、RC acceptance、`git diff --check`: 成功
- RC台帳: 5 passed、9 pending、2 blocked（本受入れはNarratorの完了数へ加算しない）
