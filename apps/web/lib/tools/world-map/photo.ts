// Client-side image compression: downscale to max 800px long edge, JPEG quality 0.75.
// Targets ~120KB output to fit comfortably in the localStorage 5MB budget.

const MAX_EDGE = 800;
const QUALITY = 0.75;

export async function compressImageToDataUrl(file: File): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Image compression only runs in the browser");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("That file doesn't look like an image");
  }
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const { width, height } = fitWithin(img.width, img.height, MAX_EDGE);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", QUALITY);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function fitWithin(
  w: number,
  h: number,
  max: number,
): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  if (w > h) {
    const ratio = max / w;
    return { width: max, height: Math.round(h * ratio) };
  }
  const ratio = max / h;
  return { width: Math.round(w * ratio), height: max };
}
