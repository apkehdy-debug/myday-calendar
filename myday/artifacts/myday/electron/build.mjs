import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(directory, "../dist-electron");

await build({
  entryPoints: [path.join(directory, "main.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: path.join(output, "main.mjs"),
  external: ["electron"],
  sourcemap: true,
});

await build({
  entryPoints: [path.join(directory, "preload.ts")],
  bundle: true,
  platform: "browser",
  format: "cjs",
  outfile: path.join(output, "preload.cjs"),
  external: ["electron"],
  sourcemap: true,
});