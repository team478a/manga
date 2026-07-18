# MANGAI Desktop Adult ローカルAI導入ガイド

更新日: 2026-07-18

## 目的

成人向けProjectのPrompt、参照素材、生成画像を外部Providerへ送らず、端末内のOllamaとComfyUIだけで制作する。ComfyUIは`localhost`または`127.0.0.1`で起動する。LAN・公開URLを成人向け生成先として使用しない。

## Ollama

Creator Chat用モデルは、端末のRAMとモデル配布元の利用条件を確認して選択する。MANGAIはモデル名からlicenseを推測しない。

| 端末目安 | 推奨するモデル規模 | 運用 |
| --- | --- | --- |
| RAM 8GB | 1B〜3Bの量子化モデル | Chatだけを実行し、画像生成前にモデルを解放 |
| RAM 12〜16GB | 3B〜7Bの量子化モデル | ComfyUIとの同時実行を避ける |
| RAM 24GB以上 | 7B前後から検証 | 応答速度とlicenseを確認して段階的に変更 |

確認項目は、商用利用、成人向け利用、派生物、クレジット表示、再配布である。確認できないモデルは制作へ使用しない。

## ComfyUI

1. ComfyUIを端末内へ導入する。
2. 低VRAM端末では`--lowvram`または`--novram`、`--cpu-vae`、必要に応じて`--reserve-vram`を設定する。
3. MANGAI DesktopのAI設定でURLを`http://127.0.0.1:8188`へ設定する。
4. API形式のworkflow JSONをMANGAIへ登録する。
5. workflowの入力mappingを設定し、検証ボタンでノードを確認する。

推奨workflowは次の条件を満たす。

- 出力batch sizeは1
- 低VRAM用に`VAEDecodeTiled`を使用
- Image-to-Imageは`sourceImage`と`denoiseStrength`をmapping
- ControlNetは`controlImage`をmapping
- Inpaintingは`sourceImage`、`maskImage`、`denoiseStrength`をmapping
- 使用checkpoint、VAE、LoRA、ControlNet modelのlicenseを個別確認

mapping例:

```json
{
  "prompt": { "nodeId": "6", "input": "text" },
  "negativePrompt": { "nodeId": "7", "input": "text" },
  "sourceImage": { "nodeId": "10", "input": "image" },
  "controlImage": { "nodeId": "11", "input": "image" },
  "maskImage": { "nodeId": "12", "input": "image" },
  "denoiseStrength": { "nodeId": "3", "input": "denoise" },
  "width": { "nodeId": "5", "input": "width" },
  "height": { "nodeId": "5", "input": "height" },
  "seed": { "nodeId": "3", "input": "seed" }
}
```

ノードIDは使用するworkflowに合わせて変更する。

## 成人向け生成の安全条件

- 成人向けProjectとして作成する
- 端末管理者が成人向け生成を有効にする
- 18歳以上確認が有効期限内である
- 1枚ごとの6項目確認を完了する
- 架空の成人だけを扱い、未成年・年齢不明・実在人物・非同意表現を含めない
- 一括生成は使用しない
- ComfyUI接続先がloopbackであることを確認する

## 低VRAM受入れ

| Profile | 最大辺 | ControlNet | LoRA | 排他制御 |
| --- | ---: | ---: | ---: | --- |
| 8GB | 1024px | 1 | 2 | Chatと画像生成を同時実行しない |
| 12GB | 1024px | 2 | 3 | Chatと画像生成を同時実行しない |
| 16GB | 1536px | 4 | 4 | 画像生成は1件ずつ |

各端末でText-to-Image、Image-to-Image、ControlNet、Inpaintingを1枚ずつ実行し、生成後に保存・Page配置・PDF書き出しまで確認する。

## Project privacy評価

現行ProjectはWindowsユーザー領域のローカルフォルダーへ保存されるが、Project単位の暗号化は未実装である。BitLocker、Windowsアカウント分離、画面ロック、暗号化バックアップを配布前の運用条件とする。アプリ内暗号化は鍵回復、検索・サムネイル、バックアップ互換性を含む別要件として設計する。

診断・クラッシュレポートは任意同意であり、Prompt、Negative Prompt、入力画像、マスク、画像bytes、生成input/outputを常時除外する。
