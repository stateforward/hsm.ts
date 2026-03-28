type AnyAttributes = Record<string, unknown>;
type AnyEventData = unknown;
type AnyEvent = Event<string, unknown>;
type AnyOperations = Record<string, unknown>;

type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends bigint
        ? bigint
        : T;

type Simplify<T> = { [K in keyof T]: T[K] } & {};
type UnionToIntersection<U> = (
  U extends unknown ? (value: U) => void : never
) extends (value: infer I) => void
  ? I
  : never;

type AttributeMarker<A extends AnyAttributes = {}> = {
  readonly __attributes__?: A;
};

type StateMarker<S extends string = never> = {
  readonly __states__?: S;
};

type EventMarker<E extends AnyEvent = never> = {
  readonly __events__?: E;
};

type OperationMarker<O extends AnyOperations = {}> = {
  readonly __operations__?: O;
};

type StateRefMarker<R extends string = never> = {
  readonly __state_refs__?: R;
};

type AttributesFromPartial<P> = P extends AttributeMarker<infer A> ? A : {};
type StatesFromPartial<P> = P extends StateMarker<infer S> ? S : never;
type EventsFromPartial<P> = P extends EventMarker<infer E> ? E : never;
type OperationsFromPartial<P> = P extends OperationMarker<infer O> ? O : {};
type StateRefsFromPartial<P> = P extends StateRefMarker<infer R> ? R : never;

type MergeAttributes<Partials extends readonly unknown[]> = Simplify<
  UnionToIntersection<AttributesFromPartial<Partials[number]>>
>;

type MergeStates<Partials extends readonly unknown[]> = StatesFromPartial<
  Partials[number]
>;

type MergeEvents<Partials extends readonly unknown[]> = EventsFromPartial<
  Partials[number]
>;

type MergeOperations<Partials extends readonly unknown[]> = Simplify<
  UnionToIntersection<OperationsFromPartial<Partials[number]>>
>;

type MergeStateRefs<Partials extends readonly unknown[]> = StateRefsFromPartial<
  Partials[number]
>;

type PrefixStatePaths<Name extends string, States extends string> = [
  States,
] extends [never]
  ? never
  : `${Name}/${States}`;

type QualifyStatePaths<ModelName extends string, States extends string> = [
  States,
] extends [never]
  ? never
  : `/${ModelName}/${States}`;

type AbsoluteStateRefs<States extends string> = [States] extends [never]
  ? never
  : `/${States}`;

type RelativeStateRefs<Partials extends readonly unknown[]> = Exclude<
  MergeStateRefs<Partials>,
  `/${string}`
>;

type InvalidRelativeStateRefs<
  States extends string,
  Partials extends readonly unknown[],
> = Exclude<RelativeStateRefs<Partials>, States>;

type InvalidAbsoluteStateRefs<
  States extends string,
  Partials extends readonly unknown[],
> = Exclude<Extract<MergeStateRefs<Partials>, `/${string}`>, AbsoluteStateRefs<States>>;

type ValidateRelativeStateRefs<
  States extends string,
  Partials extends readonly unknown[],
> = [InvalidRelativeStateRefs<States, Partials>] extends [never] ? unknown : never;

type ValidateAllStateRefs<
  States extends string,
  Partials extends readonly unknown[],
> = [InvalidRelativeStateRefs<States, Partials> | InvalidAbsoluteStateRefs<States, Partials>] extends [never]
  ? unknown
  : never;

export interface Event<N extends string = string, T = AnyEventData> {
  kind: number;
  name: N;
  data?: T;
  schema?: unknown;
  source?: string;
  target?: string;
  id?: string;
}

export interface EventSnapshot {
  event: string;
  target?: string;
  guard: boolean;
  schema?: unknown;
}

export interface Snapshot {
  id: string;
  qualifiedName: string;
  state: string;
  attributes: Record<string, unknown>;
  queueLen: number;
  events: EventSnapshot[];
}

