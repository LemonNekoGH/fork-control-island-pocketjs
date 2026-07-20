import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(import.meta.dir, "..");
const frameworkRoot = resolve(dirname(new URL(import.meta.resolve("@pocketjs/framework")).pathname), "..");
const outputRoot = resolve(process.argv[2] ?? tmpdir(), "control-island-qa");
const bundlePath = resolve(projectRoot, "dist/control-island-main.js");
const pakPath = resolve(projectRoot, "dist/control-island-main.pak");
const wasmPath = resolve(frameworkRoot, "host-web/pocketjs.wasm");
const runtimeErrors: string[] = [];
const reportConsoleError = console.error;

console.error = (...values: unknown[]) => {
  runtimeErrors.push(values.map((value) => String(value)).join(" "));
  reportConsoleError(...values);
};

const BUTTON = {
  circle: 0x2000,
  down: 0x0040,
  left: 0x0080,
  triangle: 0x1000,
  up: 0x0010,
} as const;

interface RuntimeFrame {
  frame(buttons: number): void;
  render(): Uint8Array;
  tick(): void;
}

interface PointerGlobals {
  __pocketPointerMove?: (x: number, y: number) => void;
}

class BrowserLikeNode {
  parentNode: BrowserLikeNode | null = null;
  nextSibling: BrowserLikeNode | null = null;
}

class BrowserLikeElement extends BrowserLikeNode {}

class BrowserLikeText extends BrowserLikeNode {
  readonly nodeType = 3;

  constructor(public data = "") {
    super();
  }
}

class BrowserLikeComment extends BrowserLikeNode {
  readonly nodeType = 8;

  constructor(public data = "") {
    super();
  }
}

function installBrowserLikeDocument(): void {
  const runtimeGlobals = globalThis as Record<string, unknown>;
  runtimeGlobals.Node = BrowserLikeNode;
  runtimeGlobals.Element = BrowserLikeElement;
  runtimeGlobals.HTMLElement = BrowserLikeElement;
  runtimeGlobals.Text = BrowserLikeText;
  runtimeGlobals.Comment = BrowserLikeComment;
  runtimeGlobals.window = globalThis;
  runtimeGlobals.document = {
    createElement() { return new BrowserLikeElement(); },
    createElementNS() { return new BrowserLikeElement(); },
    createTextNode(value = "") { return new BrowserLikeText(value); },
    createComment(value = "") { return new BrowserLikeComment(value); },
    querySelector() { return null; },
    addEventListener() {},
    removeEventListener() {},
  };
}

installBrowserLikeDocument();

async function boot(): Promise<RuntimeFrame> {
  if (!existsSync(bundlePath) || !existsSync(pakPath)) {
    throw new Error("Run `bun run compile` before capturing states");
  }

  if (!existsSync(wasmPath)) {
    const child = Bun.spawn(["bun", resolve(frameworkRoot, "scripts/wasm.ts")], {
      cwd: projectRoot,
      stdout: "inherit",
      stderr: "inherit",
    });
    const status = await child.exited;
    if (status !== 0 || !existsSync(wasmPath)) {
      throw new Error("Could not build the PocketJS WebAssembly host");
    }
  }

  const { createWasmUi } = await import(resolve(frameworkRoot, "host-web/wasm-ops.js"));
  const wasm = await createWasmUi(await Bun.file(wasmPath).arrayBuffer());
  const runtimeGlobals = globalThis as Record<string, unknown>;
  runtimeGlobals.ui = wasm.ops;
  runtimeGlobals.__pak = await Bun.file(pakPath).arrayBuffer();
  runtimeGlobals.frame = undefined;
  runtimeGlobals.__pocketApp = "control-island-main";
  runtimeGlobals.__pocketDevtoolsTransport = {
    send() {},
    recv() { return null; },
  };
  globalThis.eval(await Bun.file(bundlePath).text());

  const frame = runtimeGlobals.frame;
  if (typeof frame !== "function") throw new Error("PocketJS bundle did not install its frame callback");

  return {
    frame: frame as (buttons: number) => void,
    render: wasm.render,
    tick: wasm.tick,
  };
}

async function capture(runtime: RuntimeFrame, name: string): Promise<Uint8Array> {
  mkdirSync(outputRoot, { recursive: true });
  const rawPath = resolve(outputRoot, `${name}.rgba`);
  const imagePath = resolve(outputRoot, `${name}.png`);
  const frame = runtime.render().slice();
  await Bun.write(rawPath, frame);

  // PocketJS returns a tightly packed 480x272 RGBA buffer; ImageMagick only wraps it in PNG.
  const child = Bun.spawn([
    "magick",
    "-size",
    "480x272",
    "-depth",
    "8",
    `rgba:${rawPath}`,
    `PNG32:${imagePath}`,
  ], { stdout: "inherit", stderr: "inherit" });
  const status = await child.exited;
  unlinkSync(rawPath);
  if (status !== 0) throw new Error(`Could not encode ${name}.png`);
  console.log(imagePath);
  return frame;
}

