import { dirname, resolve } from "node:path";

const frameworkEntry = import.meta.resolve("@pocketjs/framework");
const frameworkRoot = resolve(dirname(new URL(frameworkEntry).pathname), "..");
const projectRoot = resolve(import.meta.dir, "..");

function run(args: string[]): void {
  const child = Bun.spawnSync(args, {
    cwd: projectRoot,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (child.exitCode !== 0) process.exit(child.exitCode ?? 1);
}

run(["bun", resolve(frameworkRoot, "scripts/wasm.ts")]);
run([
  "bun",
  resolve(frameworkRoot, "scripts/build.ts"),
  resolve(projectRoot, "main.tsx"),
  "--framework=vue-vapor",
  `--config=${resolve(projectRoot, "pocket.config.ts")}`,
  `--outdir=${resolve(frameworkRoot, "dist")}`,
]);

await import(resolve(frameworkRoot, "host-web/serve.ts"));