export interface ClockConfig {
  setTimeout?: typeof setTimeout;
  clearTimeout?: typeof clearTimeout;
  now?: () => number;
}

export interface Config {
  id?: string;
  name?: string;
  data?: unknown;
  clock?: ClockConfig;
}

export const DefaultClock: Required<ClockConfig> = {
  clearTimeout,
  now: () => Date.now(),
  setTimeout,
};

export type TypedModel<
  A extends AnyAttributes = {},
  S extends string = never,
  E extends AnyEvent = never,
  O extends AnyOperations = {},
> = Record<string, unknown> &
  AttributeMarker<A> &
  StateMarker<S> &
  EventMarker<E> &
  OperationMarker<O>;

export type AttributesOf<M> = M extends TypedModel<infer A, any, any, any>
  ? A extends AnyAttributes
    ? A
    : {}
  : {};

export type RelativeStatePathsOf<M> = M extends TypedModel<any, infer S, any, any>
  ? S extends string
    ? S
    : never
  : never;

export type StatePathsOf<M> = M extends TypedModel<any, infer S, any, any>
  ? S extends string
    ? S
    : never
  : never;

export type EventsOf<M> = M extends TypedModel<any, any, infer E, any>
  ? E extends AnyEvent
    ? E
    : never
  : never;

export type EventNamesOf<M> = EventsOf<M> extends infer E
  ? E extends { name: infer N }
    ? N extends string
      ? N
      : never
    : never
  : never;

export type EventOfName<M, N extends EventNamesOf<M>> = Extract<
  EventsOf<M>,
  { name: N }
>;

export type OperationsOf<M> = M extends TypedModel<any, any, any, infer O>
  ? {
      [K in keyof O as O[K] extends (...args: any[]) => any ? K : never]: O[K];
    }
  : {};

type ModelDispatchEvent<M> = [EventsOf<M>] extends [never] ? Event : EventsOf<M>;

export type TypedPartialElement<
  T = unknown,
  A extends AnyAttributes = {},
  S extends string = never,
  E extends AnyEvent = never,
  O extends AnyOperations = {},
  R extends string = never,
> = ((ctx: BuildContext) => T | void) &
  AttributeMarker<A> &
  StateMarker<S> &
  EventMarker<E> &
  OperationMarker<O> &
  StateRefMarker<R>;

type AnyPartialElement = TypedPartialElement<any, AnyAttributes, any, any, any, any>;
type PartialArgs<P extends readonly unknown[]> = P &
  readonly TypedPartialElement<any, AnyAttributes, string, AnyEvent, AnyOperations, string>[];

type PartialOrName = string | AnyPartialElement;

type TypedBehavior<E extends AnyEvent = AnyEvent, R = unknown> = (
  ctx: Context,
  instance: Instance,
  event: E,
) => R;

type TypedOperationInput<E extends AnyEvent = AnyEvent, R = unknown> =
  | string
  | TypedBehavior<E, R>;

type OperationArgs<Ops extends readonly unknown[]> = Ops &
  readonly TypedOperationInput<any, unknown>[];

type OperationEvent<Input> = Input extends (
  ctx: Context,
  instance: Instance,
  event: infer E,
) => any
  ? E extends AnyEvent
    ? E
    : never
  : never;

type MergeOperationEvents<Inputs extends readonly unknown[]> = OperationEvent<
  Inputs[number]
>;

interface RuntimeAttribute {
  defaultValue: unknown;
  hasDefault: boolean;
}

interface RuntimeTransition {
  source: string;
  target?: string;
  events: string[];
  guard?: TypedBehavior<any, boolean>;
  effect?: TypedBehavior<any, unknown>;
}

interface RuntimeState {
  name: string;
  qualifiedName: string;
  transitions: RuntimeTransition[];
  initial?: string;
}

interface RuntimeModel {
  name: string;
  qualifiedName: string;
  attributes: Record<string, RuntimeAttribute>;
  operations: Record<string, (...args: any[]) => any>;
  events: Record<string, Event>;
  states: Record<string, RuntimeState>;
  initial?: string;
}

