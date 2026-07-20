# Control Island for PocketJS

A clean-room PocketJS 0.6 + Vue Vapor adaptation of AIRI's `stage-tamagotchi`
Control Island. It preserves the 40×40 control geometry,
three-button persistent rail, 3×3 expanded grid, account row, focus tooltips,
light/dark palettes, and 500/400ms drawer transforms of the current AIRI
component. PocketJS's cross-backend rendering contract does not expose
backdrop blur, so the translucent desktop glass is represented by
alpha-composited native surfaces, subtle border translucency, and a one-pixel
reflected highlight. This keeps the same
contrast hierarchy on the WebAssembly and PSP renderers without pretending an
unsupported framebuffer blur exists.

The portable build supports both native virtual-cursor input and desktop mouse
input. Analog movement enables PocketJS cursor mode; the patched web host maps
physical pointer coordinates into the logical 480×272 viewport and maps the
primary button to Circle. D-pad input exits cursor mode so focus navigation
remains deterministic. The eye control enables real cursor-hover stage fading,
and an expanded island collapses after the cursor stays outside it for 1.5
seconds. Hover fade uses a 250ms ease-out transition. Triangle remains the
explicit portable back action. Window actions
open visible host simulations instead of calling Electron IPC.

The app renders at PocketJS's native PSP-sized 480×272 viewport. Because the
desktop component's full vertical layout is taller than that viewport, the
expanded drawer opens immediately to the left of the persistent rail. The
desktop-only Electron actions are represented by deterministic portable
surfaces: settings, chat, profile, microphone controls, stage movement, and a
host-intercepted close request.

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
- `patches/pocketjs-0.6.0-cursor-host.patch` adds host-positioned virtual cursor
  input and physical-pointer forwarding.
- `patches/pocketjs-0.6.0-devtools-tree.patch` adds a defensive DevTools tree
  boundary for browser-native Vapor anchors.
- `patches/pocketjs-0.6.0-sweep-tree.patch` prevents those foreign anchors from
  entering native-node retention and destruction traversal. The patches do not
  fork or vendor PocketJS.
- `patches/pocketjs-0.6.0-server-host.patch` makes the development server host
  configurable so cloud preview proxies can reach it.
- `scripts/captureStates.ts` is the native-size visual and interaction harness.

## CodeSandbox

Import the repository into a CodeSandbox Devbox. Its Dev Container installs
[mise](https://mise.jdx.dev/), which then installs the pinned Bun and Rust
toolchains from `.mise.toml`. CodeSandbox setup tasks install packages, apply
the PocketJS patches, build the WebAssembly host once, and validate the project.
The `PocketJS Playground` task then starts an externally reachable preview on
port 8130.

After publishing the repository to GitHub, either use CodeSandbox's **Import
Repository** action or open
`https://codesandbox.io/p/github/<owner>/<repository>`. Wait for the setup tasks
to finish, then share the preview created by `PocketJS Playground`. CodeSandbox
documents both [GitHub repository imports](https://codesandbox.io/blog/get-started-with-hacktoberfest)
and [Dev Container support](https://codesandbox.io/blog/introducing-dev-container-support-in-codesandbox).

Use `HOST=0.0.0.0 PORT=8130 bun run dev:codesandbox` manually if the automatic
task is stopped. The regular `bun run dev` command rebuilds the WebAssembly host
for local framework development. CodeSandbox startup reuses the setup-built
host; run `bun run wasm` there only when rebuilding that host is intentional.

The architecture follows PocketJS's official
[getting-started guide](https://pocketjs.dev/docs/getting-started/) and
[upstream repository](https://github.com/pocket-stack/pocketjs). AIRI source
attribution and asset provenance are recorded in `THIRD_PARTY_NOTICES.md`.
