// Regression guard for the unified liquid shader:
// 1. Small droplets must render as filled cyan, not as black/transparent cutouts.
// 2. A droplet buried inside an active SDF form must not emboss an "inner ball"
//    into the glass surface.

import { chromium } from "playwright";
import fs from "node:fs";
import {
  SDF_BALL_MAX,
  SDF_GLASS_FRAG,
  SDF_GLASS_VERT,
  SDF_RES,
  SDF_THICK,
} from "../../lib/webgl/sdf-glass-shader.mjs";

const SIZE = 256;

// prefer the system browser (matches the other harnesses) — survives
// playwright version bumps without a `playwright install`
const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const executablePath = chromeCandidates.find((c) => fs.existsSync(c));

const browser = await chromium.launch({
  headless: true,
  chromiumSandbox: false,
  ...(executablePath ? { executablePath } : {}),
});
const page = await browser.newPage({
  viewport: { width: SIZE, height: SIZE },
  deviceScaleFactor: 1,
});

const result = await page.evaluate(
  ({ frag, vert, size, maxBalls, sdfRes, thick }) => {
    const makeCircleSdf = (radius) => {
      const data = new Float32Array(sdfRes * sdfRes);
      for (let y = 0; y < sdfRes; y++) {
        for (let x = 0; x < sdfRes; x++) {
          const u = (x + 0.5) / sdfRes;
          const v = (y + 0.5) / sdfRes;
          data[y * sdfRes + x] = Math.hypot(u - 0.5, v - 0.5) - radius;
        }
      }
      return data;
    };

    const makeEmptySdf = () => {
      const data = new Float32Array(sdfRes * sdfRes);
      data.fill(1);
      return data;
    };

    const compile = (gl, type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh) || "shader compile failed");
      }
      return sh;
    };

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    document.body.appendChild(canvas);
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
    });
    if (!gl) throw new Error("WebGL2 unavailable");

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vert));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || "program link failed");
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = (name) => gl.getUniformLocation(prog, name);
    const tex = (unit, data) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R32F,
        sdfRes,
        sdfRes,
        0,
        gl.RED,
        gl.FLOAT,
        data,
      );
      return t;
    };

    const empty = makeEmptySdf();
    const circle = makeCircleSdf(0.34);
    tex(0, empty);
    tex(1, empty);

    gl.uniform1i(U("iSDF"), 0);
    gl.uniform1i(U("iSDF2"), 1);
    gl.uniform2f(U("iRes"), size, size);
    gl.uniform2f(U("iTexel"), 1 / sdfRes, 1 / sdfRes);
    gl.uniform1f(U("iThick"), thick);
    gl.uniform1f(U("iTime"), 0);
    gl.uniform1f(U("iWarp"), 0);
    gl.uniform1f(U("iMute"), 0);
    gl.uniform2f(U("iFormOff"), 0, 0);
    gl.uniform1f(U("iFormScale"), 1);
    gl.viewport(0, 0, size, size);

    const balls = new Float32Array(maxBalls * 3);
    const render = ({ form, glass, ball }) => {
      gl.activeTexture(gl.TEXTURE0);
      tex(0, form ? circle : empty);
      gl.activeTexture(gl.TEXTURE1);
      tex(1, empty);
      balls.fill(0);
      let count = 0;
      if (ball) {
        balls[0] = ball[0];
        balls[1] = ball[1];
        balls[2] = ball[2];
        count = 1;
      }
      gl.uniform1f(U("iFormA"), form ? 1 : 0);
      gl.uniform1f(U("iFormB"), 0);
      gl.uniform1f(U("iEroA"), 0);
      gl.uniform1f(U("iEroB"), 0);
      gl.uniform1f(U("iGlass"), glass ? 1 : 0);
      gl.uniform1f(U("iGloss"), 0);
      gl.uniform3fv(U("iBalls"), balls);
      // solid — the identity every consumer must upload (unset reads 0, which
      // multiplies the ball field away entirely)
      gl.uniform1fv(U("iBallDensity"), new Float32Array(balls.length / 3).fill(1));
      gl.uniform1i(U("iBallCount"), count);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const px = new Uint8Array(size * size * 4);
      gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    };

    const at = (px, x, y) => {
      const i = (y * size + x) * 4;
      return [px[i], px[i + 1], px[i + 2], px[i + 3]];
    };

    const tiny = render({ form: false, glass: false, ball: [0.5, 0.5, 0.014] });
    const tinyCenter = at(tiny, size / 2, size / 2);

    const formOnly = render({ form: true, glass: true, ball: null });
    const buried = render({ form: true, glass: true, ball: [0.255, 0.5, 0.045] });
    let sum = 0;
    let n = 0;
    for (let y = 112; y < 144; y++) {
      for (let x = 60; x < 78; x++) {
        const i = (y * size + x) * 4;
        for (let c = 0; c < 3; c++) {
          const d = buried[i + c] - formOnly[i + c];
          sum += d * d;
          n++;
        }
      }
    }
    const buriedRms = Math.sqrt(sum / Math.max(n, 1));

    return { tinyCenter, buriedRms };
  },
  {
    frag: SDF_GLASS_FRAG,
    vert: SDF_GLASS_VERT,
    size: SIZE,
    maxBalls: SDF_BALL_MAX,
    sdfRes: SDF_RES,
    thick: SDF_THICK,
  },
);

await browser.close();

const failures = [];
if (result.tinyCenter[3] < 180) {
  failures.push(
    `tiny droplet center alpha ${result.tinyCenter[3]} < 180 (black center/cutout risk)`,
  );
}
if (result.buriedRms > 7) {
  failures.push(
    `buried droplet changed form surface RMS ${result.buriedRms.toFixed(2)} > 7 (inner-ball emboss risk)`,
  );
}

console.log("LIQUID_GLITCH_CHECK " + JSON.stringify(result));
if (failures.length) {
  console.error("FAIL " + failures.join("; "));
  process.exit(1);
}
