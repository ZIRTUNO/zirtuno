// Read-only source/import and asset inventory. Reachability is evidence for
// review, not permission to delete: tooling, routes and references also count.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../../", import.meta.url));
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true })
  .flatMap((e) => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
const configRoots = fs.readdirSync(root).filter((f) => /\.(?:ts|mjs)$/.test(f) && !f.endsWith(".d.ts"));
const files = [...["app", "components", "lib", "scripts"].flatMap(walk), ...configRoots]
  .filter((f) => /\.(?:[cm]?[jt]sx?)$/.test(f) && !/\.d\.[cm]?ts$/.test(f));
const available = new Set(files);
const resolve = (file, spec) => {
  if (!spec.startsWith(".") && !spec.startsWith("@/")) return null;
  const base = spec.startsWith("@/") ? spec.slice(2)
    : path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
  return [base, ...[".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"].map((e) => base + e)]
    .find((f) => available.has(f));
};
const imports = new Map();
const packages = new Set();
for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), "utf8"), ts.ScriptTarget.Latest, true);
  const edges = [];
  function visit(node) {
    let spec;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) spec = node.moduleSpecifier.text;
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) spec = node.arguments[0].text;
    if (spec) {
      const target = resolve(file, spec);
      if (target) edges.push(target);
      else if (!spec.startsWith(".") && !spec.startsWith("@/") && !spec.startsWith("node:")) packages.add(spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  imports.set(file, edges);
}
const reachable = (roots) => {
  const seen = new Set();
  const visit = (file) => { if (seen.has(file)) return; seen.add(file); for (const next of imports.get(file) ?? []) visit(next); };
  roots.forEach(visit);
  return seen;
};
const appRoots = files.filter((f) => f.startsWith("app/") && /\/(?:page|layout|template|route|not-found|error|global-error|sitemap|robots|opengraph-image|icon)\.[jt]sx?$/.test(f));
// Framework configuration imports request.ts outside the app entry graph.
appRoots.push("lib/i18n/request.ts", ...configRoots);
const app = reachable(appRoots);
const all = reachable([...appRoots, ...files.filter((f) => f.startsWith("scripts/"))]);
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
console.log(JSON.stringify({
  modules: files.length, roots: appRoots.length, appReachable: app.size,
  toolingOnly: files.filter((f) => !f.startsWith("scripts/") && !app.has(f) && all.has(f)),
  unreferenced: files.filter((f) => !f.startsWith("scripts/") && !all.has(f)),
  dependenciesWithoutSourceImports: Object.keys(pkg.dependencies).filter((p) => !packages.has(p)),
  assets: walk("public").map((file) => ({ file, bytes: fs.statSync(path.join(root, file)).size })).sort((a, b) => b.bytes - a.bytes),
}, null, 2));
