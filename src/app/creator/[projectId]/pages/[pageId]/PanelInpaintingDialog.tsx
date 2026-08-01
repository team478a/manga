"use client";
/* eslint-disable @next/next/no-img-element -- Private signed asset URLs are drawn at their exact source dimensions. */

import { useEffect, useRef, useState } from "react";
import { Brush, Check, Eraser, RotateCcw, Sparkles, X } from "lucide-react";
import {
  defaultMaskSuggestion,
  maskSuggestionsForPreset,
  type MaskRevisionPreset,
  type MaskSuggestion,
} from "./services/panel-mask-suggestions";

export function PanelInpaintingDialog({
  sourceUrl,
  sourceWidth,
  sourceHeight,
  revisionPreset,
  submitting,
  onCancel,
  onSubmit,
}: {
  sourceUrl: string;
  sourceWidth: number;
  sourceHeight: number;
  revisionPreset: MaskRevisionPreset;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (mask: File) => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const [brushPercent, setBrushPercent] = useState(6);
  const [hasMask, setHasMask] = useState(false);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(
    null,
  );
  const suggestions = maskSuggestionsForPreset(revisionPreset);

  function paintSuggestion(suggestion: MaskSuggestion) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.fillStyle = "#ffffff";
    for (const shape of suggestion.shapes) {
      if (shape.kind === "rectangle") {
        context.fillRect(
          shape.x * canvas.width,
          shape.y * canvas.height,
          shape.width * canvas.width,
          shape.height * canvas.height,
        );
        continue;
      }
      context.beginPath();
      context.ellipse(
        shape.centerX * canvas.width,
        shape.centerY * canvas.height,
        shape.radiusX * canvas.width,
        shape.radiusY * canvas.height,
        0,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    context.restore();
    setHasMask(true);
    setActiveSuggestionId(suggestion.id);
  }

  // A newly mounted dialog owns a fresh canvas, so preset/source changes reset it.
  useEffect(() => {
    paintSuggestion(defaultMaskSuggestion(revisionPreset));
  }, [revisionPreset, sourceUrl]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel, submitting]);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function draw(to: { x: number; y: number }) {
    const canvas = canvasRef.current;
    const from = lastPointRef.current;
    if (!canvas || !from) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.save();
    context.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : "source-over";
    context.strokeStyle = "#ffffff";
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth =
      (Math.min(sourceWidth, sourceHeight) * brushPercent) / 100;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.restore();
    lastPointRef.current = to;
    setActiveSuggestionId(null);
    if (tool === "brush") setHasMask(true);
  }

  function clearMask() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasMask(false);
    setActiveSuggestionId(null);
  }

  async function submit() {
    const strokes = canvasRef.current;
    if (!strokes || !hasMask || submitting) return;
    const mask = document.createElement("canvas");
    mask.width = sourceWidth;
    mask.height = sourceHeight;
    const context = mask.getContext("2d");
    if (!context) return;
    context.fillStyle = "#000000";
    context.fillRect(0, 0, mask.width, mask.height);
    context.drawImage(strokes, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      mask.toBlob(resolve, "image/png"),
    );
    if (!blob) return;
    await onSubmit(
      new File([blob], `panel-inpainting-mask-${crypto.randomUUID()}.png`, {
        type: "image/png",
      }),
    );
  }

  return (
    <div
      aria-labelledby="inpainting-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-stone-950/70 p-3 sm:p-6"
      role="dialog"
    >
      <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-start gap-3 border-b border-stone-200 p-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold" id="inpainting-dialog-title">
              直したい範囲を塗る
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              おすすめ範囲を自動配置しました。白い範囲だけをAIが修正し、黒い範囲は元画像を維持します。
            </p>
          </div>
          <button
            aria-label="閉じる"
            className="button-secondary p-2"
            disabled={submitting}
            onClick={onCancel}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="border-b border-violet-200 bg-violet-50 p-3">
          <div className="flex items-center gap-2 text-sm font-bold text-violet-950">
            <Sparkles className="h-4 w-4" /> 修正範囲のおすすめ
          </div>
          <p className="mt-1 text-xs text-violet-800">
            修正内容に合わせた目安です。画像を見ながら「塗る」「消す」で調整してください。
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                aria-pressed={activeSuggestionId === suggestion.id}
                className={
                  activeSuggestionId === suggestion.id
                    ? "button"
                    : "button-secondary"
                }
                disabled={submitting}
                key={suggestion.id}
                onClick={() => paintSuggestion(suggestion)}
                title={suggestion.description}
                type="button"
              >
                {activeSuggestionId === suggestion.id ? (
                  <Check className="mr-1 h-4 w-4" />
                ) : null}
                {suggestion.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-stone-50 p-3">
          <button
            aria-pressed={tool === "brush"}
            className={tool === "brush" ? "button" : "button-secondary"}
            onClick={() => setTool("brush")}
            type="button"
          >
            <Brush className="mr-1 h-4 w-4" /> 塗る
          </button>
          <button
            aria-pressed={tool === "eraser"}
            className={tool === "eraser" ? "button" : "button-secondary"}
            onClick={() => setTool("eraser")}
            type="button"
          >
            <Eraser className="mr-1 h-4 w-4" /> 消す
          </button>
          <label className="ml-1 flex items-center gap-2 text-sm">
            太さ
            <input
              aria-label="ブラシの太さ"
              max={15}
              min={1}
              onChange={(event) => setBrushPercent(Number(event.target.value))}
              type="range"
              value={brushPercent}
            />
          </label>
          <button
            className="button-secondary ml-auto"
            disabled={!hasMask}
            onClick={clearMask}
            type="button"
          >
            <RotateCcw className="mr-1 h-4 w-4" /> 全消去
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-stone-800 p-3 sm:p-6">
          <div
            className="relative mx-auto max-h-[65vh] max-w-full overflow-hidden shadow-xl"
            style={{ aspectRatio: `${sourceWidth} / ${sourceHeight}` }}
          >
            <img
              alt="部分修正する元画像"
              className="absolute inset-0 h-full w-full object-contain"
              draggable={false}
              src={sourceUrl}
            />
            <canvas
              aria-label="修正範囲を描くキャンバス"
              className="absolute inset-0 h-full w-full cursor-crosshair opacity-70 touch-none"
              height={sourceHeight}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                drawingRef.current = true;
                const start = point(event);
                lastPointRef.current = start;
                draw({ x: start.x + 0.01, y: start.y + 0.01 });
              }}
              onPointerMove={(event) => {
                if (drawingRef.current) draw(point(event));
              }}
              onPointerUp={(event) => {
                drawingRef.current = false;
                lastPointRef.current = null;
                event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              ref={canvasRef}
              width={sourceWidth}
            />
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-stone-200 p-4">
          <button
            className="button-secondary"
            disabled={submitting}
            onClick={onCancel}
            type="button"
          >
            キャンセル
          </button>
          <button
            className="button"
            disabled={!hasMask || submitting}
            onClick={() => void submit()}
            type="button"
          >
            {submitting ? "修正候補を受付中…" : "この範囲の修正候補を生成"}
          </button>
        </div>
      </div>
    </div>
  );
}
