# Marketplace UI Acceptance Report

## 1. 判定

- 総合判定: `CONDITIONAL / BLOCKED_EXTERNAL_ENVIRONMENT`
- 実装状態: Marketplace UI-1〜5の静的構造と回帰テストは成立している。
- 読者体験の受入れ状態: 未完了。実作品・認証済み本棚を表示できる環境へ到達できず、表紙トリミング、実データ密度、responsive崩れ、keyboard操作、contrastを実画面で最終確認できていない。
- Phase 2移行判定: `NO-GO`。P1のUI調整方針を確定し、実データread-only受入れを完了してから判断する。
- Production、DB、作品、商品、publication、Checkout、Stripe、注文、決済、環境変数、UIコードは変更していない。

## 2. 監査基準

| 項目 | 記録 |
| --- | --- |
| Repository | `team478a/manga` |
| 対象ブランチ | `feature/manga-canvas-mvp` |
| 基準HEAD | `ee7018fec559c5bf210e8615ea84d507554da70c` |
| 監査開始時HEAD | `43aa42da85e4b75ebe3eaf7ea77d9d68d759ef87` |
| worktree | `codex/marketplace-acceptance-blocker-20261002`。開始時の製品コード差分なし。既存の監査ブロッカー文書4件に各1行の差分のみ |
| Marketplace UI実装 | PR #602 `feat: Marketplaceを漫画書店型UIへ刷新`、merge `8882c15be1f57833fb800c07d3750f3bd193c66f` |
| 次工程定義 | PR #608 `docs: Marketplace次工程とPhase 2境界を定義`、merge `ee7018fec559c5bf210e8615ea84d507554da70c` |
| 今回の監査PR | Draft PR #609 |
| 対象環境 | Source、集中テスト、GitHub CI、Vercel deploymentへの匿名HTTP |
| 実画面環境 | Vercel SSO保護下。認証済みbrowser接続はrequest-header policy読込失敗 |

## 3. 確認範囲と証跡

### 実施済み

- `/`、`/works`、`/works/[id]`、`/works/[id]/read`、`/dashboard/purchases`の表示構造、データ分岐、CTA、empty/error/loading stateをコード監査した。
- Header、mobile bottom navigation、cover表示、検索・filter、responsive breakpoint、skip link、focus-visible、alt、ARIA、safe area、reduced motionをコード監査した。
- Marketplace集中テスト22件を実行し、22/22成功した。
- `git diff --check`に成功した。
- PR #609のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsは全て成功している。
- Vercel対象URLへの匿名HEADはVercel SSOへ`302`となることを再確認した。

### BLOCKED_EXTERNAL_ENVIRONMENT

- 確認できなかったこと:
  - 実作品の表紙がHome、一覧、詳細、本棚で切れないこと。
  - 390 × 844、768px、1280px、1440pxの実画面でoverflow、文字崩れ、CTA崩れ、Header崩れ、Bottom Navigation重なりがないこと。
  - 認証済み本棚で複数冊、paid、test、refundedが自然に見えること。
  - 未購入sampleと購入済みfull accessのReader遷移。
  - 実画面のkeyboard順序、focus表示、contrast、touch操作。
- 理由:
  - LocalにはSupabase資格情報と実作品・購入データがない。
  - Vercel deploymentはSSO保護され、匿名HTTPは`302`でVercel SSOへ転送される。
  - 認証済みbrowser接続は再試行とsession reset後もrequest-header policy読込に失敗した。
- 必要条件:
  - Vercel SSOへ正規にログイン済みで操作可能なbrowser接続、またはProductionと分離された実データ相当の隔離Staging。
  - 縦横比が異なる実表紙を含む公開一般作品、固定publication/sample、active商品。
  - paid、test、refundedを含む既存の認証済み購入者アカウント。新規購入や実決済は不要。
- コード上で確認できた範囲:
  - route、表示順、breakpoint、object-fit、状態分岐、権限サービス、ARIA、empty/error/loading契約。
- 安全対応:
  - 認証迂回、Productionデータ変更、購入、Download実行、Checkout、DB変更は行っていない。

## 4. 読者体験評価

### Home

- Heroは「次に夢中になる漫画を、ここで。」、`漫画を探す`、`本棚を開く`を先頭に置き、AI SaaSではなく漫画書店として認識しやすい。
- Featured、注目、新着、ジャンル、試し読み、最下部Creator CTAの順で、作品発見がCreator導線より優先されている。
- HeroはDesktopで作品カードと2カラム、Mobileで縦積みとなる。コード上は過大ではないが、実作品を入れた視覚比率は未確認。
- Featuredの表紙が`object-cover`であり、作品名・作者名・人物頭部を切る可能性がある。
- 「注目作品」はランキングではなく、active商品を持つ作品を`created_at`降順で最大5件選ぶ。説明文は根拠を示すが、見出しだけでは人気・編集選定と誤認され得る。

