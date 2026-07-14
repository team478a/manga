# MANGAI販売パッケージ仕様 v1

最終更新: 2026-07-14

## 目的

MANGAI Desktopで完成した作品を、秘密鍵をDesktopへ保存せずMANGAI Hubへ受け渡すための交換形式です。ファイル拡張子は`.zip`、形式名は`mangai.sales-package`、バージョンは`1`です。

Desktopの「書き出し」は`MANGAI販売パッケージ.zip`を生成します。HubはZIPを受け取り、内容確認後に下書き作品・商品へ変換します。v1はアップロード処理を含まず、ローカルファイル生成までを責務とします。

## ZIP構成

```text
manifest.json
products/main.pdf
products/pages.zip
cover/cover.png | cover.jpg | cover.webp
samples/001.png ... 003.png
metadata/project.json
metadata/description.txt
metadata/social-post.txt
```

表紙が未設定の場合は`cover/`を省略し、Desktopの書き出し警告へ記録します。サンプルは正式なEpisode・Page順の先頭3ページまでです。

## manifest.json

```json
{
  "format": "mangai.sales-package",
  "version": 1,
  "createdAt": "2026-07-14T00:00:00.000Z",
  "work": {
    "sourceProjectId": "UUID",
    "title": "作品名",
    "subtitle": "",
    "description": "",
    "genre": "漫画",
    "ageRating": "全年齢",
    "readingDirection": "rtl",
    "width": 1600,
    "height": 2400,
    "dpi": 300,
    "episodeCount": 1,
    "pageCount": 16
  },
  "files": [
    {
      "role": "product_pdf",
      "path": "products/main.pdf",
      "mimeType": "application/pdf",
      "byteSize": 12345,
      "sha256": "64文字の小文字16進SHA-256"
    }
  ]
}
```

### file role

| role              | 用途                       | 件数     |
| ----------------- | -------------------------- | -------- |
| `product_pdf`     | 購入者へ配布する本編PDF    | 1        |
| `page_images_zip` | 購入者へ配布できる連番画像 | 1        |
| `cover`           | 作品表紙                   | 0または1 |
| `sample`          | 公開サンプルPNG            | 0〜3     |
| `project_info`    | 作品メタデータJSON         | 1        |
| `description`     | 販売説明文                 | 1        |
| `social_post`     | SNS告知文                  | 1        |

## 検証規則

- ZIP展開前に総容量、エントリ数、各エントリ容量へHub側上限を適用する
- 絶対パス、ドライブ文字、`..`、制御文字を含むパスを拒否する
- `manifest.json`に未記載のファイルと、ZIP内に存在しない記載ファイルを拒否する
- 展開した各ファイルのバイト数とSHA-256をmanifestと照合する
- 同じパスの重複、未対応`format`・`version`・`role`を拒否する
- MIME typeは宣言だけを信用せず、Hub側でもファイル内容を検査する
- `sourceProjectId`は同期IDではなく出所確認用とし、Hubの所有者・作品IDは認証済みユーザーに対して新規採番する

## 互換性

v1へ任意項目を追加する場合、既存読込側が無視できる項目に限定します。必須項目、ファイル役割、意味を変更する場合は`version`を上げます。共通実装は`@mangai/export-core`の`parseSalesPackageManifest`と`createSalesPackageZip`を使用します。

Hubの`/dashboard/import-package`は、ZIPをサーバーへ送信する前にブラウザ内で本仕様を検証し、作品情報・表紙・サンプル・収録ファイルをプレビューします。Supabaseへ非公開下書きを作成する確定処理は次の実装段階です。
