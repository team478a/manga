import React from "react";
import { Folder, Image, Maximize2 } from "lucide-react";

export function StatusBar({
  selectedLabel,
  pageSize,
  dpi,
  zoom,
  assetCount,
  storagePath,
}: {
  selectedLabel: string;
  pageSize?: string;
  dpi: number;
  zoom: number;
  assetCount: number;
  storagePath: string;
}) {
  return (
    <footer className="status-bar">
      <span>{selectedLabel}</span>
      <span className="status-bar-path" title={storagePath}>
        <Folder size={13} aria-hidden="true" />
        {storagePath}
      </span>
      <span>
        {pageSize ?? "Page未選択"} / {dpi}dpi
      </span>
      <span className="status-bar-spacer" />
      <span>
        <Maximize2 size={13} aria-hidden="true" /> {zoom}%
      </span>
      <span>
        <Image size={13} aria-hidden="true" /> 素材 {assetCount}
      </span>
    </footer>
  );
}
