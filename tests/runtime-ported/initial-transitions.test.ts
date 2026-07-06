/**
 * @fileoverview Test initial transitions at multiple hierarchy levels
 * Tests that initial transitions are properly followed when entering states at various depths
 */

import test from "node:test";
import assert from "node:assert";
import * as hsm from "../../src/index.ts";

// Test instance implementation
class InitialInstance extends hsm.Instance {
  constructor() {
    super();
    this.log = [];
    this.data = {};
  }

  logAction(action) {
    this.log.push(action);
  }
}

test('Basic initial transition in top-level state', async function () {
  const instance = new InitialInstance();

  const model = hsm.define('BasicInitialMachine',
    hsm.initial(
      hsm.target('container'),
    ),
    hsm.state('container',
      hsm.initial(
        hsm.target('default'),
        hsm.effect(function (ctx, inst, event) {
          inst.logAction('initial-effect');
        })
      ),
      hsm.entry(function (ctx, inst, event) {
        inst.logAction('container-entry');
      }),

      hsm.state('default',
        hsm.entry(function (ctx, inst, event) {
          inst.logAction('default-entry');
        })
      ),

      hsm.state('other',
        hsm.entry(function (ctx, inst, event) {
          inst.logAction('other-entry');
        })
      )
    )
  );

  const ctx = new hsm.Context();
  hsm.start(ctx, instance, model);

  // Should follow initial transition
  assert.deepStrictEqual(instance.log, [
    'container-entry',
    'initial-effect',
    'default-entry'
  ]);
  assert.strictEqual(instance.state(), '/BasicInitialMachine/container/default');

  hsm.stop(instance);
});

test('Nested initial transitions - multiple levels deep', async function () {
  const instance = new InitialInstance();

  const model = hsm.define('NestedInitialMachine',
    hsm.initial(
      hsm.target('level1'),
    ),
    hsm.state('level1',
      hsm.initial(
        hsm.target('level2'),
        hsm.effect(function (ctx, inst, event) {
          inst.logAction('level1-initial');
        })
      ),
      hsm.entry(function (ctx, inst, event) {
        inst.logAction('level1-entry');
      }),

      hsm.state('level2',
        hsm.initial(
          hsm.target('level3'),
          hsm.effect(function (ctx, inst, event) {
            inst.logAction('level2-initial');
          })
        ),
        hsm.entry(function (ctx, inst, event) {
          inst.logAction('level2-entry');
        }),

        hsm.state('level3',
          hsm.initial(
            hsm.target('final'),
            hsm.effect(function (ctx, inst, event) {
              inst.logAction('level3-initial');
            })
          ),
          hsm.entry(function (ctx, inst, event) {
            inst.logAction('level3-entry');
          }),

          hsm.state('final',
            hsm.entry(function (ctx, inst, event) {
              inst.logAction('final-entry');
            })
          )
        )
      )
    )
  );

  const ctx = new hsm.Context();
  hsm.start(ctx, instance, model);

  // Should follow all initial transitions in sequence
  assert.deepStrictEqual(instance.log, [
    'level1-entry',
    'level1-initial',
    'level2-entry',
    'level2-initial',
    'level3-entry',
    'level3-initial',
    'final-entry'
  ]);
  assert.strictEqual(instance.state(), '/NestedInitialMachine/level1/level2/level3/final');

  hsm.stop(instance);
});

test('Initial transitions with guards', async function () {
  const instance = new InitialInstance();
  instance.data.useAlternate = true;

  const model = hsm.define('GuardedInitialMachine',
    hsm.initial(
      hsm.target('choice')
    ),
    hsm.choice('choice',
      hsm.transition(
        hsm.guard(function (ctx, inst, event) {
          return inst.data.useAlternate;
        }),
        hsm.target('parent/alternate'),
        hsm.effect(function (ctx, inst, event) {
          inst.logAction('chose-alternate');
        })
      ),
      hsm.transition(
        hsm.target('parent/default'),
        hsm.effect(function (ctx, inst, event) {
          inst.logAction('chose-default');
        })
      )
    ),
    hsm.state('parent',
      hsm.initial(
        hsm.target('default')
      ),
      hsm.state('default',
        hsm.entry(function (ctx, inst, event) {
          inst.logAction('default-entry');
        })
      ),

      hsm.state('alternate',
        hsm.entry(function (ctx, inst, event) {
          inst.logAction('alternate-entry');
        })
      )
    )
  );

  const ctx = new hsm.Context();
  hsm.start(ctx, instance, model);

  // Should choose alternate based on guard
  assert.deepStrictEqual(instance.log, [
    'chose-alternate',
    'alternate-entry'
  ]);
  assert.strictEqual(instance.state(), '/GuardedInitialMachine/parent/alternate');

  hsm.stop(instance);

  // Test with different guard result
  instance.data.useAlternate = false;
  instance.log = [];

  const ctx2 = new hsm.Context();
  hsm.start(ctx2, instance, model);

  // Should choose default
  assert.deepStrictEqual(instance.log, [
    'chose-default',
    'default-entry'
  ]);
  assert.strictEqual(instance.state(), '/GuardedInitialMachine/parent/default');

  hsm.stop(instance);
});

