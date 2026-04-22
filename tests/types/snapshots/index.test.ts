import * as hsm from "../../../src/index.js";

class CounterInstance extends hsm.Instance {}

const Tick = hsm.event("tick");

const model = hsm.define(
  "Snapshots",
  hsm.attribute("count", 0),
  hsm.attribute("label", "ready"),
  hsm.state("idle", hsm.transition(hsm.on(Tick), hsm.target("/Snapshots/done"))),
  hsm.state("done"),
  hsm.initial(hsm.target("idle")),
);

const started = hsm.start(new CounterInstance(), model);
const snapshot = started.takeSnapshot();
const liveTypedSnapshot: hsm.SnapshotOf<typeof model> = started.takeSnapshot();
const typedSnapshot = null as any as hsm.SnapshotOf<typeof model>;
const snapshotState: "/Snapshots/done" | "/Snapshots/idle" = typedSnapshot.state;
const snapshotAttributes: hsm.AttributesOf<typeof model> = typedSnapshot.attributes;
const snapshotEvent = typedSnapshot.events[0]!;
const eventName: "tick" = snapshotEvent.event;
const eventTarget: "/Snapshots/done" | undefined = snapshotEvent.target;
const tickSnapshot: Extract<hsm.EventSnapshotOf<typeof model>, { event: "tick" }> =
  null as any as {
    event: "tick";
    guard: boolean;
    schema?: any;
    target: "/Snapshots/done" | undefined;
  };
// @ts-expect-error tick snapshots cannot target idle in this model
const badTickSnapshot: Extract<hsm.EventSnapshotOf<typeof model>, { event: "tick" }> =
  null as any as {
    event: "tick";
    guard: boolean;
    schema?: any;
    target: "/Snapshots/idle";
  };

void snapshot;
void liveTypedSnapshot;
void typedSnapshot;
void snapshotState;
void snapshotAttributes;
void eventName;
void eventTarget;
void tickSnapshot;
void badTickSnapshot;
void started;
