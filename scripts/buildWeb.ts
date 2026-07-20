import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(import.meta.dir, "..");
const frameworkRoot = resolve(
  dirname(new URL(import.meta.resolve("@pocketjs/framework")).pathname),
  "..",
);
const hostRoot = resolve(frameworkRoot, "host-web");
const outputRoot = resolve(projectRoot, "site");
const appName = "control-island-main";

function run(args: string[]): void {
  const child = Bun.spawnSync(args, {
    cwd: projectRoot,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (child.exitCode !== 0) process.exit(child.exitCode ?? 1);
}

run(["bun", resolve(frameworkRoot, "scripts/wasm.ts")]);
run(["bun", "run", "compile:web"]);

const indexTemplatePath = resolve(projectRoot, "web/index.html");
const versionInputs = [
  indexTemplatePath,
  resolve(hostRoot, "engine.js"),
  resolve(hostRoot, "wasm-ops.js"),
  resolve(hostRoot, "hud.js"),
  resolve(hostRoot, "pocketjs.wasm"),
  resolve(projectRoot, `dist/${appName}.js`),
  resolve(projectRoot, `dist/${appName}.pak`),
];
const versionHash = createHash("sha256");
for (const input of versionInputs) {
  if (!existsSync(input)) throw new Error(`Missing GitHub Pages input: ${input}`);
  versionHash.update(readFileSync(input));
}
const assetVersion = versionHash.digest("hex").slice(0, 12);
const versionRoot = resolve(outputRoot, "assets", assetVersion);
const outputDist = resolve(versionRoot, "dist");

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputDist, { recursive: true });

const files = [
  [resolve(hostRoot, "engine.js"), resolve(versionRoot, "engine.js")],
  [resolve(hostRoot, "wasm-ops.js"), resolve(versionRoot, "wasm-ops.js")],
  [resolve(hostRoot, "hud.js"), resolve(versionRoot, "hud.js")],
  [resolve(hostRoot, "pocketjs.wasm"), resolve(versionRoot, "pocketjs.wasm")],
  [resolve(projectRoot, `dist/${appName}.js`), resolve(outputDist, `${appName}.js`)],
  [resolve(projectRoot, `dist/${appName}.pak`), resolve(outputDist, `${appName}.pak`)],
] as const;

for (const [source, destination] of files) {
  if (!existsSync(source)) throw new Error(`Missing GitHub Pages input: ${source}`);
  copyFileSync(source, destination);
}

const indexTemplate = readFileSync(indexTemplatePath, "utf8");
if (!indexTemplate.includes("__ASSET_VERSION__")) {
  throw new Error("GitHub Pages index is missing the __ASSET_VERSION__ placeholder");
}
writeFileSync(
  resolve(outputRoot, "index.html"),
  indexTemplate.replaceAll("__ASSET_VERSION__", assetVersion),
);
writeFileSync(resolve(outputRoot, ".nojekyll"), "");
console.log(`GitHub Pages site staged at ${outputRoot} (assets/${assetVersion})`);
