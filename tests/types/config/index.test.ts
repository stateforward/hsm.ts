import * as hsm from "../../../src/index.js";

const canonicalQueue: hsm.QueueShape = {
  Push(context, event) {
    void context;
    void event.name;
  },
  Pop(context) {
    void context;
    return undefined;
  },
  Len(context) {
    void context;
    return 0;
  },
};

const lowercaseQueue: hsm.QueueShape = {
  push(event) {
    void event.name;
  },
  pop() {
    return undefined;
  },
  len() {
    return 0;
  },
};

const asyncPushQueue: hsm.QueueShape = {
  // @ts-expect-error Queue push hooks must be synchronous.
  push(event) {
    void event.name;
    return Promise.resolve();
  },
  pop() {
    return undefined;
  },
  len() {
    return 0;
  },
};

const asyncPopQueue: hsm.QueueShape = {
  push(event) {
    void event.name;
  },
  // @ts-expect-error Queue pop hooks must be synchronous.
  pop() {
    return Promise.resolve(undefined);
  },
  len() {
    return 0;
  },
};

const asyncLenQueue: hsm.QueueShape = {
  push(event) {
    void event.name;
  },
  pop() {
    return undefined;
  },
  // @ts-expect-error Queue len hooks must be synchronous.
  len() {
    return Promise.resolve(0);
  },
};

const canonicalConfig: hsm.Config = hsm.Config({
  ID: "alpha",
  Name: "/Configured",
  Data: { boot: true },
  Clock: {
    now() {
      return 1;
    },
  },
  Queue: canonicalQueue,
});

const positionalConfig: hsm.Config = hsm.Config(
  "beta",
  "/ConfiguredBeta",
  undefined,
  undefined,
  lowercaseQueue,
);

const lowercaseConfig: hsm.Config = hsm.Config({
  id: "gamma",
  name: "/ConfiguredGamma",
  data: undefined,
  queue: lowercaseQueue,
});

void canonicalConfig;
void positionalConfig;
void lowercaseConfig;
void asyncPushQueue;
void asyncPopQueue;
void asyncLenQueue;