test('Initial transition bypassed on direct entry', async function () {
  const instance = new InitialInstance();

  const model = hsm.define('DirectEntryMachine',
    hsm.initial(
      hsm.target('parent/default'),
      hsm.effect(function (ctx, inst, event) {
        inst.logAction('initial-transition-effect');
      })
    ),
    hsm.state('parent',
      hsm.initial(
        hsm.target('default')
      ),

      hsm.state('default',
        hsm.entry(function (ctx, inst, event) {
          inst.logAction('default-entry');
        })
      ),

      hsm.state('specific',
        hsm.entry(function (ctx, inst, event) {
          inst.logAction('specific-entry');
        })
      ),

      hsm.transition(
        hsm.on('go-specific'),
        hsm.target('specific')
      )
    )
  );

  const ctx = new hsm.Context();
  hsm.start(ctx, instance, model);
  assert.strictEqual(instance.state(), '/DirectEntryMachine/parent/default');
  instance.log = [];

  // Direct transition to specific state should bypass initial
  instance.dispatch({ name: 'go-specific', kind: hsm.kinds.Event });
  assert.deepStrictEqual(instance.log, [
    'specific-entry'
  ]);
  // Note: initial-transition-effect should NOT be in the log
  assert.strictEqual(instance.state(), '/DirectEntryMachine/parent/specific');

  hsm.stop(instance);
});

test('Initial transitions triggered on re-entry', async function () {
  const instance = new InitialInstance();

  const model = hsm.define('ReentryMachine',
    hsm.initial(
      hsm.target('container'),

    ),
    hsm.state('container',
      hsm.initial(
        hsm.target('child'),
        hsm.effect(function (ctx, inst, event) {
          inst.data.initialCount = (inst.data.initialCount || 0) + 1;
          inst.logAction('initial-' + inst.data.initialCount);
        })
      ),
      hsm.entry(function (ctx, inst, event) {
        inst.logAction('container-entry');
      }),
      hsm.exit(function (ctx, inst, event) {
        inst.logAction('container-exit');
      }),

      hsm.state('child',
        hsm.entry(function (ctx, inst, event) {
          inst.logAction('child-entry');
        }),
        hsm.exit(function (ctx, inst, event) {
          inst.logAction('child-exit');
        })
      ),

      hsm.transition(
        hsm.on('leave'),
        hsm.target('../outside')
      )
    ),

    hsm.state('outside',
      hsm.entry(function (ctx, inst, event) {
        inst.logAction('outside-entry');
      }),
      hsm.transition(
        hsm.on('return'),
        hsm.target('../container')
      )
    )
  );

  const ctx = new hsm.Context();
  hsm.start(ctx, instance, model);

  // First entry
  assert.strictEqual(instance.data.initialCount, 1);
  assert.strictEqual(instance.state(), '/ReentryMachine/container/child');

  // Leave container
  instance.dispatch({ name: 'leave', kind: hsm.kinds.Event });
  assert.strictEqual(instance.state(), '/ReentryMachine/outside');

  instance.log = [];
  // Return to container - should trigger initial again
  instance.dispatch({ name: 'return', kind: hsm.kinds.Event });
  assert.deepStrictEqual(instance.log, [
    'container-entry',
    'initial-2',
    'child-entry'
  ]);
  assert.strictEqual(instance.data.initialCount, 2);
  assert.strictEqual(instance.state(), '/ReentryMachine/container/child');

  hsm.stop(instance);
});

