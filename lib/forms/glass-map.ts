/** A refractive normal map for a shallow, rounded glass lens.
 * Generated only on resize. BMP keeps this DOM/canvas-free and dependency-free.
 * R/G encode surface normals; neutral centre = no displacement of the backdrop.
 */
export function glassMap(width: number, height: number): string {
  const ratio = Math.min(0.6, 280 / width);
  const w = Math.max(2, Math.ceil(width * ratio));
  const h = Math.max(2, Math.ceil(height * ratio));
  const stride = (w * 3 + 3) & ~3;
  const bytes = new Uint8Array(54 + stride * h);
  const view = new DataView(bytes.buffer);
  bytes[0] = 66; bytes[1] = 77;
  view.setUint32(2, bytes.length, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, w, true); view.setInt32(22, -h, true);
  view.setUint16(26, 1, true); view.setUint16(28, 24, true);
  const radius = Math.min(10, height / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = (x + 0.5) / w * width - width / 2;
      const py = (y + 0.5) / h * height - height / 2;
      const qx = Math.abs(px) - (width / 2 - radius);
      const qy = Math.abs(py) - (height / 2 - radius);
      const ax = Math.max(0, qx), ay = Math.max(0, qy);
      const len = Math.hypot(ax, ay);
      const dist = len + Math.min(Math.max(qx, qy), 0) - radius;
      const nx = len ? ax / len : qx > qy ? 1 : 0;
      const ny = len ? ay / len : qy >= qx ? 1 : 0;
      // A rolled rim: displacement rises through the bevel then falls to zero
      // at the edge. The clear interior transmits the original environment.
      const depth = Math.max(0, -dist);
      const slope = depth < 14 ? Math.sin(depth / 14 * Math.PI) * 0.92 : 0;
      const i = 54 + y * stride + x * 3;
      bytes[i] = 128;
      bytes[i + 1] = Math.round(128 + Math.sign(py) * ny * slope * 122);
      bytes[i + 2] = Math.round(128 + Math.sign(px) * nx * slope * 122);
    }
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return `data:image/bmp;base64,${btoa(binary)}`;
}
