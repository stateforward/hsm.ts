import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts", "src/kind.ts", "src/muid.ts"],
  format: ["esm", "cjs"],
  sourcemap: true,
  target: "es2022",
});
