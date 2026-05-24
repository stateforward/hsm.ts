import test from "node:test";
import assert from "node:assert";
import * as hsm from "../../src/index.ts";

class OwnershipInstance extends hsm.Instance {
  seen: Array<{
    name: string;
    kind: unknown;
    schema: unknown;
    source: unknown;
    target: unknown;
    id: unknown;
    qualifiedName: unknown;
    data: unknown;
    dataCount: number;
  }> = [];
}

function defineOwnershipModel() {
  return hsm.define(
    "EventOwnership",
    hsm.state(
      "idle",
      hsm.transition(
        hsm.on("go"),
        hsm.effect((ctx, instance, event) => {
          const ownership = instance as OwnershipInstance;
          event.data.count += 1;
          ownership.seen.push({
            name: event.name,
            kind: event.kind,
            schema: event.schema,
            source: event.source,
            target: event.target,
            id: event.id,
            qualifiedName: event.qualifiedName,
            data: event.data,
            dataCount: event.data.count,
          });

          event.name = "mutated-name";
          event.kind = hsm.kinds.ErrorEvent;
          event.schema = { changed: ownership.seen.length };
          event.source = "mutated-source";
          event.target = "mutated-target";
          event.id = "mutated-id";
          event.qualifiedName = "mutated-qualified-name";
        }),
        hsm.target("."),
      ),
    ),
    hsm.initial(hsm.target("idle")),
  );
}

test("behavior metadata writes do not mutate the caller event", async () => {
  const instance = new OwnershipInstance();
  const model = defineOwnershipModel();
  hsm.start(new hsm.Context(), instance, model);

  const schema = { version: 1 };
  const data = { count: 0 };
  const event = {
    name: "go",
    kind: hsm.kinds.Event,
    schema,
    source: "caller-source",
    target: "caller-target",
    id: "caller-id",
    qualifiedName: "caller-qualified-name",
    data,
  };

  await instance.dispatch(event);

  assert.strictEqual(event.name, "go");
  assert.strictEqual(event.kind, hsm.kinds.Event);
  assert.strictEqual(event.schema, schema);
  assert.strictEqual(event.source, "caller-source");
  assert.strictEqual(event.target, "caller-target");
  assert.strictEqual(event.id, "caller-id");
  assert.strictEqual(event.qualifiedName, "caller-qualified-name");
  assert.strictEqual(event.data, data);
  assert.strictEqual(data.count, 1);
});

test("dispatchAll gives each recipient isolated event metadata and shared data", async () => {
  const ctx = new hsm.Context();
  const first = new OwnershipInstance();
  const second = new OwnershipInstance();
  const model = defineOwnershipModel();
  hsm.start(ctx, first, model);
  hsm.start(ctx, second, model);

  const schema = { version: 1 };
  const data = { count: 0 };
  const event = {
    name: "go",
    kind: hsm.kinds.Event,
    schema,
    source: "caller-source",
    target: "caller-target",
    id: "caller-id",
    qualifiedName: "caller-qualified-name",
    data,
  };

  await hsm.dispatchAll(ctx, event);

  assert.deepStrictEqual(first.seen[0], {
    name: "go",
    kind: hsm.kinds.Event,
    schema,
    source: "caller-source",
    target: "caller-target",
    id: "caller-id",
    qualifiedName: "caller-qualified-name",
    data,
    dataCount: 1,
  });
  assert.deepStrictEqual(second.seen[0], {
    name: "go",
    kind: hsm.kinds.Event,
    schema,
    source: "caller-source",
    target: "caller-target",
    id: "caller-id",
    qualifiedName: "caller-qualified-name",
    data,
    dataCount: 2,
  });
  assert.strictEqual(event.name, "go");
  assert.strictEqual(event.kind, hsm.kinds.Event);
  assert.strictEqual(event.schema, schema);
  assert.strictEqual(data.count, 2);
});

test("dispatchTo and group dispatch do not leak metadata writes to siblings", async () => {
  const ctx = new hsm.Context();
  const first = new OwnershipInstance();
  const second = new OwnershipInstance();
  const model = defineOwnershipModel();
  hsm.start(ctx, first, model);
  hsm.start(ctx, second, model);

  const ids = Object.keys(ctx.instances);
  const schema = { version: 1 };
  const data = { count: 0 };
  const event = {
    name: "go",
    kind: hsm.kinds.Event,
    schema,
    source: "caller-source",
    target: "caller-target",
    id: "caller-id",
    qualifiedName: "caller-qualified-name",
    data,
  };

  await hsm.dispatchTo(ctx, event, ids[0], ids[1]);
  assert.strictEqual(first.seen[0].name, "go");
  assert.strictEqual(second.seen[0].name, "go");
  assert.strictEqual(first.seen[0].schema, schema);
  assert.strictEqual(second.seen[0].schema, schema);
  assert.strictEqual(data.count, 2);

  first.seen = [];
  second.seen = [];
  data.count = 0;
  const group = hsm.makeGroup(first, second);
  await group.dispatch(event);
  assert.strictEqual(first.seen[0].name, "go");
  assert.strictEqual(second.seen[0].name, "go");
  assert.strictEqual(first.seen[0].kind, hsm.kinds.Event);
  assert.strictEqual(second.seen[0].kind, hsm.kinds.Event);
  assert.strictEqual(event.name, "go");
  assert.strictEqual(event.kind, hsm.kinds.Event);
  assert.strictEqual(data.count, 2);
});

test("default event kind is scoped to the dispatched copy", async () => {
  const instance = new OwnershipInstance();
  const model = defineOwnershipModel();
  hsm.start(new hsm.Context(), instance, model);

  const event = { name: "go", data: { count: 0 } };
  await instance.dispatch(event as hsm.Event);
  assert.strictEqual("kind" in event, false);
  assert.strictEqual(instance.seen[0].kind, hsm.kinds.Event);
});