interface BuildContext {
  model: RuntimeModel;
  currentState?: RuntimeState;
  currentTransition?: RuntimeTransition;
}

const MODEL = Symbol("hsm.model");
let nextInstanceId = 1;
let nextKind = 1;

const defineKind = () => nextKind++;

export const kinds = {
  CallEvent: defineKind(),
  ChangeEvent: defineKind(),
  Event: defineKind(),
  InitialEvent: defineKind(),
  State: defineKind(),
  Transition: defineKind(),
};

export const Kinds = kinds;

export const makeKind = (...baseKinds: number[]) =>
  baseKinds.reduce((value, kind) => value | kind, defineKind());

export const isKind = (kindValue: number, ...baseKinds: number[]) =>
  baseKinds.every((kind) => (kindValue & kind) === kind);

export const join = (...segments: string[]) => {
  const parts = segments
    .flatMap((segment) => segment.split("/"))
    .filter(Boolean);

  return `/${parts.join("/")}`;
};

export const dirname = (path: string) => {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.length ? `/${parts.join("/")}` : "/";
};

export const isAbsolute = (path: string) => path.startsWith("/");

export const isAncestor = (ancestor: string, descendant: string) =>
  descendant === ancestor || descendant.startsWith(`${ancestor}/`);

export const lca = (a: string, b: string) => {
  const left = a.split("/").filter(Boolean);
  const right = b.split("/").filter(Boolean);
  const common: string[] = [];

  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] !== right[index]) {
      break;
    }
    common.push(left[index]!);
  }

  return common.length ? `/${common.join("/")}` : "/";
};

export const InitialEvent: Event<"hsm_initial"> = {
  kind: kinds.InitialEvent,
  name: "hsm_initial",
};

export const FinalEvent: Event<"hsm_final"> = {
  kind: kinds.Event,
  name: "hsm_final",
};

export const ErrorEvent: Event<"hsm_error"> = {
  kind: kinds.Event,
  name: "hsm_error",
};

const resolveStateRef = (
  model: RuntimeModel,
  state: RuntimeState | undefined,
  name: string,
) => {
  if (isAbsolute(name)) {
    return join(model.qualifiedName, name.slice(1));
  }
  return join(state?.qualifiedName ?? model.qualifiedName, name);
};

const localName = (path: string) => path.split("/").filter(Boolean).at(-1) ?? path;

const runtimeModelOf = (model: TypedModel<any, any, any, any>) =>
  (model as Record<PropertyKey, unknown>)[MODEL] as RuntimeModel;

const asPartial = <
  T = unknown,
  A extends AnyAttributes = {},
  S extends string = never,
  E extends AnyEvent = never,
  O extends AnyOperations = {},
  R extends string = never,
>(
  partial: (ctx: BuildContext) => T | void,
) => partial as TypedPartialElement<T, A, S, E, O, R>;

const composeOperations = (operations: readonly TypedOperationInput[]) =>
  operations.reduce<TypedBehavior<any, unknown> | undefined>((composed, operation) => {
    const next =
      typeof operation === "string"
        ? ((ctx, instance, event) => instance.call(operation, ctx, event)) satisfies TypedBehavior
        : operation;

    if (!composed) {
      return next;
    }

    return (ctx, instance, event) => {
      composed(ctx, instance, event);
      return next(ctx, instance, event);
    };
  }, undefined);

export class Context {
  listeners: Array<() => void> = [];
  instances: Record<string, Instance> = {};
  done = false;

  addEventListener(type: "done", listener: () => void) {
    if (type === "done") {
      this.listeners.push(listener);
    }
  }

  removeEventListener(type: "done", listener: () => void) {
    if (type === "done") {
      this.listeners = this.listeners.filter((entry) => entry !== listener);
    }
  }
}

export class Instance {
  _hsm: HSM<any, this> | null = null;

  dispatch(event: Event) {
    this._hsm?.dispatch(event);
  }

