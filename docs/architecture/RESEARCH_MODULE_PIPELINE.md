# 市場分析モジュール構成

## 目的

市場分析の既存挙動を保ったまま、責務を `domain`、`application`、`infrastructure`、`presentation`、`contracts` に分離する。旧 `src/lib/cloud-research*.ts` は既存importを壊さない互換アダプターとして残す。

## 処理パイプライン

1. `application/discover-sources.ts`: 利用制限後に検索Providerへ委譲
2. `application/verify-source.ts`: Server側の安全な出典取得へ委譲
3. `application/extract-claims.ts`: 検証済み本文から事実候補を抽出
4. `application/compare-claims.ts`: 独立出典の候補を照合
5. `application/generate-report.ts`: Feature Flag、一般向け境界、利用枠、AI分析、消費、保存を順序制御
6. `application/evaluate-report.ts`: 根拠と分析結果を評価
7. `application/list-reports.ts`: 所有者限定の保存・一覧・詳細取得

## レイヤー

- `contracts`: 入出力、検索契約
- `domain`: Report、Evidence、出典ポリシー、domain error
- `application`: ユースケースと依存ポート
- `infrastructure`: Brave、OpenAI、Supabase、Server fetchのadapter
- `presentation`: Server Action用の安全なエラー変換とview model

## 互換性

- 既存URL、Form、API契約、DB schema、Feature Flag名、環境変数名は変更しない。
- 既存の `src/lib/cloud-research*.ts` exportはモジュールへの再exportで維持する。
- 成人向け入力はProvider呼び出し前に従来どおり拒否する。
- ProviderまたはDBの内部詳細は利用者へ表示しない。

## ロールバック

このPRをrevertすると旧 `src/lib` 実装とAction内のオーケストレーションへ一括で戻る。migration、DB、環境変数の巻き戻しは不要。
