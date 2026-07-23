# MANGAI Phase 5 Desktop Adult ローカル実用化 進捗

開始日: 2026-07-18

## 既存実装として確認済み

- 一般Cloud／成人Desktopのcontent class境界
- 成人向けProjectの`local_only`既定値
- 管理者許可、期限付き18歳以上確認、1枚ごとの6項目確認
- 未成年・年齢不明・実在人物・非同意／搾取表現のPrompt拒否
- 成人向け一括生成の拒否とComfyUI batch size 1固定
- loopback ComfyUI限定、外部routeのfail closed
- Runtime Profile、最大解像度、ControlNet／LoRA上限、ChatとのGPU排他
- tiled VAE workflow監査とComfyUI CPU VAE／low VRAM実行環境検査

## Milestone 1: ローカル修正生成・キャラクター一貫性

- Project作成時の成人向け専用確認
- キャラクターProfile、外見Prompt、Negative Promptの端末内保存
- ProfileとProject素材の参照用途別関連付け
- 別Project素材の関連付け拒否
- 再起動、Project複製、バックアップ復元でのProfile保持
- Text-to-Image、Image-to-Image、ControlNet、Inpaintingの入力契約
- Project素材の所有・hash・サイズ確認後にだけlocalhost ComfyUIへupload
- workflowのsource／control／mask／denoise mapping
- 顔や手の修正をInpaintingとして1枚ずつ実行するUI

## Milestone 2: privacy・導入資料

- Prompt、Negative Prompt、入力画像、マスク、画像bytes、生成input/outputの診断除外
- クラッシュ自由文messageを保存しないprivacy境界
- 選択モデルのlicense表示。未確認を自動推測しない
- Ollama／ComfyUI、workflow mapping、低VRAM設定の導入ガイド
- Project単位暗号化を別要件として評価し、現行の運用条件を明記

## Milestone 3: 実機証跡回収

- MANGAI Desktopから、内容を含まない実機証跡JSONを保存可能
- 証跡はGPU／VRAM／RAM、4方式の成果物hash、PDF／販売パッケージhashだけを保持
- CLI取込み時にProfileのVRAM帯、全4方式、日時、SHA-256、書き出しを検証
- 取込み後も8GB／12GB／16GBの全Profileが揃わない限りstrict判定は不合格

## Milestone 4: 参照画像のローカル安全確認

- 入力画像とキャラクターProfile参照素材を生成前に列挙
- 人物なし、架空の成人、未確認、年齢曖昧、実在人物可能性を端末内だけで記録
- 未確認、人物有無不明、成人未確認、実在人物可能性ありをfail closedで拒否
- 判定結果は素材metadataへ保存し、Project複製・バックアップ・復元で維持
- 現段階は利用者による手動ローカル確認。端末内推定モデルは今後の実装対象

## 検証

- Phase 5 offline受入れ: 1/1。成人向けText-to-Image／Img2Img／ControlNet／Inpainting、素材保存、Page配置、PDF・販売パッケージ書き出し、実機証跡作成まで成功
- 実機証跡取込み: 2/2。正常取込みとVRAM帯不一致拒否に成功
- AI core: 44/44
- Desktop統合: 90/90
- TypeScript、ESLint、Desktop production build: 成功
- 日英29画面・状態のaxe監査: 違反0件
- 8GB／12GB／16GB実機記録schema: 正常
- 実機strict判定: pending 3件を理由に意図どおり不合格

## 残る完了条件

1. 8GB GPU Windows実機のText-to-Image／Img2Img／ControlNet／Inpainting
2. 12GB GPU Windows実機の同4操作
3. 16GB以上GPU Windows実機の同4操作
4. 実機結果反映後のPhase 5完了監査資料

状態: **リポジトリ実装・証跡回収経路完了／Windows GPU実機3区分の受入れ待ち**
