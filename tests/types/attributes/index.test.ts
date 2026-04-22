import * as hsm from "../../../src/index.js";

class CounterInstance extends hsm.Instance {}

const model = hsm.define(
  "Counter",
  hsm.attribute("count", 0),
  hsm.attribute("label", "ready"),
  hsm.attribute("enabled", true),
  hsm.state(
    "idle",
    hsm.transition(hsm.onSet("count"), hsm.target(".")),
    hsm.transition(hsm.when("label"), hsm.target(".")),
  ),
  hsm.initial(hsm.target("idle")),
);

const started = hsm.start(new CounterInstance(), model);
const typedInstance: CounterInstance = started;

const count: number = started.get("count");
const label: string = started.get("label");
const enabled: boolean = started.get("enabled");
const missing: unknown = started.get("missing");

started.set("count", 1);
started.set("label", "set");
started.set("enabled", false);

const attributes: hsm.AttributesOf<typeof model> = {
  count: 1,
  enabled: true,
  label: "ok",
};

const attributeKeys: hsm.AttributeKeysOf<typeof model> =
  null as any as "count" | "enabled" | "label";

void count;
void label;
void enabled;
void missing;
void attributes;
void attributeKeys;
void started;
void typedInstance;
