# Recommended Marketplace UI Adjustment Plan

## 実施結果

- 項目1〜8を`codex/marketplace-ui-adjustments-20261002`で実装した。項目3は新しいAPI／DB契約を作らず、既存Readerのowner／paid判定を共通application helperへ集約して再利用した。
- 項目9の静的回帰は完了したが、実表紙fixture相当の実作品、4 viewport、認証済み本棚・Reader、実画面a11yは外部環境blockerのため未完了である。
- Phase 2機能、DB migration、Production作品・商品・publication、Checkout enable、Stripe、実決済は変更していない。
- 次の完了条件は、正規認証済み環境または隔離Stagingで項目9をread-only確認すること。完了まではPhase 2へ進まない。

責任者承認後に別のMarketplace UI Adjustment PRとして実施する候補。最大10項目に限定し、Phase 2機能、DB migration、Production操作、Checkout変更は含めない。

## 推奨項目

1. **共通cover表示方針を作る（P1）**
   Home Featured、`MarketplaceWorkCard`、Detail、本棚の背景、fallback、sizes、borderを共通化する。基本は表紙全体を守る`object-contain` + neutral matteとし、実表紙比較で最終決定する。card hoverでは画像自体を拡大しない。

2. **作品詳細の情報順を試し読み優先へ直す（P1）**
   タイトル・作者・ジャンルの直後に試し読み可否と主CTAを置き、その後に価格・購入導線を置く。購入CTAは試し読みより強くしない。

3. **Reader entitlementをDetailへ安全に共有する契約を設計する（P1）**
   既存のowner/paid判定を重複実装せずread-only helperへ分離し、未購入は「無料で試し読み」、購入済みは「漫画を読む」と表示する。API、DB、migrationは増やさない案を第一候補とし、契約レビュー後だけ実装する。

4. **試し読みCTAの重複を整理する（P2）**
   ファーストビューの主CTAを状態別に一意化する。中段のviolet sectionは試し読み内容の説明またはReader再導線として役割を明確にする。

5. **「注目作品」を選定規則に一致させる（P2）**
   推奨名は「販売中の新着」。人気、ランキング、レコメンド、編集選定を示唆する名称は新しい根拠契約ができるまで使わない。

6. **Mobile filter chipを44pxへ調整する（P2）**
   `marketplace-filter-chip`のtouch targetを44px以上へ上げ、390pxで折返し量と検索UIの高さを確認する。

7. **本棚の取引履歴語彙を弱める（P2）**
   「N冊の購入履歴」を「N冊の本」、「購入履歴はありません。」を「本棚は空です」等へ変更する。購入日、価格、test/refundedは補助情報として残す。

8. **canary対象外の購入案内を明確にする（P2）**
   「限定販売中」の近くに、現在購入できないことと利用可能条件を誤認なく説明する。販売対象を広げたりCheckout enableを変更したりしない。

9. **実表紙fixtureとviewport matrixでAdjustment PRを受け入れる（P1）**
   2:3、縦長、やや横長、上下端に文字、人物頭部が上端にある表紙を用い、390 × 844、768px、1280px、1440pxでHome、Works、Detail、Bookshelf、Reader、Mobile Navを確認する。可能なら実作品のread-only確認を最終証跡とする。

## PR分割案

- 1つのAdjustment PRに含める: 1、2、4、5、6、7、8と表示テスト。
- 3は既存権限helperの再利用方法を先にレビューし、契約が明確なら同PR、判断が必要なら独立PRとする。
- 9はAdjustment PRの受入れgateであり、Productionデータ変更や実購入を伴わない。

## 完了条件

- P1-1〜P1-3が解消される。
- 実作品で表紙全体とCTA階層が確認できる。
- 指定4 viewportでoverflow、文字、CTA、Header、Bottom Navigationの崩れがない。
- keyboard、focus-visible、contrast、44px target、reduced motionを実画面で確認する。
- paid/test/refundedを既存データでread-only確認する。
- P3機能、DB migration、Production作品・商品・publication・Checkout・Stripe・決済を変更していない。
