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
  transitions: [{}],
  Transitions: [{}],
} as any as hsm.SnapshotOf<typeof model>;
const snapshotState: "/Snapshots/done" | "/Snapshots/idle" = typedSnapshot.state;
const canonicalSnapshotState: "/Snapshots/done" | "/Snapshots/idle" = typedSnapshot.State;
const snapshotAttributes: hsm.AttributesOf<typeof model> = typedSnapshot.attributes;
const canonicalSnapshotAttributes: hsm.AttributesOf<typeof model> = typedSnapshot.Attributes;
const transitionSnapshot = typedSnapshot.transitions[0]!;
const canonicalTransitionSnapshot = typedSnapshot.Transitions[0]!;
const transitionSource: "/Snapshots" | "/Snapshots/idle" = transitionSnapshot.source;
const canonicalTransitionSource: "/Snapshots" | "/Snapshots/idle" = transitionSnapshot.Source;
const transitionTarget: "/Snapshots/done" | "/Snapshots/idle" | undefined = transitionSnapshot.target;
const canonicalTransitionTarget: "/Snapshots/done" | "/Snapshots/idle" | undefined = transitionSnapshot.Target;
const transitionGuard: boolean = transitionSnapshot.Guard;
const transitionKind: number = transitionSnapshot.Kind;
// @ts-expect-error snapshots expose readonly state
typedSnapshot.state = "/Snapshots/idle";
// @ts-expect-error canonical snapshots expose readonly state
typedSnapshot.State = "/Snapshots/idle";
// @ts-expect-error snapshot attributes are readonly
typedSnapshot.attributes.count = 1;
// @ts-expect-error canonical snapshot attributes are readonly
typedSnapshot.Attributes.count = 1;
// @ts-expect-error snapshot transitions are readonly
typedSnapshot.transitions.push(transitionSnapshot);
// @ts-expect-error canonical snapshot transitions are readonly
typedSnapshot.Transitions.push(transitionSnapshot);
// @ts-expect-error snapshot transition details are readonly
transitionSnapshot.guard = false;
// @ts-expect-error canonical snapshot transition details are readonly
transitionSnapshot.Guard = false;
const tickSnapshot: hsm.TransitionSnapshotOf<typeof model> =
  null as any as {
    name: string;
    Name: string;
    source: "/Snapshots/idle";
    Source: "/Snapshots/idle";
    Kind: number;
    kind: number;
    events: readonly "tick"[];
    Events: readonly "tick"[];
    guard: boolean;
    Guard: boolean;
    target: "/Snapshots/done" | undefined;
    Target: "/Snapshots/done" | undefined;
  };
// @ts-expect-error tick transitions cannot target idle in this model
const badTickSnapshot: hsm.TransitionSnapshotOf<typeof model> =
  null as any as {
    name: string;
    source: "/Snapshots/idle";
    events: readonly "tick"[];
    guard: boolean;
    target: "/Snapshots/idle";
  };

void snapshot;
void liveTypedSnapshot;
void typedSnapshot;
void snapshotState;
void canonicalSnapshotState;
void snapshotAttributes;
void canonicalSnapshotAttributes;
void canonicalTransitionSnapshot;
void transitionSource;
void canonicalTransitionSource;
void transitionTarget;
void canonicalTransitionTarget;
void transitionGuard;
void transitionKind;
void tickSnapshot;
void badTickSnapshot;
void started;
