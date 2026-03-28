import * as runtime from "./hsm.js";

const runtimeAny = runtime as any;

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

type ValidStateRefs<States extends string> = States | AbsoluteStateRefs<States>;

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

export interface Context {
  listeners: Array<() => void>;
  instances: Record<string, Instance>;
  done: boolean;
  addEventListener(type: "done", listener: () => void): void;
  removeEventListener(type: "done", listener: () => void): void;
}

export interface Instance {
  _hsm: TypedHSM<any, any> | null;
  dispatch(event: Event): void;
  state(): string;
  context(): Context;
  clock(): Required<ClockConfig>;
  get(name: string): unknown;
  set(name: string, value: unknown): void;
  call(name: string, ...args: unknown[]): unknown;
  restart(data?: unknown): void;
  takeSnapshot(): Snapshot;
}

export interface Queue {
  backHead: number;
  back: Array<Event | undefined>;
  front: Event[];
  len(): number;
  pop(): Event | undefined;
  push(...events: Event[]): void;
}

export interface Profiler {
  reset(): void;
  getTime(): number;
  start(name: string): void;
  end(name: string): void;
  getResults(): Record<
    string,
    { count: number; totalTime: number; maxTime: number; avgTime: number }
  >;
  report(): void;
}

export interface Group {
  dispatch(event: Event): void;
  clock(): Required<ClockConfig>;
  set(name: string, value: unknown): void;
  call(name: string, ...args: unknown[]): unknown;
  stop(): void;
  restart(data?: unknown): void;
  takeSnapshot(): Snapshot;
}

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

export type EventOfName<
  M,
  N extends EventNamesOf<M>,
> = Extract<EventsOf<M>, { name: N }>;

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
> = ((model: Record<string, unknown>, stack: unknown[]) => T | void) &
  AttributeMarker<A> &
  StateMarker<S> &
  EventMarker<E> &
  OperationMarker<O> &
  StateRefMarker<R>;

type AnyPartialElement = TypedPartialElement<any, AnyAttributes, any, any, any, any>;
type PartialArgs<P extends readonly unknown[]> = P &
  readonly TypedPartialElement<
    any,
    AnyAttributes,
    string,
    AnyEvent,
    AnyOperations,
    string
  >[];

type PartialOrName =
  | string
  | AnyPartialElement;

export type TypedHSM<
  M extends TypedModel<any, any, any, any> = TypedModel<any, any, any, any>,
  T extends Instance = Instance,
> = {
  readonly _hsm: TypedHSM<M, T>;
  readonly instance: T;
  readonly ctx: Context;
  readonly model: M;
  readonly queue: Queue;
  readonly id: string;
  readonly name: string;
  dispatch(event: ModelDispatchEvent<M>): void;
  state(): StatePathsOf<M>;
  start(): TypedHSM<M, T>;
  stop(): void;
  restart(data?: unknown): void;
  get<K extends string>(
    name: K,
  ): K extends keyof AttributesOf<M> ? AttributesOf<M>[K] : unknown;
  set<K extends string>(
    name: K,
    value: NoInfer<
      K extends keyof AttributesOf<M> ? AttributesOf<M>[K] : unknown
    >,
  ): void;
  call<K extends keyof OperationsOf<M> & string>(
    name: K,
    ...args: Parameters<OperationsOf<M>[K]>
  ): ReturnType<OperationsOf<M>[K]>;
  call<K extends string>(
    name: K extends keyof OperationsOf<M> ? never : K,
    ...args: unknown[]
  ): unknown;
  takeSnapshot(): Snapshot;
};

export const Context = runtime.Context as unknown as { new (): Context };
export const Instance = runtime.Instance as unknown as { new (): Instance };
export const Queue = runtime.Queue as unknown as { new (): Queue };
export const Profiler = runtime.Profiler as unknown as {
  new (disabled?: boolean): Profiler;
};
export const Group = runtime.Group as unknown as {
  new (...instances: Instance[]): Group;
};

export const kinds = runtime.kinds as Record<string, number>;
export const Kinds = runtime.Kinds as Record<string, number>;
export const DefaultClock = runtime.DefaultClock as Required<ClockConfig>;
export const InitialEvent = runtime.InitialEvent as Event<"hsm_initial">;
export const FinalEvent = runtime.FinalEvent as Event<"hsm_final">;
export const ErrorEvent = runtime.ErrorEvent as Event<"hsm_error">;

