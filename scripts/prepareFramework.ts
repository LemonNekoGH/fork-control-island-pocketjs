import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(import.meta.dir, "..");
const frameworkRoot = resolve(dirname(new URL(import.meta.resolve("@pocketjs/framework")).pathname), "..");
const expectedVuePath = resolve(frameworkRoot, "node_modules/vue");
const cursorHostPatch = resolve(projectRoot, "patches/pocketjs-0.6.0-cursor-host.patch");
const devtoolsTreePatch = resolve(projectRoot, "patches/pocketjs-0.6.0-devtools-tree.patch");
const sweepTreePatch = resolve(projectRoot, "patches/pocketjs-0.6.0-sweep-tree.patch");
const serverHostPatch = resolve(projectRoot, "patches/pocketjs-0.6.0-server-host.patch");
const responsiveWebPatch = resolve(projectRoot, "patches/pocketjs-0.6.0-responsive-web.patch");

function applyPatch(patchPath: string, description: string): void {
  const child = Bun.spawnSync(["patch", "-p1", "--forward", "-i", patchPath], {
    cwd: frameworkRoot,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (child.exitCode !== 0) throw new Error(`Could not apply the PocketJS ${description} patch`);
}

async function applyCursorHostPatch(): Promise<void> {
  const inputSource = resolve(frameworkRoot, "src/input.ts");
  const inputApiSource = resolve(frameworkRoot, "src/input-api.ts");
  const engineSource = resolve(frameworkRoot, "host-web/engine.js");
  const patchApplied = async () => (
    (await Bun.file(inputSource).text()).includes("export function setCursorPosition")
    && (await Bun.file(inputApiSource).text()).includes("setCursorPosition,")
    && (await Bun.file(engineSource).text()).includes("function forwardPointer")
    && (await Bun.file(engineSource).text()).includes("let pointerPressed = 0")
  );
  if (await patchApplied()) return;

  applyPatch(cursorHostPatch, "cursor host");
  if (!await patchApplied()) throw new Error("PocketJS cursor host patch verification failed");
}

async function applyDevtoolsTreePatch(): Promise<void> {
  const devtoolsSource = resolve(frameworkRoot, "src/devtools.ts");
  const patchApplied = async () => (
    (await Bun.file(devtoolsSource).text()).includes('typeof child.id !== "number"')
  );
  if (await patchApplied()) return;

  applyPatch(devtoolsTreePatch, "DevTools tree");
  if (!await patchApplied()) throw new Error("PocketJS DevTools tree patch verification failed");
}

async function applySweepTreePatch(): Promise<void> {
  const nativeTreeSource = resolve(frameworkRoot, "src/native-tree.ts");
  const patchApplied = async () => (
    (await Bun.file(nativeTreeSource).text()).includes("if (!isNativeNode(node)) return false;")
  );
  if (await patchApplied()) return;

  applyPatch(sweepTreePatch, "sweep tree");
  if (!await patchApplied()) throw new Error("PocketJS sweep tree patch verification failed");
}

async function applyServerHostPatch(): Promise<void> {
  const serverSource = resolve(frameworkRoot, "host-web/server.ts");
  const patchApplied = async () => (
    (await Bun.file(serverSource).text()).includes('opts.hostname ?? process.env.HOST ?? "127.0.0.1"')
  );
  if (await patchApplied()) return;

  applyPatch(serverHostPatch, "server host");
  if (!await patchApplied()) throw new Error("PocketJS server host patch verification failed");
}

async function applyResponsiveWebPatch(): Promise<void> {
  const rasterSource = resolve(frameworkRoot, "core/src/raster.rs");
  const wasmSource = resolve(frameworkRoot, "wasm/src/lib.rs");
  const engineSource = resolve(frameworkRoot, "host-web/engine.js");
  const shellSource = resolve(frameworkRoot, "host-web/index.html");
  const vaporSource = resolve(frameworkRoot, "src/index-vue-vapor.ts");
  const inputSource = resolve(frameworkRoot, "src/input.ts");
  const patchApplied = async () => (
    (await Bun.file(rasterSource).text()).includes("pub fn render_viewport_scaled")
    && (await Bun.file(wasmSource).text()).includes("pub extern \"C\" fn ui_set_viewport")
    && (await Bun.file(engineSource).text()).includes("new ResizeObserver(resizeCanvas)")
    && (await Bun.file(shellSource).text()).includes("width: 100vw")
    && !(await Bun.file(shellSource).text()).includes("data-btn")
    && (await Bun.file(vaporSource).text()).includes("__subscribeViewport")
    && (await Bun.file(inputSource).text()).includes("const viewportWidth = vp ? vp.w : SCREEN_W")
  );
  if (await patchApplied()) return;

  applyPatch(responsiveWebPatch, "responsive Web viewport");
  if (!await patchApplied()) throw new Error("PocketJS responsive Web viewport patch verification failed");
}

function linkFrameworkVueRuntime(): void {
  if (existsSync(expectedVuePath)) return;
  mkdirSync(dirname(expectedVuePath), { recursive: true });

  // PocketJS 0.6.0 resolves Vue from this package-local fixed path.
  symlinkSync(resolve(projectRoot, "node_modules/vue"), expectedVuePath, "junction");
}

linkFrameworkVueRuntime();
await applyCursorHostPatch();
await applyDevtoolsTreePatch();
await applySweepTreePatch();
await applyServerHostPatch();
await applyResponsiveWebPatch();
