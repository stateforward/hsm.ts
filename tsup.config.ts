import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts"],
  external: ["@stateforward/hsm"],
  format: ["esm", "cjs"],
  sourcemap: true,
  target: "es2022",
});

