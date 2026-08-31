# Desktop Adult Pilot model候補監査

作成日: 2026-08-31

## 判定

`LICENSE_OWNER_CONFIRMED_FOR_INTERNAL_PILOT / USER_DOWNLOAD_SELECTED / RUNTIME_BLOCKED_ON_CURRENT_HOST`

初回12GB Pilotの技術候補をSDXL系へ限定した。責任者は2026-08-31に、Open RAIL++の利用制限をMANGAIの禁止入力へ継承すること、内部Pilotでのローカル利用、公式配布元からの取得を承認した。再配布・同梱は承認していない。実file検証と12GB実機Runtime検証が未完了のため、artifactのstatusは`pending`を維持する。

## 配布判断

- ComfyUI v0.34.0はGPL-3.0のため、初回PilotではMANGAI installerへ同梱しない。
- SDXL baseとControlNetはOpen RAIL++のAttachment Aを利用者条件へ継承する。
- VAEは公式model cardのMIT表示を根拠とし、取得元・revision・license表示を保持する。
- ComfyUIとmodelは固定した公式URLから利用者が取得し、MANGAI preflightがversion、容量、SHA-256を検証する。
- この判断は内部Pilot限定であり、一般配布、モデル再配布、Cloud利用、外部Provider利用を承認しない。

## 現在の実行端末

- OS: Windows 11 Home
- GPU: Intel Iris Xe Graphics（Windows表示上のAdapter RAM約2GB）
- NVIDIA Runtime: `nvidia-smi`未検出
- RAM: 約16GB
- Dドライブ空き: 約902GB
- 判定: 保存容量は確保可能だが、専用NVIDIA GPU／VRAM 12GB以上のPilot条件を満たさない。大型artifactの取得と実生成はこの端末では開始しない。

端末名、利用者名、絶対pathは証跡へ保存しない。

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

1. 12GB以上のNVIDIA GPUを搭載したWindows 11内部受入れ端末を用意する。
2. 固定URLから取得した3 model fileの容量とSHA-256を実fileで再計算する。
3. ControlNet fileがComfyUI標準`ControlNetLoader`で読み込めることを12GB実機で確認する。
4. ComfyUI `v0.34.0`を公式sourceから構築し、commit、展開後容量、Runtime構成を登録する。
5. custom nodeを使わない4方式workflowとmappingは`pilot-sdxl-v1`として作成・SHA-256登録済み。実ComfyUIでのnode入力互換と1枚生成は未確認。
6. Pilot利用条件へOpen RAIL++、GPL-3.0、MITの表示とAttachment A制限を反映する。

## 非実施

- モデル・ComfyUI artifactのdownload、install、起動、生成（現端末はRuntime条件外のため停止）
- 成人向けPrompt・画像の処理
- Cloud、外部Provider、Production、Project、Job、credit操作
