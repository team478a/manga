# 品質承認済み候補の完成判定整合 Release Candidate

## 概要

PR #316のProduction受入れ後、対象22ページは画像4/4、セリフ1/1、生成中0、失敗0、ページ一覧「完成」であるにもかかわらず、編集画面だけが「手動確認待ち」を表示していた。本変更は完成判定の読み取りロジックだけを整合させる。

## 原因

品質承認と候補採用は`cloud_manga_quality_logs`へ記録される。一方、同じ候補生成単位の`cloud_generation_panel_adoptions.status`には、過去の自動配置時に記録された`review_required`または`placement_failed`が残る場合がある。

従来の完成判定は、品質承認済み候補の存在を考慮せず、候補単位に残ったadoption statusを未解決として数えていた。そのため採用済み候補だけでなく、比較後に採用されなかった兄弟候補の古い状態でも手動確認待ちへ戻っていた。

## 修正契約

- 同じ候補生成単位に、品質承認済みかつ不採用でない候補が1件以上あれば、その生成単位のadoption確認は解決済みとする。
- 品質承認された候補が後から不採用になった場合は、未確認の兄弟候補があれば確認待ちを維持する。
- 全候補が不採用なら、adoption確認待ちは残さない。画像不足など別の完成条件がページを未完成として判定する。
- セリフ配置、制作状態、Canvas内容、品質記録の既存source of truthは変更しない。

## 変更ファイル

- `src/modules/manga/domain/page-completion.ts`
- `src/modules/cloud-creator/projects/page-completion-service.ts`
- `tests/manga-page-completion.test.mjs`
- 正本同期文書

## 検証結果

- 集中テスト: 15/15成功
- dependency boundary: error 0、既存warning 2件
- lint: 成功
- typecheck: Hub／Desktop成功
- Hub test: 824/824成功
- Canvas test: 26/26成功
- AI test: 48/48成功
- Desktop test: 182/182成功
- Desktop accessibility: violation 0
- Supabase migration validation: 61件成功
- Hub build: 成功
- Desktop build: 成功
- RC preflight: repository structure ready。外部設定Pendingは既存ローカル環境依存
- `git diff --check`: 成功

## 不変契約

API、URL、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF処理、成人向け境界、Desktop製品コードは変更しない。

## Production確認

本PRではProductionへの書込みを行っていない。作品、Canvas、画像、品質記録、Storage、Provider、creditの変更は0件である。

merge後は対象22ページを再読込し、画像4/4・セリフ1/1を維持したまま編集画面が「ページ完成」と表示することを確認する。Provider再実行、credit消費、DB手動更新は不要である。

## Draft PRとPreview

- Draft PR: [#317](https://github.com/team478a/manga/pull/317)
- 実装HEAD: `e3f80a80b8646c879fd59c261940ee6137463e5b`
- Mergeability: `MERGEABLE`
- Core quality: 成功
- Migration roundtrip: 成功
- Windows build: 成功
- Vercel: 成功
- Vercel Preview Comments: 成功
- Preview: [Ready](https://mangai-hub-staging-qht1tbga3-team478as-projects.vercel.app)
- Preview確認: `/login`のタイトル、メール、パスワード、ログイン導線が正常。ブラウザログ0件。
- Preview確認中のProduction DB、Provider、credit、作品データ変更は0件。

## ロールバック

本変更のcommitを通常のrevertで戻す。DB・migration・Storage変更がないため、データrollbackは不要である。戻した場合、対象ページの編集画面は再び古いadoption statusを理由に「手動確認待ち」を表示する。
