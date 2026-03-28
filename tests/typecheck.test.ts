import * as hsm from "../dist/index.js";

class CounterInstance extends hsm.Instance {}

const expectType = <T>(_value: T): void => {};

const counterModel = hsm.define(
  "Counter",
  hsm.attribute("count", 0),
  hsm.state("idle"),
  hsm.initial(hsm.target("idle")),
);

const counterMachine = hsm.start(new CounterInstance(), counterModel);

expectType<number>(counterMachine.get("count"));
counterMachine.set("count", 1);

// @ts-expect-error count is typed as number
counterMachine.set("count", "bad");

interface CustomModel extends hsm.TypedModel<{ count: number; label: string }> {
  readonly customName?: string;
}

const customLabel = hsm.attribute("label", "ready");
const customCount = hsm.attribute("count", 0);

const explicitModel = hsm.define<CustomModel>(
  "ExplicitCounter",
  customLabel,
  customCount,
  hsm.state("idle"),
  hsm.initial(hsm.target("idle")),
);

const explicitMachine = hsm.start(new CounterInstance(), explicitModel);
expectType<string>(explicitMachine.get("label"));
expectType<number>(explicitMachine.get("count"));

const Tick = hsm.event<"tick", { step: number }>("tick");
const Stop = hsm.event("stop");

const eventfulModel = hsm.define(
  "Eventful",
  hsm.state(
    "idle",
    hsm.transition(
      hsm.on(Tick),
      hsm.guard((ctx, instance, event: typeof Tick) => {
        expectType<"tick">(event.name);
        expectType<{ step: number } | undefined>(event.data);
        return true;
      }),
      hsm.target("running"),
    ),
  ),
  hsm.state(
    "running",
    hsm.transition(
      hsm.on(Stop),
      hsm.effect((ctx, instance, event: typeof Stop) => {
        expectType<"stop">(event.name);
      }),
      hsm.target("idle"),
    ),
  ),
  hsm.initial(hsm.target("idle")),
);

const eventfulMachine = hsm.start(new CounterInstance(), eventfulModel);
eventfulMachine.dispatch(Tick);
eventfulMachine.dispatch(Stop);
eventfulMachine.dispatch({ kind: Tick.kind, name: "tick", data: { step: 1 } });

type EventfulDispatch = Parameters<typeof eventfulMachine.dispatch>[0];
type EventfulState = ReturnType<typeof eventfulMachine.state>;

expectType<hsm.Event<"tick", { step: number }> | hsm.Event<"stop", unknown>>(
  null as any as EventfulDispatch,
);
expectType<"tick" | "stop">(null as any as hsm.EventNamesOf<typeof eventfulModel>);

expectType<"/Eventful/idle" | "/Eventful/running">(
  null as any as EventfulState,
);

const opsModel = hsm.define(
  "Ops",
  hsm.operation("sum", (left: number, right: number) => left + right),
);

const opsMachine = hsm.start(new CounterInstance(), opsModel);
expectType<number>(opsMachine.call("sum", 1, 2));

// @ts-expect-error operation args are inferred
opsMachine.call("sum", "1", 2);
