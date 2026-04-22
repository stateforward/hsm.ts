import * as hsm from "../../../src/index.js";

const timerModel = hsm.define(
  "TimerTyping",
  hsm.attribute("delayMs", 100),
  hsm.attribute("delayText", "250"),
  hsm.attribute("deadline", new Date()),
  hsm.attribute("enabled", true),
  hsm.state(
    "idle",
    hsm.transition(hsm.after("delayMs"), hsm.target(".")),
    hsm.transition(hsm.after("delayText"), hsm.target(".")),
    hsm.transition(hsm.every("delayMs"), hsm.target(".")),
    hsm.transition(hsm.every("delayText"), hsm.target(".")),
    hsm.transition(hsm.at("delayMs"), hsm.target(".")),
    hsm.transition(hsm.at("delayText"), hsm.target(".")),
    hsm.transition(hsm.at("deadline"), hsm.target(".")),
    hsm.transition(hsm.after(() => 10), hsm.target(".")),
    hsm.transition(hsm.every(() => 25), hsm.target(".")),
    hsm.transition(hsm.at(() => new Date()), hsm.target(".")),
  ),
  hsm.initial(hsm.target("idle")),
);

// @ts-expect-error duration keys must be number/string-compatible attributes
const invalidAfterModel = hsm.define(
  "InvalidAfterTimerTyping",
  hsm.attribute("enabled", true),
  hsm.state(
    "idle",
    hsm.transition(hsm.after("enabled"), hsm.target(".")),
  ),
  hsm.initial(hsm.target("idle")),
);

// @ts-expect-error interval keys must be number/string-compatible attributes
const invalidEveryModel = hsm.define(
  "InvalidEveryTimerTyping",
  hsm.attribute("enabled", true),
  hsm.state(
    "idle",
    hsm.transition(hsm.every("enabled"), hsm.target(".")),
  ),
  hsm.initial(hsm.target("idle")),
);

// @ts-expect-error timepoint keys must be number/string/date-compatible attributes
const invalidAtModel = hsm.define(
  "InvalidAtTimerTyping",
  hsm.attribute("enabled", true),
  hsm.state(
    "idle",
    hsm.transition(hsm.at("enabled"), hsm.target(".")),
  ),
  hsm.initial(hsm.target("idle")),
);

void timerModel;
void invalidAfterModel;
void invalidEveryModel;
void invalidAtModel;
