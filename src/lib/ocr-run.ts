import { parseLabelText } from "@/lib/ocr-parse";
import type { IngredientDraft } from "@/lib/lookup/types";

/** Otsu's method: the grayscale threshold that best separates ink from paper. */
function otsuThreshold(histogram: number[], total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/**
 * Prepare a label photo for OCR: downscale, grayscale, then binarize with
 * Otsu's threshold so the Supplement Facts text separates cleanly from the
 * background. Dark-text-on-light panels read far better as a crisp two-level
 * image than as contrast-stretched greyscale, especially through glare on a
 * glossy bottle. Runs entirely in the browser; falls back to the original file
 * if canvas is unavailable.
 */
export async function preprocessForOcr(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  // Keep more resolution than before — these panels pack small type, and
  // tesseract needs a decent pixel height per glyph to read it.
  const maxDim = 2600;
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
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = g;
    histogram[g]++;
  }
  const threshold = otsuThreshold(histogram, (d.length / 4) | 0);
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] > threshold ? 255 : 0;
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
    // Keep the run of spaces between an ingredient name and its amount so the
    // parser's "<name> … <amount> <unit>" split has whitespace to work with,
    // instead of tesseract collapsing the dot-leader gap away.
    await worker.setParameters({ preserve_interword_spaces: "1" });
    const {
      data: { text },
    } = await worker.recognize(prepared);
    return parseLabelText(text);
  } finally {
    await worker.terminate();
  }
}
