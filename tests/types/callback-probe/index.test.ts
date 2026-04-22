import * as hsm from "../../../src/index.js";

const Tick = hsm.event("tick");

const model = hsm.define(
  "Probe",
  hsm.state(
    "idle",
    hsm.transition(
      hsm.on(Tick),
      hsm.guard((ctx, instance, event: hsm.Event<"tick">) => {
        const n = event.name;
        const m: "tick" = n;
        void ctx;
        void instance;
        void n;
        void m;
        return true;
      }),
      hsm.target(".")
    ),
  ),
  hsm.initial(hsm.target("idle")),
);

void model;
