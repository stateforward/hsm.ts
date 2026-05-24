import * as hsm from "../../../src/index.js";

class ResultInstance extends hsm.Instance {}

const Done = hsm.event("done");

const model = hsm.define(
  "Results",
  hsm.attribute("count", 0),
  hsm.state(
    "idle",
    hsm.transition(hsm.on(Done), hsm.target(".")),
    hsm.transition(hsm.onSet("count"), hsm.target(".")),
  ),
  hsm.initial(hsm.target("idle")),
);

const ctx = new hsm.Context();
const first = hsm.start(ctx, new ResultInstance(), model);
const second = hsm.start(ctx, new ResultInstance(), model);
const group = hsm.makeGroup(first, second);

const instanceDispatchCompletion: hsm.Completion = first.dispatch(Done);
const instanceSetCompletion: hsm.Completion = first.set("count", 1);
const groupDispatchCompletion: hsm.Completion = group.dispatch(Done);
const groupSetCompletion: hsm.Completion = group.set("count", 2);
const dispatchAllCompletion: hsm.Completion = hsm.dispatchAll(ctx, Done);
const dispatchToCompletion: hsm.Completion = hsm.dispatchTo(ctx, Done, "0");
const topLevelSetCompletion: hsm.Completion = hsm.set(first, "count", 3);

// @ts-expect-error set returns a completion, not a number result
const invalidSetCompletion: hsm.Completion = 3;

void instanceDispatchCompletion;
void instanceSetCompletion;
void groupDispatchCompletion;
void groupSetCompletion;
void dispatchAllCompletion;
void dispatchToCompletion;
void topLevelSetCompletion;
void invalidSetCompletion;
