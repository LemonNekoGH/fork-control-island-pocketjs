import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(import.meta.dir, "..");
const frameworkRoot = resolve(
  dirname(new URL(import.meta.resolve("@pocketjs/framework")).pathname),
  "..",
);
const hostRoot = resolve(frameworkRoot, "host-web");
const outputRoot = resolve(projectRoot, "site");
const outputDist = resolve(outputRoot, "dist");
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
run(["bun", "run", "compile"]);

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputDist, { recursive: true });

const files = [
  [resolve(projectRoot, "web/index.html"), resolve(outputRoot, "index.html")],
  [resolve(hostRoot, "engine.js"), resolve(outputRoot, "engine.js")],
  [resolve(hostRoot, "wasm-ops.js"), resolve(outputRoot, "wasm-ops.js")],
  [resolve(hostRoot, "hud.js"), resolve(outputRoot, "hud.js")],
  [resolve(hostRoot, "pocketjs.wasm"), resolve(outputRoot, "pocketjs.wasm")],
  [resolve(projectRoot, `dist/${appName}.js`), resolve(outputDist, `${appName}.js`)],
  [resolve(projectRoot, `dist/${appName}.pak`), resolve(outputDist, `${appName}.pak`)],
] as const;

for (const [source, destination] of files) {
  if (!existsSync(source)) throw new Error(`Missing GitHub Pages input: ${source}`);
  copyFileSync(source, destination);
}

writeFileSync(resolve(outputRoot, ".nojekyll"), "");
console.log(`GitHub Pages site staged at ${outputRoot}`);