test('Named initial pseudostates', async function () {
  const instance = new InitialInstance();

  const model = hsm.define('NamedInitialMachine',
    hsm.initial('start',
      hsm.target('multi/state1'),
      hsm.effect(function (ctx, inst, event) {
        inst.logAction('normal-start');
      })
    ),
    hsm.state('multi',
      hsm.initial(
        hsm.target('state1')
      ),
      hsm.state('state1',
        hsm.entry(function (ctx, inst, event) {
          inst.logAction('state1-entry');
        })
      ),
      hsm.state('state2',
        hsm.entry(function (ctx, inst, event) {
          inst.logAction('state2-entry');
        })
      )
    )
  );

  const ctx = new hsm.Context();
  hsm.start(ctx, instance, model);

  // Should use named initial
  assert.deepStrictEqual(instance.log, [
    'normal-start',
    'state1-entry'
  ]);
  assert.strictEqual(instance.state(), '/NamedInitialMachine/multi/state1');

  hsm.stop(instance);
});

test('Complex initial transition scenario', async function () {
  const instance = new InitialInstance();

  const model = hsm.define('ComplexInitialMachine',
    hsm.initial(
      hsm.target('root/branch1')
    ),
    hsm.state('root',
      hsm.initial(
        hsm.target('branch1')
      ),
      hsm.state('branch1',
        hsm.initial(
          hsm.target('leaf1'),
          hsm.effect(function (ctx, inst, event) {
            inst.logAction('branch1-initial');
          })
        ),
        hsm.entry(function (ctx, inst, event) {
          inst.logAction('branch1-entry');
        }),

        hsm.state('leaf1',
          hsm.entry(function (ctx, inst, event) {
            inst.logAction('leaf1-entry');
          }),
          hsm.transition(
            hsm.on('switch'),
            hsm.target('/root/branch2') // Go to branch2
          )
        )
      ),

      hsm.state('branch2',
        hsm.initial(
          hsm.target(
            'choice1'
          )
        ),
        hsm.choice(
          'choice1',
          hsm.transition(
            hsm.guard(function (ctx, inst, event) {
              return inst.data.visited;
            }),
            hsm.target('leaf2b')
          ),
          hsm.transition(
            hsm.target('leaf2a')
          )
        ),
        hsm.entry(function (ctx, inst, event) {
          inst.logAction('branch2-entry');
          inst.data.visited = true;
        }),

        hsm.state('leaf2a',
          hsm.entry(function (ctx, inst, event) {
            inst.logAction('leaf2a-entry');
          })
        ),

        hsm.state('leaf2b',
          hsm.entry(function (ctx, inst, event) {
            inst.logAction('leaf2b-entry');
          })
        )
      )
    )
  );

  const ctx = new hsm.Context();
  hsm.start(ctx, instance, model);

  // Should follow initial transitions through branch1
  assert.deepStrictEqual(instance.log, [
    'branch1-entry',
    'branch1-initial',
    'leaf1-entry'
  ]);
  assert.strictEqual(instance.state(), '/ComplexInitialMachine/root/branch1/leaf1');

  instance.log = [];
  // Switch to branch2 - first time should go to leaf2a
  instance.dispatch({ name: 'switch', kind: hsm.kinds.Event });
  assert.deepStrictEqual(instance.log, [
    'branch2-entry',
    'leaf2b-entry'
  ]);
  assert.strictEqual(instance.state(), '/ComplexInitialMachine/root/branch2/leaf2b');
  assert.strictEqual(instance.data.visited, true);

  hsm.stop(instance);
});

test('Initial transitions with event data passing', async function () {
  const instance = new InitialInstance();

  const model = hsm.define('EventDataInitialMachine',
    hsm.initial(
      hsm.target('parent/child'),
      hsm.effect(function (ctx, inst, event) {
        inst.logAction('initial-effect');
        inst.data.initialEventName = event.name;
        inst.data.initialEventKind = event.kind;
      })
    ),
    hsm.state('parent',
      hsm.initial(
        hsm.target('child')
      ),
      hsm.state('child',
        hsm.entry(function (ctx, inst, event) {
          inst.logAction('child-entry');
          inst.data.childEventName = event.name;
        })
      )
    )
  );

  const ctx = new hsm.Context();
  hsm.start(ctx, instance, model);

  // Initial event should be passed through
  assert.strictEqual(instance.data.initialEventName, 'hsm/initial');
  assert.strictEqual(instance.data.initialEventKind, hsm.kinds.CompletionEvent);
  assert.strictEqual(instance.data.childEventName, 'hsm/initial');

  hsm.stop(instance);
});
