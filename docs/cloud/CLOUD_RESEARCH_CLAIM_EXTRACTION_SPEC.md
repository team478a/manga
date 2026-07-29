# Cloud Research Claim Extraction Specification

## 操作フロー

1. 出典検索結果から候補を採用する
2. 新規市場分析画面で「事実候補を抽出」を実行する
3. Serverが同じURLを改めて取得・検証する
4. 選択分野に一致する原文候補を表示する
5. 利用者が原文を別タブで確認する
6. 「事実メモへ採用」で出典1へ転記する
7. 利用者が市場分析の保存を実行する

抽出、転記、市場分析保存はそれぞれ別操作である。抽出結果だけでは事実として確定・保存されない。

## Server取得境界

- HTTPSのみ
- 許可host allowlist必須
- DNS解決後のprivate、loopback、link-local、予約addressを拒否
- redirectごとにURLとDNSを再検証
- 対応MIME: `text/html`、`text/plain`、`application/json`
- raw response上限: 1,000,000 bytes
- timeout: 7秒
- 正規化本文上限: 200,000文字

HTMLではscript、style、noscript、SVG、template、navigation、header、footer、aside、form、commentを除外する。同一行は重複除去する。

## 候補契約

各候補は次を持つ。

- 安定ID
- 原文そのままの候補文
- 根拠分野
- 決定的score
- 一致したkeyword
- 正規化本文内の開始・終了位置
- raw source SHA-256
- normalized text SHA-256

候補長は20〜500文字、最大8件とする。Cookie、privacy、利用規約、login等の定型文は除外する。数値、割合、通貨、年を含む文には順位付け加点を行うが、数値自体は生成しない。

## 分野

- 市場需要
- 競合
- 読者
- 人気テーマ
- 価格
- 販売チャネル
- リスク

各分野は日本語・英語の固定keyword辞書を使う。外部AI APIやLLMは使用しない。

## 保存とprivacy

一時本文は1回のServer Action内だけで使用する。次は保存・出力しない。

- DB
- application log
- analytics
- Server Action responseの全文
- HTML hidden field

ブラウザへ返すのは最大8件、各500文字までの候補と検証metadataだけである。候補の採用後、既存の市場分析保存処理が利用者の事実メモとして保存する。

## 認可と利用制限

- `CLOUD_RESEARCH_MVP_ENABLED=true`
- `CLOUD_RESEARCH_SOURCE_VERIFICATION_ENABLED=true`
- login済みprofile必須
- 全体300回/分
- 利用者20回/分
- 利用制限keyはHMAC化し、生のprofile IDを保存しない

## 制約

候補抽出は関連文の発見を補助するものであり、事実性、最新性、代表性を保証しない。原文、公開日時、調査方法、母集団を利用者が確認する必要がある。
