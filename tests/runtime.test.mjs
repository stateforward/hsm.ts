import test from "node:test";
import assert from "node:assert/strict";

import * as hsm from "../dist/index.js";

class CounterInstance extends hsm.Instance {}

test("built package delegates to @stateforward/hsm runtime", () => {
  const model = hsm.define(
    "Counter",
    hsm.attribute("count", 0),
    hsm.state("idle"),
    hsm.initial(hsm.target("idle")),
  );

  const machine = hsm.start(new CounterInstance(), model);

  assert.equal(machine.state(), "/Counter/idle");
  assert.equal(machine.get("count"), 0);

  machine.set("count", 3);
  assert.equal(machine.get("count"), 3);
});

