// browser-side image compression, shared by every image upload.

const QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45];

// encode one canvas frame; null when the browser can't produce that type
function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((r) => canvas.toBlob((b) => r(b && b.type === type ? b : null), type, quality));
}

// jpeg has no alpha: put transparent pixels on white instead of black
function flatten(canvas: HTMLCanvasElement) {
  const c = document.createElement("canvas");
  c.width = canvas.width;
  c.height = canvas.height;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(canvas, 0, 0);
  return c;
}

// encode as webp (jpeg fallback), stepping quality down until it fits maxBytes
export async function compressCanvas(canvas: HTMLCanvasElement, maxBytes: number): Promise<Blob> {
  // safari can't write webp and hands back png, so detect that once
  const webp = !!(await encode(canvas, "image/webp", QUALITIES[0]));
  const type = webp ? "image/webp" : "image/jpeg";
  const src = webp ? canvas : flatten(canvas);
  let smallest: Blob | null = null;
  for (const q of QUALITIES) {
    const blob = await encode(src, type, q);
    if (!blob) continue;
    if (blob.size <= maxBytes) return blob;
    if (!smallest || blob.size < smallest.size) smallest = blob;
  }
  if (!smallest) throw new Error("Gambar tidak bisa diproses");
  return smallest;
}

// draw a bitmap scaled so its longest side is at most maxSide
function scaled(img: ImageBitmap, maxSide: number) {
  const k = Math.min(1, maxSide / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.width * k));
  c.height = Math.max(1, Math.round(img.height * k));
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

export type CompressedImage = { file: Blob; thumb: Blob; width: number; height: number };

// shrink a picked/pasted image for upload, plus a small thumbnail
export async function compressImageFile(
  file: File,
  { maxSide = 2000, maxBytes = 500 * 1024, thumbSide = 400, thumbBytes = 40 * 1024 } = {},
): Promise<CompressedImage> {
  const img = await createImageBitmap(file).catch(() => {
    throw new Error(`"${file.name}" bukan gambar yang bisa dibuka`);
  });
  try {
    const big = scaled(img, maxSide);
    // always re-encode, which also strips exif (gps location from phone photos)
    const out = await compressCanvas(big, maxBytes);
    const thumb = await compressCanvas(scaled(img, thumbSide), thumbBytes);
    return { file: out, thumb, width: big.width, height: big.height };
  } finally {
    img.close();
  }
}

// compress one image and upload it as a card attachment; returns the new attachment id
export async function uploadCardImage(cardId: string, f: File, onStep?: (step: string) => void): Promise<string> {
  onStep?.("Mengompres…");
  const img = await compressImageFile(f);
  onStep?.("Mengunggah…");
  const form = new FormData();
  form.append("file", img.file);
  form.append("thumb", img.thumb);
  form.append("name", (f.name || "gambar").replace(/\.[^.]+$/, "") + (img.file.type === "image/webp" ? ".webp" : ".jpg"));
  form.append("width", String(img.width));
  form.append("height", String(img.height));
  const res = await fetch(`/api/cards/${cardId}/attachments`, { method: "POST", body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Gagal mengunggah gambar");
  return json.id as string;
}

// compress a photo for a board background and upload it; returns the new background value ("u:<version>")
export async function uploadBoardBackground(boardId: string, f: File, onStep?: (step: string) => void): Promise<string> {
  onStep?.("Mengompres…");
  // full-screen size is plenty for a background; the thumb feeds board tiles and menus
  const img = await compressImageFile(f, { maxSide: 1920, maxBytes: 350 * 1024, thumbSide: 480, thumbBytes: 30 * 1024 });
  onStep?.("Mengunggah…");
  const form = new FormData();
  form.append("file", img.file);
  form.append("thumb", img.thumb);
  const res = await fetch(`/api/boards/${boardId}/background`, { method: "PUT", body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Gagal mengunggah background");
  return json.background as string;
}
