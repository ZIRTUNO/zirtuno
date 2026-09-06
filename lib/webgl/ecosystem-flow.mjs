// S3: three currents, one continuous body. Cloud space; no DOM or allocation.
// Each 16-drop current opens from an arc into a closed, tilted loop. Scroll
// brings the loops into contact, then draws them into the existing S4 source.
import { smooth01 } from "./phys.mjs";

export const ECO_BEATS = [0.08, 0.34, 0.60, 0.88];
export const ecosystemBeat = (p) => p < 0.30 ? 0 : p < 0.56 ? 1 : p < 0.83 ? 2 : 3;

export function ecosystemFlow(out, i, p, time, destination) {
  if (p >= 1) {
    out[0] = destination[0]; out[1] = destination[1]; out[2] = destination[2];
    out[3] = 0; out[4] = 1;
    return;
  }
  const group = Math.floor(i / 16);
  const u = (i % 16) / 16;
  const assemble = smooth01((p - group * 0.18) / 0.26);
  const join = smooth01((p - 0.47) / 0.35);
  const close = smooth01((p - 0.80) / 0.20);
  const alive = 1 - close;
  const bearing = group * Math.PI * 2 / 3 + 0.38;
  const turn = 0.24 * Math.sin(time * 0.28 + group * 1.7) * alive;
  const arc = 0.58 + assemble * 0.42;
  const angle = u * Math.PI * 2 * arc + bearing + p * 1.15 + time * 0.065 * alive;
  const radius = 0.185 + 0.01 * Math.sin(angle * 3 + time * 0.4) * alive;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius * (0.62 + 0.12 * Math.sin(p * 2 + group));
  const tilt = bearing + turn;
  const spread = (0.22 - join * 0.035) + (1 - assemble) * 0.09;
  const cx = Math.cos(bearing) * spread;
  const cy = Math.sin(bearing) * spread;
  const px = 0.5 + cx + x * Math.cos(tilt) - y * Math.sin(tilt);
  const py = 0.5 + cy + x * Math.sin(tilt) + y * Math.cos(tilt);
  const tube = (0.032 + 0.0015 * Math.sin(angle + group)) * (0.86 + assemble * 0.14);
  out[0] = px + (destination[0] - px) * close;
  out[1] = py + (destination[1] - py) * close;
  out[2] = tube + (destination[2] - tube) * close;
  out[3] = (0.68 - assemble * 0.57) * alive;
  out[4] = assemble;
}
