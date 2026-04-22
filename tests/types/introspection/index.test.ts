import * as hsm from "../../../src/index.js";

const Tick = hsm.event("tick");
const Reset = hsm.event("reset");

const model = hsm.define(
  "Graph",
  hsm.state(
    "idle",
    hsm.state("nested"),
    hsm.initial(hsm.target("nested")),
    hsm.transition(hsm.on(Tick), hsm.source("nested"), hsm.target("/Graph/running")),
  ),
  hsm.state(
    "running",
    hsm.transition(hsm.on(Reset), hsm.target("/Graph/idle/nested")),
  ),
  hsm.initial(hsm.target("idle")),
);

const idleChild: hsm.ChildrenOf<typeof model, "/Graph/idle"> =
  null as any as "/Graph/idle/nested";
const nestedParent: hsm.ParentOf<typeof model, "/Graph/idle/nested"> =
  null as any as "/Graph/idle";
const idleDescendant: hsm.DescendantsOf<typeof model, "/Graph/idle"> =
  null as any as "/Graph/idle/nested";
const nestedAncestor: hsm.AncestorsOf<typeof model, "/Graph/idle/nested"> =
  null as any as "/Graph/idle";
const rootInitial: hsm.InitialStateOf<typeof model, "/Graph"> =
  null as any as "/Graph/idle";
const idleInitial: hsm.InitialStateOf<typeof model, "/Graph/idle"> =
  null as any as "/Graph/idle/nested";
const leafState: hsm.LeafStatesOf<typeof model> =
  null as any as "/Graph/idle/nested" | "/Graph/running";
const nestedEvent: hsm.EventsForState<typeof model, "/Graph/idle/nested"> =
  null as any as hsm.Event<"tick">;
const nestedTarget: hsm.TargetsFromState<typeof model, "/Graph/idle/nested"> =
  null as any as "/Graph/running";
const resetSource: hsm.SourcesForEvent<typeof model, "reset"> =
  null as any as "/Graph/running";
const canTick: hsm.CanTransition<
  typeof model,
  "/Graph/idle/nested",
  "/Graph/running",
  "tick"
> = true;
const cannotReset: hsm.CanTransition<
  typeof model,
  "/Graph/idle/nested",
  "/Graph/running",
  "reset"
> = false;

void idleChild;
void nestedParent;
void idleDescendant;
void nestedAncestor;
void rootInitial;
void idleInitial;
void leafState;
void nestedEvent;
void nestedTarget;
void resetSource;
void canTick;
void cannotReset;