### Works

- Gridは390px相当で2列、768pxで3列、1024〜1279pxで4列、1280px以上で5列となる。
- タイトル2行、作者1行、価格、先頭タグに情報を限定し、長い説明文は表示しない。
- 検索、タグ、販売中filter、条件クリアは揃っている。検索入力とbuttonは48px高。
- 表紙は`aspect-[2/3]`かつ`object-cover`、hover時に1.02倍へ拡大するため、表紙端の文字がさらに切れる可能性がある。
- filter chipは`min-h-9`（36px）で、今回の44px touch target基準を満たさない。

### Detail

- 表紙、タイトル、作者、タグ、価格、試し読みCTA、購入案内、あらすじ、sample、購入商品、Creator情報を表示する。
- タイトル、作者、試し読み可否、価格、購入導線はファーストセクションで判別できる構造である。
- ただし価格が試し読みCTAより先に表示され、確定優先順位「試し読み → 価格 → 購入」と一致しない。
- 固定publicationでは上部に「漫画を読む・試し読み」、直後の強調sectionに「無料で試し読み」があり、状態と文言が重複・曖昧である。
- Detail page自身は購入権限を取得していない。Reader serviceはowner/purchasedを判定できるため、未購入「無料で試し読み」／購入済み「漫画を読む」へ分けるには、そのentitlement判定を安全に再利用するread-only契約が必要である。
- 購入CTAは試し読みより視覚的に弱い上部outline導線から商品sectionへ移動する。test時は実請求なしを明示し、Checkout無効時は「購入準備中」、live listing非対象は「限定販売中」として購入可能に偽装しない。
- 「限定販売中」はcanary対象外理由を十分には説明しないため、実画面では利用者が購入不可理由を理解できるか再確認が必要。
- 主表紙は`object-cover`。作品詳細の大きな表紙で全体構図が欠けるリスクが最も高い。

### Reader

- 本文画像は`object-contain`、`max-h-[85vh]`で、ページ全体を保つ方針になっている。
- 未購入ではsampleだけ、ownerまたはpaid購入者は全ページという既存権限を維持する。
- Mobile Bottom NavigationはReader routeで表示されず、本文を覆わない。
- 実sample/full access、ページ移動、縦横比別の表示は実データ環境で未確認。

### Bookshelf

- 見出しは「本棚」、カードは表紙・タイトル・作者・`漫画を読む`を中心にする。
- Downloadはoutlineのsecondary CTAで、Reader CTAが視覚的主役である。
- test購入、refunded、購入日、商品、価格を区別し、refundedでは利用不可理由を表示する。
- 複数冊はMobile 1列、768px以上で2列。実データ密度は未確認。
- 表紙は`object-cover`で、一覧より小さい表示でもタイトル等を切る可能性がある。
- 見出し脇の「N冊の購入履歴」と空状態「購入履歴はありません。」は、書店の本棚より取引履歴の語感が残る。補助情報としては許容できるが、モック思想との差分である。

### Header / Mobile Navigation

- HeaderはMANGAIを「インディーズ漫画のデジタル書店」と明示し、検索、漫画を探す、本棚を優先する。
- 「販売パッケージ」「クラウド制作」は表示しない。Creator/Adminにだけ「漫画を作る」を表示し、HomeのCreator CTAは最下部にある。
- Mobile Bottom Navigationはホーム／探す／本棚／マイページの4項目、64px高、active violet、`aria-current`、safe-area paddingを持つ。
- `body:has(.marketplace-mobile-nav)`が64px + safe areaの下余白を確保し、1024px以上で解除する。静的には本文との重なりを避ける。
- mobile header iconは44 × 44px。Bottom Navigationの各cellは64px高。

## 5. 表紙object-fit監査

| 画面 | Component | 現在設定 | 切れる可能性 | 推奨 |
| --- | --- | --- | --- | --- |
| Home | Featured | `aspect-[2/3]` + `object-cover` | HIGH。大きく表示され、表紙端の作品名・作者名・人物頭部が欠け得る | 全体を見せる`object-contain`を基本に、neutral matte背景とsubtle inset borderで余白をデザインとして処理する |
| Works | `MarketplaceWorkCard` | `aspect-[2/3]` + `object-cover` + hover 1.02倍 | HIGH。2列時も端の文字が切れ、hoverで拡大する | 共通cover componentへ集約し`contain`。hoverは画像拡大ではなくcard shadow/translateだけにする |
| Detail | Work detail cover | `aspect-[2/3]` + `object-cover` | HIGH。最重要の大型表紙で全体構図が崩れ得る | `object-contain`を第一候補とし、実表紙で余白色を確認する |
| Bookshelf | Bookshelf card | `aspect-[2/3]` + `object-cover` | MEDIUM-HIGH。小さくても書名識別を損なう | `contain` + neutral matte。カード寸法は維持する |
| Reader | Work reader page | `object-contain` + `max-h-[85vh]` | LOW | 現状維持 |