  state() {
    return this._hsm?.state() ?? "";
  }

  context() {
    return this._hsm?.ctx ?? new Context();
  }

  clock() {
    return this._hsm?.clock() ?? DefaultClock;
  }

  get(name: string) {
    return this._hsm?.get(name);
  }

  set(name: string, value: unknown) {
    this._hsm?.set(name, value);
  }

  call(name: string, ...args: unknown[]) {
    return this._hsm?.call(name, ...args);
  }

  restart(data?: unknown) {
    this._hsm?.restart(data);
  }

  takeSnapshot() {
    return this._hsm?.takeSnapshot() ?? {
      attributes: {},
      events: [],
      id: "",
      qualifiedName: "",
      queueLen: 0,
      state: "",
    };
  }
}

export class Queue {
  backHead = 0;
  back: Array<Event | undefined> = [];
  front: Event[] = [];

  len() {
    return this.front.length + this.back.length - this.backHead;
  }

  pop() {
    if (this.front.length > 0) {
      return this.front.shift();
    }

    if (this.backHead >= this.back.length) {
      return undefined;
    }

    const value = this.back[this.backHead];
    this.backHead += 1;
    return value;
  }

  push(...events: Event[]) {
    this.back.push(...events);
  }
}

export class HSM<
  M extends TypedModel<any, any, any, any> = TypedModel<any, any, any, any>,
  T extends Instance = Instance,
> {
  readonly _hsm = this;
  readonly queue = new Queue();
  readonly id: string;
  readonly name: string;
  readonly qualifiedName: string;
  readonly model: M;
  readonly ctx: Context;
  readonly instance: T;
  private readonly runtimeModel: RuntimeModel;
  private readonly clockConfig: Required<ClockConfig>;
  private attributes: Record<string, unknown> = {};
  private currentState = "";

  constructor(ctx: Context, instance: T, model: M, config?: Config) {
    this.ctx = ctx;
    this.instance = instance;
    this.model = model;
    this.runtimeModel = runtimeModelOf(model);
    this.id = config?.id ?? `${this.runtimeModel.name}-${nextInstanceId++}`;
    this.name = config?.name ?? this.runtimeModel.name;
    this.qualifiedName = this.runtimeModel.qualifiedName;
    this.clockConfig = {
      ...DefaultClock,
      ...(config?.clock ?? {}),
    };

    ctx.instances[this.id] = instance;
    instance._hsm = this;
    this.initialize();
  }

  private initialize() {
    this.attributes = Object.fromEntries(
      Object.entries(this.runtimeModel.attributes).map(([name, definition]) => [
        name,
        definition.hasDefault ? definition.defaultValue : undefined,
      ]),
    );

    this.currentState = this.resolveInitialState(
      this.runtimeModel.initial ?? Object.keys(this.runtimeModel.states)[0] ?? "",
    );
  }

  private resolveInitialState(path: string): string {
    let current = path;

    while (current) {
      const state = this.runtimeModel.states[current];
      if (!state?.initial) {
        return current;
      }
      current = state.initial;
    }

    return path;
  }

  private transitionsFor(path: string) {
    return this.runtimeModel.states[path]?.transitions ?? [];
  }

  dispatch(event: ModelDispatchEvent<M>) {
    const transition = this.transitionsFor(this.currentState).find((candidate) =>
      candidate.events.includes(event.name),
    );

    if (!transition) {
      return;
    }

    if (transition.guard && !transition.guard(this.ctx, this.instance, event)) {
      return;
    }

    if (transition.effect) {
      transition.effect(this.ctx, this.instance, event);
    }

    if (transition.target) {
      this.currentState = this.resolveInitialState(transition.target);
    }
  }

  state(): StatePathsOf<M> {
    return this.currentState as StatePathsOf<M>;
  }

  start() {
    return this;
  }

  stop() {
    delete this.ctx.instances[this.id];
    this.instance._hsm = null;
  }

  restart(_data?: unknown) {
    this.initialize();
  }

  clock() {
    return this.clockConfig;
  }

  get<K extends string>(
    name: K,
  ): K extends keyof AttributesOf<M> ? AttributesOf<M>[K] : unknown {
    return this.attributes[name] as K extends keyof AttributesOf<M>
      ? AttributesOf<M>[K]
      : unknown;
  }

  set<K extends string>(
    name: K,
    value: NoInfer<
      K extends keyof AttributesOf<M> ? AttributesOf<M>[K] : unknown
    >,
  ) {
    this.attributes[name] = value;
  }

  call<K extends keyof OperationsOf<M> & string>(
    name: K,
    ...args: Parameters<OperationsOf<M>[K]>
  ): ReturnType<OperationsOf<M>[K]>;
  call(name: string, ...args: unknown[]): unknown;
  call(name: string, ...args: unknown[]) {
    const operation = this.runtimeModel.operations[name];
    if (!operation) {
      throw new Error(`Unknown operation "${name}"`);
    }
    return operation(...args);
  }

  takeSnapshot(): Snapshot {
    return {
      attributes: { ...this.attributes },
      events: this.transitionsFor(this.currentState).map((transition) => ({
        event: transition.events[0] ?? "",
        guard: Boolean(transition.guard),
        schema: this.runtimeModel.events[transition.events[0] ?? ""]?.schema,
        target: transition.target,
      })),
      id: this.id,
      qualifiedName: this.qualifiedName,
      queueLen: this.queue.len(),
      state: this.currentState,
    };
  }
}

