# hsm.ts

Standalone TypeScript implementation of the HSM DSL and runtime.

This package ships a native TypeScript runtime with richer compile-time types. The current build focuses on:

<!-- public TypeScript package capabilities and canonical APIs from src/hsm.ts and ../dsl.md -->

- standard TypeScript source for both the DSL and runtime
- modern package outputs via `tsup`
- PascalCase DSL/runtime exports with camelCase compatibility aliases
- `Define` / `Redefine` model construction
- `Validator` / `Finalizer` hooks for definition-time model checks and finalization
- `SubmachineState`, `EntryPoint`, `ExitPoint`, `ShallowHistory`, and `DeepHistory`
- top-level `Attribute` / `Operation` namespaces with `OnSet`, `When`, and `OnCall` events
- `Observe` hooks for redefining a model with observation behavior
- `New`, `Start`, `Started`, `Stop`, and `Restart` lifecycle helpers
- `Dispatch`, `DispatchAll`, `DispatchTo`, `MakeGroup`, and ordered group snapshots
- attribute-aware `sm.get("name")` value/found reads, `sm.set("name", value)`, and Promise-returning `sm.call("name")`

## Development

```sh
npm install
npm run typecheck
npm run test
npm run conformance
npm run build
```

## Example

```ts
import * as hsm from "@stateforward/hsm.ts";

class Counter extends hsm.Instance {}

const model = hsm.define(
  "Counter",
  hsm.Attribute("count", 0),
  hsm.State("idle"),
  hsm.Initial(hsm.Target("idle")),
);

const machine = hsm.start(new Counter(), model);

const [count] = machine.get("count"); // number
machine.set("count", count + 1);
```
