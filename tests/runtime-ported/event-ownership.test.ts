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
  envelopes: Array<Record<string, unknown>> = [];
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
          ownership.envelopes.push({
            name: event.name,
            Name: event.Name,
            kind: event.kind,
            Kind: event.Kind,
            schema: event.schema,
            Schema: event.Schema,
            source: event.source,
            Source: event.Source,
            target: event.target,
            Target: event.Target,
            id: event.id,
            ID: event.ID,
            qualifiedName: event.qualifiedName,
            QualifiedName: event.QualifiedName,
            metadataSource: event.metadata?.source,
            metadataTarget: event.metadata?.target,
          });

          event.name = "mutated-name";
          event.Name = "mutated-Name";
          event.kind = hsm.kinds.ErrorEvent;
          event.Kind = hsm.kinds.ErrorEvent;
          event.schema = { changed: ownership.seen.length };
          event.Schema = { changed: ownership.seen.length };
          event.source = "mutated-source";
          event.Source = "mutated-Source";
          event.target = "mutated-target";
          event.Target = "mutated-Target";
          event.id = "mutated-id";
          event.ID = "mutated-ID";
          event.qualifiedName = "mutated-qualified-name";
          event.QualifiedName = "mutated-QualifiedName";
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
  const ctx = new hsm.Context().WithValue(hsm.Keys.Instances, {});
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
  const ctx = new hsm.Context().WithValue(hsm.Keys.Instances, {});
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

test("dispatchTo populates missing source from current runtime context and target per recipient", async () => {
  const ctx = new hsm.Context().WithValue(hsm.Keys.Instances, {});
  const producer = new hsm.Instance();
  const peer = new OwnershipInstance();
  const peerModel = defineOwnershipModel();
  const producerModel = hsm.define(
    "DispatchSourceProducer",
    hsm.state(
      "idle",
      hsm.transition(
        hsm.on("send"),
        hsm.effect((behaviorCtx) => {
          void hsm.dispatchTo(behaviorCtx, {
            name: "go",
            kind: hsm.kinds.Event,
            id: "lower-id",
            qualifiedName: "lower-qualified",
            data: { count: 0 },
            metadata: {
              source: "metadata-source",
              target: "metadata-target",
            },
          } as hsm.Event, "peer");
        }),
      ),
    ),
    hsm.initial(hsm.target("idle")),
  );

  hsm.start(ctx, producer, producerModel, hsm.Config({ ID: "producer" }));
  hsm.start(ctx, peer, peerModel, hsm.Config({ ID: "peer" }));

  await producer.dispatch({ name: "send", kind: hsm.kinds.Event });

  assert.strictEqual(peer.seen[0].source, "producer");
  assert.strictEqual(peer.seen[0].target, "peer");
  assert.deepStrictEqual(peer.envelopes[0], {
    name: "go",
    Name: "go",
    kind: hsm.kinds.Event,
    Kind: hsm.kinds.Event,
    schema: undefined,
    Schema: undefined,
    source: "producer",
    Source: "producer",
    target: "peer",
    Target: "peer",
    id: "lower-id",
    ID: "lower-id",
    qualifiedName: "lower-qualified",
    QualifiedName: "lower-qualified",
    metadataSource: "metadata-source",
    metadataTarget: "metadata-target",
  });
  assert.deepStrictEqual(peer.seen[0].data, { count: 1 });
});

test("method dispatch with explicit context populates source and target like helper dispatch", async () => {
  const ctx = new hsm.Context().WithValue(hsm.Keys.Instances, {});
  const producer = new hsm.Instance();
  const peer = new OwnershipInstance();
  const model = defineOwnershipModel();
  hsm.start(ctx, producer, model, hsm.Config({ ID: "producer" }));
  hsm.start(ctx, peer, model, hsm.Config({ ID: "peer" }));

  await peer.dispatch(producer.context(), {
    name: "go",
    data: { count: 0 },
  } as hsm.Event);

  assert.strictEqual(peer.seen[0].source, "producer");
  assert.strictEqual(peer.seen[0].target, "peer");
  assert.strictEqual(peer.envelopes[0].Source, "producer");
  assert.strictEqual(peer.envelopes[0].Target, "peer");
});

test("method dispatch without explicit context populates source and target", async () => {
  const instance = new OwnershipInstance();
  const model = defineOwnershipModel();
  hsm.start(new hsm.Context(), instance, model, hsm.Config({ ID: "self" }));

  await instance.dispatch({
    name: "go",
    data: { count: 0 },
  } as hsm.Event);

  assert.strictEqual(instance.seen[0].source, "self");
  assert.strictEqual(instance.seen[0].target, "self");
  assert.strictEqual(instance.envelopes[0].Source, "self");
  assert.strictEqual(instance.envelopes[0].Target, "self");
});