export type TypedHSM<
  M extends TypedModel<any, any, any, any> = TypedModel<any, any, any, any>,
  T extends Instance = Instance,
> = HSM<M, T>;

export class Group {
  private readonly instances: Instance[];

  constructor(...instances: Instance[]) {
    this.instances = instances;
  }

  dispatch(event: Event) {
    this.instances.forEach((instance) => instance.dispatch(event));
  }

  clock() {
    return this.instances[0]?.clock() ?? DefaultClock;
  }

  set(name: string, value: unknown) {
    this.instances.forEach((instance) => instance.set(name, value));
  }

  call(name: string, ...args: unknown[]) {
    return this.instances.map((instance) => instance.call(name, ...args));
  }

  stop() {
    this.instances.forEach((instance) => instance._hsm?.stop());
  }

  restart(data?: unknown) {
    this.instances.forEach((instance) => instance.restart(data));
  }

  takeSnapshot() {
    return this.instances[0]?.takeSnapshot() ?? {
      attributes: {},
      events: [],
      id: "",
      qualifiedName: "",
      queueLen: 0,
      state: "",
    };
  }
}

export const event = <const N extends string, D = unknown>(
  name: N,
  schema?: D,
): Event<N, D> => ({
  kind: kinds.Event,
  name,
  schema,
});

export function source<const Name extends string>(
  name: Name,
): TypedPartialElement<unknown, {}, never, never, {}, Name | `/${Name}`>;
export function source(name: string): TypedPartialElement {
  return asPartial((ctx) => {
    if (ctx.currentTransition) {
      ctx.currentTransition.source = resolveStateRef(ctx.model, ctx.currentState, name);
    }
  });
}

export function target<const Name extends string>(
  name: Name,
): TypedPartialElement<unknown, {}, never, never, {}, Name | `/${Name}`>;
export function target(name: string): TypedPartialElement {
  return asPartial((ctx) => {
    if (ctx.currentTransition) {
      ctx.currentTransition.target = resolveStateRef(ctx.model, ctx.currentState, name);
    }
  });
}

export function on<const E extends AnyEvent>(event: E): TypedPartialElement<
  unknown,
  {},
  never,
  E
>;
export function on<const Name extends string>(
  event: Name,
): TypedPartialElement<unknown, {}, never, Event<Name>>;
export function on(eventOrName: Event | string): TypedPartialElement {
  return asPartial((ctx) => {
    const eventValue =
      typeof eventOrName === "string" ? event(eventOrName) : eventOrName;

    ctx.model.events[eventValue.name] = eventValue;
    ctx.currentTransition?.events.push(eventValue.name);
  });
}

