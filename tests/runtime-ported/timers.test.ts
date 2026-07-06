/**
 * @fileoverview Test timer-based transitions (after/every)
 * Tests time-based events that fire after delays or at intervals
 */

import test from "node:test";
import assert from "node:assert";
import * as hsm from "../../src/index.ts";

// Helper to create a delay promise
function delay(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

// Test instance implementation
class TimerInstance extends hsm.Instance {
  constructor() {
    super();
    this.log = [];
    this.data = {
      tickCount: 0,
    };
  }

  logAction(action) {
    this.log.push(action);
  }
}

function manualClock() {
  const callbacks = [];
  const canceled = [];
  return {
    callbacks,
    canceled,
    clock: {
      setTimeout(callback) {
        const id = callbacks.length;
        callbacks.push(callback);
        return id;
      },
      clearTimeout(id) {
        canceled[id] = true;
      },
      now() {
        return 0;
      },
    },
  };
}

test('Basic after timer - fires once after delay', async function () {
  const instance = new TimerInstance();

  const model = hsm.define('BasicAfterMachine',
    hsm.initial(
      hsm.target('waiting')
    ),
    hsm.state(
      'waiting',
      hsm.entry(function (ctx, inst, event) {
        inst.logAction('waiting-entry');
      }),
      hsm.transition(
        hsm.after(function () { return 50; }), // 50ms delay
        hsm.target('/done'),
        hsm.effect(function (ctx, inst, event) {
          inst.logAction('timer-triggered');
        })
      )
    ),
    hsm.state('done',
      hsm.entry(function (ctx, inst, event) {
        inst.logAction('done-entry');
      })
    )
  );

  const ctx = new hsm.Context();
  hsm.start(ctx, instance, model);
  assert.deepStrictEqual(instance.log, ['waiting-entry']);
  assert.strictEqual(instance.state(), '/BasicAfterMachine/waiting');
  // Wait for timer to fire
  await delay(100);

  assert.deepStrictEqual(instance.log, [
    'waiting-entry',
    'timer-triggered',
    'done-entry'
  ]);
  assert.strictEqual(instance.state(), '/BasicAfterMachine/done');

  hsm.stop(instance);
});

test('Stale after timer callback after restart does not dispatch into new run', async function () {
  const instance = new TimerInstance();
  const controlled = manualClock();
  const model = hsm.define('StaleAfterRestartMachine',
    hsm.initial(
      hsm.target('waiting')
    ),
    hsm.state('waiting',
      hsm.transition(
        hsm.after(function () { return 10; }),
        hsm.target('../fired')
      )
    ),
    hsm.state('fired')
  );

  hsm.start(new hsm.Context(), instance, model, { clock: controlled.clock });
  const staleCallback = controlled.callbacks[0];

  await hsm.restart(instance);
  staleCallback();
  await delay(0);

  assert.strictEqual(instance.state(), '/StaleAfterRestartMachine/waiting');
  await hsm.stop(instance);
});

test('After timer aborted on state exit', async function () {
  const instance = new TimerInstance();

  const model = hsm.define('AbortedAfterMachine',
    hsm.initial(
      hsm.target('timed')
    ),
    hsm.state('timed',

      hsm.transition(
        hsm.after(function () { return 100; }), // Long delay
        hsm.target('/timeout'),
        hsm.effect(function (ctx, inst, event) {
          inst.logAction('timeout-fired');
        })
      ),
      hsm.transition(
        hsm.on('cancel'),
        hsm.target('/cancelled'),
        hsm.effect(function (ctx, inst, event) {
          inst.logAction('manual-cancel');
        })
      )
    ),
    hsm.state('timeout'),
    hsm.state('cancelled')
  );

  const ctx = new hsm.Context();
  hsm.start(ctx, instance, model);

  // Cancel before timer fires
  await delay(30);
  instance.dispatch({ name: 'cancel', kind: hsm.kinds.Event });

  assert.deepStrictEqual(instance.log, ['manual-cancel']);
  assert.strictEqual(instance.state(), '/AbortedAfterMachine/cancelled');

  // Wait longer to ensure timer doesn't fire
  await delay(100);
  assert.strictEqual(instance.log.includes('timeout-fired'), false);

  hsm.stop(instance);
});

test('Stale at timer callback after restart does not dispatch into new run', async function () {
  const instance = new TimerInstance();
  const controlled = manualClock();
  const model = hsm.define('StaleAtRestartMachine',
    hsm.initial(
      hsm.target('waiting')
    ),
    hsm.state('waiting',
      hsm.transition(
        hsm.at(function () { return 10; }),
        hsm.target('../fired')
      )
    ),
    hsm.state('fired')
  );

  hsm.start(new hsm.Context(), instance, model, { clock: controlled.clock });
  const staleCallback = controlled.callbacks[0];

  await hsm.restart(instance);
  staleCallback();
  await delay(0);

  assert.strictEqual(instance.state(), '/StaleAtRestartMachine/waiting');
  await hsm.stop(instance);
});

test('Basic every timer - fires repeatedly at intervals', async function () {
  const instance = new TimerInstance();

  const model = hsm.define('BasicEveryMachine',
    hsm.initial(
      hsm.target('counting')
    ),
    hsm.state('counting',
      hsm.entry(function (ctx, inst, event) {
        inst.data.count = 0;
        inst.logAction('counting-entry');
      }),
      hsm.transition(
        hsm.every(function () { return 30; }), // 30ms interval
        hsm.effect(function (ctx, inst, event) {
          inst.data.count++;
          inst.logAction('tick-' + inst.data.count);
        })
      ),
      hsm.transition(
        hsm.on('stop'),
        hsm.target('/stopped'),
        hsm.effect(function (ctx, inst, event) {
          inst.logAction('stopped-at-' + inst.data.count);
        })
      )
    ),
    hsm.state('stopped')
  );

  const ctx = new hsm.Context();
  hsm.start(ctx, instance, model);
  assert.deepStrictEqual(instance.log, ['counting-entry']);

  // Let it tick a few times
  await delay(100);
  console.log('tick-1', instance.log.includes('tick-1'));
  // Should have ticked at least 2-3 times
  assert.strictEqual(instance.data.count >= 2, true);
  assert.strictEqual(instance.log.includes('tick-1'), true);
  assert.strictEqual(instance.log.includes('tick-2'), true);

  // Stop the timer
  instance.dispatch({ name: 'stop', kind: hsm.kinds.Event });

  const finalCount = instance.data.count;
  assert.strictEqual(instance.log.includes('stopped-at-' + finalCount), true);

  // Wait and ensure no more ticks
  await delay(50);
  assert.strictEqual(instance.data.count, finalCount);

  hsm.stop(instance);
});

test('Every timer does not grow cancellation listeners on each tick', async function () {
  let timerCtx;
  const instance = new TimerInstance();

  const model = hsm.define('EveryListenerGrowthMachine',
    hsm.initial(
      hsm.target('ticking')
    ),
    hsm.state('ticking',
      hsm.transition(
        hsm.every(function (ctx) {
          timerCtx = ctx;
          return 1;
        }),
        hsm.effect(function (ctx, inst) {
          inst.data.tickCount++;
        })
      )
    )
  );

  hsm.start(new hsm.Context(), instance, model);
  await delay(35);

  assert.strictEqual(instance.data.tickCount > 5, true);
  assert.strictEqual(timerCtx.listeners.length <= 2, true);
  await hsm.stop(instance);
  assert.strictEqual(timerCtx.listeners.length <= 2, true);
});

test('Multiple timers in same state', async function () {
  const instance = new TimerInstance();

  const model = hsm.define('MultipleTimerMachine',
    hsm.initial(
      hsm.target('multi')
    ),
    hsm.state('multi',

      hsm.transition(
        hsm.after(function () { return 40; }),
        hsm.target('/path1'),
        hsm.effect(function (ctx, inst, event) {
          inst.logAction('timer1-fired');
        })
      ),
      hsm.transition(
        hsm.after(function () { return 80; }),
        hsm.target('/path2'),
        hsm.effect(function (ctx, inst, event) {
          inst.logAction('timer2-fired');
        })
      )
    ),
    hsm.state('path1'),
    hsm.state('path2')
  );

  const ctx = new hsm.Context();
  hsm.start(ctx, instance, model);

  // First timer should fire first
  await delay(60);
  assert.deepStrictEqual(instance.log, ['timer1-fired']);
  assert.strictEqual(instance.state(), '/MultipleTimerMachine/path1');

  // Second timer should not fire because we've exited the state
  await delay(40);
  assert.strictEqual(instance.log.includes('timer2-fired'), false);

  hsm.stop(instance);
});

test('Failed after transition preserves sibling one-shot timers', async function () {
  const instance = new TimerInstance();
  const model = hsm.define('TimerSiblingRollbackMachine',
    hsm.initial(
      hsm.target('waiting')
    ),
    hsm.state('waiting',
      hsm.transition(
        hsm.after(function () { return 10; }),
        hsm.effect(function (ctx, inst) {
          inst.logAction('first-fired');
          throw new Error('first failed');
        }),
        hsm.target('../failed')
      ),
      hsm.transition(
        hsm.after(function () { return 40; }),
        hsm.effect(function (ctx, inst) {
          inst.logAction('second-fired');
        }),
        hsm.target('../done')
      )
    ),
    hsm.state('failed'),
    hsm.state('done')
  );

  hsm.start(new hsm.Context(), instance, model);
  await delay(100);

  assert.deepStrictEqual(instance.log, ['first-fired', 'second-fired']);
  assert.strictEqual(instance.state(), '/TimerSiblingRollbackMachine/done');
  await hsm.stop(instance);
});

test('Timer with dynamic duration based on instance data', async function () {
  const instance = new TimerInstance();
  instance.data.delay = 60;

  const model = hsm.define('DynamicTimerMachine',
    hsm.initial(
      hsm.target('waiting')
    ),
    hsm.state('waiting',

      hsm.entry(function (ctx, inst, event) {
        inst.logAction('waiting-with-delay-' + inst.data.delay);
      }),
      hsm.transition(
        hsm.after(function (ctx, inst, event) {
          return inst.data.delay;
        }),
        hsm.target('/finished'),
        hsm.effect(function (ctx, inst, event) {
          inst.logAction('dynamic-timer-fired');
        })
      )
    ),
    hsm.state('finished')
  );
  console.log('model', model.deferredMap);
  const ctx = new hsm.Context();
  hsm.start(ctx, instance, model);
  assert.deepStrictEqual(instance.log, ['waiting-with-delay-60']);

  // Timer should fire after instance.data.delay ms
  await delay(80);
  assert.deepStrictEqual(instance.log, [
    'waiting-with-delay-60',
    'dynamic-timer-fired'
  ]);
  assert.strictEqual(instance.state(), '/DynamicTimerMachine/finished');

  hsm.stop(instance);
});

test('Timer with event data access', async function () {
  const instance = new TimerInstance();

  const model = hsm.define('EventDataTimerMachine',
    hsm.initial(
      hsm.target('timed')
    ),
    hsm.state('timed',

      hsm.transition(
        hsm.after(function (ctx, inst, event) {
          inst.data.timerEvent = event;
          return 50;
        }),
        hsm.target('/triggered')
      )
    ),
    hsm.state('triggered')
  );

  const ctx = new hsm.Context();
  hsm.start(ctx, instance, model);

  // Timer function should receive initial event
  assert.strictEqual(instance.data.timerEvent.name, 'hsm/initial');

  await delay(70);
  assert.strictEqual(instance.state(), '/EventDataTimerMachine/triggered');

  hsm.stop(instance);
});

test('Zero or negative timer duration', async function () {
  const instance = new TimerInstance();

  const model = hsm.define('ZeroTimerMachine',
    hsm.initial(
      hsm.target('immediate')
    ),
    hsm.state('immediate',
      hsm.transition(
        hsm.after(function () { return 0; }), // Immediate
        hsm.target('/done'),
        hsm.effect(function (ctx, inst, event) {
          inst.logAction('immediate-timer');
        })
      )
    ),
    hsm.state('done')
  );

  const ctx = new hsm.Context();
  hsm.start(ctx, instance, model);

  // Zero duration timers fire immediately.
  await delay(20);

  assert.strictEqual(instance.state(), '/ZeroTimerMachine/done');
  assert.strictEqual(instance.log.includes('immediate-timer'), true);

  hsm.stop(instance);
});

test('Timer in hierarchical state', async function () {
  const instance = new TimerInstance();

  const model = hsm.define('HierarchicalTimerMachine',
    hsm.initial(
      hsm.target('parent/child')
    ),
    hsm.state('parent',


      hsm.state(
        'child',
        hsm.transition(
          hsm.after(function () { return 50; }),
          hsm.target('/done'),
          hsm.effect(function (ctx, inst, event) {
            inst.logAction('parent-handled-timeout');
          })
        )
      )
    ),
    hsm.state('done')
  );

  const ctx = new hsm.Context();
  hsm.start(ctx, instance, model);
  assert.strictEqual(instance.state(), '/HierarchicalTimerMachine/parent/child');

  // Timer should fire and bubble up
  await delay(70);

  assert.deepStrictEqual(instance.log, ['parent-handled-timeout']);
  assert.strictEqual(instance.state(), '/HierarchicalTimerMachine/done');

  hsm.stop(instance);
});

test('Every timer with abort signal handling', async function () {
  const instance = new TimerInstance();

  const model = hsm.define('EveryTimerAbortMachine',
    hsm.initial(
      hsm.target('active')
    ),
    hsm.state('active',
      hsm.entry(function (ctx, inst, event) {
        inst.data.tickCount = 0;
      }),
      hsm.transition(
        hsm.every(function () { return 25; }),
        hsm.effect(function (ctx, inst, event) {
          inst.data.tickCount++;
          inst.logAction('tick-' + inst.data.tickCount);
        })
      ),
      hsm.transition(
        hsm.on('finish'),
        hsm.target('../finished')
      )
    ),
    hsm.state('finished',
      hsm.entry(function (ctx, inst, event) {
        inst.logAction('finished-at-tick-' + inst.data.tickCount);
      })
    )
  );

  const ctx = new hsm.Context();
  hsm.start(ctx, instance, model);

  // Let it tick a few times
  await delay(80);
  assert.strictEqual(instance.data.tickCount >= 2, true, `tickCount: ${instance.data.tickCount}`);

  // Stop while ticking
  instance.dispatch({ name: 'finish', kind: hsm.kinds.Event });
  const finalTick = instance.data.tickCount;

  // Wait and ensure no more ticks
  await delay(50);
  assert.strictEqual(instance.data.tickCount, finalTick);
  assert.strictEqual(instance.log.includes('finished-at-tick-' + finalTick), true);

  hsm.stop(instance);
});