function pixel(frame: Uint8Array, x: number, y: number): [number, number, number] {
  const offset = (y * 480 + x) * 4;
  return [frame[offset], frame[offset + 1], frame[offset + 2]];
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

async function advance(runtime: RuntimeFrame, buttons: number, frames = 1): Promise<void> {
  for (let index = 0; index < frames; index++) {
    runtime.frame(buttons);
    runtime.tick();
    await Promise.resolve();
  }
}

async function pulse(runtime: RuntimeFrame, buttons: number, settleFrames = 2): Promise<void> {
  await advance(runtime, buttons);
  await advance(runtime, 0, settleFrames);
}

async function advancePointer(runtime: RuntimeFrame, x: number, y: number, frames: number): Promise<void> {
  const pointerGlobals = globalThis as PointerGlobals;
  if (!pointerGlobals.__pocketPointerMove) throw new Error("PocketJS pointer bridge is unavailable");
  for (let index = 0; index < frames; index++) {
    pointerGlobals.__pocketPointerMove(x + index % 2, y);
    await advance(runtime, 0);
  }
}

const runtime = await boot();
await advance(runtime, 0, 4);
await capture(runtime, "01-collapsed");

await pulse(runtime, BUTTON.down, 3);
await capture(runtime, "02-focused");

await pulse(runtime, BUTTON.circle, 34);
const expandedFrame = await capture(runtime, "03-expanded");

await pulse(runtime, BUTTON.left);
await capture(runtime, "04-drawer-focus");

await pulse(runtime, BUTTON.circle, 4);
await capture(runtime, "05-drawer-action");

await pulse(runtime, BUTTON.triangle);
await pulse(runtime, BUTTON.triangle, 28);
await pulse(runtime, BUTTON.down);
await pulse(runtime, BUTTON.down);
await pulse(runtime, BUTTON.circle, 20);
await capture(runtime, "06-stage-moved");

const themeRuntime = await boot();
await advance(themeRuntime, 0, 4);
await pulse(themeRuntime, BUTTON.down);
await pulse(themeRuntime, BUTTON.circle, 34);
await pulse(themeRuntime, BUTTON.left);
await pulse(themeRuntime, BUTTON.up);
await pulse(themeRuntime, BUTTON.up);
await pulse(themeRuntime, BUTTON.up);
await pulse(themeRuntime, BUTTON.circle, 4);
await capture(themeRuntime, "07-light-theme");

const hearingRuntime = await boot();
await advance(hearingRuntime, 0, 4);
await pulse(hearingRuntime, BUTTON.down);
await pulse(hearingRuntime, BUTTON.down);
await pulse(hearingRuntime, BUTTON.circle, 8);
await capture(hearingRuntime, "08-hearing-overlay");

const accountRuntime = await boot();
await advance(accountRuntime, 0, 4);
await pulse(accountRuntime, BUTTON.down);
await pulse(accountRuntime, BUTTON.circle, 34);
await pulse(accountRuntime, BUTTON.left);
for (let index = 0; index < 9; index++) await pulse(accountRuntime, BUTTON.up);
await pulse(accountRuntime, BUTTON.circle, 52);
await pulse(accountRuntime, BUTTON.circle, 4);
await capture(accountRuntime, "09-account-overlay");

const hoverRuntime = await boot();
await advance(hoverRuntime, 0, 4);
await pulse(hoverRuntime, BUTTON.down);
await pulse(hoverRuntime, BUTTON.circle, 34);
await pulse(hoverRuntime, BUTTON.left);
await pulse(hoverRuntime, BUTTON.up);
await pulse(hoverRuntime, BUTTON.circle, 4);

await advancePointer(hoverRuntime, 196, 150, 4);
const hoverMidFrame = hoverRuntime.render().slice();
await advancePointer(hoverRuntime, 196, 150, 16);
const hoverFrame = await capture(hoverRuntime, "10-hover-fade");

await advancePointer(hoverRuntime, 196, 150, 100);
const autoCollapsedFrame = await capture(hoverRuntime, "11-hover-auto-collapsed");

const tooltipRuntime = await boot();
await advance(tooltipRuntime, 0, 4);
const tooltipTargets = [
  { name: "12-collapse-tooltip-rehover", y: 156 },
  { name: "13-hearing-tooltip-rehover", y: 200 },
  { name: "14-move-tooltip-rehover", y: 244 },
];
for (const target of tooltipTargets) {
  await advancePointer(tooltipRuntime, 452, target.y, 3);
  await advancePointer(tooltipRuntime, 400, 100, 3);
  await advancePointer(tooltipRuntime, 452, target.y, 3);
  await capture(tooltipRuntime, target.name);
  await advancePointer(tooltipRuntime, 400, 100, 3);
}

const expandedStagePixel = pixel(expandedFrame, 196, 150);
const hoverMidStagePixel = pixel(hoverMidFrame, 196, 150);
const hoverStagePixel = pixel(hoverFrame, 196, 150);
if (colorDistance(expandedStagePixel, hoverMidStagePixel) < 5) {
  throw new Error(`Hover fade regression: the opacity transition did not start (${expandedStagePixel} -> ${hoverMidStagePixel})`);
}
if (colorDistance(hoverMidStagePixel, hoverStagePixel) < 5) {
  throw new Error(`Hover fade regression: the opacity transition did not finish smoothly (${hoverMidStagePixel} -> ${hoverStagePixel})`);
}
if (colorDistance(expandedStagePixel, hoverStagePixel) < 40) {
  throw new Error("Hover fade regression: the stage character did not fade");
}
if (colorDistance(pixel(hoverFrame, 300, 100), pixel(autoCollapsedFrame, 300, 100)) < 40) {
  throw new Error("Outside-hover regression: the expanded drawer did not collapse");
}

if (runtimeErrors.length > 0) {
  throw new Error(`PocketJS reported ${runtimeErrors.length} runtime error(s)`);
}
