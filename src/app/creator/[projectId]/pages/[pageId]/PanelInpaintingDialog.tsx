"use client";
/* eslint-disable @next/next/no-img-element -- Private signed asset URLs are drawn at their exact source dimensions. */

import { useEffect, useRef, useState } from "react";
import { Brush, Eraser, RotateCcw, X } from "lucide-react";

export function PanelInpaintingDialog({
  sourceUrl,
  sourceWidth,
  sourceHeight,
  submitting,
  onCancel,
  onSubmit,
}: {
  sourceUrl: string;
  sourceWidth: number;
  sourceHeight: number;
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
    if (tool === "brush") setHasMask(true);
  }

  function clearMask() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasMask(false);
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
              白く塗った範囲だけをAIが修正します。黒い範囲は元画像を維持します。
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