test("group dispatch populates missing target per recipient", async () => {
  const ctx = new hsm.Context().WithValue(hsm.Keys.Instances, {});
  const first = new OwnershipInstance();
  const second = new OwnershipInstance();
  const model = defineOwnershipModel();
  hsm.start(ctx, first, model, hsm.Config({ ID: "first" }));
  hsm.start(ctx, second, model, hsm.Config({ ID: "second" }));

  await hsm.makeGroup(first, second).dispatch({
    name: "go",
    data: { count: 0 },
  } as hsm.Event);

  assert.strictEqual(first.seen[0].target, "first");
  assert.strictEqual(second.seen[0].target, "second");
  assert.strictEqual(first.seen[0].source, undefined);
  assert.strictEqual(second.seen[0].source, undefined);
  assert.strictEqual(first.envelopes[0].Target, "first");
  assert.strictEqual(second.envelopes[0].Target, "second");
});

test("direct dispatch normalizes canonical PascalCase event envelope fields", async () => {
  const instance = new OwnershipInstance();
  const model = defineOwnershipModel();
  hsm.start(new hsm.Context(), instance, model);

  await instance.dispatch({
    Name: "go",
    Kind: hsm.kinds.Event,
    Source: "upper-source",
    Target: "upper-target",
    ID: "upper-id",
    QualifiedName: "upper-qualified",
    Schema: { version: 1 },
    data: { count: 0 },
  } as hsm.Event);

  assert.deepStrictEqual(instance.envelopes[0], {
    name: "go",
    Name: "go",
    kind: hsm.kinds.Event,
    Kind: hsm.kinds.Event,
    schema: { version: 1 },
    Schema: { version: 1 },
    source: "upper-source",
    Source: "upper-source",
    target: "upper-target",
    Target: "upper-target",
    id: "upper-id",
    ID: "upper-id",
    qualifiedName: "upper-qualified",
    QualifiedName: "upper-qualified",
    metadataSource: undefined,
    metadataTarget: undefined,
  });
});

test("start does not mutate a bare parent context registry", () => {
  const parent = new hsm.Context();
  const instance = new hsm.Instance();
  const model = defineOwnershipModel();

  hsm.start(parent, instance, model, hsm.Config({ ID: "probe" }));

  assert.deepStrictEqual(Object.keys(parent.instances), []);
  assert.strictEqual(parent.Value(hsm.Keys.Instances), undefined);
  assert.deepStrictEqual(Object.keys(instance.context().Value(hsm.Keys.Instances) as Record<string, hsm.Instance>), ["probe"]);
});

test("restart does not promote a machine context to its own owner", async () => {
  const parent = new hsm.Context().WithValue(hsm.Keys.Instances, {});
  const instance = new hsm.Instance();
  const model = defineOwnershipModel();
  const baselineListeners = parent.listeners.length;

  hsm.start(parent, instance, model, hsm.Config({ ID: "probe" }));
  assert.strictEqual(instance.context().Value(hsm.Keys.Owner), undefined);
  assert.strictEqual(parent.listeners.length, baselineListeners + 1);
  const originalContext = instance.context();

  await hsm.restart(instance);

  assert.strictEqual(originalContext.done, true);
  assert.strictEqual(instance.context().Value(hsm.Keys.Owner), undefined);
  assert.strictEqual(parent.listeners.length, baselineListeners + 1);
  await hsm.stop(instance);
  assert.strictEqual(parent.listeners.length, baselineListeners);
});

test("group dispatch without explicit context uses group identity as source", async () => {
  const ctx = new hsm.Context().WithValue(hsm.Keys.Instances, {});
  const first = new OwnershipInstance();
  const second = new OwnershipInstance();
  const model = defineOwnershipModel();
  hsm.start(ctx, first, model, hsm.Config({ ID: "first" }));
  hsm.start(ctx, second, model, hsm.Config({ ID: "second" }));

  await hsm.makeGroup("fleet", first, second).dispatch({
    name: "go",
    data: { count: 0 },
  } as hsm.Event);

  assert.strictEqual(first.seen[0].source, "fleet");
  assert.strictEqual(second.seen[0].source, "fleet");
  assert.strictEqual(first.seen[0].target, "first");
  assert.strictEqual(second.seen[0].target, "second");
});

test("group dispatch without explicit context does not grow member context listeners", async () => {
  const ctx = new hsm.Context().WithValue(hsm.Keys.Instances, {});
  const first = new OwnershipInstance();
  const second = new OwnershipInstance();
  const model = defineOwnershipModel();
  hsm.start(ctx, first, model, hsm.Config({ ID: "first" }));
  hsm.start(ctx, second, model, hsm.Config({ ID: "second" }));
  const group = hsm.makeGroup("fleet", first, second);
  const before = first.context().listeners.length;

  await group.dispatch({ name: "go", data: { count: 0 } } as hsm.Event);
  await group.dispatch({ name: "go", data: { count: 0 } } as hsm.Event);

  assert.strictEqual(first.context().listeners.length, before);
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
