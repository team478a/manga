# MANGAI 漫画品質エンジン・ベンチマーク設計

作成日: 2026-08-16

対象: PR-R4-3A

状態: `IMPLEMENTED_LOCAL / BLOCKED_FIXTURE_SHORTAGE`

## 1. 結論

現行の品質判定は、画像内容を直接認識するVisual Judgeではない。生成Assetの有無、寸法と、呼出元が任意で渡した観測値をルールで集計する。未観測値を75点、失敗判定時は100点相当として扱うため、「評価できていない」と「品質が良い」を区別できない。

PR-R4-3Aでは外部挙動を変えず、次の評価基盤だけを追加した。

- `ok / unknown / not_evaluated`を区別し、未評価を点数へ変換しないEvidence契約
- VLM、embedding、detector、hybridを同じ方法で比較するprovider-neutral Judge境界
- 非公開・ローカルfixtureのmanifestと、実ファイル・hash・寸法を検証するpreflight
- 検出率、誤検出率、failure一致、Evidence coverage、Judge費用、遅延を分離する集計

リポジトリ内に再利用可能な正解付き漫画画像が30件なく、Production作品の転用も禁止されているため、実測ベンチマークは`BLOCKED_FIXTURE_SHORTAGE`である。推測値や架空画像で精度を報告しない。

## 2. 現行実装の監査

| 責務 | 現在のファイル | 判明した契約／課題 |
| --- | --- | --- |
| Panel Specification | `src/modules/manga-quality/domain/panel-specification.ts` | 人物名・Identity、人数、表情、構図、背景、小物、動作、shot、camera angle、generation targetを保持するversion 1。Visual Judgeの期待値として再利用可能。 |
| 既存Failure分類 | `src/modules/manga-quality/domain/failure-category.ts` | runtimeとDBに保存する既存語彙。R4-3Aでは変更しない。 |
| 現行Judge | `src/modules/manga-quality/application/rule-based-panel-judge.ts` | 画像を解析せず、欠損scoreを75で補完する。failure判定の欠損は`?? 100`で合格側へ倒れる。 |
| 完了Job評価 | `src/modules/manga-quality/application/evaluate-completed-panel.ts` | 現在渡す実観測はAsset有無と縦横寸法だけ。人物、表情、背景、人体等は観測していない。 |
| Candidate順位 | `rule-based-panel-judge.ts`の`rankPanelCandidates` | 保存済みoverall score、作成日時、IDで決定。Evidence coverageを順位条件にしていない。 |
| Score保存 | `src/modules/manga-quality/infrastructure/panel-quality-repository.ts` | 既存RPCを通じてversion 1評価を保存する。 |
| DB/RPC/RLS | `supabase/migrations/202608080002_cloud_manga_quality_judge.sql` | Panel Specificationと0〜100 score、failure、`evaluation_details`、latencyを保存。service roleのみ書込、所有者のみ参照。R4-3Aで変更なし。 |
| 操作ログ | `supabase/migrations/202608080001_cloud_manga_quality_logs.sql`、`src/modules/manga-quality/domain/quality-evaluation-log.ts` | 表示・採用・不採用、repair、retry、credit、実費、generation latencyを記録。Judge費用専用列ではない。 |
| Inpainting / Outpainting | `src/modules/cloud-ai/infrastructure/provider-registry.ts`、`bfl-provider.ts` | BFL `flux-pro-1.0-fill`を既存Providerとして登録。mask付きinpaintingと方向付きoutpaintingを実装済み。 |
| 生成・修正入口 | `src/modules/manga/application/build-panel-revision.ts`、`enqueue-panel-candidates.ts` | source Asset、mask、outpainting directionをrevisionからJobへ渡す。 |

### 2.1 現行値をそのまま精度と呼べない理由

- `characterMatch`等が未指定でも各75点になる。
- failure判定は未指定を100として扱うため、未検査の人体、背景、小物等を不良と判定しない。
- `semanticEvidenceAvailable`は人物数またはIdentity観測の有無であり、すべての品質項目を見た意味ではない。
- `evaluationLatencyMs`は現行ルール処理の時間で、VLM、OCR、embeddingの実遅延ではない。
- 保存済みgeneration costとJudge costは別物だが、現行ログにはJudge costの独立した実測契約がない。

これらは既存ユーザー向け挙動なのでR4-3Aでは変更せず、R4-3B以降の置換判断材料として明示する。

