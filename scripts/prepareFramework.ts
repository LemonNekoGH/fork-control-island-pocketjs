import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(import.meta.dir, "..");
const frameworkRoot = resolve(dirname(new URL(import.meta.resolve("@pocketjs/framework")).pathname), "..");
const expectedVuePath = resolve(frameworkRoot, "node_modules/vue");
const browserRuntimePatch = resolve(projectRoot, "patches/pocketjs-0.6.0-browser-runtime.patch");

function applyPatch(patchPath: string, description: string): void {
  const child = Bun.spawnSync(["patch", "-p1", "--forward", "--batch", "-i", patchPath], {
    cwd: frameworkRoot,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (child.exitCode !== 0) throw new Error(`Could not apply the PocketJS ${description} patch`);
}

async function applyBrowserRuntimePatch(): Promise<void> {
  const inputSource = resolve(frameworkRoot, "src/input.ts");
  const inputApiSource = resolve(frameworkRoot, "src/input-api.ts");
  const devtoolsSource = resolve(frameworkRoot, "src/devtools.ts");
  const nativeTreeSource = resolve(frameworkRoot, "src/native-tree.ts");
  const rasterSource = resolve(frameworkRoot, "core/src/raster.rs");
  const wasmSource = resolve(frameworkRoot, "wasm/src/lib.rs");
  const engineSource = resolve(frameworkRoot, "host-web/engine.js");
  const shellSource = resolve(frameworkRoot, "host-web/index.html");
  const vaporSource = resolve(frameworkRoot, "src/index-vue-vapor.ts");
  const patchApplied = async () => {
    const engine = await Bun.file(engineSource).text();
    return (await Bun.file(inputSource).text()).includes("export function setCursorPosition")
      && (await Bun.file(inputApiSource).text()).includes("setCursorPosition,")
      && (await Bun.file(devtoolsSource).text()).includes('typeof child.id !== "number"')
      && (await Bun.file(nativeTreeSource).text()).includes("if (!isNativeNode(node)) return false;")
      && (await Bun.file(rasterSource).text()).includes("pub fn render_viewport_scaled")
      && (await Bun.file(wasmSource).text()).includes("pub extern \"C\" fn ui_set_viewport")
      && engine.includes("function forwardPointer")
      && engine.includes("let pointerPressed = 0")
      && engine.includes("new ResizeObserver(resizeCanvas)")
      && engine.includes("wasm.renderScaled(renderScale)")
      && engine.includes("window.devicePixelRatio")
      && engine.includes("wasm.init(rasterDensity)")
      && engine.includes('new URL("pocketjs.wasm", import.meta.url)')
      && engine.includes("let hudEnabled = true;")
      && engine.includes("hudEnabled = opts.hud !== false;")
      && engine.includes("if (opts.devtools !== false) connectDevtools();")
      && (await Bun.file(shellSource).text()).includes("width: 100vw")
      && !(await Bun.file(shellSource).text()).includes("data-btn")
      && (await Bun.file(vaporSource).text()).includes("__subscribeViewport")
      && (await Bun.file(inputSource).text()).includes("const viewportWidth = vp ? vp.w : SCREEN_W");
  };
  if (await patchApplied()) return;

  applyPatch(browserRuntimePatch, "browser runtime");
  if (!await patchApplied()) throw new Error("PocketJS browser runtime patch verification failed");
}

function linkFrameworkVueRuntime(): void {
  if (existsSync(expectedVuePath)) return;
  mkdirSync(dirname(expectedVuePath), { recursive: true });

  // PocketJS 0.6.0 resolves Vue from this package-local fixed path.
  symlinkSync(resolve(projectRoot, "node_modules/vue"), expectedVuePath, "junction");
}

linkFrameworkVueRuntime();
await applyBrowserRuntimePatch();
