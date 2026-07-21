import { parseLabelText } from "@/lib/ocr-parse";
import type { IngredientDraft } from "@/lib/lookup/types";

/**
 * Prepare a label photo for OCR: downscale, grayscale, and stretch contrast so
 * the Supplement Facts text separates from the background. Runs entirely in the
 * browser (uses canvas). Falls back to the original file if canvas is missing.
 */
export async function preprocessForOcr(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const maxDim = 2000;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    const v = ((d[i] - min) / range) * 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);

  return new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), "image/png"),
  );
}

/**
 * Read a supplement label photo entirely in the browser and return the parsed
 * ingredient rows. The photo never leaves the device.
 */
export async function recognizeLabel(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<IngredientDraft[]> {
  const prepared = await preprocessForOcr(file).catch(() => file);
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text") {
        onProgress?.(Math.round(m.progress * 100));
      }
    },
  });
  try {
    const {
      data: { text },
    } = await worker.recognize(prepared);
    return parseLabelText(text);
  } finally {
    await worker.terminate();
  }
}