export function onSet<const Name extends string>(
  name: Name,
): TypedPartialElement<unknown, {}, never, Event<string>> {
  return on(`set:${name}`);
}

export function onCall<const Name extends string>(
  name: Name,
): TypedPartialElement<unknown, {}, never, Event<string>> {
  return on(`call:${name}`);
}

export function when<const Name extends string>(
  name: Name,
): TypedPartialElement<unknown, {}, never, Event<string>>;
export function when<const E extends AnyEvent>(
  expr: TypedBehavior<E, unknown>,
): TypedPartialElement<unknown, {}, never, E>;
export function when(expr: string | TypedBehavior): TypedPartialElement {
  return (
    typeof expr === "string"
      ? onSet(expr)
      : guard(expr as TypedBehavior<any, boolean>)
  ) as TypedPartialElement;
}

export function entry<const Ops extends readonly unknown[]>(
  ...operations: OperationArgs<Ops>
): TypedPartialElement<unknown, {}, never, MergeOperationEvents<Ops>> {
  return asPartial(() => {
    void operations;
  });
}

export const exit = entry;
export const activity = entry;

export function effect<const Ops extends readonly unknown[]>(
  ...operations: OperationArgs<Ops>
): TypedPartialElement<unknown, {}, never, MergeOperationEvents<Ops>> {
  const implementation = composeOperations(operations as readonly TypedOperationInput[]);

  return asPartial((ctx) => {
    if (ctx.currentTransition) {
      ctx.currentTransition.effect = implementation;
    }
  });
}

export function guard<const E extends AnyEvent>(
  expression: string | TypedBehavior<E, boolean>,
): TypedPartialElement<unknown, {}, never, E>;
export function guard(
  expression: string | TypedBehavior,
): TypedPartialElement {
  return asPartial((ctx) => {
    if (ctx.currentTransition) {
      ctx.currentTransition.guard =
        typeof expression === "string"
          ? (((_, instance) => Boolean(instance.call(expression))) as TypedBehavior<
              any,
              boolean
            >)
          : (expression as TypedBehavior<any, boolean>);
    }
  });
}

export const after = (_duration: string | TypedBehavior) => asPartial(() => {});
export const every = after;
export const at = after;
export const defer = (..._eventNames: string[]) => asPartial(() => {});

export function final<const Name extends string>(
  name: Name,
): TypedPartialElement<unknown, {}, Name>;
export function final(name: string): TypedPartialElement {
  return state(name) as TypedPartialElement;
}

export function state<
  const Name extends string,
  const P extends readonly unknown[],
>(
  name: Name,
  ...partials: PartialArgs<P>
): TypedPartialElement<
  unknown,
  MergeAttributes<P>,
  Name | PrefixStatePaths<Name, MergeStates<P>>,
  MergeEvents<P>,
  MergeOperations<P>,
  MergeStateRefs<P>
>;
export function state(name: string, ...partials: TypedPartialElement[]): TypedPartialElement {
  return asPartial((ctx) => {
    const qualifiedName = join(ctx.currentState?.qualifiedName ?? ctx.model.qualifiedName, name);
    const runtimeState: RuntimeState = {
      name,
      qualifiedName,
      transitions: [],
    };

    ctx.model.states[qualifiedName] = runtimeState;

    const nested: BuildContext = {
      ...ctx,
      currentState: runtimeState,
    };

    partials.forEach((partial) => partial(nested));
  });
}

export function initial<
  const Name extends string,
  const P extends readonly unknown[],
>(
  elementOrName: Name,
  ...partials: PartialArgs<P>
): TypedPartialElement<
  unknown,
  MergeAttributes<P>,
  MergeStates<P>,
  MergeEvents<P>,
  MergeOperations<P>,
  Name | `/${Name}` | MergeStateRefs<P>
