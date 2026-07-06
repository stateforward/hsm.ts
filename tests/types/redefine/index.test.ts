import * as hsm from "../../../src/index.js";

class CounterInstance extends hsm.Instance {}

const Tick = hsm.event("tick");

const base = hsm.define(
  "BaseRedefine",
  hsm.attribute("count", 0),
  hsm.operation("ready", () => true),
  hsm.state("idle"),
  hsm.initial(hsm.target("idle")),
);

const extended = hsm.redefine(
  base,
  hsm.state("done"),
  hsm.transition(
    hsm.on(Tick),
    hsm.source("/BaseRedefine/idle"),
    hsm.target("/BaseRedefine/done"),
  ),
);

const renamed = hsm.redefine(
  base,
  "RenamedRedefine",
  hsm.state("done"),
  hsm.transition(
    hsm.on(Tick),
    hsm.source("/RenamedRedefine/idle"),
    hsm.target("/RenamedRedefine/done"),
  ),
);

const extendedState: hsm.StatePathsOf<typeof extended> = "/BaseRedefine/done";
const renamedState: hsm.StatePathsOf<typeof renamed> = "/RenamedRedefine/done";
const renamedIdle: hsm.StatePathsOf<typeof renamed> = "/RenamedRedefine/idle";
const eventNames: hsm.EventNamesOf<typeof renamed> = "tick";
const attributes: hsm.AttributesOf<typeof extended> = { count: 1 };
const operations: hsm.OperationsOf<typeof extended> = { ready: () => true };

const started = hsm.start(new CounterInstance(), renamed);
const currentState: "/RenamedRedefine/idle" | "/RenamedRedefine/done" =
  started.state();
started.dispatch(Tick);

// @ts-expect-error renamed models should expose paths under the replacement root
const oldRootState: hsm.StatePathsOf<typeof renamed> = "/BaseRedefine/idle";

// @ts-expect-error added states should be present on the redefined model
const missingAddedState: hsm.StatePathsOf<typeof extended> = "/BaseRedefine/missing";

void extendedState;
void renamedState;
void renamedIdle;
void eventNames;
void attributes;
void operations;
void currentState;
void oldRootState;
void missingAddedState;
