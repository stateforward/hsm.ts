import { performance } from "node:perf_hooks";

import * as tsMuid from "../src/muid.ts";

type Result = {
  label: string;
  medianMs: number;
  opsPerSec: number;
  samplesMs: number[];
};

const rounds = 7;
const iterations = 200_000;
const warmup = 50_000;

const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

const benchmark = (label: string, fn: () => void): Result => {
  for (let index = 0; index < warmup; index += 1) {
    fn();
  }

  const samplesMs: number[] = [];
  for (let round = 0; round < rounds; round += 1) {
    const start = performance.now();
    for (let index = 0; index < iterations; index += 1) {
      fn();
    }
    samplesMs.push(performance.now() - start);
  }

  const medianMs = median(samplesMs);
  return {
    label,
    medianMs,
    opsPerSec: iterations / (medianMs / 1000),
    samplesMs,
  };
};

const printResult = (result: Result) => {
  console.log(
    `${result.label}: median=${result.medianMs.toFixed(3)}ms ops/s=${result.opsPerSec.toFixed(0)} samples=[${result.samplesMs
      .map((sample) => sample.toFixed(3))
      .join(", ")}]`,
  );
};

const tsGenerator = new tsMuid.Generator(tsMuid.getDefaultConfig(), 0, 0);
const tsGeneratorResult = benchmark("ts Generator.id()", () => {
  tsGenerator.id();
});
const tsStringResult = benchmark("ts make().toString()", () => {
  tsMuid.make().toString();
});

printResult(tsGeneratorResult);
printResult(tsStringResult);
