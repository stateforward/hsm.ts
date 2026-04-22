# hsm.ts

Standalone TypeScript implementation of the HSM DSL and runtime.

This package ships a native TypeScript runtime with richer compile-time types. The current build focuses on:

- standard TypeScript source for both the DSL and runtime
- modern package outputs via `tsup`
- PascalCase DSL/runtime exports with camelCase compatibility aliases
- attribute-aware `sm.get("name")` and `sm.set("name", value)` typing on the returned machine

## Development

```sh
npm install
npm run typecheck
npm run test
npm run build
```

## Example

```ts
import * as hsm from "@stateforward/hsm.ts";

class Counter extends hsm.Instance {}

const model = hsm.define(
  "Counter",
  hsm.attribute("count", 0),
  hsm.state("idle"),
  hsm.initial(hsm.target("idle")),
);

const machine = hsm.start(new Counter(), model);

const count = machine.get("count"); // number
machine.set("count", count + 1);
```