export const isKind = runtime.isKind as (
  kindValue: number,
  ...baseKinds: number[]
) => boolean;
export const makeKind = runtime.makeKind as (...baseKinds: number[]) => number;
export const join = runtime.join as (...segments: string[]) => string;
export const dirname = runtime.dirname as (path: string) => string;
export const isAbsolute = runtime.isAbsolute as (path: string) => boolean;
export const lca = runtime.lca as (a: string, b: string) => string;
export const isAncestor = runtime.isAncestor as (
  ancestor: string,
  descendant: string,
) => boolean;

type TypedBehavior<
  E extends AnyEvent = AnyEvent,
  R = unknown,
> = (ctx: Context, instance: Instance, event: E) => R;

type TypedOperationInput<E extends AnyEvent = AnyEvent, R = unknown> =
  | string
  | TypedBehavior<E, R>;

type OperationArgs<Ops extends readonly unknown[]> = Ops &
  readonly TypedOperationInput<any, unknown>[];

export const event = runtime.event as <const N extends string, D = unknown>(
  name: N,
  schema?: D,
) => Event<N, D>;

export function source<const Name extends string>(
  name: Name,
): TypedPartialElement<unknown, {}, never, never, {}, Name | `/${Name}`>;
export function source(name: string): TypedPartialElement {
  return runtimeAny.source(name) as TypedPartialElement;
}

