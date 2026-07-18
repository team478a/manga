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

## 残る完了条件

## 検証

- Phase 5 offline受入れ: 1/1。成人向けInpainting、素材保存、Page配置、PDF・販売パッケージ書き出しまで成功
- AI core: 41/41
- Desktop統合: 86/86
- TypeScript、ESLint、Desktop production build: 成功
- 日英29画面・状態のaxe監査: 違反0件
- 8GB／12GB／16GB実機記録schema: 正常
- 実機strict判定: pending 3件を理由に意図どおり不合格

## 残る完了条件

1. 8GB GPU Windows実機のText-to-Image／Img2Img／ControlNet／Inpainting
2. 12GB GPU Windows実機の同4操作
3. 16GB以上GPU Windows実機の同4操作
4. 実機結果反映後のPhase 5完了監査資料

状態: **リポジトリ実装完了／Windows GPU実機受入れ待ち**
