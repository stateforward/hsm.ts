import * as hsm from "../../../src/index.js";

declare const dynamicEventName: string;

const model = hsm.define(
  "DeferredTyping",
  hsm.attribute("count", 0),
  hsm.operation("save", () => undefined),
  hsm.state(
    "idle",
    hsm.defer("tick", "set:count", "call:save"),
    hsm.defer(dynamicEventName),
    hsm.transition(hsm.on("tick"), hsm.target(".")),
    hsm.transition(hsm.onSet("count"), hsm.target(".")),
    hsm.transition(hsm.onCall("save"), hsm.target(".")),
  ),
  hsm.initial(hsm.target("idle")),
);

const forwardReferenceModel = hsm.define(
  "DeferredForwardReference",
  hsm.state(
    "idle",
    hsm.defer("tick"),
    hsm.transition(hsm.on("tick"), hsm.target(".")),
  ),
  hsm.initial(hsm.target("idle")),
);

void model;
void forwardReferenceModel;