export function target<const Name extends string>(
  name: Name,
): TypedPartialElement<unknown, {}, never, never, {}, Name | `/${Name}`>;
export function target(name: string): TypedPartialElement {
  return runtimeAny.target(name) as TypedPartialElement;
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
export function on(event: Event | string): TypedPartialElement {
  return runtimeAny.on(event) as TypedPartialElement;
}

export function onSet<const Name extends string>(
  name: Name,
): TypedPartialElement<unknown, {}, never, Event<string>>;
export function onSet(name: string): TypedPartialElement {
  return runtimeAny.onSet(name) as TypedPartialElement;
}

export function onCall<const Name extends string>(
  name: Name,
): TypedPartialElement<unknown, {}, never, Event<string>>;
export function onCall(name: string): TypedPartialElement {
  return runtimeAny.onCall(name) as TypedPartialElement;
}

export function when<const Name extends string>(
  name: Name,
): TypedPartialElement<unknown, {}, never, Event<string>>;
export function when<const E extends AnyEvent>(
  expr: TypedBehavior<E, unknown>,
): TypedPartialElement<unknown, {}, never, E | Event<string>>;
export function when(
  expr: string | TypedBehavior,
): TypedPartialElement {
  return runtimeAny.when(expr) as TypedPartialElement;
}

export function entry<
  const Ops extends readonly unknown[],
>(
  ...operations: OperationArgs<Ops>
): TypedPartialElement<
  unknown,
  {},
  never,
  MergeOperationEvents<Ops>
>;
export function entry(
  ...operations: Array<TypedOperationInput>
): TypedPartialElement {
  return runtimeAny.entry(...operations) as TypedPartialElement;
}
export const exit = runtime.exit as typeof entry;
export const activity = runtime.activity as typeof entry;
export const effect = runtime.effect as typeof entry;
export function guard<const E extends AnyEvent>(
  expression: string | TypedBehavior<E, boolean>,
): TypedPartialElement<unknown, {}, never, E>;
export function guard(
  expression: string | TypedBehavior,
): TypedPartialElement {
  return runtimeAny.guard(expression) as TypedPartialElement;
}

export function after<const E extends AnyEvent>(
  duration: string | TypedBehavior<E, number>,
): TypedPartialElement<unknown, {}, never, E | Event<string>>;
export function after(
  duration: string | TypedBehavior,
): TypedPartialElement {
  return runtimeAny.after(duration) as TypedPartialElement;
}
export const every = runtime.every as typeof after;
export function at<const E extends AnyEvent>(
  timepoint: string | TypedBehavior<E, number | Date>,
): TypedPartialElement<unknown, {}, never, E | Event<string>>;
export function at(
  timepoint: string | TypedBehavior,
): TypedPartialElement {
  return runtimeAny.at(timepoint) as TypedPartialElement;
}

export const defer = runtime.defer as (
  ...eventNames: string[]
) => TypedPartialElement;

export function final<const Name extends string>(
  name: Name,
): TypedPartialElement<unknown, {}, Name>;
export function final(name: string): TypedPartialElement {
  return runtime.final(name) as TypedPartialElement;
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
export function state(
  name: string,
  ...partials: TypedPartialElement[]
): TypedPartialElement {
  return runtimeAny.state(name, ...partials) as TypedPartialElement;
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
export function initial<
  const P extends readonly unknown[],
>(
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
  if (typeof elementOrName === "undefined") {
    return runtimeAny.initial(...partials) as TypedPartialElement;
  }
  return runtimeAny.initial(
    elementOrName as string | Function,
    ...partials,
  ) as TypedPartialElement;
}

export function transition<
  const P extends readonly unknown[],
>(...partials: PartialArgs<P>): TypedPartialElement<
  unknown,
  MergeAttributes<P>,
  MergeStates<P>,
  MergeEvents<P>,
  MergeOperations<P>,
  MergeStateRefs<P>
>;
export function transition(...partials: TypedPartialElement[]): TypedPartialElement {
  return runtimeAny.transition(...partials) as TypedPartialElement;
}

export function choice<
  const P extends readonly unknown[],
>(
  elementOrName: PartialOrName,
  ...partials: PartialArgs<P>
): TypedPartialElement<
  unknown,
  MergeAttributes<P>,
  MergeStates<P>,
  MergeEvents<P>,
  MergeOperations<P>,
  MergeStateRefs<P>
>;
export function choice(
  elementOrName: PartialOrName,
  ...partials: TypedPartialElement[]
): TypedPartialElement {
  return runtimeAny.choice(
    elementOrName as string | Function,
    ...partials,
  ) as TypedPartialElement;
}

export function shallowHistory<
  const P extends readonly unknown[],
>(
  elementOrName: PartialOrName,
  ...partials: PartialArgs<P>
): TypedPartialElement<
  unknown,
  MergeAttributes<P>,
  MergeStates<P>,
  MergeEvents<P>,
  MergeOperations<P>,
  MergeStateRefs<P>
>;
export function shallowHistory(
  elementOrName: PartialOrName,
  ...partials: TypedPartialElement[]
): TypedPartialElement {
  return runtimeAny.shallowHistory(
    elementOrName as string | Function,
    ...partials,
  ) as TypedPartialElement;
}

export function deepHistory<
  const P extends readonly unknown[],
>(
  elementOrName: PartialOrName,
  ...partials: PartialArgs<P>
): TypedPartialElement<
  unknown,
  MergeAttributes<P>,
  MergeStates<P>,
  MergeEvents<P>,
  MergeOperations<P>,
  MergeStateRefs<P>
>;
export function deepHistory(
  elementOrName: PartialOrName,
  ...partials: TypedPartialElement[]
): TypedPartialElement {
  return runtimeAny.deepHistory(
    elementOrName as string | Function,
    ...partials,
  ) as TypedPartialElement;
}

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
  if (arguments.length > 1) {
    return runtimeAny.attribute(name, defaultValue) as TypedPartialElement;
  }
  return runtimeAny.attribute(name) as TypedPartialElement;
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
  return runtimeAny.operation(name, implementation) as TypedPartialElement;
}

export function define<
  const Name extends string,
  const P extends readonly unknown[],
>(
  name: Name,
  ...partials: PartialArgs<P>
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
export function define(
  name: string,
  ...partials: AnyPartialElement[]
): any {
  return runtimeAny.define(name, ...partials);
}

export function start<M extends TypedModel<any, any, any, any>, T extends Instance>(
  instance: T,
  model: M,
  config?: Config,
): TypedHSM<M, T>;
export function start<M extends TypedModel<any, any, any, any>, T extends Instance>(
  ctx: Context,
  instance: T,
  model: M,
  config?: Config,
): TypedHSM<M, T>;
export function start(...args: unknown[]): TypedHSM {
  return runtimeAny.start(...args) as TypedHSM;
}

export const stop = runtime.stop as (instance: Instance) => void;
export const restart = runtime.restart as (instance: Instance, data?: unknown) => void;
export const dispatchAll = runtime.dispatchAll as (ctx: Context, event: Event) => void;
export const dispatchTo = runtime.dispatchTo as (
  ctx: Context,
  event: Event,
  ...ids: string[]
) => void;
export const get = runtime.get as (instance: Instance, name: string) => unknown;
export const set = runtime.set as (
  instance: Instance,
  name: string,
  value: unknown,
) => void;
export const call = runtime.call as (
  instance: Instance,
  name: string,
  ...args: unknown[]
) => unknown;
export const takeSnapshot = runtime.takeSnapshot as (instance: Instance) => Snapshot;
export const makeGroup = runtime.makeGroup as (...instances: Instance[]) => Group;

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
export const MakeKind = runtime.MakeKind as typeof makeKind;
export const IsKind = runtime.IsKind as typeof isKind;
