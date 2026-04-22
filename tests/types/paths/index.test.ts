import * as hsm from "../../../src/index.js";

const Tick = hsm.event<"tick", { step: number }>("tick");

const model = hsm.define(
  "Paths",
  hsm.state(
    "idle",
    hsm.state("nested"),
    hsm.state("sibling"),
    hsm.initial(hsm.target(".")),
    hsm.transition(hsm.on(Tick), hsm.target("nested")),
    hsm.transition(hsm.on(Tick), hsm.target(".")),
    hsm.transition(
      hsm.on(Tick),
      hsm.source("/Paths/idle"),
      hsm.target("nested"),
    ),
    hsm.transition(hsm.on(Tick), hsm.source("."), hsm.target("nested")),
    hsm.transition(hsm.on(Tick), hsm.source("./nested"), hsm.target("./sibling")),
    hsm.transition(hsm.on(Tick), hsm.source("nested"), hsm.target("../running")),
    hsm.transition(hsm.on(Tick), hsm.source("./sibling"), hsm.target("..")),
  ),
  hsm.state("running"),
  hsm.initial(hsm.target("/Paths/idle")),
);

const absolutePaths:
  | "/Paths/idle"
  | "/Paths/idle/nested"
  | "/Paths/idle/sibling"
  | "/Paths/running" =
  null as any as hsm.StatePathsOf<typeof model>;
const relativePaths: "idle" | "idle/nested" | "idle/sibling" | "running" =
  null as any as hsm.RelativeStatePathsOf<typeof model>;

// @ts-expect-error relative targets can only resolve within the current state's descendants
hsm.define(
  "BrokenRelativeTarget",
  hsm.state("idle", hsm.transition(hsm.on(Tick), hsm.target("running"))),
  hsm.state("running"),
);

// @ts-expect-error absolute targets must resolve to a declared state path
hsm.define(
  "BrokenAbsoluteTarget",
  hsm.state("idle"),
  hsm.initial(hsm.target("/missing")),
);

hsm.define(
  "BrokenSource",
  // @ts-expect-error relative sources use the same compile-time path validation as targets
  hsm.state(
    "idle",
    hsm.state("nested"),
    hsm.transition(hsm.on(Tick), hsm.source("missing"), hsm.target("nested")),
  ),
);

hsm.define(
  "BrokenParentTraversal",
  // @ts-expect-error invalid upward traversal beyond the model root is rejected after path normalization
  hsm.state(
    "idle",
    hsm.state(
      "nested",
      hsm.transition(hsm.on(Tick), hsm.target("../../../missing")),
    ),
  ),
);

void absolutePaths;
void relativePaths;
