# Desktop Adult Pilot model候補監査

作成日: 2026-08-31

## 判定

`CANDIDATES_PINNED / LICENSE_OWNER_CONFIRMATION_REQUIRED / DOWNLOAD_NOT_RUN`

初回12GB Pilotの技術候補をSDXL系へ限定した。これは配布・利用承認ではない。Open RAIL++の利用制限継承、成人向け制作への適用、モデル同梱・利用者download方式を責任者が確認するまで、manifestのstatusは`pending`を維持する。

## 固定候補

|役割|候補|revision|配布file|公称license|容量|
|---|---|---|---|---|---:|
|Runtime|ComfyUI|`v0.34.0`|Pilot artifact未作成|GPL-3.0|未確定|
|Checkpoint|`stabilityai/stable-diffusion-xl-base-1.0`|`462165984030d82259a11f4367a4eed129e94a7b`|`sd_xl_base_1.0.safetensors`|CreativeML Open RAIL++-M|6,938,078,334 bytes|
|VAE|`madebyollin/sdxl-vae-fp16-fix`|`207b116dae70ace3637169f1ddd2434b91b3a8cd`|`sdxl.vae.safetensors`|MIT（model card表示）|334,641,162 bytes|
|ControlNet|`diffusers/controlnet-canny-sdxl-1.0`|`eb115a19a10d14909256db740ed109532ab1483c`|`diffusion_pytorch_model.safetensors`|Open RAIL++|5,004,167,864 bytes|

SHA-256はHugging Face公式model APIのLFS metadataから取得し、`DESKTOP_ADULT_PILOT_BUNDLE.json`へ保存した。実fileをdownloadしての再計算はまだ行っていない。

## 技術選定理由

- SDXL baseはText-to-ImageとImage-to-Imageを同じ基盤で扱える。
- ComfyUIはlocal API、offline実行、SDXL、ControlNet、Inpainting、maskを標準機能として扱える。
- FP16 VAEは12GB帯でのVAE負荷を抑える候補だが、実機で画質と安定性を確認する。
- Canny ControlNetは最初の構図制御を再現可能にしやすい。Pose等の追加ControlNetは初回Pilotへ含めない。
- InpaintingはSDXL base、VAE、mask workflowで構成し、別checkpointを初回候補へ追加しない。

## 未完了gate

1. Open RAIL++のAttachment Aを含む利用制限とMANGAIの禁止入力が一致することを責任者が確認する。
2. VAEのmodel card上MIT表示について、同梱・再配布時のNOTICE方法を確認する。
3. ControlNet fileがComfyUI標準`ControlNetLoader`で読み込めることを12GB実機で確認する。
4. ComfyUI `v0.34.0`のPilot artifactを作成し、SHA-256と展開後容量を登録する。
5. custom nodeを使わない4方式workflowを作成し、SHA-256を登録する。
6. モデル取得方法を「MANGAI同梱」または「利用者が公式配布元から取得」から決定する。

## 非実施

- モデル・ComfyUI artifactのdownload、install、起動、生成
- 成人向けPrompt・画像の処理
- Cloud、外部Provider、Production、Project、Job、credit操作
