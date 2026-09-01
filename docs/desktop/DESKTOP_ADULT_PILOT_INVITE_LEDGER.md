# MANGAI Desktop Adult Pilot 招待台帳

作成日: 2026-09-01

## 目的

招待対象、配布日時、Desktop version、対応環境、同意日時、停止状態を、作品内容と個人情報を保持せず追跡する。実台帳はGitへcommitせず、アクセス制限された運用領域へ保存する。

## 作成と検査

`DESKTOP_ADULT_PILOT_INVITE_LEDGER.example.json`を運用領域へcopyし、環境変数で実台帳を指定して検査する。

```powershell
$env:MANGAI_ADULT_PILOT_INVITE_LEDGER_PATH = "<access-controlled-ledger.json>"
npm run desktop:adult:pilot-ledger:check
```

検査成功だけで招待や配布は行われない。招待開始、Stage追加、停止解除は責任者の明示承認が必要である。

## Entry契約

```json
{
  "monitorId": "monitor-012345abcdef",
  "stage": 1,
  "status": "INVITED",
  "desktopVersion": "0.1.0-beta.1",
  "environment": {
    "windows": "windows_11",
    "vramBand": "12gb"
  },
  "distributedAt": "2026-09-01T00:00:00.000Z",
  "consentedAt": null,
  "stoppedAt": null
}
```

- `monitorId`: 氏名、メール、既存account IDから導出しないrandom ID。
- `stage`: 1、2、3のみ。
- `status`: `INVITED`、`ACTIVE`、`STOPPED`、`COMPLETED`、`WITHDRAWN`。
- `environment`: Windows 11と`12gb`／`16gb_or_more`だけ。端末名やlocal pathは保存しない。
- `ACTIVE`／`COMPLETED`: ISO 8601の`consentedAt`が必須。
- `STOPPED`: ISO 8601の`stoppedAt`が必須。

## 保存禁止

氏名、メール、住所、電話、端末名、Project名、Prompt、Negative Prompt、参照画像、mask、生成画像、完成Page、作品説明、自由記述、秘密値、絶対pathを保存しない。問い合わせ内容は停止・復旧ランブックの内容非保持項目だけを別管理する。
