# Control Island for PocketJS

A clean-room PocketJS 0.6 + Vue Vapor adaptation of AIRI's `stage-tamagotchi`
Control Island. It preserves the 40×40 control geometry,
three-button persistent rail, 3×3 expanded grid, account row, focus tooltips,
light/dark palettes, and 500/400ms drawer transforms of the current AIRI
component. PocketJS's cross-backend rendering contract does not expose
backdrop blur, so the translucent desktop glass is represented by
alpha-composited native surfaces, subtle border translucency, and a one-pixel
reflected highlight. This keeps the same contrast hierarchy across PocketJS
renderers without pretending an unsupported framebuffer blur exists.

The portable build supports both native virtual-cursor input and desktop mouse
input. Analog movement enables PocketJS cursor mode; the patched web host maps
physical pointer coordinates into the current canvas viewport and maps the
primary button to Circle. D-pad input exits cursor mode so focus navigation
remains deterministic. The eye control enables real cursor-hover stage fading,
and an expanded island collapses after the cursor stays outside it for 1.5
seconds. Hover fade uses a 250ms ease-out transition. Triangle remains the
explicit portable back action. Window actions
open visible host simulations instead of calling Electron IPC.

The Web renderer follows the browser canvas at arbitrary window sizes. The
portable component keeps its 40×40 control geometry while the surrounding
stage and expanded layout respond to the available viewport. Desktop-only
Electron actions are represented by deterministic portable surfaces: settings,
chat, profile, microphone controls, stage movement, and a host-intercepted close
request.

## Run

```sh
bun install
bun run icons
bun run typecheck
bun run check
bun run compile
bun run dev
```

ImageMagick 7 (`magick`) is required for icon generation and PNG capture.

Open the printed local URL. Arrow keys move focus; Enter or Z activates Circle;
S activates Triangle and closes the active surface or collapses the drawer.

## GitHub Pages

The repository publishes a static PocketJS Web build through GitHub Actions.
Before the first deployment, open the repository's **Settings → Pages** page
and select **GitHub Actions** as the build source. A push to `main` then builds
the patched WebAssembly renderer, compiles the Vue Vapor app, and deploys the
result to:

```text
https://lemonnekogh.github.io/fork-control-island-pocketjs/
```

Build and preview the same artifact locally with:

```sh
bun run build:web
bun run preview:web
```

The generated `site/` directory is disposable and is not committed.

## Deterministic visual QA

Run:

```sh
bun run capture
```

The command first rebuilds the bundle, then boots it in PocketJS's WebAssembly
renderer, replays native
button masks, and writes collapsed, expanded, focused, light-theme, hearing,
account, stage-movement, cursor-hover fade, and outside-hover auto-collapse
PNGs to the system temporary directory. It also builds the WebAssembly host on
first use when necessary and fails when PocketJS reports a runtime class or
renderer error. Pixel assertions verify the fade's intermediate and final
states, plus collapse while the pointer keeps moving outside the island. The
harness also installs browser-shaped Text and Comment anchors, then re-enters
all three rail tooltips to exercise Vue Vapor teardown and PocketJS sweeping.

## Implementation notes

- `app.tsx` contains the native Vue Vapor component and state machines.
- `assets/*.svg` are editable original vectors; `bun run icons` produces the
  light and dark PNG textures consumed by PocketJS's baked asset pipeline.
- `scripts/prepareFramework.ts` supplies the package-local Vue path expected by
  the published PocketJS 0.6 compiler and applies the narrowly scoped framework
  patches during installation.
- `patches/pocketjs-0.6.0-browser-runtime.patch` applies host pointer input,
  Vue Vapor tree guards, the responsive viewport renderer, and static-host
  options as one clean patch against the published PocketJS 0.6.0 package. It
  does not fork or vendor PocketJS.
- `scripts/buildWeb.ts` assembles real files for the Pages artifact without
  publishing `node_modules` symlinks or the Bun development server.
- `scripts/captureStates.ts` is the native-size visual and interaction harness.

The architecture follows PocketJS's official
[getting-started guide](https://pocketjs.dev/docs/getting-started/) and
[upstream repository](https://github.com/pocket-stack/pocketjs). AIRI source
attribution and asset provenance are recorded in `THIRD_PARTY_NOTICES.md`.
