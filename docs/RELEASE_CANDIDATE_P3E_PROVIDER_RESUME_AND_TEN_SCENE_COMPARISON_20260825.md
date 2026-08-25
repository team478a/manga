# P3-E Provider再開・失敗解放・参照付き10シーン比較

## 実行承認と境界

- 2026-08-25に責任者がBFL実Providerテストを明示承認した。
- 費用上限は、公式料金再確認後に`$0.50`へ再承認された。
- Production、Supabase、MANGAI Job／credit台帳、Storage、Canvasは使用していない。
- 一般向け架空人物だけを使用し、Prompt、API key、Provider Job ID、生成画像はGitへ保存しない。
- 自動再試行は0回。moderation拒否時は停止し、責任者の再承認後に別の穏やかな場面へ置換した。

## 無課金の中断・再開／失敗解放

既存の決定論的テスト34件を再実行し、34/34成功した。

- checkpoint済みBFL Provider Jobはpollだけを再開し、submitを重複しない。
- Provider Job IDを失敗後にも保持し、完了待ちでは通常retry回数を消費しない。
- 20ページ中断後も完了済みAssetを維持し、未完了コマだけを再開する。
- 終端失敗は予約credit／予約費用を`release`し、使用creditへ加算しない。
- retry可能な失敗は終端まで予約を維持する。

## BFL参照付き10シーン比較

- Provider／model: `black-forest-labs`／`flux-2-pro`（固定snapshot）
- 基準人物画像: 1件
- 同一基準画像を参照した別シーン: 9件
- 成功画像: 10/10、PNG 512×768
- moderation: 最初の場面候補1件が非retry拒否。別の穏やかな場面への置換は成功。
- 自動再試行: 0
- 費用見込み: 成功分は公式最低料金で`$0.435`、拒否分も課金された場合の最大見込み`$0.480`。Provider請求台帳は本テストから参照していないため確定額ではない。

## 人手採点

| 項目 | 結果 | 判定 |
| --- | ---: | --- |
| 重大な別人化防止 | 10/10 | PASS（受入8/10以上） |
| 丸眼鏡 | 10/10 | PASS |
| 主要衣装・体格 | 10/10 | PASS |
| 髪型の厳密一致 | 8/10 | WARNING（2シーンで軽微な輪郭変動） |
| 重大な人体破綻なし | 10/10 | PASS |
| 疑似文字なし | 7/10 | WARNING（本棚／書類／書籍） |
| 白黒画風の厳密維持 | 9/10 | WARNING（夕景1件に橙色） |

画像はOS一時領域にのみ保存し、SHA-256を含むローカルevidence JSONを作成した。利用者素材、Production素材、成人向け素材は使っていない。

## 検出した価格計測gap

現行BFL adapterの`modelCostMicros`は`flux-2-pro`を常に`30,000` microsとして返す。一方、2026-08-25確認時点のBFL公式料金はText-to-Imageが`from $0.030`、Image Editingが`from $0.045`である。submit応答のProvider costを現行schemaが保持せず、参照付き生成でも`30,000`を返すため、実請求とMANGAI原価記録が乖離する可能性がある。

このgapを解消するまで、参照付きstaging E2Eを課金・原価整合の合格証跡にしない。次はProvider返却costの検証、価格version更新、上限guard、決定論的テストを小さなPRで実装してからstaging E2Eへ進む。

## ローカル品質ゲート

- 集中34/34
- Hub 882/882、Canvas 26/26、AI 48/48、Desktop 182/182
- a11y violation 0、migration 71件
- deps、lint、全型検査、Hub／Desktop build、RC structure、diff check成功
- npm audit既知5件、module boundary既知警告2件、外部設定／手動E2E pendingは既存状態

## 公式確認先

- https://docs.bfl.ai/quick_start/pricing
- https://docs.bfl.ai/flux_2/flux2_image_editing
- https://docs.bfl.ai/flux_2/flux2_overview