## 3. Evidence契約

すべてのscoreは内部で0〜1を使い、表示・既存保存境界でのみ0〜100へ変換する。

```text
EvidenceValue = {
  status: "ok" | "unknown" | "not_evaluated",
  score: number(0..1) | null,
  confidence: number(0..1),
  source: "vlm" | "embedding" | "detector" | "rule",
  reason?: string
}
```

- `ok`: scoreが必須。
- `unknown`: Judgeは評価を試みたが根拠不足。scoreは必ず`null`。
- `not_evaluated`: そのJudgeの能力・設定・入力不足により評価していない。scoreは必ず`null`。
- 未評価を0、75、100へ補完しない。
- `detectedCharacterCount`はscoreとは別に観測人数をnullableで保持する。
- 基本必須Evidenceはcharacter、composition、anatomy、orientation、text artifact、detected character count。
- 前後コマがある場合だけcontinuityも必須にする。

Evidence coverageは、対象Evidenceのうち`ok`になった件数の割合である。総合点とcoverageを別に表示・判定し、coverage不足を高得点で隠さない。

## 4. Failure分類

Visual Judge用語彙は、現行runtime語彙を壊さず、より直接的な検査対象を表す。

- 人物: `character_mismatch`、`face_mismatch`、`wrong_character_count`、`wrong_expression`
- 人体: `body_distortion`、`hand_error`、`body_prop_fusion`
- 構図: `wrong_camera`、`crop_mismatch`
- 背景・小物: `wrong_background`、`missing_prop`、`prop_fusion`
- 継続性: `continuity_break`
- artifact: `text_artifact`、`ui_artifact`
- 物理: `orientation_error`、`gravity_error`
- その他: `low_readability`、`other`

R4-3Aは互換mapだけを定義し、DB enum、既存failure配列、UI表示帯は変更しない。

## 5. Fixture契約と現在の不足

保存場所は`tests/fixtures/manga-quality/`、画像本体はGit対象外の`assets/`とする。manifestは各画像について次を要求する。

- opaqueなfixture ID
- `assets/`配下の相対パス
- SHA-256、MIME type、width、height
- 完全なPanel Specification
- 採用可否、failure分類、severity
- 任意の責任者レビュー注記

画像はProduction DB／Storage／既存32ページ作品から取得しない。署名付きURL、利用者名、Prompt、個人情報、秘密情報も保存しない。

現在のreadinessは次の通り。

| 条件 | 必要 | 現在 | 不足 |
| --- | ---: | ---: | ---: |
| 総fixture | 30〜50 | 0 | 30 |
| 採用可能 | 15以上 | 0 | 15 |
| 人物／顔 | 5以上 | 0 | 5 |
| 人体／融合 | 5以上 | 0 | 5 |
| 文字／UI | 5以上 | 0 | 5 |
| 構図／crop | 5以上 | 0 | 5 |
| 向き／重力 | 5以上 | 0 | 5 |
| 背景／小物 | 5以上 | 0 | 5 |

`npm run manga:quality:benchmark:preflight`は不足数を報告するが、基盤検証を継続できるよう終了コード0とする。fixtureが揃った後のCI受入れは`npm run manga:quality:benchmark:strict`を使い、不足を終了コード1にする。

## 6. 比較対象

下表は2026-08-16時点の公式仕様に基づく調査であり、MANGAI fixture上の精度・実費・遅延は未測定である。モデル採用の決定ではない。

