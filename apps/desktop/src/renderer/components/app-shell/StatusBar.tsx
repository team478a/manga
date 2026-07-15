import React from "react";
import { Folder, Image, Maximize2 } from "lucide-react";
import { useI18n } from "../../i18n";

export function StatusBar({
  selectedLabel,
  pageSize,
  dpi,
  zoom,
  assetCount,
  storagePath,
  activity,
}: {
  selectedLabel: string;
  pageSize?: string;
  dpi: number;
  zoom: number;
  assetCount: number;
  storagePath: string;
  activity?: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <footer className="status-bar">
      <span>{selectedLabel}</span>
      <span className="status-bar-path" title={storagePath}>
        <Folder size={13} aria-hidden="true" />
        {storagePath}
      </span>
      <span>
        {pageSize ?? t("status.noPage")} / {dpi}dpi
      </span>
      <span className="status-bar-spacer" />
      {activity}
      <span>
        <Maximize2 size={13} aria-hidden="true" /> {zoom}%
      </span>
      <span>
        <Image size={13} aria-hidden="true" />{" "}
        {t("status.assets", { count: assetCount })}
      </span>
    </footer>
  );
}
