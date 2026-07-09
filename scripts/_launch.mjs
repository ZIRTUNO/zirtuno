// Shared Playwright launch options: prefer the system browser (survives
// playwright version bumps without a `playwright install`). Import as:
//   import { LAUNCH } from "./_launch.mjs";
//   const browser = await chromium.launch(LAUNCH);
import fs from "node:fs";

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const executablePath = chromeCandidates.find((c) => fs.existsSync(c));

export const LAUNCH = {
  headless: true,
  chromiumSandbox: false,
  ...(executablePath ? { executablePath } : {}),
};
