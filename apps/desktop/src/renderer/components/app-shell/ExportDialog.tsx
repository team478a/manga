import React from "react";
import {
  CheckCircle2,
  Download,
  FileArchive,
  FileText,
  XCircle,
} from "lucide-react";
import type {
  ExportHistoryItem,
  ExportProgress,
} from "../../../preload/api";
import { useI18n } from "../../i18n";

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
  history,
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
  history: ExportHistoryItem[];
}) {
  const { t, formatDateTime } = useI18n();
  const backdropRef = React.useRef<HTMLDivElement>(null),
    dialogRef = React.useRef<HTMLElement>(null),
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
  React.useEffect(() => {
    const backdrop = backdropRef.current;
    const parent = backdrop?.parentElement;
    if (!open || !backdrop || !parent) return;
    const siblings = [...parent.children].filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && element !== backdrop,
    );
    const previous = siblings.map((element) => ({
      element,
      inert: element.getAttribute("inert"),
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
    for (const element of siblings) {
      element.setAttribute("inert", "");
      element.setAttribute("aria-hidden", "true");
    }
    return () => {
      for (const item of previous) {
        if (item.inert === null) item.element.removeAttribute("inert");
        else item.element.setAttribute("inert", item.inert);
        if (item.ariaHidden === null)
          item.element.removeAttribute("aria-hidden");
        else item.element.setAttribute("aria-hidden", item.ariaHidden);
      }
    };
  }, [open]);
  if (!open) return null;
  return (
    <div ref={backdropRef} className="modal-backdrop" role="presentation">
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
                ? t("export.runningTitle")
                : result
                  ? t("export.completeTitle")
                  : error
                    ? t("export.failedTitle")
                    : t("export.title")}
            </h2>
          </div>
          {!running && (
            <button
              className="secondary"
              data-a11y-action="close-export"
              aria-label={t("export.close")}
              onClick={onClose}
            >
              ×
            </button>
          )}
        </header>
        {running ? (
          <div className="export-dialog-state">
            <Download size={36} aria-hidden="true" />
            <strong>
              {progress?.status === "packaging"
                  ? t("export.packaging")
                  : t("export.rendering", {
                    current:
                      progress?.pageNumber ?? progress?.current ?? 0,
                    total: progress?.total ?? 0,
                  })}
            </strong>
            <progress max="100" value={progress?.percent ?? 0} />
            <span>{progress?.percent ?? 0}%</span>
          </div>
        ) : result ? (
          <div className="export-dialog-state success">
            <CheckCircle2 size={40} aria-hidden="true" />
            <strong>{t("export.complete", { project: projectTitle })}</strong>
            <p className="export-output-path">{result.outputDir}</p>
            {result.warnings.length > 0 && (
              <div className="export-warnings">
                <b>{t("export.warnings")}</b>
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
            <p>{t("export.unchanged")}</p>
          </div>
        ) : (
          <div className="export-dialog-content">
            <p>
              {t("export.summary", {
                project: projectTitle,
                count: pageCount,
              })}
            </p>
            {pageCount === 0 && (
              <p className="export-empty-warning">
                {t("export.empty")}
              </p>
            )}
            <div className="export-format-list">
              <article>
                <FileText size={22} aria-hidden="true" />
                <div>
                  <b>{t("export.pdfTitle")}</b>
                  <small>{t("export.pdfDescription")}</small>
                </div>
              </article>
              <article>
                <FileArchive size={22} aria-hidden="true" />
                <div>
                  <b>{t("export.zipTitle")}</b>
                  <small>{t("export.zipDescription")}</small>
                </div>
              </article>
              <article>
                <FileArchive size={22} aria-hidden="true" />
                <div>
                  <b>{t("export.packageTitle")}</b>
                  <small>{t("export.packageDescription")}</small>
                </div>
              </article>
            </div>
            <div className="export-warnings">
              <b>{t("export.recent")}</b>
              {!history.length ? (
                <p>{t("export.noHistory")}</p>
              ) : (
                history.slice(0, 3).map((item) => (
                  <p key={item.id}>
                    {formatDateTime(item.createdAt)}・
                    {t("export.historyFiles", { count: item.files.length })}
                    {item.warnings.length
                      ? `・${t("export.historyWarnings", {
                          count: item.warnings.length,
                        })}`
                      : ""}
                    <br />
                    <small>{item.outputDir}</small>
                  </p>
                ))
              )}
            </div>
          </div>
        )}
        <footer>
          {running ? (
            <button className="danger" onClick={onCancel}>
              {t("export.cancel")}
            </button>
          ) : result ? (
            <button onClick={onClose}>{t("export.done")}</button>
          ) : (
            <>
              <button className="secondary" onClick={onClose}>
                {t("export.close")}
              </button>
              <button disabled={pageCount === 0} onClick={onStart}>
                {error ? t("export.retry") : t("export.start")}
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
