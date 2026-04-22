import * as hsm from "../../../src/index.js";

class CounterInstance extends hsm.Instance {}

const Tick = hsm.event<"tick", { step: number }>("tick");
const Stop = hsm.event("stop");
const Pause = hsm.event("pause");
const ExplicitLifecycleEvent = hsm.event<"lifecycle", { phase: "enter" | "exit" }>(
  "lifecycle",
);

const model = hsm.define(
  "Eventful",
  hsm.state(
    "idle",
    hsm.entry((ctx, instance, event) => {
      const name = event.name;
      void ctx;
      void instance;
      void name;
    }),
    hsm.transition(
      hsm.on(Tick),
      hsm.guard((ctx, instance, event) => {
        const name = event.name;
        const schema = event.schema;
        const data: { step: number } | undefined = event.data;
        void ctx;
        void instance;
        void name;
        void schema;
        void data;
        return true;
      }),
      hsm.target("/running"),
    ),
  ),
    hsm.state(
      "running",
      hsm.exit((ctx, instance, event) => {
        const name = event.name;
        void ctx;
        void instance;
        void name;
      }),
    hsm.transition(
      hsm.on(Stop),
      hsm.effect((ctx, instance, event) => {
        const name = event.name;
        void ctx;
        void instance;
        void name;
      }),
      hsm.target("/idle"),
    ),
    hsm.transition(
      hsm.on(Tick),
      hsm.on(Pause),
      hsm.effect((ctx, instance, event) => {
        const name = event.name;
        void ctx;
        void instance;
        void name;
      }),
      hsm.target("/idle"),
    ),
  ),
  hsm.initial(hsm.target("idle")),
);

const helperModel = hsm.define(
  "HelperEvents",
  hsm.attribute("count", 0),
  hsm.attribute("label", ""),
  hsm.operation("save", () => undefined),
  hsm.operation("multiply", (left: number, right: number) => left * right),
  hsm.state(
    "idle",
    hsm.transition(
      hsm.onSet("count"),
      hsm.guard((ctx, instance, event) => {
        const setName = event.name;
        void ctx;
        void instance;
        void setName;
        return true;
      }),
      hsm.target("."),
    ),
    hsm.transition(
      hsm.onSet("label"),
      hsm.guard((ctx, instance, event) => {
        const setName = event.name;
        void ctx;
        void instance;
        void setName;
        return true;
      }),
      hsm.target("."),
    ),
    hsm.transition(
      hsm.onCall("save"),
      hsm.effect((ctx, instance, event) => {
        const setName = event.name;
        void ctx;
        void instance;
        void setName;
      }),
      hsm.target("."),
    ),
    hsm.transition(
      hsm.onCall("multiply"),
      hsm.effect((ctx, instance, event) => {
        const setName = event.name;
        void ctx;
        void instance;
        void setName;
      }),
      hsm.target("."),
    ),
    hsm.transition(
      hsm.when("count"),
      hsm.effect((ctx, instance, event) => {
        const setName = event.name;
        void ctx;
        void instance;
        void setName;
      }),
      hsm.target("."),
    ),
  ),
  hsm.initial(hsm.target("idle")),
);

const explicitLifecycleModel = hsm.define(
  "ExplicitLifecycle",
  hsm.state(
    "idle",
    hsm.entry((ctx, instance, event: hsm.Event<"lifecycle", { phase: "enter" | "exit" }>) => {
      const lifecycleName: "lifecycle" = event.name;
      const lifecycleData:
        | { phase: "enter" | "exit" }
        | undefined = event.data;
      void ctx;
      void instance;
      void lifecycleName;
      void lifecycleData;
    }),
    hsm.exit((ctx, instance, event: hsm.Event<"lifecycle", { phase: "enter" | "exit" }>) => {
      const lifecycleName: "lifecycle" = event.name;
      void ctx;
      void instance;
      void lifecycleName;
    }),
    hsm.activity((ctx, instance, event: hsm.Event<"lifecycle", { phase: "enter" | "exit" }>) => {
      const lifecycleName: "lifecycle" = event.name;
      void ctx;
      void instance;
      void lifecycleName;
    }),
    hsm.transition(hsm.on(ExplicitLifecycleEvent), hsm.target(".")),
  ),
  hsm.initial(hsm.target("idle")),
);