>;
export function initial<
  const I extends AnyPartialElement,
  const P extends readonly unknown[],
>(
  elementOrName: I,
  ...partials: PartialArgs<P>
): TypedPartialElement<
  unknown,
  Simplify<AttributesFromPartial<I> & MergeAttributes<P>>,
  StatesFromPartial<I> | MergeStates<P>,
  EventsFromPartial<I> | MergeEvents<P>,
  Simplify<OperationsFromPartial<I> & MergeOperations<P>>,
  StateRefsFromPartial<I> | MergeStateRefs<P>
>;
export function initial<const P extends readonly unknown[]>(
  elementOrName?: undefined,
  ...partials: PartialArgs<P>
): TypedPartialElement<
  unknown,
  MergeAttributes<P>,
  MergeStates<P>,
  MergeEvents<P>,
  MergeOperations<P>,
  MergeStateRefs<P>
>;
export function initial(
  elementOrName?: PartialOrName,
  ...partials: TypedPartialElement[]
): TypedPartialElement {
  return asPartial((ctx) => {
    const transition: RuntimeTransition = {
      events: [InitialEvent.name],
      source: ctx.currentState?.qualifiedName ?? ctx.model.qualifiedName,
    };

    const initialContext: BuildContext = {
      ...ctx,
      currentTransition: transition,
    };

    if (typeof elementOrName === "string") {
      target(elementOrName)(initialContext);
    } else if (elementOrName) {
      elementOrName(initialContext);
    }

    partials.forEach((partial) => partial(initialContext));

    const resolvedTarget = transition.target;
    if (!resolvedTarget) {
      return;
    }

    if (ctx.currentState) {
      ctx.currentState.initial = resolvedTarget;
    } else {
      ctx.model.initial = resolvedTarget;
    }
  });
}

export function transition<const P extends readonly unknown[]>(
  ...partials: PartialArgs<P>
): TypedPartialElement<
  unknown,
  MergeAttributes<P>,
  MergeStates<P>,
  MergeEvents<P>,
  MergeOperations<P>,
  MergeStateRefs<P>
>;
export function transition(...partials: TypedPartialElement[]): TypedPartialElement {
  return asPartial((ctx) => {
    const state = ctx.currentState;
    if (!state) {
      return;
    }

    const runtimeTransition: RuntimeTransition = {
      events: [],
      source: state.qualifiedName,
    };

    const transitionContext: BuildContext = {
      ...ctx,
      currentTransition: runtimeTransition,
    };

    partials.forEach((partial) => partial(transitionContext));
    state.transitions.push(runtimeTransition);
  });
}

export const choice = state;
export const shallowHistory = state;
export const deepHistory = state;

export function attribute<const N extends string>(
  name: N,
): TypedPartialElement<unknown, Record<N, unknown>>;
export function attribute<const N extends string, V>(
  name: N,
  defaultValue: V,
): TypedPartialElement<unknown, Record<N, Widen<V>>>;
export function attribute(
  name: string,
  defaultValue?: unknown,
): TypedPartialElement {
  const hasDefault = arguments.length > 1;

  return asPartial((ctx) => {
    ctx.model.attributes[name] = {
      defaultValue,
      hasDefault,
    };
  });
}

export function operation<
  const Name extends string,
  F extends (...args: any[]) => any,
>(
  name: Name,
  implementation: F,
): TypedPartialElement<unknown, {}, never, never, Record<Name, F>>;
export function operation(
  name: string,
  implementation: (...args: any[]) => any,
): TypedPartialElement {
  return asPartial((ctx) => {
    ctx.model.operations[name] = implementation;
  });
}

