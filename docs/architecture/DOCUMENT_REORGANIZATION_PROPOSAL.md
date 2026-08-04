# Current Task / Handoff Log Reorganization Proposal

作成日: 2026-08-04

## 目的

現在作業と履歴を分離し、次担当者が古い「現在の優先タスク」を正本と誤認しない構造へ変更する。

PR-R0で実際に全文移動すると1,500行上限を超えるため、本PRでは案だけを確定し、既存本文は変更しない。

## `docs/CURRENT_TASK.md`縮小案

目標は300行以下とし、次だけを残す。

1. 正本branchとHEAD
2. 現在のPR名、目的、変更範囲
3. 完了条件と停止条件
4. 外部受入れ残件へのlink
5. 過去タスクarchive index

現在の全文は次へ移動する。

```text
docs/archive/tasks/CURRENT_TASK_THROUGH_2026-08-04.md
```

移動後は履歴本文を現行ファイルへ追記せず、完了したPR単位で月別archiveへ追記する。

## `docs/HANDOFF_LOG.md`分割案

正本には最新引継ぎ1件とarchive indexだけを残す。

```text
docs/archive/handoff/HANDOFF_LOG_2026-07.md
docs/archive/handoff/HANDOFF_LOG_2026-08.md
```

旧台帳には日付順でない追記と`#`/`##`の混在があるため、単純な行範囲分割を行わない。各日付見出しを単位として月別に移し、次を検査する。

- 全日付見出しがいずれかのarchiveに1回だけ存在する
- 本文の欠落・重複がない
- 相対linkが移動後も有効
- 旧PR番号、branch、commitは履歴として保持
- 「現在」「次」の表現はarchive内では履歴であると明示

## 実施PR案

文書移動だけの独立PRで行う。`git diff --find-renames`でrenameを確認し、実変更が1,500行を超える場合は次の2PRへ分ける。

1. `CURRENT_TASK.md`縮小とtask archive
2. `HANDOFF_LOG.md`縮小と2026-07/2026-08 archive

コード、DB、migration、環境変数、CI設定は変更しない。

## 完了確認

- `CURRENT_TASK.md`が300行以下
- `HANDOFF_LOG.md`が最新引継ぎとarchive indexだけ
- archiveを含む全見出し件数が移動前と一致
- Markdown link確認
- `git diff --check`
- 全CI成功
