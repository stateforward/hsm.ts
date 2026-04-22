import * as hsm from "../../../src/index.js";

const model = hsm.define(
  "Finals",
  hsm.state(
    "process",
    hsm.state(
      "running",
      hsm.transition(hsm.on("advance"), hsm.target("../completed")),
    ),
    hsm.final("completed"),
    hsm.initial(hsm.target("running")),
  ),
  hsm.final("terminated"),
  hsm.initial(hsm.target("process")),
);

const finalStates: hsm.FinalStatesOf<typeof model> =
  null as any as "/Finals/process/completed" | "/Finals/terminated";
const isCompletedFinal: hsm.IsFinalState<
  typeof model,
  "/Finals/process/completed"
> = true;
const isRunningFinal: hsm.IsFinalState<typeof model, "/Finals/process/running"> =
  false;
const completionOwners: hsm.CompletionStatePathsOf<typeof model> =
  null as any as "/Finals" | "/Finals/process";
const doneNames: hsm.DoneEventNamesOf<typeof model> =
  null as any as "done:/Finals" | "done:/Finals/process";
const doneEvent: hsm.DoneEventOf<typeof model> =
  null as any as hsm.Event<"done:/Finals"> | hsm.Event<"done:/Finals/process">;
const completionEvents: hsm.CompletionEventsOf<typeof model> = doneEvent;

// @ts-expect-error done events are type-only in this pass and are not part of runtime dispatch unions
const runtimeEventName: hsm.EventNamesOf<typeof model> = "done:/Finals/process";

void finalStates;
void isCompletedFinal;
void isRunningFinal;
void completionOwners;
void doneNames;
void doneEvent;
void completionEvents;
void runtimeEventName;
