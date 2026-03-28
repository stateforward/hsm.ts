# hsm.ts

TypeScript-first wrapper library for [`@stateforward/hsm`](https://www.npmjs.com/package/@stateforward/hsm).

This package keeps the proven `hsm.js` runtime and exposes a modern TypeScript build with richer compile-time types. The initial setup focuses on:

- standard TypeScript source instead of JSDoc-authored declarations
- modern package outputs via `tsup`
- typed wrappers for `define`, `attribute`, `state`, `initial`, `transition`, `choice`, and `start`
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
