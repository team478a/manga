import {
  MAX_MONITOR_SCREENSHOTS,
  MAX_MONITOR_SCREENSHOT_SOURCE_BYTES,
  MAX_MONITOR_SCREENSHOTS_SOURCE_BYTES,
  MAX_MONITOR_SCREENSHOTS_TRANSPORT_BYTES,
} from "./monitor-feedback-limits.ts";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export type OptimizedMonitorScreenshots = {
  files: File[];
  optimized: boolean;
  sourceBytes: number;
  transportBytes: number;
};

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality),
  );
}

async function decodeScreenshot(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("monitor_screenshot_decode_failed"));
      element.src = objectUrl;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function compressScreenshot(file: File, targetBytes: number) {
  if (file.size <= targetBytes) return file;

  const decoded = await decodeScreenshot(file);
  try {
    let maximumDimension = 1_920;
    let quality = 0.86;
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const scale = Math.min(
        1,
        maximumDimension / Math.max(decoded.width, decoded.height),
      );
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("monitor_screenshot_canvas_unavailable");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(decoded.source, 0, 0, width, height);
      const blob = await canvasToBlob(canvas, "image/webp", quality);
      if (blob && blob.size <= targetBytes) {
        const stem = file.name.replace(/\.[^.]+$/, "") || "screenshot";
        const outputType = allowedTypes.has(blob.type) ? blob.type : "image/png";
        const extension =
          outputType === "image/webp"
            ? "webp"
            : outputType === "image/jpeg"
              ? "jpg"
              : "png";
        return new File([blob], `${stem}-optimized.${extension}`, {
          type: outputType,
          lastModified: Date.now(),
        });
      }
      maximumDimension = Math.max(960, Math.round(maximumDimension * 0.82));
      quality = Math.max(0.5, quality - 0.08);
    }
  } finally {
    decoded.close();
  }
  throw new Error("monitor_screenshot_optimization_failed");
}

export async function optimizeMonitorScreenshots(
  values: FormDataEntryValue[],
): Promise<OptimizedMonitorScreenshots> {
  const files = values.filter(
    (value): value is File => value instanceof File && value.size > 0,
  );
  const sourceBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (
    files.length > MAX_MONITOR_SCREENSHOTS ||
    files.some(
      (file) =>
        !allowedTypes.has(file.type) ||
        file.size > MAX_MONITOR_SCREENSHOT_SOURCE_BYTES,
    ) ||
    sourceBytes > MAX_MONITOR_SCREENSHOTS_SOURCE_BYTES
  ) {
    throw new Error("monitor_screenshot_selection_invalid");
  }
  if (sourceBytes <= MAX_MONITOR_SCREENSHOTS_TRANSPORT_BYTES) {
    return {
      files,
      optimized: false,
      sourceBytes,
      transportBytes: sourceBytes,
    };
  }

  const targetBytes = Math.floor(
    MAX_MONITOR_SCREENSHOTS_TRANSPORT_BYTES / Math.max(1, files.length),
  );
  const optimizedFiles = await Promise.all(
    files.map((file) => compressScreenshot(file, targetBytes)),
  );
  const transportBytes = optimizedFiles.reduce(
    (sum, file) => sum + file.size,
    0,
  );
  if (transportBytes > MAX_MONITOR_SCREENSHOTS_TRANSPORT_BYTES) {
    throw new Error("monitor_screenshot_optimization_failed");
  }
  return {
    files: optimizedFiles,
    optimized: true,
    sourceBytes,
    transportBytes,
  };
}
