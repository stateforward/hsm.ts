import * as hsm from "../../../src/index.js";

class CounterInstance extends hsm.Instance {}

const model = hsm.define(
  "Counter",
  hsm.attribute("count", 0),
  hsm.attribute("label", "ready"),
  hsm.attribute("enabled", true),
  hsm.attribute("typedCount", Number),
  hsm.attribute("typedLabel", String, "ready"),
  hsm.attribute("typedDate", Date, new Date()),
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
const typedCount: number = started.get("typedCount");
const typedLabel: string = started.get("typedLabel");
const typedDate: Date = started.get("typedDate");
const missing: unknown = started.get("missing");

started.set("count", 1);
started.set("label", "set");
started.set("enabled", false);
started.set("typedCount", 1);
started.set("typedLabel", "set");
started.set("typedDate", new Date());
started.set("missing", "dynamic");
const setCompletion: hsm.Completion = started.set("count", 2);
// @ts-expect-error known attribute values must match their declared type
started.set("count", "1");
// @ts-expect-error explicit Number attributes accept numbers only
started.set("typedCount", "1");
// @ts-expect-error explicit Date attributes accept Date values only
started.set("typedDate", {});
// @ts-expect-error explicit default must match declared type
hsm.attribute("badDefault", Number, "1");

const attributes: hsm.AttributesOf<typeof model> = {
  count: 1,
  enabled: true,
  label: "ok",
  typedCount: 2,
  typedLabel: "ok",
  typedDate: new Date(),
};

const attributeKeys: hsm.AttributeKeysOf<typeof model> =
  null as any as "count" | "enabled" | "label" | "typedCount" | "typedLabel" | "typedDate";

void count;
void label;
void enabled;
void typedCount;
void typedLabel;
void typedDate;
void missing;
void attributes;
void attributeKeys;
void started;
void typedInstance;
void setCompletion;