const started: CounterInstance = hsm.start(new CounterInstance(), model);
const typedStarted = hsm.start(new CounterInstance(), model);
const helperStarted = hsm.start(new CounterInstance(), helperModel);

started.dispatch(Tick);
started.dispatch(Stop);
started.dispatch({ kind: Tick.kind, name: "tick", data: { step: 1 } });
typedStarted.dispatch(Tick);
typedStarted.dispatch({ kind: Tick.kind, name: "tick", data: { step: 1 } });
// @ts-expect-error dispatch payload follows event name
typedStarted.dispatch({ kind: Tick.kind, name: "tick", data: { step: "1" } });
// @ts-expect-error dispatch is limited to known model events
typedStarted.dispatch({ kind: Tick.kind, name: "missing" });
helperStarted.dispatch({
  kind: Tick.kind,
  name: "set:count",
  data: { name: "count", old: 0, new: 1 },
});
helperStarted.dispatch({
  kind: Tick.kind,
  name: "call:multiply",
  data: { name: "multiply", args: [1, 2] },
});
helperStarted.dispatch({
  kind: Tick.kind,
  name: "set:count",
  // @ts-expect-error synthetic payloads follow the selected event name
  data: { name: "count", old: "0", new: 1 },
});
helperStarted.dispatch({
  kind: Tick.kind,
  name: "call:multiply",
  // @ts-expect-error operation argument payloads are typed
  data: { name: "multiply", args: [1, "2"] },
});
const currentState: "/Eventful/idle" | "/Eventful/running" = typedStarted.state();
const currentSnapshot: hsm.SnapshotOf<typeof model> = typedStarted.takeSnapshot();

const eventNames: "pause" | "tick" | "stop" =
  null as any as hsm.EventNamesOf<typeof model>;
const tickDispatchEvent: hsm.DispatchEventOfName<typeof model, "tick"> = {
  kind: Tick.kind,
  name: "tick",
  data: { step: 1 },
};
const dispatchEventUnion: hsm.DispatchEventsOf<typeof model> = tickDispatchEvent;
const tickEvent: hsm.Event<"tick", { step: number }> =
  null as any as hsm.EventOfName<typeof model, "tick">;
const setCountEvent: hsm.Event<"set:count"> =
  null as any as hsm.EventOfName<typeof helperModel, "set:count">;
const setCountEventSchema: {
  name: "count";
  old: number;
  new: number;
} =
  null as any as NonNullable<
    hsm.EventOfName<typeof helperModel, "set:count">["schema"]
  >;
const setLabelEventSchema: {
  name: "label";
  old: string;
  new: string;
} =
  null as any as NonNullable<
    hsm.EventOfName<typeof helperModel, "set:label">["schema"]
  >;
const callSaveEvent: hsm.Event<"call:save"> =
  null as any as hsm.EventOfName<typeof helperModel, "call:save">;
const callSaveEventSchema: {
  name: "save";
  args: [];
} =
  null as any as NonNullable<
    hsm.EventOfName<typeof helperModel, "call:save">["schema"]
  >;
const callMultiplyEventSchema: {
  name: "multiply";
  args: [number, number];
} =
  null as any as NonNullable<
    hsm.EventOfName<typeof helperModel, "call:multiply">["schema"]
  >;
const whenCountEvent: hsm.Event<"set:count"> =
  null as any as hsm.EventOfName<typeof helperModel, "set:count">;

void eventNames;
void tickDispatchEvent;
void dispatchEventUnion;
void tickEvent;
void setCountEvent;
void setCountEventSchema;
void setLabelEventSchema;
void callSaveEvent;
void callSaveEventSchema;
void callMultiplyEventSchema;
void currentState;
void currentSnapshot;
void typedStarted;
void helperStarted;
void whenCountEvent;
void started;
void explicitLifecycleModel;