| 候補 | 期待する役割 | 構造化出力 | データ取扱い上の確認 | 現在の判定 |
| --- | --- | --- | --- | --- |
| OpenAI vision | Panel Specificationと画像を一括比較し、多項目Evidenceを返す | [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)あり | APIは既定で学習不使用。標準のabuse monitoring、Responses保存、ZDR/MAM条件は[公式データ制御](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint)を個別確認する | benchmark待ち |
| Google Gemini vision | 画像理解とJSON Schema評価 | [Structured output](https://ai.google.dev/gemini-api/docs/structured-output)あり | 無償／有償でデータ利用条件が異なるため[利用規約](https://ai.google.dev/gemini-api/terms)と契約tierを確認する | benchmark待ち |
| Anthropic Claude vision | 画像とPanel Specificationの比較 | Adapter側でschema validationが必要 | 商用APIは既定で学習不使用。標準保持とZDR条件は[公式privacy](https://privacy.anthropic.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data)を確認する | benchmark待ち |
| DINOv2 / OpenCLIP | 顔・衣装・styleの参照画像との近さをローカルで補助判定 | 独自の数値schema | ローカル処理可能。漫画絵での閾値校正が必須 | 単独採用しない |
| PaddleOCR | 文字／UI artifactの位置・confidence検出 | box、text、confidenceを正規化可能 | ローカル処理可能。正規セリフと画像内artifactの区別が必要 | VLM補助候補 |

公式機能・価格の参照先:

- OpenAI: [Vision](https://developers.openai.com/api/docs/guides/images-vision)、[Pricing](https://developers.openai.com/api/docs/pricing)
- Google: [Image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)、[Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Anthropic: [Vision](https://platform.claude.com/docs/en/build-with-claude/vision)、[Pricing](https://docs.anthropic.com/en/docs/about-claude/pricing)
- Local: [OpenCLIP](https://github.com/mlfoundations/open_clip)、[DINOv2 model card](https://github.com/facebookresearch/dinov2/blob/main/MODEL_CARD.md)、[PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version2.x/ppocr/quick_start.en.md)

## 7. ベンチマーク指標

| 指標 | 定義 | 採用判断での意味 |
| --- | --- | --- |
| Critical failure recall | critical正解fixtureのうちcritical判定できた割合 | 見逃し耐性。最優先。 |
| False positive rate | 採用可能fixtureのうちcriticalと誤判定した割合 | 無駄な再生成・費用の抑制。 |
| Failure category agreement | 正解分類と提案分類のJaccard一致度 | repair routingの妥当性。 |
| Required Evidence unknown rate | 必須Evidenceの`unknown / not_evaluated`割合 | 高得点でも評価不足を検出する。 |
| Evidence coverage | 対象Evidenceの`ok`割合 | Judge能力と入力不足を分離する。 |
| Judge cost | 1候補の評価費用micros | 生成費用と混ぜない。 |
| Latency | 1候補のJudge所要ms | UI同期処理へ置くか非同期にするか判断する。 |

R4-3B開始前に、fixture全件を同一条件で各候補へ渡し、少なくとも3回の遅延分布と実請求に対応するcostを記録する。価格表からの推定だけで実費欄を埋めない。

## 8. Judge費用と生成費用の分離

費用は次の3項目を別々に集計する。

```text
generation_cost = 画像生成Providerの確定費用
judge_cost = VLM / detector / embeddingによる評価費用
repair_cost = 不採用後の再生成・inpainting・outpainting費用
total_quality_cost = judge_cost + repair_cost
```

利用者credit、既存pricing、予約・確定・返却ロジックはR4-3Aで変更しない。Judge費用を利用者へ転嫁するかは、実測後の責任者判断とする。

## 9. Inpainting / repair能力

既存BFL Fillはinpaintingとoutpaintingに対応し、source Assetとmask／方向を受け取れる。ただしVisual Judgeのfailureからrepair operationへ自動接続する契約はまだない。

推奨routing候補は次の通りだが、R4-3Aでは実装しない。

- 顔、手、局所artifact、小物不足: maskが信頼できる場合だけinpainting候補
- crop、余白不足: outpainting候補
- orientation、gravity、人物数、全体構図、広範囲融合: 原則として再生成候補
- identity／continuity: referenceを維持した再生成または限定repair候補

mask精度、修正成功率、費用はfixture不足のため未測定である。

## 10. 推奨構成とR4-3Bへの停止条件

現時点の推奨は「provider-neutral VLM + ローカルOCR」の段階導入である。embeddingは人物・style一致の補助としてのみ比較し、漫画fixtureで閾値を校正するまでcritical判定へ使わない。

R4-3Bへ進むには、次をすべて満たす必要がある。

1. 権利確認済みの30〜50画像、採用可能15画像、主要6群各5画像が揃う。
2. `manga:quality:benchmark:strict`が成功する。
3. 同じfixtureでVLM候補、OCR、embeddingの精度・費用・遅延が実測される。
4. 外部送信するfixtureとProviderのデータ保持条件を責任者が承認する。
5. 採用Judge、閾値、unknown時のfail-closed挙動、Judge費用負担を責任者が決定する。
6. Production DB／Storage／既存作品を使わないPreviewまたは専用検証環境を用意する。

現在は1〜5が未完了のため、PR-R4-3AのDraft PRとCI確認後に停止する。
