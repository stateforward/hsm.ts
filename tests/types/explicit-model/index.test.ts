import * as hsm from "../../../src/index.js";

class CounterInstance extends hsm.Instance {
  tag() {
    return "counter" as const;
  }
}

class OtherInstance extends hsm.Instance {}

interface CustomModel
  extends hsm.TypedModel<
    { count: number; label: string },
    {},
    any,
    any,
    any,
    any,
    string,
    CounterInstance
  > {
  readonly customName?: string;
}

const model = hsm.define<CustomModel>(
  "ExplicitCounter",
  hsm.attribute("count", 0),
  hsm.attribute("label", "ready"),
  hsm.state("idle"),
  hsm.initial(hsm.target("idle")),
);

const started = hsm.start(new CounterInstance(), model);
const startedCounter: CounterInstance = started;
const startedTyped = hsm.start(new CounterInstance(), model);
const startedTypedCounter: CounterInstance = startedTyped;

const count: number = started.get("count");
const label: string = started.get("label");
const tag: "counter" = started.tag();
const machineInstanceTag: "counter" = startedTyped.tag();
const explicitBehavior: hsm.BehaviorCallbackFor<CustomModel> = (
  ctx,
  instance,
  event,
) => {
  const explicitTag: "counter" = instance.tag();
  void ctx;
  void event;
  void explicitTag;
};
const custom: CustomModel = model;

// @ts-expect-error model expects CounterInstance
hsm.start(new OtherInstance(), model);
// @ts-expect-error HSM is not publicly exposed
hsm.HSM;

void count;
void label;
void tag;
void machineInstanceTag;
void explicitBehavior;
void started;
void startedCounter;
void startedTyped;
void startedTypedCounter;
void custom;