全箇所を機械的に`object-contain`へ置換するのではなく、共通cover componentで背景、境界、fallback、sizes、hoverを統一し、2:3以外の実表紙で比較して決める。

## 6. Responsive受入れ

| Viewport | 静的確認 | 実画面判定 |
| --- | --- | --- |
| 390 × 844 | Works/Shelf 2列。Bottom Nav 4項目・64px・safe area。主要CTA 48px | `BLOCKED_EXTERNAL_ENVIRONMENT`。実表紙、長いタイトル、fixed nav重なり未確認 |
| 768px | Works/Shelf 3列。本棚2列。Header検索表示、Desktop navは未表示 | `BLOCKED_EXTERNAL_ENVIRONMENT`。Header幅と3列密度未確認 |
| 1280px | Works/Shelf 5列。Detail 2カラム。Desktop nav表示 | `BLOCKED_EXTERNAL_ENVIRONMENT`。余白、CTA、実表紙密度未確認 |
| 1440px | `max-w-7xl`内で5列。過度な全幅伸長を抑制 | `BLOCKED_EXTERNAL_ENVIRONMENT`。section balance未確認 |

コード上に明白なhorizontal overflowは見つからないが、実画面未確認のため合格とはしない。

## 7. Accessibility受入れ

| 項目 | 静的結果 | 実画面結果 |
| --- | --- | --- |
| keyboard / focus-visible | skip link、主要link/button/inputにfocus-visibleあり | Tab順と視認性はblocked |
| skip link | `#main-content`へ実装済み | 既存UI-5では確認済み。今回の実データ画面はblocked |
| alt | 表紙・sample・Readerページに作品名を含むaltあり | 実URL画像で未確認 |
| aria | search role、nav label、`aria-current`、loading `aria-busy/live`、error `role=alert`あり | 支援技術の通し確認はblocked |
| contrast | stone/violetの既存tokenを使用 | 実画面測定はblocked |
| 44px touch target | mobile header 44px、Bottom Nav 64px、主要CTA 48px | filter chipは36pxで不一致 |
| reduced motion | global media queryとcard個別対応あり | OS設定での実画面確認はblocked |

## 8. Empty / Error / Loading

- 公開作品0件: 「公開作品はまだありません」と表示する。
- 検索0件: 条件不一致を明示し、上部の「条件をクリア」で復帰できる。
- API/DB error: Home、一覧、本棚で0件と区別し、retryまたは再読込へ案内する。
- 本棚0件: 漫画を探す導線がある。ただし文言は「購入履歴はありません。」で、書店型の「本棚は空です」より取引履歴寄り。
- Loading: `aria-busy`、`aria-live`、`role=status`とreduced-motion対応skeletonを持つ。

## 9. モックとの差分

| 画面 | モックとの差分 | 重要度 | 修正推奨 | 理由 |
| --- | --- | --- | --- | --- |
| Home | Featured表紙がcrop前提。「注目」は実際には販売中の新着順 | HIGH | YES | 表紙が主役という基準と選定根拠の明瞭性に影響する |
| Works | 表紙crop/hover拡大。filter chipが36px | HIGH | YES | 作品発見の主役とMobile操作性に影響する |
| Detail | 主表紙crop、価格が試し読みより先、「漫画を読む・試し読み」が購入状態非連動 | HIGH | YES | 最重要画面で試し読み優先と状態理解を損なう |
| Reader | 本文はcontainで方向性一致。実sample/full accessとresponsiveは未確認 | MEDIUM | NO（検証は必須） | 静的な主要差分はなく、外部環境での合否だけが残る |
| Bookshelf | 表紙crop。「購入履歴」の語感が残る | HIGH | YES | 本棚としての作品識別と体験に影響する |
| Mobile Nav | 4項目、active、safe area、本文余白は実装済み。実機重なり未確認 | MEDIUM | NO（検証は必須） | 静的契約は一致するが実画面証跡がない |

## 10. 現在のMarketplace完成度

- 「ここで漫画を探せる」: 静的には達成。Home、検索、ジャンル、一覧、Headerの優先順位が書店型である。
- 「読んでみたい」: 条件付き。表紙が全体表示される保証がなく、実作品での訴求力を確認できていない。
- 「試し読みしてみよう」: 導線は強いが、Detailの情報順と状態別文言が未完成。
- 技術的完成度: 高い。集中テスト22/22、既存CI成功、状態設計あり。
- 読者体験の受入れ完成度: 未完了。P1修正候補と実データ実画面受入れが残る。

## 11. 停止条件

この報告では修正を実装しない。責任者がUI Gap ListとRecommended UI Adjustment Planを確認し、Marketplace UI Adjustment PRの開始範囲を承認するまで停止する。
