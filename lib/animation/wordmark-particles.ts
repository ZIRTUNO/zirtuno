/**
 * Wordmark particle assembly — CPU Canvas-2D (NO WebGL; strict GPU budget):
 * cyan particles drift in and settle into the wordmark's letterforms, sampled
 * from the REAL loaded font so a crisp DOM text can take over seamlessly.
 * ONE implementation, two moments: the S1.10 entry veil (the first brand
 * touch) and S8 Beat 5 (the origin's resolution).
 *
 * Returns a cancel function. `onSettled` fires once every particle has landed
 * (the caller crossfades to the crisp text / fades the veil).
 */
export function runWordmarkAssembly(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  textEl: HTMLElement,
  text: string,
  onSettled: () => void,
  /**
   * Backing-store cap in CSS px. The canvas is stretched to its host by
   * `width: 100%`, so a cap BELOW the host's width is an upscale: the origin
   * wordmark's stage is 736px wide, and at the old fixed 520 every particle
   * and every sampled letterform was blown up 1.4x and softened — at the one
   * moment the brand name is supposed to resolve. The default keeps the entry
   * veil (S1.10), whose stage is min(78vw, 520px), byte-identical.
   */
  maxWidth = 520,
): () => void {
  let raf = 0;
  let running = true;

  const run = () => {
    if (!running) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      onSettled();
      return;
    }
    const W = Math.min(host.clientWidth || 360, maxWidth);
    const H = Math.round(W * 0.26);
    canvas.width = W;
    canvas.height = H;

    // sample target points from the wordmark, in the real (loaded) font
    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const octx = off.getContext("2d");
    if (!octx) {
      onSettled();
      return;
    }
    const cs = getComputedStyle(textEl);
    const family = cs.fontFamily || "serif";
    const fstyle = cs.fontStyle || "normal";
    const fweight = cs.fontWeight || "400";
    let fontSize = Math.floor(H * 0.62);
    const setFont = () =>
      (octx.font = `${fstyle} ${fweight} ${fontSize}px ${family}`);
    setFont();
    while (octx.measureText(text).width > W * 0.9 && fontSize > 8) {
      fontSize -= 2;
      setFont();
    }
    octx.fillStyle = "#fff";
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    octx.fillText(text, W / 2, H / 2);
    const data = octx.getImageData(0, 0, W, H).data;

    const targets: number[] = [];
    const step = 4;
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 128) targets.push(x, y);
      }
    }
    const MAX = 850;
    const total = targets.length / 2;
    const skip = total > MAX ? Math.ceil(total / MAX) : 1;
    const parts: number[] = []; // x,y,tx,ty flat
    for (let i = 0; i < total; i += skip) {
      parts.push(
        Math.random() * W,
        Math.random() * H,
        targets[i * 2],
        targets[i * 2 + 1],
      );
    }

    let frames = 0;
    const draw = () => {
      if (!running) return;
      frames++;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#4DECFF";
      let maxd = 0;
      for (let i = 0; i < parts.length; i += 4) {
        parts[i] += (parts[i + 2] - parts[i]) * 0.12;
        parts[i + 1] += (parts[i + 3] - parts[i + 1]) * 0.12;
        const d =
          Math.abs(parts[i + 2] - parts[i]) +
          Math.abs(parts[i + 3] - parts[i + 1]);
        if (d > maxd) maxd = d;
        ctx.fillRect(parts[i], parts[i + 1], 1.7, 1.7);
      }
      if (maxd < 0.7 && frames > 24) {
        onSettled(); // every particle landed — hand over to the crisp text
        return;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
  };

  // ensure the brand font is ready so particles match the crisp text
  (document.fonts?.ready ?? Promise.resolve()).then(() => {
    if (running) run();
  });

  return () => {
    running = false;
    cancelAnimationFrame(raf);
  };
}
