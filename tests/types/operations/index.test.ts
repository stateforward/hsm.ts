import * as hsm from "../../../src/index.js";

class CounterInstance extends hsm.Instance {}

const model = hsm.define(
  "Ops",
  hsm.operation("sum", (left: number, right: number) => left + right),
  hsm.operation("format", (value: number) => `#${value}`),
  hsm.operation("save", () => undefined),
  hsm.operation("canSave", () => true),
  hsm.state(
    "idle",
    hsm.entry("save"),
    hsm.exit("save"),
    hsm.activity("save"),
    hsm.transition(
      hsm.onCall("save"),
      hsm.guard("canSave"),
      hsm.effect("save"),
      hsm.target("."),
    ),
  ),
  hsm.initial(hsm.target("idle")),
);

const started = hsm.start(new CounterInstance(), model);
const startedCounter: CounterInstance = started;

const sum: number = started.call("sum", 1, 2);
const format: string = started.call("format", 2);
const missing: unknown = started.call("missing", 1);

const operations = null as any as hsm.OperationsOf<typeof model>;
const operationKeys: hsm.OperationKeysOf<typeof model> =
  null as any as "canSave" | "format" | "save" | "sum";
const callableOperationKeys: hsm.CallableOperationKeysOf<typeof model> =
  null as any as "canSave" | "format" | "save" | "sum";
const guardOperationKeys: hsm.GuardOperationKeysOf<typeof model> =
  null as any as "canSave";
const formatOperation: (value: number) => string = operations.format;
const sumOperation: (left: number, right: number) => number = operations.sum;

// @ts-expect-error onSet keys are restricted to model attributes
hsm.define(
  "BadOnSet",
  hsm.state("idle", hsm.transition(hsm.onSet("missing"), hsm.target("."))),
  hsm.initial(hsm.target("idle")),
);

// @ts-expect-error when(string) keys are restricted to model attributes
hsm.define(
  "BadWhen",
  hsm.state("idle", hsm.transition(hsm.when("missing"), hsm.target("."))),
  hsm.initial(hsm.target("idle")),
);

// @ts-expect-error onCall keys are restricted to model operations
hsm.define(
  "BadOnCall",
  hsm.state("idle", hsm.transition(hsm.onCall("missing"), hsm.target("."))),
  hsm.initial(hsm.target("idle")),
);

// @ts-expect-error effect(string) keys are restricted to callable model operations
hsm.define(
  "BadEffect",
  hsm.operation("save", () => undefined),
  hsm.state(
    "idle",
    hsm.transition(hsm.onCall("save"), hsm.effect("missing"), hsm.target(".")),
  ),
  hsm.initial(hsm.target("idle")),
);

// @ts-expect-error entry(string) keys are restricted to callable model operations
hsm.define(
  "BadEntry",
  hsm.state("idle", hsm.entry("missing")),
  hsm.initial(hsm.target("idle")),
);

// @ts-expect-error activity(string) keys are restricted to callable model operations
hsm.define(
  "BadActivity",
  hsm.state("idle", hsm.activity("missing")),
  hsm.initial(hsm.target("idle")),
);

// @ts-expect-error guard(string) keys must resolve to boolean-returning operations
hsm.define(
  "BadGuard",
  hsm.operation("save", () => undefined),
  hsm.state(
    "idle",
    hsm.transition(hsm.onCall("save"), hsm.guard("save"), hsm.target(".")),
  ),
  hsm.initial(hsm.target("idle")),
);

void sum;
void format;
void missing;
void operations;
void operationKeys;
void callableOperationKeys;
void guardOperationKeys;
void formatOperation;
void sumOperation;
void started;
void startedCounter;
