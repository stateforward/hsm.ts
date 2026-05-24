import test from "node:test";
import assert from "node:assert";
import * as hsm from "../../src/index.ts";

function delay(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function ParityMachine() {
  hsm.Instance.call(this);
  this.log = [];
}

ParityMachine.prototype = Object.create(hsm.Instance.prototype);
ParityMachine.prototype.constructor = ParityMachine;

test('PascalCase exports remain available alongside camelCase', function () {
  assert.strictEqual(typeof hsm.Define, 'function');
  assert.strictEqual(typeof hsm.Config, 'function');
  assert.strictEqual(hsm.Define, hsm.define);
  assert.strictEqual(hsm.State, hsm.state);
  assert.strictEqual(hsm.Event, hsm.event);
  assert.strictEqual(hsm.EventKind, hsm.kinds.Event);
  assert.strictEqual(hsm.StateKind, hsm.kinds.State);
  assert.strictEqual(hsm.TransitionKind, hsm.kinds.Transition);
  assert.strictEqual(hsm.CompletionEventKind, hsm.kinds.CompletionEvent);
  assert.strictEqual(hsm.FinalStateKind, hsm.kinds.FinalState);
  assert.strictEqual(hsm.OnSet, hsm.onSet);
  assert.strictEqual(hsm.OnCall, hsm.onCall);
  assert.strictEqual(hsm.ShallowHistory, hsm.shallowHistory);
  assert.strictEqual(hsm.DeepHistory, hsm.deepHistory);
  assert.strictEqual(hsm.TakeSnapshot, hsm.takeSnapshot);
  assert.strictEqual(hsm.Clock, hsm.clock);
  assert.strictEqual(hsm.Kinds, hsm.kinds);
});

test('canonical Config applies ID, Name, Data, Clock, and Queue without mutating model', function () {
  var ctx = new hsm.Context();
  var first = new ParityMachine();
  var second = new ParityMachine();
  var events = [];
  var queue = [];
  var customQueue = {
    Push(context, event) {
      events.push(['push', context === ctx, event.name]);
      queue.push(event);
    },
    Pop(context) {
      events.push(['pop', context === ctx]);
      return queue.shift();
    },
    Len(context) {
      events.push(['len', context === ctx, queue.length]);
      return queue.length;
    },
  };
  var clock = {
    now: function () {
      return 42;
    },
  };
  var model = hsm.Define(
    'ConfiguredParity',
    hsm.State('idle',
      hsm.Entry(function (context, instance, event) {
        instance.log.push(event.data);
      }),
      hsm.Transition(hsm.On('go'), hsm.Target('../done'))
    ),
    hsm.State('done'),
    hsm.Initial(hsm.Target('idle'))
  );

  hsm.start(ctx, first, model, hsm.Config({
    ID: 'alpha',
    Name: '/ConfiguredAlias',
    Data: 'boot',
    Clock: clock,
    Queue: customQueue,
  }));
  hsm.start(ctx, second, model, { id: 'beta', name: '/LowercaseAlias', data: 'lower' });

  assert.strictEqual(hsm.ID(first), 'alpha');
  assert.strictEqual(hsm.Name(first), '/ConfiguredAlias');
  assert.strictEqual(hsm.QualifiedName(first), '/ConfiguredAlias');
  assert.strictEqual(hsm.TakeSnapshot(first).qualifiedName, '/ConfiguredAlias');
  assert.strictEqual(hsm.TakeSnapshot(first).QualifiedName, '/ConfiguredAlias');
  assert.strictEqual(model.qualifiedName, '/ConfiguredParity');
  assert.strictEqual(ctx.instances.alpha, first);
  assert.strictEqual(first.log[0], 'boot');
  assert.strictEqual(first.clock().now(), 42);

  assert.strictEqual(hsm.ID(second), 'beta');
  assert.strictEqual(hsm.Name(second), '/LowercaseAlias');
  assert.strictEqual(hsm.QualifiedName(second), '/LowercaseAlias');
  assert.strictEqual(second.log[0], 'lower');

  assert.ok(first.dispatch({ name: 'go', kind: hsm.kinds.Event }) instanceof Promise);
  assert.deepStrictEqual(events.filter(function (entry) { return entry[0] === 'push'; }), [
    ['push', true, 'go'],
  ]);
  assert.strictEqual(first.state(), '/ConfiguredParity/done');
});

test('dispatch and set return completions', async function () {
  var ctx = new hsm.Context();
  var first = new ParityMachine();
  var second = new ParityMachine();
  var event = { name: 'go', kind: hsm.kinds.Event };
  var model = hsm.Define(
    'DispatchCompletionParity',
    hsm.Attribute('count', 0),
    hsm.State('idle',
      hsm.Transition(hsm.On('go'), hsm.Target('.')),
      hsm.Transition(hsm.OnSet('count'), hsm.Target('.'))
    ),
    hsm.Initial(hsm.Target('idle'))
  );

  hsm.start(ctx, first, model);
  hsm.start(ctx, second, model);
  var group = hsm.MakeGroup(first, second);

  await first.dispatch(event);
  var instanceSet = first.set('count', 1);
  assert.ok(instanceSet instanceof Promise);
  await instanceSet;
  await hsm.DispatchAll(ctx, event);
  await hsm.DispatchTo(ctx, event, Object.keys(ctx.instances)[0]);
  var topLevelSet = hsm.Set(first, 'count', 2);
  assert.ok(topLevelSet instanceof Promise);
  await topLevelSet;
  await group.dispatch(event);
  var groupSet = group.set('count', 3);
  assert.ok(groupSet instanceof Promise);
  await groupSet;
  await group.set('missing' as never, 4 as never);
  assert.strictEqual(hsm.MakeGroup('dispatch-group', first, second).takeSnapshot().ID, 'dispatch-group');
});

test('Event schema metadata is preserved in model registration and snapshots', function () {
  var payloadSchema = {
    parse: function (value) {
      return value;
    }
  };
  var goEvent = hsm.Event('go', payloadSchema);
  var model = hsm.Define(
    'SchemaParity',
    hsm.State('idle',
      hsm.Transition(
        hsm.On(goEvent),
        hsm.Target('../done')
      )
    ),
    hsm.State('done'),
    hsm.Initial(hsm.Target('idle'))
  );
  var instance = new ParityMachine();

  hsm.start(new hsm.Context(), instance, model);
  var snapshot = hsm.TakeSnapshot(instance);

  assert.strictEqual(model.events.go.schema, payloadSchema);
  assert.strictEqual(snapshot.events.length, 1);
  assert.strictEqual(snapshot.Events, snapshot.events);
  assert.strictEqual(snapshot.events[0].event, 'go');
  assert.strictEqual(snapshot.events[0].Name, 'go');
  assert.strictEqual(snapshot.events[0].Kind, hsm.kinds.Event);
  assert.strictEqual(snapshot.events[0].Guard, snapshot.events[0].guard);
  assert.strictEqual(snapshot.events[0].Target, snapshot.events[0].target);
  assert.strictEqual(snapshot.events[0].schema, payloadSchema);
  assert.strictEqual(snapshot.events[0].Schema, payloadSchema);
});

test('TakeSnapshot returns an immutable point-in-time attribute snapshot', function () {
  var instance = new ParityMachine();
  var model = hsm.Define(
    'SnapshotImmutability',
    hsm.Attribute('bag', { nested: { count: 1 }, items: ['a'] }),
    hsm.State('idle',
      hsm.Transition(hsm.On('go'), hsm.Target('.'))
    ),
    hsm.Initial(hsm.Target('idle'))
  );

  hsm.start(new hsm.Context(), instance, model);
  var snapshot = hsm.TakeSnapshot(instance);
  var bag = snapshot.attributes['/SnapshotImmutability/bag'];

  assert.strictEqual(Object.isFrozen(snapshot), true);
  assert.strictEqual(Object.isFrozen(snapshot.attributes), true);
  assert.strictEqual(snapshot.Attributes, snapshot.attributes);
  assert.strictEqual(snapshot.QueueLen, snapshot.queueLen);
  assert.strictEqual(Object.isFrozen(snapshot.events), true);
  assert.strictEqual(Object.isFrozen(snapshot.events[0]), true);
  assert.strictEqual(Object.isFrozen(bag), true);
  assert.strictEqual(Object.isFrozen(bag.nested), true);
  assert.strictEqual(Object.isFrozen(bag.items), true);

  assert.throws(function () {
    snapshot.attributes['/SnapshotImmutability/extra'] = true;
  }, TypeError);
  assert.throws(function () {
    snapshot.events.push({ event: 'later', guard: false });
  }, TypeError);
  assert.throws(function () {
    bag.nested.count = 9;
  }, TypeError);

  var liveBag = hsm.Get(instance, 'bag');
  liveBag.nested.count = 2;
  liveBag.items.push('b');
  var freshBag = hsm.Get(instance, 'bag');
  assert.strictEqual(freshBag.nested.count, 1);
  assert.deepStrictEqual(freshBag.items, ['a']);
  hsm.Set(instance, 'bag', { nested: { count: 3 }, items: ['c'] });

  assert.strictEqual(bag.nested.count, 1);
  assert.deepStrictEqual(bag.items, ['a']);
});

test('Attribute + OnSet + Get/Set parity', async function () {
  var instance = new ParityMachine();
  var model = hsm.Define(
    'AttributeParity',
    hsm.Attribute('count', 1),
    hsm.State('idle',
      hsm.Transition(
        hsm.OnSet('count'),
        hsm.Target('../changed'),
        hsm.Effect(function (ctx, inst, event) {
          inst.log.push(event.data.old + '->' + event.data.new);
        })
      )
    ),
    hsm.State('changed'),
    hsm.Initial(hsm.Target('idle'))
  );

  var sm = hsm.start(new hsm.Context(), instance, model);
  assert.strictEqual(hsm.Get(instance, 'count'), 1);
  hsm.Set(instance, 'count', 1);
  assert.strictEqual(sm.state(), '/AttributeParity/idle');
  hsm.Set(instance, 'count', 2);
  await delay(0);
  assert.strictEqual(sm.state(), '/AttributeParity/changed');
  assert.deepStrictEqual(instance.log, ['1->2']);
});

test('Attribute explicit type forms validate runtime Set values', async function () {
  var instance = new ParityMachine();
  var model = hsm.Define(
    'AttributeTypeParity',
    hsm.Attribute('count', Number),
    hsm.Attribute('label', String, 'ready'),
    hsm.Attribute('stamp', Date, new Date(0)),
    hsm.State('idle'),
    hsm.Initial(hsm.Target('idle'))
  );

  hsm.start(new hsm.Context(), instance, model);

  await hsm.Set(instance, 'count', 1);
  await hsm.Set(instance, 'count', '1');
  await hsm.Set(instance, 'label', 'set');
  await hsm.Set(instance, 'label', 1);
  await hsm.Set(instance, 'stamp', new Date(1));
  await hsm.Set(instance, 'stamp', {});
  assert.strictEqual(hsm.Get(instance, 'count'), 1);
  assert.strictEqual(hsm.Get(instance, 'label'), 'set');
  assert.strictEqual(hsm.Get(instance, 'stamp').getTime(), 1);
  assert.throws(function () {
    hsm.Attribute('bad', Number, 'not-a-number' as never);
  }, /default value does not match declared type/);
});

test('Set rejects unknown attributes and default-backed type mismatches', async function () {
  var instance = new ParityMachine();
  var model = hsm.Define(
    'AttributeSetValidation',
    hsm.Attribute('count', 1),
    hsm.Attribute('stamp', new Date(0)),
    hsm.Attribute('items', []),
    hsm.State('idle',
      hsm.Transition(
        hsm.OnSet('count'),
        hsm.Target('../changed'),
        hsm.Effect(function (ctx, inst, event) {
          inst.log.push(event.data.old + '->' + event.data.new);
        })
      )
    ),
    hsm.State('changed'),
    hsm.Initial(hsm.Target('idle'))
  );

  var sm = hsm.start(new hsm.Context(), instance, model);

  await hsm.Set(instance, 'missing', 1);
  await hsm.Set(instance, 'count', '2');
  await hsm.Set(instance, 'stamp', 0);
  await hsm.Set(instance, 'items', {});
  assert.strictEqual(hsm.Get(instance, 'count'), 1);
  assert.strictEqual(hsm.Get(instance, 'stamp').getTime(), 0);
  assert.deepStrictEqual(hsm.Get(instance, 'items'), []);
  assert.strictEqual(sm.state(), '/AttributeSetValidation/idle');
  assert.deepStrictEqual(instance.log, []);

  await hsm.Set(instance, 'count', 1);
  await hsm.Set(instance, 'stamp', new Date(1));
  await hsm.Set(instance, 'items', ['ok']);
  await hsm.Set(instance, 'count', 2);
  await delay(0);
  assert.strictEqual(sm.state(), '/AttributeSetValidation/changed');
  assert.deepStrictEqual(instance.log, ['1->2']);
});

test('Operation + OnCall + Call parity', async function () {
  var instance = new ParityMachine();
  var model = hsm.Define(
    'CallParity',
    hsm.Operation('doWork', function (ctx, inst, a, b) {
      inst.log.push('op:' + a + ':' + b);
      return a + b;
    }),
    hsm.State('idle',
      hsm.Transition(
        hsm.OnCall('doWork'),
        hsm.Target('../done'),
        hsm.Effect('recordEffect')
      )
    ),
    hsm.State('done'),
    hsm.Operation('recordEffect', function (ctx, inst, event) {
      inst.log.push('effect:' + event.data.name);
    }),
    hsm.Initial(hsm.Target('idle'))
  );

  var sm = hsm.start(new hsm.Context(), instance, model);
  var result = hsm.Call(instance, 'doWork', 2, 3);
  await delay(0);
  assert.strictEqual(result, 5);
  assert.strictEqual(sm.state(), '/CallParity/done');
  assert.deepStrictEqual(instance.log, ['effect:/CallParity/doWork', 'op:2:3']);
});

test('String operation references work for Entry/Effect/Guard', async function () {
  var instance = new ParityMachine();
  var model = hsm.Define(
    'OperationRefs',
    hsm.Operation('enterIdle', function (ctx, inst, event) {
      inst.log.push('enterIdle');
    }),
    hsm.Operation('allowGo', function (ctx, inst, event) {
      inst.log.push('allowGo');
      return true;
    }),
    hsm.Operation('markGo', function (ctx, inst, event) {
      inst.log.push('markGo');
    }),
    hsm.State('idle',
      hsm.Entry('enterIdle'),
      hsm.Transition(
        hsm.On('go'),
        hsm.Guard('allowGo'),
        hsm.Effect('markGo'),
        hsm.Target('../done')
      )
    ),
    hsm.State('done'),
    hsm.Initial(hsm.Target('idle'))
  );

  var sm = hsm.start(new hsm.Context(), instance, model);
  sm.dispatch({ name: 'go', kind: hsm.kinds.Event });
  await delay(0);
  assert.strictEqual(sm.state(), '/OperationRefs/done');
  assert.deepStrictEqual(instance.log, ['enterIdle', 'allowGo', 'markGo']);
});

test('ShallowHistory and DeepHistory restore correctly', async function () {
  var instance = new ParityMachine();
  var model = hsm.Define(
    'HistoryParity',
    hsm.State('A',
      hsm.State('A1',
        hsm.State('A1a'),
        hsm.State('A1b'),
        hsm.Initial(hsm.Target('A1a'))
      ),
      hsm.State('A2'),
      hsm.ShallowHistory('shallow'),
      hsm.DeepHistory('deep'),
      hsm.Initial(hsm.Target('A1'))
    ),
    hsm.State('B'),
    hsm.Transition(hsm.On('toA1b'), hsm.Source('A/A1/A1a'), hsm.Target('A/A1/A1b')),
    hsm.Transition(hsm.On('toB'), hsm.Source('A/A1/A1b'), hsm.Target('B')),
    hsm.Transition(hsm.On('backDeep'), hsm.Source('B'), hsm.Target('A/deep')),
    hsm.Transition(hsm.On('backShallow'), hsm.Source('B'), hsm.Target('A/shallow')),
    hsm.Initial(hsm.Target('A'))
  );

  var sm = hsm.start(new hsm.Context(), instance, model);
  sm.dispatch({ name: 'toA1b', kind: hsm.kinds.Event });
  sm.dispatch({ name: 'toB', kind: hsm.kinds.Event });
  sm.dispatch({ name: 'backDeep', kind: hsm.kinds.Event });
  assert.strictEqual(sm.state(), '/HistoryParity/A/A1/A1b');
  sm.dispatch({ name: 'toB', kind: hsm.kinds.Event });
  sm.dispatch({ name: 'backShallow', kind: hsm.kinds.Event });
  assert.strictEqual(sm.state(), '/HistoryParity/A/A1/A1a');
});

test('When(function), At(), TakeSnapshot(), and Restart() parity', async function () {
  var instance = new ParityMachine();
  var resolveReady;
  var ready = new Promise(function (resolve) {
    resolveReady = resolve;
  });

  var model = hsm.Define(
    'RuntimeParity',
    hsm.State('waiting',
      hsm.Transition(
        hsm.When(function () {
          return ready;
        }),
        hsm.Target('../atDeadline')
      )
    ),
    hsm.State('atDeadline',
      hsm.Transition(
        hsm.At(function () {
          return Date.now() + 5;
        }),
        hsm.Target('../done')
      )
    ),
    hsm.State('done'),
    hsm.Initial(hsm.Target('waiting'))
  );

  var sm = hsm.start(new hsm.Context(), instance, model);
  var before = hsm.TakeSnapshot(instance);
  assert.strictEqual(before.state, '/RuntimeParity/waiting');
  resolveReady();
  await delay(10);
  assert.strictEqual(sm.state(), '/RuntimeParity/done');
  hsm.Restart(instance);
  assert.strictEqual(sm.state(), '/RuntimeParity/waiting');
});

test('MakeGroup dispatches to all grouped instances', async function () {
  var first = new ParityMachine();
  var second = new ParityMachine();
  var model = hsm.Define(
    'GroupParity',
    hsm.State('idle',
      hsm.Transition(hsm.On('go'), hsm.Target('../done'))
    ),
    hsm.State('done'),
    hsm.Initial(hsm.Target('idle'))
  );

  hsm.start(new hsm.Context(), first, model, { id: 'first' });
  hsm.start(new hsm.Context(), second, model, { id: 'second' });
  var group = hsm.MakeGroup(first, second);
  group.dispatch({ name: 'go', kind: hsm.kinds.Event });
  await delay(0);
  assert.strictEqual(first.state(), '/GroupParity/done');
  assert.strictEqual(second.state(), '/GroupParity/done');
});

test('DSL names reject slash characters', function () {
  assert.throws(function () { hsm.Define('Bad/Model'); }, /Model name "Bad\/Model" cannot contain "\/"/);
  assert.throws(function () { hsm.State('bad/state'); }, /State name "bad\/state" cannot contain "\/"/);
  assert.throws(function () { hsm.Final('bad/final'); }, /Final name "bad\/final" cannot contain "\/"/);
  assert.throws(function () { hsm.ShallowHistory('bad/history'); }, /ShallowHistory name "bad\/history" cannot contain "\/"/);
  assert.throws(function () { hsm.DeepHistory('bad/history'); }, /DeepHistory name "bad\/history" cannot contain "\/"/);
  assert.throws(function () { hsm.Choice('bad/choice'); }, /Choice name "bad\/choice" cannot contain "\/"/);
  assert.throws(function () { hsm.Attribute('bad/attribute', 1); }, /Attribute name "bad\/attribute" cannot contain "\/"/);
  assert.throws(function () { hsm.Operation('bad/operation', function () {}); }, /Operation name "bad\/operation" cannot contain "\/"/);
});
