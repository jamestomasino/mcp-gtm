import { build } from "esbuild";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * esbuild bundler for mcp-gtm.
 * Produces a single self-contained dist/index.js that works with `node dist/index.js`.
 */
await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outdir: "dist",
  sourcemap: true,
  external: ["@modelcontextprotocol/sdk", "zod"],
  treeShaking: true,
  logLevel: "info",
});
