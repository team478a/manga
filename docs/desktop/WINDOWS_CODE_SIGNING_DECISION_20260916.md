# MANGAI Desktop Windowsコード署名方式の判断

作成日: 2026-09-16

## 結論

Adult技術モニターStage 0では、日本法人向けの公開信頼されたOVコードサイニング証明書を第一候補とし、Windows証明書ストア／ハードウェアトークンからローカル署名する。既存のPFX／GitHub Actions経路は後方互換として維持する。証明書購入、秘密情報登録、artifact配布は責任者の別判断とする。

Azure Artifact Signingは将来候補として維持するが、MicrosoftのWindows署名ガイドは現在、組織の申込地域を米国、カナダ、EU、英国に限定している。日本法人のPublic Trust受付を確実な前提にできないため、Stage 0の確定経路にはしない。

## 根拠

- Microsoftは一般公開向けに公開信頼された署名方式を要求し、自己署名証明書は限定テストで端末側の明示的な信頼登録が必要としている。MANGAIのStage 0 gateは「信頼された証明書」を要求するため、自己署名へ要件を下げない。
- electron-builder 26はPFXに加え、Windows証明書ストア内の証明書をSHA-1 thumbprintで選択できる。EV／hardware tokenもWindows端末上の`certificateSubjectName`または`certificateSha1`経路を利用できる。
- GMOグローバルサインの日本向け公式ページでは、法人向け通常コードサイニング証明書が年額69,000円（税抜）、最短3営業日、ハードウェアトークン提供と案内されている。MANGAIはdriver署名を行わないため、Stage 0ではEVを必須としない。
- OV署名は発行元と改変有無を検証できるが、新しいpublisherのSmartScreen評価が直ちに確立するとは限らない。Stage 0では署名の`Valid`、表示publisher、checksumを合否対象とし、SmartScreen表示は別の観察項目として記録する。

## 実装境界

- `WIN_CSC_LINK`／`WIN_CSC_KEY_PASSWORD`: 既存PFX方式。GitHub Actionsの正式Releaseに使用可能。
- `MANGAI_WIN_CERTIFICATE_SHA1`: Windows証明書ストア／hardware token方式。Stage 0受入れ専用artifactのローカル署名に使用する。
- 2方式の同時指定、不完全なPFX、40桁以外のthumbprint、非Windowsでの証明書ストア方式は生成前に拒否する。
- preflightとログは方式名とREADY／BLOCKEDだけを表示し、PFX path、password、thumbprintを表示しない。
- 署名後も`Get-AuthenticodeSignature`と`verify:win:artifacts -- signed`で`Valid`を必須とする。署名があるだけでStage 0またはStage 1の配布許可にはしない。

## 外部手続き（未実施）

1. 法人名義、申請担当者、必要書類、請求先を責任者が確定する。
2. OV証明書を申請し、トークン到着後に専用Windows署名端末へdriverを導入する。
3. 証明書subject、有効期限、thumbprintを画面で確認する。thumbprintは運用設定として扱い、秘密鍵とPINは記録しない。
4. Stage 0専用versionをローカル署名し、installer、製品EXE、blockmap、SBOM、checksumを固定する。
5. 署名検証と既存Stage 0 readiness strictの両方が成功してから、対象者・日時・送付物を別承認する。

## 参照

- Microsoft Learn: `https://learn.microsoft.com/en-us/windows/msix/package/sign-msix-package-guide`
- electron-builder 26: `https://www.electron.build/v26/docs/features/code-signing/code-signing-win/`
- GMOグローバルサイン: `https://jp.globalsign.com/codesigning/`
- Azure Artifact Signing quickstart: `https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart`
