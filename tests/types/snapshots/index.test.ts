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
const typedSnapshot = {
  attributes: {},
  Attributes: {},
  events: [{}],
  Events: [{}],
} as any as hsm.SnapshotOf<typeof model>;
const snapshotState: "/Snapshots/done" | "/Snapshots/idle" = typedSnapshot.state;
const canonicalSnapshotState: "/Snapshots/done" | "/Snapshots/idle" = typedSnapshot.State;
const snapshotAttributes: hsm.AttributesOf<typeof model> = typedSnapshot.attributes;
const canonicalSnapshotAttributes: hsm.AttributesOf<typeof model> = typedSnapshot.Attributes;
const snapshotEvent = typedSnapshot.events[0]!;
const canonicalSnapshotEvent = typedSnapshot.Events[0]!;
const eventName: "tick" = snapshotEvent.event;
const canonicalEventName: "tick" = snapshotEvent.Name;
const eventTarget: "/Snapshots/done" | undefined = snapshotEvent.target;
const canonicalEventTarget: "/Snapshots/done" | undefined = snapshotEvent.Target;
const canonicalEventGuard: boolean = snapshotEvent.Guard;
const canonicalEventKind: number = snapshotEvent.Kind;
// @ts-expect-error snapshots expose readonly state
typedSnapshot.state = "/Snapshots/idle";
// @ts-expect-error canonical snapshots expose readonly state
typedSnapshot.State = "/Snapshots/idle";
// @ts-expect-error snapshot attributes are readonly
typedSnapshot.attributes.count = 1;
// @ts-expect-error canonical snapshot attributes are readonly
typedSnapshot.Attributes.count = 1;
// @ts-expect-error snapshot events are readonly
typedSnapshot.events.push(snapshotEvent);
// @ts-expect-error canonical snapshot events are readonly
typedSnapshot.Events.push(snapshotEvent);
// @ts-expect-error snapshot event details are readonly
snapshotEvent.guard = false;
// @ts-expect-error canonical snapshot event details are readonly
snapshotEvent.Guard = false;
const tickSnapshot: Extract<hsm.EventSnapshotOf<typeof model>, { event: "tick" }> =
  null as any as {
    event: "tick";
    Name: "tick";
    Kind: number;
    guard: boolean;
    Guard: boolean;
    schema?: any;
    Schema?: any;
    target: "/Snapshots/done" | undefined;
    Target: "/Snapshots/done" | undefined;
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
void canonicalSnapshotState;
void snapshotAttributes;
void canonicalSnapshotAttributes;
void canonicalSnapshotEvent;
void eventName;
void canonicalEventName;
void eventTarget;
void canonicalEventTarget;
void canonicalEventGuard;
void canonicalEventKind;
void tickSnapshot;
void badTickSnapshot;
void started;
