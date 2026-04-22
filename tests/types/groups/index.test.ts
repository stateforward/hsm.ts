import * as hsm from "../../../src/index.js";

class FirstInstance extends hsm.Instance {}
class SecondInstance extends hsm.Instance {}

interface FirstModel
  extends hsm.TypedModel<
    { shared: string; count: number },
    { sum: (left: number, right: number) => number },
    any,
    any,
    hsm.Event<"go", { step: number }>,
    any,
    string,
    FirstInstance
  > {}

interface SecondModel
  extends hsm.TypedModel<
    { shared: string; flag: boolean },
    { toggle: () => boolean },
    any,
    any,
    hsm.Event<"flip", { flag: boolean }>,
    any,
    string,
    SecondInstance
  > {}

const firstModel = hsm.define<FirstModel>(
  "First",
  hsm.attribute("shared", "ready"),
  hsm.attribute("count", 0),
  hsm.operation("sum", (left: number, right: number) => left + right),
  hsm.state("idle", hsm.transition(hsm.on("go"), hsm.target("."))),
  hsm.initial(hsm.target("idle")),
);

const secondModel = hsm.define<SecondModel>(
  "Second",
  hsm.attribute("shared", "ready"),
  hsm.attribute("flag", true),
  hsm.operation("toggle", () => true),
  hsm.state("idle", hsm.transition(hsm.on("flip"), hsm.target("."))),
  hsm.initial(hsm.target("idle")),
);

const first = hsm.start(new FirstInstance(), firstModel);
const second = hsm.start(new SecondInstance(), secondModel);

const group = hsm.makeGroup(first, second);

group.dispatch({ kind: 0, name: "go", data: { step: 1 } });
group.dispatch({ kind: 0, name: "flip", data: { flag: true } });
// @ts-expect-error dispatch is limited to the member event union
group.dispatch({ kind: 0, name: "missing" });
// @ts-expect-error grouped dispatch payloads follow the selected event name
group.dispatch({ kind: 0, name: "go", data: { step: "1" } });

group.set("shared", "updated");
// @ts-expect-error count is not shared across all members
group.set("count", 1);
// @ts-expect-error shared stays string across all members
group.set("shared", false);

const groupSum: number = group.call("sum", 1, 2);
// @ts-expect-error group.call follows hsm.go and only types the first member's operations
group.call("toggle");
// @ts-expect-error sum keeps the first member's parameter types
group.call("sum", "1", 2);

const groupSnapshot = group.takeSnapshot();
const groupFirstSnapshot: hsm.SnapshotOf<typeof firstModel> = groupSnapshot.members[0];
const groupSecondSnapshot: hsm.SnapshotOf<typeof secondModel> = groupSnapshot.members[1];
const groupFirstShared: string = groupSnapshot.members[0].attributes.shared;
const groupSecondFlag: boolean = groupSnapshot.members[1].attributes.flag;
// @ts-expect-error the flattened member tuple keeps first-model attributes on index 0
groupSnapshot.members[0].attributes.flag;

const nested = hsm.makeGroup(group, hsm.start(new FirstInstance(), firstModel));
const nestedSum: number = nested.call("sum", 3, 4);
nested.dispatch({ kind: 0, name: "flip", data: { flag: true } });
// @ts-expect-error nested groups still reject non-member events
nested.dispatch({ kind: 0, name: "unknown" });
const nestedSnapshot = nested.takeSnapshot();
const nestedFirstSnapshot: hsm.SnapshotOf<typeof firstModel> = nestedSnapshot.members[0];
const nestedSecondSnapshot: hsm.SnapshotOf<typeof secondModel> = nestedSnapshot.members[1];
const nestedThirdSnapshot: hsm.SnapshotOf<typeof firstModel> = nestedSnapshot.members[2];
// @ts-expect-error flattened nested group snapshots preserve tuple length
nestedSnapshot.members[3];

void groupSum;
void nestedSum;
void groupFirstSnapshot;
void groupSecondSnapshot;
void groupFirstShared;
void groupSecondFlag;
void nestedFirstSnapshot;
void nestedSecondSnapshot;
void nestedThirdSnapshot;
