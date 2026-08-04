# MANGAI Cloud 本番公開ルート smoke 検査

## 目的

`https://app.mang-ai.com`の主要ページが500系エラーになっていないことと、未ログイン利用者が認証必須ページから安全にログイン画面へ誘導されることを、読み取り専用HTTP GETだけで確認します。

## 検査対象

- 公開: `/`、`/login`、`/signup`、`/forgot-password`、`/works`
- 認証必須: `/dashboard`、`/creator`、`/dashboard/monitor/welcome`、`/admin`

公開ページは2xxを合格とします。認証必須ページは、Cookieを送らない状態で同一originの`/login`へ3xx遷移することを合格とします。外部originへの遷移、5xx、通信失敗は不合格です。

## 実行

事前検査と実検査の両方で明示確認値が必要です。値や利用者情報は出力しません。

```powershell
$env:MANGAI_ROUTE_SMOKE_CONFIRM = "READ_ONLY_PRODUCTION_HTTP"
npm run cloud:production:routes:preflight
npm run cloud:production:routes
Remove-Item Env:MANGAI_ROUTE_SMOKE_CONFIRM
```

この検査はログイン、フォーム送信、DB更新、外部AI Provider実行を行いません。認証済み画面の内容、レスポンシブ表示、実作品操作は別のブラウザ受入れで確認します。
