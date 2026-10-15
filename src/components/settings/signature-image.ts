const SIG_MAX_WIDTH = 600;
export const SIG_MAX_CHARS = 400_000;

/** 讀取圖片並縮小（寬度上限 600px），回傳 data URL */
export async function shrinkImage(file: File): Promise<string> {
  const src = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("讀取失敗"));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("無法讀取這張圖片"));
    i.src = src;
  });
  const scale = Math.min(1, SIG_MAX_WIDTH / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const keepAlpha = file.type === "image/png" || file.type === "image/gif" || file.type === "image/webp";
  if (!keepAlpha) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  let out = canvas.toDataURL(keepAlpha ? "image/png" : "image/jpeg", 0.9);
  // 仍過大時改用 JPEG 並逐步降低品質
  for (let q = 0.85; out.length > SIG_MAX_CHARS && q >= 0.4; q -= 0.15) {
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    out = canvas.toDataURL("image/jpeg", q);
  }
  return out;
}
