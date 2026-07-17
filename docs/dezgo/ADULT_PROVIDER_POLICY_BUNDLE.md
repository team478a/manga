# 成人向けProvider運用ポリシーbundle

## 1. 目的

Dezgoの成人向け商用API承認証跡と、確認済みモデルallowlistをMANGAI Desktopへ安全に配布します。一般的な商用利用可という案内だけでは承認済みデータを作成しません。

## 2. 信頼モデル

- 運用担当はアプリ外でEd25519秘密鍵を保管し、署名します。
- Desktopには公開鍵とkey IDだけを`build/adult-provider-policy-trust.json`から同梱します。
- 初期trust storeは公開鍵0件です。本番公開鍵を登録するまで取込UIは無効です。
- 秘密鍵、承認文書本文、成人向けPrompt・画像はアプリやbundleへ含めません。

## 3. bundle形式

```json
{
  "format": "mangai.adult-provider-policy",
  "version": 1,
  "keyId": "operations-key-2026-01",
  "payload": {
    "issuedAt": "2026-07-17T00:00:00.000Z",
    "expiresAt": "2026-10-15T00:00:00.000Z",
    "providerApproval": {
      "providerId": "dezgo",
      "status": "approved",
      "evidenceSha256": "64文字の小文字16進SHA-256",
      "confirmedAt": "2026-07-17T00:00:00.000Z",
      "expiresAt": "2026-10-15T00:00:00.000Z",
      "revokedAt": null
    },
    "models": []
  },
  "signature": "Ed25519署名のbase64"
}
```

署名対象は`payload`だけではなく、`format`、`version`、`keyId`、`payload`を含む署名対象objectです。object keyを辞書順に再帰整列し、配列順を保持した空白なしUTF-8 JSONへ正規化します。

## 4. 検証と更新

- bundleは1MB以下、有効期間は最大180日です。
- 発行日時が現在より5分を超えて未来の場合、または期限切れの場合は拒否します。
- Providerと各モデルの有効期限はbundleの有効期限を超えられません。
- 未知のkey ID、署名改変、重複モデルID、schema外fieldは拒否します。
- 検証成功後だけProvider承認・モデルallowlist・取込監査を同一transactionで更新します。
- importはallowlist全体を置き換えます。bundleから削除されたモデルは承認対象から外れます。
- 更新後に承認対象外となった成人向けDezgo待機・一時停止Jobは同じtransactionで停止し、未精算の費用予約を解放します。通常のsafe Jobとローカル生成Jobは変更しません。

## 5. 現在の状態

署名検証と取込経路は実装済みです。本番公開鍵と実承認データは未投入であり、`dezgoAdultGenerationEnabled`は`false`のままです。このbundleを取り込んだだけで成人向け外部送信が有効になることはありません。
