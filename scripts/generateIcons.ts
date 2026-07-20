import { readdirSync, unlinkSync } from "node:fs";
import { basename, resolve } from "node:path";

const projectRoot = resolve(import.meta.dir, "..");
const assetsRoot = resolve(projectRoot, "assets");

async function rasterize(source: string, destination: string): Promise<void> {
  const child = Bun.spawn(["magick", "-background", "none", source, "-resize", "32x32", "-depth", "8", `PNG32:${destination}`], {
    cwd: projectRoot,
    stdout: "inherit",
    stderr: "inherit",
  });
  const status = await child.exited;
  if (status !== 0) throw new Error(`ImageMagick failed for ${basename(source)}`);
}

/**
 * Generates deterministic light and dark raster variants for PocketJS's baked image pipeline.
 * SVG remains the editable source because PocketJS cannot tint an image at runtime.
 */
async function generateIcons(): Promise<void> {
  for (const file of readdirSync(assetsRoot).filter((entry) => entry.endsWith(".svg")).sort()) {
    const name = file.slice(0, -4);
    const source = resolve(assetsRoot, file);
    const temporaryLightSource = resolve(assetsRoot, `.${name}-light.svg`);
    const lightSvg = (await Bun.file(source).text())
      .replaceAll("#cbd5e1", "#334155")
      .replaceAll("#67e8f9", "#0891b2")
      .replaceAll("#fda4af", "#e11d48")
      .replaceAll("#64748b", "#334155");

    await rasterize(source, resolve(assetsRoot, `${name}-dark.png`));
    await Bun.write(temporaryLightSource, lightSvg);
    try {
      await rasterize(temporaryLightSource, resolve(assetsRoot, `${name}-light.png`));
    }
    finally {
      unlinkSync(temporaryLightSource);
    }
  }
}

await generateIcons();