const validateModel = (model: RuntimeModel) => {
  const knownStates = new globalThis.Set(Object.keys(model.states));

  if (model.initial && !knownStates.has(model.initial)) {
    throw new Error(`Unknown initial target "${model.initial}"`);
  }

  Object.values(model.states).forEach((state) => {
    if (state.initial && !knownStates.has(state.initial)) {
      throw new Error(`Unknown initial target "${state.initial}"`);
    }

    state.transitions.forEach((transition) => {
      if (transition.target && !knownStates.has(transition.target)) {
        throw new Error(`Unknown transition target "${transition.target}"`);
      }
      if (transition.source && !knownStates.has(transition.source)) {
        throw new Error(`Unknown transition source "${transition.source}"`);
      }
    });
  });
};

export function define<
  const Name extends string,
  const P extends readonly unknown[],
>(
  name: Name,
  ...partials: PartialArgs<P> & ValidateAllStateRefs<MergeStates<P>, P>
): TypedModel<
  MergeAttributes<P>,
  QualifyStatePaths<Name, MergeStates<P>>,
  MergeEvents<P>,
  MergeOperations<P>
>;
export function define<M extends TypedModel<any, any, any, any>>(
  name: string,
  ...partials: AnyPartialElement[]
): M;
export function define(name: string, ...partials: AnyPartialElement[]) {
  const runtimeModel: RuntimeModel = {
    attributes: {},
    events: {},
    name,
    operations: {},
    qualifiedName: `/${name}`,
    states: {},
  };

  const context: BuildContext = { model: runtimeModel };
  partials.forEach((partial) => partial(context));
  validateModel(runtimeModel);

  const model = { [MODEL]: runtimeModel } as TypedModel<any, any, any, any>;
  return model;
}

export function start<M extends TypedModel<any, any, any, any>, T extends Instance>(
  instance: T,
  model: M,
  config?: Config,
): HSM<M, T>;
export function start<M extends TypedModel<any, any, any, any>, T extends Instance>(
  ctx: Context,
  instance: T,
  model: M,
  config?: Config,
): HSM<M, T>;
export function start(...args: unknown[]) {
  if (args[0] instanceof Context) {
    const [ctx, instance, model, config] = args as [Context, Instance, TypedModel, Config | undefined];
    return new HSM(ctx, instance, model, config);
  }

  const [instance, model, config] = args as [Instance, TypedModel, Config | undefined];
  return new HSM(new Context(), instance, model, config);
}

export const stop = (instance: Instance) => instance._hsm?.stop();
export const restart = (instance: Instance, data?: unknown) => instance.restart(data);
export const dispatchAll = (ctx: Context, evt: Event) =>
  Object.values(ctx.instances).forEach((instance) => instance.dispatch(evt));
export const dispatchTo = (ctx: Context, evt: Event, ...ids: string[]) =>
  ids.forEach((id) => ctx.instances[id]?.dispatch(evt));
export const get = (instance: Instance, name: string) => instance.get(name);
export const set = (instance: Instance, name: string, value: unknown) =>
  instance.set(name, value);
export const call = (instance: Instance, name: string, ...args: unknown[]) =>
  instance.call(name, ...args);
export const takeSnapshot = (instance: Instance) => instance.takeSnapshot();
export const makeGroup = (...instances: Instance[]) => new Group(...instances);

export const Define = define;
export const State = state;
export const Initial = initial;
export const Transition = transition;
export const Final = final;
export const Choice = choice;
export const ShallowHistory = shallowHistory;
export const DeepHistory = deepHistory;
export const Attribute = attribute;
export const Operation = operation;
export const Event = event;
export const On = on;
export const OnSet = onSet;
export const OnCall = onCall;
export const When = when;
export const Entry = entry;
export const Exit = exit;
export const Activity = activity;
export const Effect = effect;
export const Guard = guard;
export const After = after;
export const Every = every;
export const At = at;
export const Defer = defer;
export const Source = source;
export const Target = target;
export const DispatchAll = dispatchAll;
export const DispatchTo = dispatchTo;
export const Get = get;
export const Set = set;
export const Call = call;
export const Restart = restart;
export const TakeSnapshot = takeSnapshot;
export const MakeGroup = makeGroup;
export const MakeKind = makeKind;
export const IsKind = isKind;
