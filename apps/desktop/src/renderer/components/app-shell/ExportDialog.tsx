import React from "react";
import {
  CheckCircle2,
  Download,
  FileArchive,
  FileText,
  XCircle,
} from "lucide-react";
import type { ExportProgress } from "../../../preload/api";

export type ExportResult = {
  outputDir: string;
  warnings: string[];
};

export function ExportDialog({
  open,
  projectTitle,
  pageCount,
  progress,
  result,
  error,
  onStart,
  onCancel,
  onClose,
}: {
  open: boolean;
  projectTitle: string;
  pageCount: number;
  progress?: ExportProgress;
  result?: ExportResult;
  error?: string;
  onStart: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const dialogRef = React.useRef<HTMLElement>(null),
    running = Boolean(progress),
    runningRef = React.useRef(running),
    closeRef = React.useRef(onClose);
  runningRef.current = running;
  closeRef.current = onClose;
  React.useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog
      ?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      ?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !runningRef.current) {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0],
        last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [open]);
  React.useEffect(() => {
    if (!open || dialogRef.current?.contains(document.activeElement)) return;
    dialogRef.current
      ?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      ?.focus();
  }, [open, running, result, error]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        onKeyDown={(event) => {
          if (event.key !== "Escape" || running) return;
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
      >
        <header>
          <div>
            <small>MANGAI EXPORT</small>
            <h2 id="export-dialog-title">
              {running
                ? "書き出し中"
                : result
                  ? "書き出し完了"
                  : error
                    ? "書き出しを完了できませんでした"
                    : "作品を書き出す"}
            </h2>
          </div>
          {!running && (
            <button className="secondary" aria-label="閉じる" onClick={onClose}>
              ×
            </button>
          )}
        </header>
        {running ? (
          <div className="export-dialog-state">
            <Download size={36} aria-hidden="true" />
            <strong>
              {progress?.status === "packaging"
                ? "PDF・ZIP・販売パッケージを作成中"
                : `Page ${progress?.pageNumber ?? progress?.current} / ${progress?.total} を描画中`}
            </strong>
            <progress max="100" value={progress?.percent ?? 0} />
            <span>{progress?.percent ?? 0}%</span>
          </div>
        ) : result ? (
          <div className="export-dialog-state success">
            <CheckCircle2 size={40} aria-hidden="true" />
            <strong>{projectTitle}を書き出しました。</strong>
            <p className="export-output-path">{result.outputDir}</p>
            {result.warnings.length > 0 && (
              <div className="export-warnings">
                <b>確認事項</b>
                {result.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}
          </div>
        ) : error ? (
          <div className="export-dialog-state danger-state">
            <XCircle size={40} aria-hidden="true" />
            <strong>{error}</strong>
            <p>
              Projectデータは変更されていません。内容を確認して再実行できます。
            </p>
          </div>
        ) : (
          <div className="export-dialog-content">
            <p>
              <b>{projectTitle}</b> の {pageCount}ページを書き出します。
            </p>
            {pageCount === 0 && (
              <p className="export-empty-warning">
                書き出すPageがありません。先にPageを追加してください。
              </p>
            )}
            <div className="export-format-list">
              <article>
                <FileText size={22} aria-hidden="true" />
                <div>
                  <b>印刷・閲覧用PDF</b>
                  <small>DPI設定に基づく全ページPDF</small>
                </div>
              </article>
              <article>
                <FileArchive size={22} aria-hidden="true" />
                <div>
                  <b>連番画像ZIP</b>
                  <small>合成済みPNGとmanifest</small>
                </div>
              </article>
              <article>
                <FileArchive size={22} aria-hidden="true" />
                <div>
                  <b>MANGAI販売パッケージ</b>
                  <small>Hub取り込み用の作品・商品データ</small>
                </div>
              </article>
            </div>
          </div>
        )}
        <footer>
          {running ? (
            <button className="danger" onClick={onCancel}>
              書き出しをキャンセル
            </button>
          ) : result ? (
            <button onClick={onClose}>完了</button>
          ) : (
            <>
              <button className="secondary" onClick={onClose}>
                閉じる
              </button>
              <button disabled={pageCount === 0} onClick={onStart}>
                {error ? "再実行" : "書き出し開始"}
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
