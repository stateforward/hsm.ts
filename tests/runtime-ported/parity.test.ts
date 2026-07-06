import test from "node:test";
import assert from "node:assert";
import * as hsm from "../../src/index.ts";

function delay(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

class ParityMachine extends hsm.Instance {
  constructor() {
    super();
    this.log = [];
  }
}

test('PascalCase exports remain available alongside camelCase', function () {
  assert.strictEqual(typeof hsm.Define, 'function');
  assert.strictEqual(typeof hsm.Config, 'function');
  assert.strictEqual(hsm.Define, hsm.define);
  assert.strictEqual(hsm.Redefine, hsm.redefine);
  assert.strictEqual(hsm.State, hsm.state);
  assert.strictEqual(hsm.SubmachineState, hsm.submachineState);
  assert.strictEqual(hsm.EntryPoint, hsm.entryPoint);
  assert.strictEqual(hsm.ExitPoint, hsm.exitPoint);
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
  assert.strictEqual(hsm.Observe, hsm.observe);
  assert.strictEqual(hsm.Validator, hsm.validator);
  assert.strictEqual(hsm.Finalizer, hsm.finalizer);
  assert.strictEqual(hsm.Dispatch, hsm.dispatch);
  assert.strictEqual(hsm.TakeSnapshot, hsm.takeSnapshot);
  assert.strictEqual(hsm.Clock, hsm.clock);
  assert.strictEqual(hsm.Kinds, hsm.kinds);
});

test('Redefine replays a model without mutating the source', function () {
  var base = hsm.Define(
    'BaseRedefine',
    hsm.State('idle'),
    hsm.Initial(hsm.Target('idle'))
  );
  var redefined = hsm.Redefine(
    base,
    'RenamedRedefine',
    hsm.State('done'),
    hsm.Transition(hsm.On('finish'), hsm.Source('idle'), hsm.Target('done'))
  );

  assert.strictEqual(base.qualifiedName, '/BaseRedefine');
  assert.strictEqual(redefined.qualifiedName, '/RenamedRedefine');
  assert.ok(base.members['/BaseRedefine/idle']);
  assert.strictEqual(base.members['/BaseRedefine/done'], undefined);
  assert.ok(redefined.members['/RenamedRedefine/idle']);
  assert.ok(redefined.members['/RenamedRedefine/done']);
});

test('Redefine re-roots absolute paths from the source model', function () {
  var base = hsm.Define(
    'BaseAbsoluteRedefine',
    hsm.State('idle'),
    hsm.Initial(hsm.Target('/BaseAbsoluteRedefine/idle'))
  );
  var redefined = hsm.Redefine(base, 'RenamedAbsoluteRedefine');
  var instance = new ParityMachine();

  hsm.start(new hsm.Context(), instance, redefined);

  assert.ok(redefined.members['/RenamedAbsoluteRedefine/idle']);
  assert.strictEqual(instance.state(), '/RenamedAbsoluteRedefine/idle');
  hsm.stop(instance);
});

test('Validator and Finalizer participate in Define and Redefine replay', function () {
  var original = [];
  var override = [];
  var finalized = [];
  var base = hsm.Define(
    'ModelHooks',
    hsm.Validator({
      validate(model) {
        original.push(model.qualifiedName);
      },
    }),
    hsm.Finalizer({
      finalize(model) {
        var transition = Object.values(model.members).find(function (member) {
          return hsm.isKind(member.kind, hsm.kinds.Transition) && member.events.includes('go');
        });
        finalized.push([model.qualifiedName, transition.kind]);
        return model;
      },
    }),
    hsm.State('idle',
      hsm.Transition(hsm.On('go'), hsm.Target('../done'))
    ),
    hsm.State('done'),
    hsm.Initial(hsm.Target('idle'))
  );
  var redefined = hsm.Redefine(
    base,
    hsm.Validator({
      validate(model) {
        override.push(model.qualifiedName);
      },
    }),
    hsm.State('extra')
  );

  assert.strictEqual(base.qualifiedName, '/ModelHooks');
  assert.ok(redefined.members['/ModelHooks/extra']);
  assert.deepStrictEqual(original, ['/ModelHooks']);
  assert.deepStrictEqual(override, ['/ModelHooks']);
  assert.deepStrictEqual(finalized, [
    ['/ModelHooks', hsm.kinds.External],
    ['/ModelHooks', hsm.kinds.External],
  ]);
});

test('canonical Config applies ID, Name, Data, Clock, and Queue without mutating model', function () {
  var ctx = new hsm.Context().WithValue(hsm.Keys.Instances, {});
  var first = new ParityMachine();
  var second = new ParityMachine();
  var events = [];
  var queue = [];
  var customQueue = {
    Push(context, event) {
      events.push(['push', context.Value(hsm.Keys.HSM) === first, event.name]);
      queue.push(event);
    },
    Pop(context) {
      events.push(['pop', context.Value(hsm.Keys.HSM) === first]);
      return queue.shift();
    },
    Len(context) {
      events.push(['len', context.Value(hsm.Keys.HSM) === first, queue.length]);
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
  assert.strictEqual(hsm.Name(first), 'ConfiguredAlias');
  assert.strictEqual(hsm.QualifiedName(first), '/ConfiguredAlias');
  assert.strictEqual(hsm.TakeSnapshot(first).qualifiedName, '/ConfiguredAlias');
  assert.strictEqual(hsm.TakeSnapshot(first).QualifiedName, '/ConfiguredAlias');
  assert.strictEqual(model.qualifiedName, '/ConfiguredParity');
  assert.strictEqual(ctx.instances.alpha, first);
  assert.strictEqual(first.log[0], 'boot');
  assert.strictEqual(first.clock().now(), 42);

  assert.strictEqual(hsm.ID(second), 'beta');
  assert.strictEqual(hsm.Name(second), 'LowercaseAlias');
  assert.strictEqual(hsm.QualifiedName(second), '/LowercaseAlias');
  assert.strictEqual(second.log[0], 'lower');

  assert.ok(first.dispatch({ name: 'go', kind: hsm.kinds.Event }) instanceof Promise);
  assert.deepStrictEqual(events.filter(function (entry) { return entry[0] === 'push'; }), [
    ['push', true, 'go'],
  ]);
  assert.strictEqual(first.state(), '/ConfiguredParity/done');
});

test('dispatch and set return completions', async function () {
  var ctx = new hsm.Context().WithValue(hsm.Keys.Instances, {});
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
  await assert.rejects(
    group.set('missing' as never, 4 as never),
    /missing attribute/
  );
  var identifiedGroup = hsm.MakeGroup('dispatch-group', first, second);
  assert.strictEqual(identifiedGroup.id, 'dispatch-group');
  assert.strictEqual(identifiedGroup.takeSnapshot().length, 2);
});

test('Public helpers accept nullable explicit contexts', async function () {
  var instance = new ParityMachine();
  var model = hsm.Define(
    'NullableContextHelpers',
    hsm.Attribute('count', 0),
    hsm.Operation('sum', function (ctx, inst, a, b) {
      inst.log.push('sum:' + a + ':' + b);
      return a + b;
    }),
    hsm.State('idle',
      hsm.Transition(
        hsm.On('go'),
        hsm.Effect(function (ctx, inst) {
          inst.log.push('go');
        }),
        hsm.Target('.')
      ),
      hsm.Transition(hsm.OnSet('count'), hsm.Target('.')),
      hsm.Transition(hsm.OnCall('sum'), hsm.Target('.'))
    ),
    hsm.Initial(hsm.Target('idle'))
  );

  hsm.start(new hsm.Context(), instance, model);
  await hsm.Dispatch(null, instance, { name: 'go', kind: hsm.kinds.Event });
  await hsm.Set(null, instance, 'count', 7);
  var result = await hsm.Call(null, instance, 'sum', 2, 5);

  assert.strictEqual(hsm.Get(null, instance, 'count')[0], 7);
  assert.strictEqual(result, 7);
  assert.deepStrictEqual(instance.log, ['go', 'sum:2:5']);
  await hsm.stop(instance);
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
  assert.strictEqual(snapshot.transitions.length, 1);
  assert.strictEqual(snapshot.Transitions, snapshot.transitions);
  assert.strictEqual(snapshot.transitions[0].Name, '/SchemaParity/idle/transition_2');
  assert.strictEqual(snapshot.transitions[0].Kind, 67343);
  assert.strictEqual(snapshot.transitions[0].Source, '/SchemaParity/idle');
  assert.strictEqual(snapshot.transitions[0].Target, '/SchemaParity/done');
  assert.deepStrictEqual(snapshot.transitions[0].Events, ['go']);
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
  assert.strictEqual(Object.isFrozen(snapshot.transitions), true);
  assert.strictEqual(Object.isFrozen(snapshot.transitions[0]), true);
  assert.strictEqual(Object.isFrozen(bag), true);
  assert.strictEqual(Object.isFrozen(bag.nested), true);
  assert.strictEqual(Object.isFrozen(bag.items), true);

  assert.throws(function () {
    snapshot.attributes['/SnapshotImmutability/extra'] = true;
  }, TypeError);
  assert.throws(function () {
    snapshot.transitions.push({ Name: 'later', name: 'later', Kind: hsm.kinds.Transition, kind: hsm.kinds.Transition, Source: '', source: '', Events: [], events: [], Guard: false, guard: false });
  }, TypeError);
  assert.throws(function () {
    bag.nested.count = 9;
  }, TypeError);

  var [liveBag] = hsm.Get(instance, 'bag') as hsm.AttributeRead<{ nested: { count: number }; items: string[] }>;
  liveBag.nested.count = 2;
  liveBag.items.push('b');
  var [freshBag] = hsm.Get(instance, 'bag') as hsm.AttributeRead<{ nested: { count: number }; items: string[] }>;
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
  assert.strictEqual(hsm.Get(instance, 'count')[0], 1);
  await hsm.Set(instance, 'count', 1);
  assert.strictEqual(sm.state(), '/AttributeParity/idle');
  await hsm.Set(instance, 'count', 2);
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
  await assert.rejects(
    hsm.Set(instance, 'count', '1'),
    /attribute "count" rejected value/
  );
  await hsm.Set(instance, 'label', 'set');
  await assert.rejects(
    hsm.Set(instance, 'label', 1),
    /attribute "label" rejected value/
  );
  await hsm.Set(instance, 'stamp', new Date(1));
  await assert.rejects(
    hsm.Set(instance, 'stamp', {}),
    /attribute "stamp" rejected value/
  );
  assert.strictEqual(hsm.Get(instance, 'count')[0], 1);
  assert.strictEqual(hsm.Get(instance, 'label')[0], 'set');
  assert.strictEqual((hsm.Get(instance, 'stamp')[0] as Date).getTime(), 1);
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

  await assert.rejects(
    hsm.Set(instance, 'missing', 1),
    /missing attribute/
  );
  await assert.rejects(
    hsm.Set(instance, 'count', '2'),
    /attribute "count" rejected value/
  );
  await assert.rejects(
    hsm.Set(instance, 'stamp', 0),
    /attribute "stamp" rejected value/
  );
  await assert.rejects(
    hsm.Set(instance, 'items', {}),
    /attribute "items" rejected value/
  );
  assert.strictEqual(hsm.Get(instance, 'count')[0], 1);
  assert.strictEqual((hsm.Get(instance, 'stamp')[0] as Date).getTime(), 0);
  assert.deepStrictEqual(hsm.Get(instance, 'items')[0], []);
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
  var result = await hsm.Call(instance, 'doWork', 2, 3);
  assert.strictEqual(result, 5);
  assert.strictEqual(sm.state(), '/CallParity/done');
  assert.deepStrictEqual(instance.log, ['op:2:3', 'effect:/CallParity/doWork']);
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
      hsm.ShallowHistory('shallow', hsm.Transition(hsm.Target('A1'))),
      hsm.DeepHistory('deep', hsm.Transition(hsm.Target('A1'))),
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

test('SubmachineState flattens child model under the containing state', async function () {
  var instance = new ParityMachine();
  var child = hsm.Define(
    'ChildModel',
    hsm.State('off',
      hsm.Transition(hsm.On('turnOn'), hsm.Target('../on'))
    ),
    hsm.State('on'),
    hsm.Initial(hsm.Target('off'))
  );
  var parent = hsm.Define(
    'ParentModel',
    hsm.SubmachineState('drive', child),
    hsm.State('done'),
    hsm.Initial(hsm.Target('drive'))
  );

  assert.ok(parent.members['/ParentModel/drive/off']);
  assert.ok(parent.members['/ParentModel/drive/on']);
  var sm = hsm.start(new hsm.Context(), instance, parent);
  assert.strictEqual(sm.state(), '/ParentModel/drive/off');
  await sm.dispatch({ name: 'turnOn', kind: hsm.kinds.Event });
  assert.strictEqual(sm.state(), '/ParentModel/drive/on');
});

test('EntryPoint and ExitPoint route through submachine boundaries', async function () {
  var entryInstance = new ParityMachine();
  var entryChild = hsm.Define(
    'EntryChild',
    hsm.EntryPoint('warm', hsm.Target('on')),
    hsm.State('off'),
    hsm.State('on'),
    hsm.Initial(hsm.Target('off'))
  );
  var entryParent = hsm.Define(
    'EntryParent',
    hsm.State('idle',
      hsm.Transition(
        hsm.On('warm'),
        hsm.Target('../drive'),
        hsm.EntryPoint('warm')
      )
    ),
    hsm.SubmachineState('drive', entryChild),
    hsm.Initial(hsm.Target('idle'))
  );

  var entrySm = hsm.start(new hsm.Context(), entryInstance, entryParent);
  await entrySm.dispatch({ name: 'warm', kind: hsm.kinds.Event });
  assert.strictEqual(entrySm.state(), '/EntryParent/drive/on');

  var exitInstance = new ParityMachine();
  var exitChild = hsm.Define(
    'ExitChild',
    hsm.ExitPoint('complete'),
    hsm.State('running',
      hsm.Transition(hsm.On('complete'), hsm.Target('../complete'))
    ),
    hsm.Initial(hsm.Target('running'))
  );
  var exitParent = hsm.Define(
    'ExitParent',
    hsm.SubmachineState('work', exitChild),
    hsm.State('done'),
    hsm.Transition(
      hsm.Source('work'),
      hsm.ExitPoint('complete'),
      hsm.Target('done')
    ),
    hsm.Initial(hsm.Target('work'))
  );

  var exitSm = hsm.start(new hsm.Context(), exitInstance, exitParent);
  assert.strictEqual(exitSm.state(), '/ExitParent/work/running');
  await exitSm.dispatch({ name: 'complete', kind: hsm.kinds.Event });
  assert.strictEqual(exitSm.state(), '/ExitParent/done');
});

test('Observe can be attached with Redefine without mutating the source model', async function () {
  var instance = new ParityMachine();
  var observations = [];
  var base = hsm.Define(
    'ObserveBase',
    hsm.State('idle',
      hsm.Transition(
        hsm.On('go'),
        hsm.Effect(function (ctx, inst) {
          inst.log.push('effect');
        }),
        hsm.Target('../done')
      )
    ),
    hsm.State('done'),
    hsm.Initial(hsm.Target('idle'))
  );
  var observed = hsm.Redefine(
    base,
    hsm.Observe(function (ctx, inst, event) {
      observations.push([event.name, event.source, event.data.occurrence]);
    }, 'go')
  );

  assert.strictEqual(base.members['/ObserveBase/idle/transition_2/observation'], undefined);
  var sm = hsm.start(new hsm.Context(), instance, observed);
  await sm.dispatch({ name: 'go', kind: hsm.kinds.Event });
  assert.strictEqual(sm.state(), '/ObserveBase/done');
  assert.deepStrictEqual(instance.log, ['effect']);
  assert.deepStrictEqual(observations, [
    ['hsm/observation', '/ObserveBase/idle/transition_2', 'event'],
  ]);
});

test('When(function), At(), TakeSnapshot(), and Restart() parity', async function () {
  var instance = new ParityMachine();
  var ready = false;

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
  ready = true;
  await sm.dispatch({ name: 'poll', kind: hsm.kinds.Event });
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
