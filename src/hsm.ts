import { kinds, makeKind, isKind, type Kind } from "./kind.ts";
export { kinds, makeKind, isKind, kinds as Kinds, makeKind as MakeKind, isKind as IsKind };

type Path = string;
type TimerHandle = ReturnType<typeof setTimeout>;
type TimerFunction = (
    callback: (...args: Array<unknown>) => void,
    timeout?: number,
    ...args: Array<unknown>
) => TimerHandle;
type CancelFunction = (id: TimerHandle | undefined) => void;
type AnyModelElement = State | Transition | Behavior | Constraint | Vertex | AttributeDefinition | OperationDefinition;
type TransitionTable = Record<Path, TransitionCandidate[]>;
type TransitionCandidate = {
    transition: Transition;
    priority: number;
};

type EventRecord = {
  kind: Kind;
  name: string;
  data?: any;
  metadata?: Record<string, unknown>;
  schema?: any;
  source?: string;
  target?: string;
  id?: string;
  qualifiedName?: string;
  Kind?: Kind;
  Name?: string;
  Schema?: any;
  Source?: string;
  Target?: string;
  ID?: string;
  QualifiedName?: string;
};

const EVENT_METADATA_KEYS = [
    "name",
    "qualifiedName",
    "source",
    "target",
    "id",
    "kind",
    "schema",
] as const;

type Element = {
  kind: Kind;
  qualifiedName: Path;
  id?: string;
};

type Vertex = Element & {
    transitions: Path[];
};

type State = Vertex & {
    entry: Path[];
    exit: Path[];
    activities: Path[];
    deferred: Path[];
    initial?: Path;
};

type TransitionPath = {
    enter: Path[];
    exit: Path[];
};

export type AttributeRead<T = unknown> = readonly [T, boolean];

type AttributeDefinition = {
    kind: Kind;
    name: string;
    qualifiedName: string;
    hasDefault: boolean;
    defaultValue?: any;
    hasType?: boolean;
    valueType?: unknown;
};

type OperationDefinition = {
    kind: Kind;
    name: string;
    qualifiedName: string;
    implementation?: (...args: unknown[]) => unknown;
};

export type Model = State & {
  members: Record<Path, AnyModelElement>;
  transitionMap: Record<Path, Record<Path, any[]>>;
  deferredMap: Record<Path, Record<Path, string>>;
  historyPaths: Record<Path, Record<Path, Path[]>>;
  historyTargets: Record<string, Record<Path, Path>>;
  events: Record<string, EventRecord>;
  attributes: Record<string, AttributeDefinition>;
  operations: Record<string, OperationDefinition>;
  partials: Array<(model: Model, stack: AnyModelElement[]) => void>;
};

export type FinalizedModel = Model;

type Transition = Element & {
    guard: string;
    events: string[];
    effect: Path[];
    source: Path;
    target?: Path;
    paths: Record<Path, TransitionPath>;
};

type Operation = (ctx: Context, instance: Instance, event: EventRecord) => unknown;

type Expression = (ctx: Context, instance: Instance, event: EventRecord) => boolean;

type TimeExpression = (
    ctx: Context,
    instance: Instance,
    event: EventRecord,
) => number | Date | Promise<number> | Promise<Date>;

type GuardFunction = (ctx: Context, instance: Instance, event: EventRecord) => boolean;
type SignalCallback = () => void;
type Thenable = {
    then: (...args: Array<(...args: unknown[]) => unknown>) => unknown;
};
type DoneEventTarget = {
    addEventListener: (event: string, listener: SignalCallback) => void;
};
type OnEventTarget = {
    on: (event: string, listener: SignalCallback) => void;
};
type SignalLike = Thenable | DoneEventTarget | OnEventTarget;
type Timepoint = number | Date;
type TimerValue = number;

type Behavior = Element & {
    operation: Operation | null;
    operationName?: string;
    Owner?: () => string;
};

type Constraint = Element & {
    expression: Expression;
};

type PartialElement<T extends Element = Element, M extends Model = Model> = (
  model: M,
  elements: Element[],
) => T | void;

type TransitionSnapshot = Readonly<{
    name: string;
    Name: string;
    kind: Kind;
    Kind: Kind;
    source: string;
    Source: string;
    target?: string;
    Target?: string;
    events: readonly string[];
    Events: readonly string[];
    guard: boolean;
    Guard: boolean;
}>;

type SnapshotEvent = Readonly<{
    event: string;
    Name: string;
    Kind: Kind;
    target?: string;
    Target?: string;
    guard: boolean;
    Guard: boolean;
    schema?: any;
    Schema?: any;
}>;

type Snapshot = Readonly<{
    id: string;
    ID: string;
    qualifiedName: string;
    QualifiedName: string;
    state: string;
    State: string;
    attributes: Readonly<Record<string, any>>;
    Attributes: Readonly<Record<string, any>>;
    queueLen: number;
    QueueLen: number;
    transitions: readonly TransitionSnapshot[];
    Transitions: readonly TransitionSnapshot[];
    events: readonly SnapshotEvent[];
    Events: readonly SnapshotEvent[];
}>;

type Active = {
  context: Context;
  promise: Promise<void>;
};

type PartialClockConfig = Partial<ClockConfig>;

export interface Config {
    ID?: string;
    Name?: string;
    Data?: any;
    Clock?: PartialClockConfig;
    Queue?: QueueShape;
    id?: string;
    name?: string;
    data?: any;
    clock?: PartialClockConfig;
    queue?: QueueShape;
}

export interface Dispatchable {
    context(): Context;
    dispatch(event: EventRecord): Completion;
    dispatch(ctx: Context, event: EventRecord): Completion;
}

export interface ModelValidator {
    validate(model: Model): void;
}

export interface ModelFinalizer {
    finalize(model: Model): Model;
}

export class DefaultModelValidator implements ModelValidator {
    validate(model: Model): void {
        validateModelTopology(model);
    }
}

export class DefaultModelFinalizer implements ModelFinalizer {
    finalize(model: Model): Model {
        model.transitionMap = {};
        model.deferredMap = {};
        model.historyPaths = {};
        model.historyTargets = {};
        buildTransitionPaths(model);
        buildTransitionTable(model);
        buildDeferredTable(model);
        buildHistoryTables(model);
        return model;
    }
}
type ClockConfig = {
    setTimeout: TimerFunction;
    clearTimeout: CancelFunction;
    now: () => number;
};

type LowercaseQueueShape = {
  push: (event: EventRecord) => void | Error;
  pop: () => EventRecord | undefined | Error;
  len: () => number | Error;
};

type CanonicalQueueShape = {
  Push: (context: Context, event: EventRecord) => void | Error;
  Pop: (context: Context) => EventRecord | undefined | Error;
  Len: (context: Context) => number | Error;
};

type QueueShape = LowercaseQueueShape | CanonicalQueueShape;

export type Completion = Promise<void>;

type StripLeadingSlash<S extends string> = S extends `/${infer Rest}` ? Rest : S;
type StripTrailingSlash<S extends string> = S extends `${infer Rest}/` ? Rest : S;
type PathParts<S extends string> =
    S extends ''
        ? []
        : S extends `${infer Head}/${infer Tail}`
          ? [Head, ...PathParts<Tail>]
          : [S];

type CompactPathParts<Parts extends readonly string[], Acc extends readonly string[] = []> =
    Parts extends readonly [infer Head extends string, ...infer Tail extends string[]]
        ? Head extends '.'
            ? CompactPathParts<Tail, Acc>
            : Head extends ''
              ? CompactPathParts<Tail, Acc>
              : Head extends '..'
                ? CompactPathParts<Tail, PopSegment<Acc>>
                : CompactPathParts<Tail, [...Acc, Head]>
        : Acc;

type JoinPathParts<Parts extends readonly string[]> =
    Parts extends []
        ? ''
        : Parts extends readonly [infer Head extends string]
            ? Head
            : Parts extends readonly [infer Head extends string, ...infer Tail extends string[]]
                ? `${Head}/${JoinPathParts<Tail>}`
                : string;

type NormalizePath<Raw extends string> =
    ToAbsolutePath<CompactPathParts<PathParts<Raw>>>;

type ToAbsolutePath<Parts extends readonly string[]> =
    Parts extends []
        ? '/'
        : `/${JoinPathParts<Parts>}`;

type PopSegment<Parts extends readonly string[]> =
    Parts extends readonly [...infer Rest extends string[], infer _Last]
        ? Rest
        : [];

type IsAbsolutePath<S extends string> = S extends `/${string}` ? true : false;

type ResolvePathExpression<Base extends string, Expr extends string> =
    IsAbsolutePath<Expr> extends true
        ? NormalizePath<Expr>
        : ToAbsolutePath<
            CompactPathParts<
                [
                    ...PathParts<StripLeadingSlash<Base>>,
                    ...PathParts<StripLeadingSlash<StripTrailingSlash<Expr>>>,
                ]
            >
        >;

type ResolveModelPathExpression<
    Owner extends string,
    ModelRoot extends string,
    Expr extends string,
> =
    IsAbsolutePath<Expr> extends true
        ? IsPathUnderBase<NormalizePath<Expr>, ModelRoot> extends true
            ? NormalizePath<Expr>
            : ToAbsolutePath<
                CompactPathParts<
                    [
                        ...PathParts<StripLeadingSlash<ModelRoot>>,
                        ...PathParts<StripLeadingSlash<StripTrailingSlash<Expr>>>,
                    ]
                >
            >
        : ToAbsolutePath<
            CompactPathParts<
                [
                    ...PathParts<StripLeadingSlash<Owner>>,
                    ...PathParts<StripLeadingSlash<StripTrailingSlash<Expr>>>,
                ]
            >
        >;

type IsPathUnderBase<Path extends string, Base extends string> =
    Path extends Base
        | `${Base}/${string}`
        ? true
        : false;

type RelativeFromAbsolute<Path extends string> =
    Path extends `/${string}/${infer Rest}` ? Rest : never;

type ParentParts<Parts extends readonly string[]> =
    Parts extends readonly [...infer Prefix extends string[], infer _Last extends string]
        ? Prefix
        : [];

type ParentPath<Path extends string> =
    Path extends `/${infer Tail}`
        ? ToAbsolutePath<ParentParts<PathParts<Tail>>>
        : never;

type IsStatePathPrefix<Prefix extends string, Path extends string> =
    Path extends `${Prefix}/${string}` ? true : false;

export type Event<Name extends string = string, Data = unknown> = EventRecord & {
    readonly name: Name;
    readonly schema?: Data;
};

export interface TypedModel<
    TAttributes extends Record<string, any> = Record<string, any>,
    TOperations extends Record<string, (...args: any[]) => any> = Record<string, (...args: any[]) => any>,
    TGuards extends Record<string, (...args: any[]) => any> = Record<string, (...args: any[]) => any>,
    TActivities extends Record<string, (...args: any[]) => any> = Record<string, (...args: any[]) => any>,
    TEvents = Event<string, unknown>,
    TEventGroups = unknown,
    TName extends string = string,
    TInstance extends Instance = Instance,
> extends Model {
    readonly __hsm_attributes?: TAttributes;
    readonly __hsm_operations?: TOperations;
    readonly __hsm_guards?: TGuards;
    readonly __hsm_activities?: TActivities;
    readonly __hsm_events?: TEvents;
    readonly __hsm_eventGroups?: TEventGroups;
    readonly __hsm_name?: TName;
    readonly __hsm_instance?: TInstance;
    readonly __hsm_meta?: {
        name: unknown;
        states: unknown;
        finalStates: unknown;
        transitions: unknown;
        initials: unknown;
        attributes: unknown;
        operations: unknown;
        eventSchemas: unknown;
    };
}

export type EventClause<Name extends string = string, Schema = unknown> = {
    kind: 'on';
    name: Name;
    schema?: Schema;
};
export type OnSetClause<Name extends string = string> = { kind: 'onSet'; name: Name };
export type OnCallClause<Name extends string = string> = { kind: 'onCall'; name: Name };
export type WhenClause<Name extends string = string> = { kind: 'when'; name: Name };
export type WhenExprClause = { kind: 'whenExpr' };
export type SourceClause<Name extends string = string> = { kind: 'source'; name: Name };
export type TargetClause<Name extends string = string> = { kind: 'target'; name: Name };
export type GuardClause<Value = unknown> = { kind: 'guard'; value: Value };
export type EffectClause<Value = unknown> = { kind: 'effect'; value: Value };
export type AfterClause<Value = unknown> = { kind: 'after'; value: Value };
export type EveryClause<Value = unknown> = { kind: 'every'; value: Value };
export type AtClause<Value = unknown> = { kind: 'at'; value: Value };

export type TransitionSpec<Parts extends readonly TransitionBuilderClause[]> = {
    kind: 'transition';
    parts: Parts;
};

export type StateSpec<
    Name extends string = string,
    Parts extends readonly unknown[] = readonly unknown[]
> = {
    kind: 'state';
    name: Name;
    parts: Parts;
};

export type InitialSpec<Parts extends readonly TransitionBuilderClause[] = readonly TransitionBuilderClause[]> = {
    kind: 'initial';
    name: string;
    parts: Parts;
};

export type FinalSpec<Name extends string = string> = { kind: 'final'; name: Name };
export type ShallowHistorySpec<
    Name extends string = string,
    Parts extends readonly unknown[] = readonly unknown[]
> = { kind: 'shallowHistory'; name: Name; parts: Parts };
export type DeepHistorySpec<
    Name extends string = string,
    Parts extends readonly unknown[] = readonly unknown[]
> = { kind: 'deepHistory'; name: Name; parts: Parts };
export type ChoiceSpec<
    Name extends string = string,
    Parts extends readonly unknown[] = readonly unknown[]
> = { kind: 'choice'; name: Name; parts: Parts };
export type EntrySpec<Operations = unknown> = { kind: 'entry'; value: Operations };
export type ExitSpec<Operations = unknown> = { kind: 'exit'; value: Operations };
export type ActivitySpec<Operations = unknown> = { kind: 'activity'; value: Operations };
export type DeferSpec<EventNames extends readonly string[] = readonly string[]> = {
    kind: 'defer';
    eventNames: EventNames;
};
export type SubmachineStateSpec<
    Name extends string = string,
    Parts extends readonly unknown[] = readonly unknown[]
> = {
    kind: 'submachineState';
    name: Name;
    parts: Parts;
};
export type EntryPointSpec<
    Name extends string = string,
    Parts extends readonly unknown[] = readonly unknown[]
> = { kind: 'entryPoint'; name: Name; parts: Parts };
export type ExitPointSpec<
    Name extends string = string,
    Parts extends readonly unknown[] = readonly unknown[]
> = { kind: 'exitPoint'; name: Name; parts: Parts };
export type ObserveSpec<Targets extends readonly unknown[] = readonly unknown[]> = {
    kind: 'observe';
    targets: Targets;
};

export type AttributeSpec<Name extends string = string, Value = unknown> = {
    kind: 'attribute';
    name: Name;
    value: Value;
};

type AttributeValueFromTypeToken<TypeToken> =
    TypeToken extends StringConstructor ? string :
    TypeToken extends NumberConstructor ? number :
    TypeToken extends BooleanConstructor ? boolean :
    TypeToken extends BigIntConstructor ? bigint :
    TypeToken extends SymbolConstructor ? symbol :
    TypeToken extends ArrayConstructor ? unknown[] :
    TypeToken extends DateConstructor ? Date :
    TypeToken extends abstract new (...args: any[]) => infer Instance ? Instance :
    unknown;

export type OperationSpec<
    Name extends string = string,
    Fn extends (...args: any[]) => any = (...args: any[]) => any,
> = {
    kind: 'operation';
    name: Name;
    impl: Fn;
};

export type ValidatorSpec = { kind: 'validator'; validator: ModelValidator };
export type FinalizerSpec = { kind: 'finalizer'; finalizer: ModelFinalizer };

export type ModelElementSpec =
    | TransitionSpec<readonly TransitionBuilderClause[]>
    | StateSpec<string, readonly unknown[]>
    | InitialSpec<readonly TransitionBuilderClause[]>
    | FinalSpec
    | ShallowHistorySpec<string, readonly unknown[]>
    | DeepHistorySpec<string, readonly unknown[]>
    | ChoiceSpec<string, readonly unknown[]>
    | SubmachineStateSpec<string, readonly unknown[]>
    | EntryPointSpec<string, readonly unknown[]>
    | ExitPointSpec<string, readonly unknown[]>
    | EntrySpec
    | ExitSpec
    | ActivitySpec
    | AttributeSpec
    | OperationSpec
    | ValidatorSpec
    | FinalizerSpec
    | ObserveSpec
    | DeferSpec
    | { kind: 'unknown' };

export type TransitionBuilderClause =
    | EventClause
    | OnSetClause
    | OnCallClause
    | WhenClause
    | WhenExprClause
    | SourceClause
    | TargetClause
    | GuardClause
    | EffectClause
    | AfterClause
    | EveryClause
    | AtClause
    | EntryPointSpec
    | ExitPointSpec
    | { kind: 'unknownTransitionClause' };

type MetaFromBuilder<T> = T extends { __hsmSpec: infer Meta } ? Meta : never;

type ModelMetaOf<T> = T extends { __hsm_meta: infer M } ? M : never;

type BuilderTuple<Specs extends readonly unknown[]> = {
    [K in keyof Specs]: BuilderWithSpec<
        (model: Model, stack: AnyModelElement[]) => unknown,
        Specs[K]
    >;
};

type GuardBuilder<EventType extends EventRecord = EventRecord> =
    BuilderWithSpec<
        (model: Model, stack: AnyModelElement[]) => unknown,
        GuardClause<unknown>
    > & {
        readonly __hsmTransitionEvent?: EventType;
    };

type EffectBuilder<EventType extends EventRecord = EventRecord> =
    BuilderWithSpec<
        (model: Model, stack: AnyModelElement[]) => unknown,
        EffectClause<unknown>
    > & {
        readonly __hsmTransitionEvent?: EventType;
    };

type TransitionBuilderTuple<Clauses extends readonly TransitionBuilderClause[]> = BuilderTuple<Clauses>;

type ModelElementBuilderTuple<Specs extends readonly ModelElementSpec[]> = BuilderTuple<Specs>;
type ScopeModelParts<
    LocalParts extends readonly unknown[],
    ModelParts extends readonly unknown[],
> = readonly [...ModelParts, ...LocalParts];

type IsAny<T> = 0 extends (1 & T) ? true : false;

type AttributeKeysFromModelParts<Parts extends readonly unknown[]> =
    keyof ModelAttributeTypeMap<Parts> & string;

type DurationAttributeKeysFromModelParts<Parts extends readonly unknown[]> = {
    [K in AttributeKeysFromModelParts<Parts>]:
        IsAny<EventValueFromAttribute<Parts, K>> extends true
            ? K
            : [Extract<EventValueFromAttribute<Parts, K>, string | number>] extends [never]
                ? never
                : K;
}[AttributeKeysFromModelParts<Parts>];

type TimepointAttributeKeysFromModelParts<Parts extends readonly unknown[]> = {
    [K in AttributeKeysFromModelParts<Parts>]:
        IsAny<EventValueFromAttribute<Parts, K>> extends true
            ? K
            : [Extract<EventValueFromAttribute<Parts, K>, string | number | Date>] extends [never]
                ? never
                : K;
}[AttributeKeysFromModelParts<Parts>];

type OperationKeysFromModelParts<Parts extends readonly unknown[]> =
    keyof ModelOperationTypeMap<Parts> & string;

type GuardOperationKeysFromModelParts<Parts extends readonly unknown[]> = {
    [K in OperationKeysFromModelParts<Parts>]:
        IsAny<ReturnType<Extract<ModelOperationTypeMap<Parts>[K], (...args: any[]) => any>>> extends true
            ? never
            : ReturnType<Extract<ModelOperationTypeMap<Parts>[K], (...args: any[]) => any>> extends boolean
            ? K
            : never;
}[OperationKeysFromModelParts<Parts>];

type InvalidString<Message extends string, Actual extends string> = Actual & {
    readonly __hsmTypeError: Message;
};

type ValidateBehaviorArgument<
    Argument,
    ModelParts extends readonly unknown[],
    GuardOnly extends boolean = false,
> =
    Argument extends string
        ? GuardOnly extends true
            ? Argument extends GuardOperationKeysFromModelParts<ModelParts>
                ? Argument
                : InvalidString<`Invalid guard operation: ${Argument}`, Argument>
            : Argument extends OperationKeysFromModelParts<ModelParts>
                ? Argument
                : InvalidString<`Invalid behavior operation: ${Argument}`, Argument>
        : Argument;

type ValidateBehaviorArguments<
    Arguments,
    ModelParts extends readonly unknown[],
    GuardOnly extends boolean = false,
> =
    Arguments extends readonly [infer Head, ...infer Tail]
        ? readonly [
            ValidateBehaviorArgument<Head, ModelParts, GuardOnly>,
            ...ValidateBehaviorArguments<Tail, ModelParts, GuardOnly>,
        ]
        : readonly [];

type KnownEventNamesFromRootModelParts<
    RootModelParts extends readonly unknown[],
    RootPath extends string,
> =
    keyof CollectModelParts<
        RootModelParts,
        RootPath,
        RootPath,
        RootModelParts
    >['eventSchemas'] & string;

type ValidateDeferredEventName<
    EventName extends string,
    RootModelParts extends readonly unknown[],
    RootPath extends string,
> =
    string extends EventName
        ? EventName
        : EventName extends KnownEventNamesFromRootModelParts<RootModelParts, RootPath>
            ? EventName
            : InvalidString<`Invalid deferred event: ${EventName}`, EventName>;

type ValidateDeferredEventNames<
    EventNames extends readonly string[],
    RootModelParts extends readonly unknown[],
    RootPath extends string,
> = {
    [K in keyof EventNames]:
        EventNames[K] extends string
            ? ValidateDeferredEventName<EventNames[K], RootModelParts, RootPath>
            : EventNames[K];
};

type LocalKnownEventNamesFromParts<
    Parts extends readonly unknown[],
> = keyof CollectModelParts<Parts, '/', '/', Parts>['eventSchemas'] & string;

type ValidateDeferredEventNameFromParts<
    EventName extends string,
    Parts extends readonly unknown[],
> =
    string extends EventName
        ? EventName
        : EventName extends LocalKnownEventNamesFromParts<Parts>
            ? EventName
            : InvalidString<`Invalid deferred event: ${EventName}`, EventName>;

type ValidateDeferredEventNamesFromParts<
    EventNames extends readonly string[],
    Parts extends readonly unknown[],
> = {
    [K in keyof EventNames]:
        EventNames[K] extends string
            ? ValidateDeferredEventNameFromParts<EventNames[K], Parts>
            : EventNames[K];
};

type ValidateStateLocalSpec<
    Spec,
    RootParts extends readonly unknown[],
> =
    Spec extends DeferSpec<infer EventNames>
        ? DeferSpec<ValidateDeferredEventNamesFromParts<EventNames, RootParts>>
        : Spec extends StateSpec<infer Name, infer Parts>
            ? StateSpec<Name, ValidateStateLocalSpecs<Parts, RootParts>>
            : Spec;

type ValidateStateLocalSpecs<
    Specs extends readonly unknown[],
    RootParts extends readonly unknown[] = Specs,
> = {
    [K in keyof Specs]: ValidateStateLocalSpec<Specs[K], RootParts>;
};

type ValidateTransitionClause<
    Clause,
    ScopedModelParts extends readonly unknown[],
    RootModelParts extends readonly unknown[],
    RootPath extends string,
    OwnerPath extends string,
> =
    Clause extends OnSetClause<infer Name>
        ? Name extends AttributeKeysFromModelParts<ScopedModelParts>
            ? OnSetClause<Name>
            : OnSetClause<InvalidString<`Invalid onSet attribute: ${Name}`, Name>>
        : Clause extends WhenClause<infer Name>
            ? Name extends AttributeKeysFromModelParts<ScopedModelParts>
                ? WhenClause<Name>
                : WhenClause<InvalidString<`Invalid when attribute: ${Name}`, Name>>
            : Clause extends OnCallClause<infer Name>
                ? Name extends OperationKeysFromModelParts<ScopedModelParts>
                    ? OnCallClause<Name>
                    : OnCallClause<InvalidString<`Invalid onCall operation: ${Name}`, Name>>
                : Clause extends SourceClause<infer Name>
                    ? ResolveModelPathExpression<OwnerPath, RootPath, Name> extends
                        | RootPath
                        | CollectModelParts<RootModelParts, RootPath, RootPath, RootModelParts>['states']
                        ? SourceClause<Name>
                        : SourceClause<InvalidString<`Invalid transition source path: ${Name}`, Name>>
                    : Clause extends TargetClause<infer Name>
                        ? ResolveModelPathExpression<OwnerPath, RootPath, Name> extends
                            | RootPath
                            | CollectModelParts<RootModelParts, RootPath, RootPath, RootModelParts>['states']
                            ? TargetClause<Name>
                            : TargetClause<InvalidString<`Invalid transition target path: ${Name}`, Name>>
                : Clause extends AfterClause<infer Value>
                    ? Value extends string
                        ? Value extends DurationAttributeKeysFromModelParts<ScopedModelParts>
                            ? AfterClause<Value>
                            : AfterClause<InvalidString<`Invalid after attribute: ${Value}`, Value>>
                        : Clause
                : Clause extends EveryClause<infer Value>
                    ? Value extends string
                        ? Value extends DurationAttributeKeysFromModelParts<ScopedModelParts>
                            ? EveryClause<Value>
                            : EveryClause<InvalidString<`Invalid every attribute: ${Value}`, Value>>
                        : Clause
                : Clause extends AtClause<infer Value>
                    ? Value extends string
                        ? Value extends TimepointAttributeKeysFromModelParts<ScopedModelParts>
                            ? AtClause<Value>
                            : AtClause<InvalidString<`Invalid at attribute: ${Value}`, Value>>
                        : Clause
                : Clause extends GuardClause<infer Value>
                    ? GuardClause<ValidateBehaviorArgument<Value, ScopedModelParts, true>>
                    : Clause extends EffectClause<infer Value>
                        ? EffectClause<ValidateBehaviorArguments<Value, ScopedModelParts>>
                        : Clause;

type ValidateTransitionClauses<
    Clauses extends readonly unknown[],
    ScopedModelParts extends readonly unknown[],
    RootModelParts extends readonly unknown[],
    RootPath extends string,
    OwnerPath extends string,
> = {
    [K in keyof Clauses]:
        ValidateTransitionClause<Clauses[K], ScopedModelParts, RootModelParts, RootPath, OwnerPath>;
};

type ValidateModelSpec<
    Spec,
    ScopedModelParts extends readonly unknown[],
    RootModelParts extends readonly unknown[],
    RootPath extends string,
    OwnerPath extends string,
> =
    Spec extends StateSpec<infer Name, infer Parts>
        ? StateSpec<
            Name,
            ValidateModelSpecs<
                Parts,
                ScopeModelParts<Parts, ScopedModelParts>,
                RootModelParts,
                RootPath,
                ResolvePathExpression<OwnerPath, Name>
            >
        >
        : Spec extends TransitionSpec<infer Clauses>
            ? TransitionSpec<
                ValidateTransitionClauses<Clauses, ScopedModelParts, RootModelParts, RootPath, OwnerPath>
            >
            : Spec extends InitialSpec<infer Clauses>
                ? InitialSpec<
                    ValidateTransitionClauses<Clauses, ScopedModelParts, RootModelParts, RootPath, OwnerPath>
                >
                : Spec extends EntrySpec<infer Value>
                    ? EntrySpec<ValidateBehaviorArguments<Value, ScopedModelParts>>
                    : Spec extends ExitSpec<infer Value>
                        ? ExitSpec<ValidateBehaviorArguments<Value, ScopedModelParts>>
                        : Spec extends ActivitySpec<infer Value>
                            ? ActivitySpec<ValidateBehaviorArguments<Value, ScopedModelParts>>
                            : Spec extends DeferSpec<infer EventNames>
                                ? DeferSpec<
                                    ValidateDeferredEventNames<
                                        EventNames,
                                        RootModelParts,
                                        RootPath
                                    >
                                >
                            : Spec;

type ValidateModelSpecs<
    Specs extends readonly unknown[],
    ScopedModelParts extends readonly unknown[] = Specs,
    RootModelParts extends readonly unknown[] = ScopedModelParts,
    RootPath extends string = '/',
    OwnerPath extends string = RootPath,
> = {
    [K in keyof Specs]:
        ValidateModelSpec<Specs[K], ScopedModelParts, RootModelParts, RootPath, OwnerPath>;
};

type ValidatedModelElementBuilderTuple<
    Specs extends readonly ModelElementSpec[],
    ScopedModelParts extends readonly ModelElementSpec[] = Specs,
    RootModelParts extends readonly ModelElementSpec[] = ScopedModelParts,
    RootPath extends string = '/',
    OwnerPath extends string = RootPath,
> = BuilderTuple<
    ValidateModelSpecs<Specs, ScopedModelParts, RootModelParts, RootPath, OwnerPath>
>;

type ModelAttributeMap<T> =
    T extends TypedModel<infer A, any, any, any, any, any, any, any>
        ? A
        : ModelMetaOf<T> extends { attributes: infer A }
            ? A extends Record<string, unknown>
                ? A
                : {}
            : {};

type ModelOperationMap<T> =
    T extends TypedModel<any, infer O, any, any, any, any, any, any>
        ? O
        : ModelMetaOf<T> extends { operations: infer O }
            ? O extends Record<string, (...args: any[]) => any>
                ? O
                : {}
            : {};

type ModelEventMap<T> =
    T extends TypedModel<any, any, any, any, infer E, any, any, any>
        ? EventMapFromUnion<E>
        : ModelMetaOf<T> extends { eventSchemas: infer E }
            ? E extends Record<string, unknown>
                ? E
                : {}
            : {};

type ModelStateMeta<T> =
    T extends { __hsm_meta: infer Meta }
        ? Meta extends {
              name: string;
              states: infer States;
              finalStates: infer Finals;
              transitions: infer Transitions;
              initials: infer Initials;
              attributes: infer Attributes;
              operations: infer Operations;
              eventSchemas: infer EventSchemas;
          }
            ? {
                  name: string & Meta['name'];
                  states: States & string;
                  finalStates: Finals & string;
                  transitions: Transitions;
                  initials: Initials extends Record<string, string> ? Initials : Record<string, string>;
                  attributes: Attributes extends Record<string, unknown> ? Attributes : Record<string, unknown>;
                  operations: Operations extends Record<string, (...args: any[]) => any> ? Operations : Record<string, (...args: any[]) => any>;
                  eventSchemas: EventSchemas extends Record<string, unknown> ? EventSchemas : Record<string, unknown>;
              }
            : never
        : TypedModelMetaFallback<T>;

type TypedModelMetaFallback<T> = {
    name: string;
    states: string;
    finalStates: string;
    transitions: string;
    initials: Record<string, string>;
    attributes: ModelAttributeMap<T>;
    operations: ModelOperationMap<T>;
    eventSchemas: ModelEventMap<T>;
};

type TypedModelFromInfer<
    RootName extends string,
    Parts extends readonly unknown[],
> = {
    [K in keyof Model & string]: Model[K];
} & TypedModel<
    InferredAttributes<Parts>,
    InferredOperations<Parts>,
    any,
    any,
    InferredEventUnion<Parts>,
    any,
    RootName,
    Instance
> & {
    readonly __hsm_meta: ModelStateMetaFromParts<`/${RootName}`, Parts>;
};

type ModelRootPathOf<M> = ModelStateMeta<M>['name'] & string;

type ModelRootNameOf<M> = StripLeadingSlash<ModelRootPathOf<M>>;

type ModelInstanceOf<M> =
    M extends TypedModel<any, any, any, any, any, any, any, infer I>
        ? I
        : Instance;

type ReRootPath<
    Path,
    OldRoot extends string,
    NewRoot extends string,
> =
    Path extends string
        ? string extends Path
            ? string
            : Path extends OldRoot
                ? NewRoot
                : Path extends `${OldRoot}/${infer Rest}`
                    ? `${NewRoot}/${Rest}`
                    : Path
        : never;

type ReRootTransition<
    Transition,
    OldRoot extends string,
    NewRoot extends string,
> =
    Transition extends {
        source: infer Source;
        target: infer Target;
        events: infer Events;
        schema: infer Schema;
    }
        ? {
            source: ReRootPath<Source, OldRoot, NewRoot>;
            target: Target extends string ? ReRootPath<Target, OldRoot, NewRoot> : undefined;
            events: Events;
            schema: Schema;
        }
        : never;

type ReRootInitials<
    Initials,
    OldRoot extends string,
    NewRoot extends string,
> =
    Initials extends Record<string, string>
        ? {
            [K in keyof Initials & string as ReRootPath<K, OldRoot, NewRoot>]:
                ReRootPath<Initials[K], OldRoot, NewRoot>;
        }
        : {};

type CallableOperationsOf<M extends TypedModel<any, any, any, any, any, any, any, any>> = {
    [K in keyof OperationsOf<M> & string]: Extract<OperationsOf<M>[K], (...args: any[]) => any>;
};

type RedefinedOperationMap<
    Source extends TypedModel<any, any, any, any, any, any, any, any>,
    Parts extends readonly unknown[],
> = NormalizeOpMap<
    MergeEventMaps<CallableOperationsOf<Source>, InferredOperations<Parts>>
>;

type RedefinedModelMeta<
    Source extends TypedModel<any, any, any, any, any, any, any, any>,
    RootName extends string,
    Parts extends readonly unknown[],
    OldRoot extends string = ModelRootPathOf<Source>,
    NewRoot extends string = `/${RootName}`,
    AddedMeta extends {
        states: string;
        finalStates: string;
        transitions: unknown;
        initials: Record<string, string>;
        attributes: Record<string, unknown>;
        operations: Record<string, (...args: any[]) => any>;
        eventSchemas: Record<string, unknown>;
    } = ModelStateMetaFromParts<NewRoot, Parts>,
> = {
    name: NewRoot;
    states: ReRootPath<StatePathsOfModel<Source>, OldRoot, NewRoot> | AddedMeta['states'];
    finalStates: ReRootPath<FinalStatePathsOfModel<Source>, OldRoot, NewRoot> | AddedMeta['finalStates'];
    transitions:
        | ReRootTransition<TransitionMetaModel<Source>, OldRoot, NewRoot>
        | AddedMeta['transitions'];
    initials: MergeEventMaps<
        ReRootInitials<ModelStateMeta<Source>['initials'], OldRoot, NewRoot>,
        AddedMeta['initials']
    >;
    attributes: MergeEventMaps<AttributesOf<Source>, InferredAttributes<Parts>>;
    operations: RedefinedOperationMap<Source, Parts>;
    eventSchemas: MergeEventMaps<ModelEventSchemas<Source>, AddedMeta['eventSchemas']>;
};

type RedefinedModelFromInfer<
    Source extends TypedModel<any, any, any, any, any, any, any, any>,
    RootName extends string,
    Parts extends readonly unknown[],
> = {
    [K in keyof Model & string]: Model[K];
} & TypedModel<
    RedefinedModelMeta<Source, RootName, Parts>['attributes'],
    RedefinedModelMeta<Source, RootName, Parts>['operations'],
    any,
    any,
    EventUnionFromMap<RedefinedModelMeta<Source, RootName, Parts>['eventSchemas']>,
    any,
    RootName,
    ModelInstanceOf<Source>
> & {
    readonly __hsm_meta: RedefinedModelMeta<Source, RootName, Parts>;
};

type ModelAttributeTypeMap<Parts extends readonly unknown[]> =
    MergeMaps<AttributeFromParts<Parts>>;

type ModelOperationTypeMap<Parts extends readonly unknown[]> =
    NormalizeOpMap<MergeMaps<OperationFromParts<Parts>>>;

type InferredAttributes<Parts extends readonly unknown[]> =
    ModelAttributeTypeMap<Parts>;

type InferredOperations<Parts extends readonly unknown[]> =
    ModelOperationTypeMap<Parts>;

type InferredEventUnion<Parts extends readonly unknown[]> =
    EventUnionFromTransitions<
        CollectModelParts<Parts, '/', '/', Parts>['transitions']
    > |
    EventUnionFromMap<
        CollectModelParts<Parts, '/', '/', Parts>['eventSchemas']
    >;

type UnionToIntersection<T> =
    (T extends any ? (value: T) => void : never) extends (value: infer I) => void ? I : never;

type EventMapFromUnion<U> =
    UnionToIntersection<
        U extends Event<infer Name, infer Schema>
            ? { [K in Name]: Schema }
            : {}
    > extends infer M
        ? M extends Record<string, unknown>
            ? MergeMaps<M>
            : {}
        : {};

type MergeEventMaps<
    A extends Record<string, unknown>,
    B extends Record<string, unknown>,
> = {
    [K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : never;
};

type EventSpecMapToUnion<SchemaMap> = SchemaMap;

type MergeMaps<
    M extends Record<string, unknown>,
> = {
    [K in keyof M]: M[K];
};

type NormalizeOpMap<M extends Record<string, unknown>> = {
    [K in keyof M]: M[K] extends (...args: any[]) => any ? M[K] : never;
};

type AttributeFromParts<Parts extends readonly unknown[]> =
    Parts extends readonly [infer H, ...infer T]
        ? H extends AttributeSpec<infer Name, infer Value>
            ? { [K in Name]: Value } & AttributeFromParts<T>
            : AttributeFromParts<T>
        : {};

type OperationFromParts<Parts extends readonly unknown[]> =
    Parts extends readonly [infer H, ...infer T]
        ? H extends OperationSpec<infer Name, infer Fn>
            ? { [K in Name]: Fn } & OperationFromParts<T>
            : OperationFromParts<T>
        : {};

type EventValueFromAttribute<Parts extends readonly unknown[], Name extends string> =
    Name extends keyof ModelAttributeTypeMap<Parts> & string
        ? ModelAttributeTypeMap<Parts>[Name]
        : unknown;

type EventArgsFromOperation<Parts extends readonly unknown[], Name extends string> =
    Name extends keyof ModelOperationTypeMap<Parts> & string
        ? Parameters<Extract<ModelOperationTypeMap<Parts>[Name], (...args: any[]) => any>>
        : unknown[];

type EventSchemasFromPartialsWithContext<
    Parts extends readonly unknown[],
    ModelParts extends readonly unknown[],
    ModelRoot extends string = '/',
> =
    Parts extends readonly [infer H, ...infer T]
        ? H extends EventClause<infer Name, infer Schema>
            ? { [K in Name]: Schema extends undefined ? unknown : Schema } &
              EventSchemasFromPartialsWithContext<T, ModelParts, ModelRoot>
            : H extends OnSetClause<infer Name>
                ? {
                    [K in ResolvePathExpression<ModelRoot, Name>]: {
                        name: Name;
                        old: EventValueFromAttribute<ModelParts, Name>;
                        new: EventValueFromAttribute<ModelParts, Name>;
                    };
                } & EventSchemasFromPartialsWithContext<T, ModelParts, ModelRoot>
                : H extends OnCallClause<infer Name>
                    ? {
                        [K in ResolvePathExpression<ModelRoot, Name>]: {
                            name: Name;
                            args: EventArgsFromOperation<ModelParts, Name>;
                        };
                    } & EventSchemasFromPartialsWithContext<T, ModelParts, ModelRoot>
                    : H extends WhenClause<infer Name>
                        ? {
                            [K in ResolvePathExpression<ModelRoot, Name>]: {
                                name: Name;
                                old: EventValueFromAttribute<ModelParts, Name>;
                                new: EventValueFromAttribute<ModelParts, Name>;
                            };
                        } & EventSchemasFromPartialsWithContext<T, ModelParts, ModelRoot>
                        : H extends TransitionSpec<infer Clauses>
                            ? EventSchemasFromClausesWithContext<Clauses, ModelParts, ModelRoot> &
                              EventSchemasFromPartialsWithContext<T, ModelParts, ModelRoot>
                            : H extends StateSpec<infer _Name, infer S>
                                ? EventSchemasFromPartialsWithContext<S, ModelParts, ModelRoot> &
                                  EventSchemasFromPartialsWithContext<T, ModelParts, ModelRoot>
                                : H extends SubmachineStateSpec<infer _SubName, infer SubParts>
                                    ? EventSchemasFromPartialsWithContext<SubParts, ModelParts, ModelRoot> &
                                      EventSchemasFromPartialsWithContext<T, ModelParts, ModelRoot>
                                    : EventSchemasFromPartialsWithContext<T, ModelParts, ModelRoot>
        : {};

type EventSchemasFromPartials<Parts extends readonly unknown[]> =
    EventSchemasFromPartialsWithContext<Parts, Parts>;

type EventSchemasFromClausesWithContext<
    Clauses extends readonly unknown[],
    ModelParts extends readonly unknown[],
    ModelRoot extends string = '/',
> =
    Clauses extends readonly [infer H, ...infer T]
        ? H extends EventClause<infer Name, infer Schema>
            ? { [K in Name]: Schema extends undefined ? unknown : Schema } &
              EventSchemasFromClausesWithContext<T, ModelParts, ModelRoot>
                : H extends OnSetClause<infer Name>
                ? {
                    [K in ResolvePathExpression<ModelRoot, Name>]: {
                        name: Name;
                        old: EventValueFromAttribute<ModelParts, Name>;
                        new: EventValueFromAttribute<ModelParts, Name>;
                    };
                } & EventSchemasFromClausesWithContext<T, ModelParts, ModelRoot>
                : H extends OnCallClause<infer Name>
                    ? {
                        [K in ResolvePathExpression<ModelRoot, Name>]: {
                            name: Name;
                            args: EventArgsFromOperation<ModelParts, Name>;
                        };
                    } & EventSchemasFromClausesWithContext<T, ModelParts, ModelRoot>
                    : H extends WhenClause<infer Name>
                        ? {
                            [K in ResolvePathExpression<ModelRoot, Name>]: {
                                name: Name;
                                old: EventValueFromAttribute<ModelParts, Name>;
                                new: EventValueFromAttribute<ModelParts, Name>;
                            };
                        } & EventSchemasFromClausesWithContext<T, ModelParts, ModelRoot>
                        : EventSchemasFromClausesWithContext<T, ModelParts, ModelRoot>
        : {};

type EventSchemasFromClauses<Clauses extends readonly unknown[]> =
    EventSchemasFromClausesWithContext<Clauses, Clauses>;

type TransitionRaw<Name extends string = string> = {
    owner: string;
    source: string;
    target: string | undefined;
    events: Name;
    schema: Record<string, unknown>;
};

type TransitionFromClauses<
    Clauses extends readonly unknown[],
    Owner extends string = string,
    Root extends string = Owner,
    Source extends string = Owner,
    Target extends string | undefined = undefined,
    Events extends string = never,
    Schemas extends Record<string, unknown> = {},
    ModelParts extends readonly unknown[] = readonly unknown[],
> = Clauses extends readonly [infer H, ...infer T]
    ? H extends SourceClause<infer Name>
        ? TransitionFromClauses<T, Owner, Root, Name, Target, Events, Schemas, ModelParts>
        : H extends TargetClause<infer Name>
            ? TransitionFromClauses<T, Owner, Root, Source, Name, Events, Schemas, ModelParts>
            : H extends EventClause<infer Name, infer Schema>
                ? TransitionFromClauses<
                    T,
                    Owner,
                    Root,
                    Source,
                    Target,
                    Events | Name,
                    MergeEventMaps<Schemas, { [K in Name]: Schema extends undefined ? unknown : Schema }>,
                    ModelParts
                >
                : H extends OnSetClause<infer Name>
                    ? TransitionFromClauses<
                        T,
                        Owner,
                        Root,
                        Source,
                        Target,
                        Events | ResolvePathExpression<Root, Name>,
                            MergeEventMaps<
                                Schemas,
                                {
                                    [K in ResolvePathExpression<Root, Name>]: {
                                        name: Name;
                                        old: EventValueFromAttribute<ModelParts, Name>;
                                        new: EventValueFromAttribute<ModelParts, Name>;
                                    };
                                }
                            >,
                        ModelParts
                    >
                : H extends OnCallClause<infer Name>
                    ? TransitionFromClauses<
                        T,
                        Owner,
                        Root,
                        Source,
                        Target,
                        Events | ResolvePathExpression<Root, Name>,
                        MergeEventMaps<
                            Schemas,
                            {
                                [K in ResolvePathExpression<Root, Name>]: {
                                    name: Name;
                                    args: EventArgsFromOperation<ModelParts, Name>;
                                };
                                }
                            >,
                            ModelParts
                        >
                : H extends WhenClause<infer Name>
                    ? TransitionFromClauses<
                        T,
                        Owner,
                        Root,
                        Source,
                        Target,
                        Events | ResolvePathExpression<Root, Name>,
                        MergeEventMaps<
                            Schemas,
                            {
                                [K in ResolvePathExpression<Root, Name>]: {
                                    name: Name;
                                    old: EventValueFromAttribute<ModelParts, Name>;
                                    new: EventValueFromAttribute<ModelParts, Name>;
                                        };
                                    }
                                >,
                                ModelParts
                            >
                            : TransitionFromClauses<T, Owner, Root, Source, Target, Events, Schemas, ModelParts>
    : {
          owner: Owner;
          source: Source;
          target: Target;
          events: Events;
          schema: Schemas;
      };

type CollectModelParts<
    Parts extends readonly unknown[],
    ParentPath extends string,
    ModelRoot extends string,
    AllParts extends readonly unknown[] = Parts,
> = Parts extends readonly [infer H, ...infer T]
    ? MergeCollect<
        InferFromSpec<H, ParentPath, ModelRoot, AllParts>,
        CollectModelParts<T, ParentPath, ModelRoot, AllParts>
    >
    : {
          states: never;
          finalStates: never;
          transitions: never;
          initials: {};
          attributes: {};
          operations: {};
          eventSchemas: {};
      };

type InferFromSpec<
    Spec,
    ParentPath extends string,
    ModelRoot extends string,
    AllParts extends readonly unknown[],
> = Spec extends StateSpec<infer Name, infer P>
    ? StateFromSpec<Name, P, ParentPath, ModelRoot, AllParts>
    : Spec extends SubmachineStateSpec<infer Name, infer P>
        ? StateFromSpec<Name, P, ParentPath, ModelRoot, AllParts>
    : Spec extends FinalSpec<infer Name>
        ? FinalFromSpec<Name, ParentPath>
        : Spec extends TransitionSpec<infer Clauses>
            ? TransitionFromSpec<Clauses, ParentPath, ModelRoot, AllParts>
            : Spec extends InitialSpec<infer Clauses>
                ? InitialFromSpec<Clauses, ParentPath, ModelRoot, AllParts>
                : Spec extends AttributeSpec<infer Name, infer Value>
                    ? { states: never; finalStates: never; transitions: never; initials: {}; attributes: { [K in Name]: Value }; operations: {}; eventSchemas: {} }
                    : Spec extends OperationSpec<infer Name, infer Fn>
                        ? { states: never; finalStates: never; transitions: never; initials: {}; attributes: {}; operations: { [K in Name]: Fn }; eventSchemas: {} }
                        : Spec extends ShallowHistorySpec<infer Name, infer P>
                            ? StateAliasFromPseudo<Name, P, ParentPath, ModelRoot, AllParts>
                            : Spec extends DeepHistorySpec<infer Name, infer P>
                                ? StateAliasFromPseudo<Name, P, ParentPath, ModelRoot, AllParts>
                                : Spec extends ChoiceSpec<infer Name, infer P>
                                    ? StateAliasFromPseudo<Name, P, ParentPath, ModelRoot, AllParts>
                                    : Spec extends EntryPointSpec<infer Name, infer P>
                                        ? StateAliasFromPseudo<Name, P, ParentPath, ModelRoot, AllParts>
                                        : Spec extends ExitPointSpec<infer Name, infer P>
                                            ? StateAliasFromPseudo<Name, P, ParentPath, ModelRoot, AllParts>
                                            : { states: never; finalStates: never; transitions: never; initials: {}; attributes: {}; operations: {}; eventSchemas: {} };

type StateAliasFromPseudo<
    Name extends string,
    Parts extends readonly unknown[],
    ParentPath extends string,
    ModelRoot extends string,
    AllParts extends readonly unknown[],
> = StateFromSpec<Name, Parts, ParentPath, ModelRoot, AllParts>;

type StateFromSpec<
    Name extends string,
    Parts extends readonly unknown[],
    ParentPath extends string,
    ModelRoot extends string,
    AllParts extends readonly unknown[],
> = {
    states:
        | ResolvePathExpression<ParentPath, Name>
        | ChildTransitionsFromParts<
            Parts,
            ResolvePathExpression<ParentPath, Name>,
            ModelRoot,
            AllParts
        >['states'];
    finalStates: ChildTransitionsFromParts<
        Parts,
        ResolvePathExpression<ParentPath, Name>,
        ModelRoot,
        AllParts
    >['finalStates'];
    transitions: ChildTransitionsFromParts<
        Parts,
        ResolvePathExpression<ParentPath, Name>,
        ModelRoot,
        AllParts
    >['transitions'];
    initials: ChildTransitionsFromParts<
        Parts,
        ResolvePathExpression<ParentPath, Name>,
        ModelRoot,
        AllParts
    >['initials'];
    attributes: ChildTransitionsFromParts<
        Parts,
        ResolvePathExpression<ParentPath, Name>,
        ModelRoot,
        AllParts
    >['attributes'];
    operations: ChildTransitionsFromParts<
        Parts,
        ResolvePathExpression<ParentPath, Name>,
        ModelRoot,
        AllParts
    >['operations'];
    eventSchemas: ChildTransitionsFromParts<
        Parts,
        ResolvePathExpression<ParentPath, Name>,
        ModelRoot,
        AllParts
    >['eventSchemas'];
};

type ChildTransitionsFromParts<
    Parts extends readonly unknown[],
    ParentPath extends string,
    ModelRoot extends string,
    AllParts extends readonly unknown[],
> = CollectModelParts<Parts, ParentPath, ModelRoot, AllParts>;

type FinalFromSpec<Name extends string, ParentPath extends string> = {
    states: ResolvePathExpression<ParentPath, Name>;
    finalStates: ResolvePathExpression<ParentPath, Name>;
    transitions: never;
    initials: {};
    attributes: {};
    operations: {};
    eventSchemas: {};
};

type EventSchemasFromChildrenWithContext<
    Parts extends readonly unknown[],
    AllParts extends readonly unknown[],
    ModelRoot extends string = '/',
> =
    Parts extends readonly [infer H, ...infer T]
        ? H extends StateSpec<any, infer ChildParts>
            ? EventSchemasFromPartialsWithContext<ChildParts, AllParts, ModelRoot> &
              EventSchemasFromChildrenWithContext<T, AllParts, ModelRoot>
            : H extends FinalSpec<any>
                ? EventSchemasFromChildrenWithContext<T, AllParts, ModelRoot>
                : H extends InitialSpec<infer Clauses>
                    ? EventSchemasFromClausesWithContext<Clauses, AllParts, ModelRoot> &
                      EventSchemasFromChildrenWithContext<T, AllParts, ModelRoot>
                    : H extends TransitionSpec<infer Clauses>
                        ? EventSchemasFromClausesWithContext<Clauses, AllParts, ModelRoot> &
                          EventSchemasFromChildrenWithContext<T, AllParts, ModelRoot>
                        : EventSchemasFromChildrenWithContext<T, AllParts, ModelRoot>
        : {};

type EventSchemasFromChildren<Parts extends readonly unknown[]> =
    EventSchemasFromChildrenWithContext<Parts, Parts>;

type TransitionFromSpec<
    Clauses extends readonly unknown[],
    OwnerPath extends string,
    ModelRoot extends string,
    ModelParts extends readonly unknown[],
> = {
    states: never;
    finalStates: never;
    transitions: NormalizeTransition<
        TransitionFromClauses<Clauses, OwnerPath, ModelRoot, OwnerPath, undefined, never, {}, ModelParts>,
        OwnerPath,
        ModelRoot
    >;
    attributes: {};
    operations: {};
    eventSchemas: EventSchemasFromClausesWithContext<Clauses, ModelParts, ModelRoot>;
    initials: {};
};

type InitialsFromClauses<
    Clauses extends readonly unknown[],
    OwnerPath extends string,
    ModelRoot extends string,
> =
    NormalizeTransition<
        TransitionFromClauses<Clauses, OwnerPath, ModelRoot, OwnerPath>,
        OwnerPath,
        ModelRoot
    >['target'] extends infer Target
        ? Target extends string
            ? { [K in OwnerPath]: Target }
            : {}
        : {};

type InitialFromSpec<
    Clauses extends readonly unknown[],
    OwnerPath extends string,
    ModelRoot extends string,
    ModelParts extends readonly unknown[],
> = {
    states: never;
    finalStates: never;
    transitions: NormalizeTransition<
        TransitionFromClauses<Clauses, OwnerPath, ModelRoot, OwnerPath, undefined, never, {}, ModelParts>,
        OwnerPath,
        ModelRoot
    >;
    initials: InitialsFromClauses<Clauses, OwnerPath, ModelRoot>;
    attributes: {};
    operations: {};
    eventSchemas: EventSchemasFromClausesWithContext<Clauses, ModelParts, ModelRoot>;
};

type NormalizeTransition<
    T extends {
        owner: string;
        source: string;
        target: string | undefined;
        events: string;
        schema: Record<string, unknown>;
    },
    Owner extends string,
    Root extends string,
> = {
    source: ResolveModelPathExpression<Owner, Root, T['source']>;
    target: T['target'] extends string ? ResolveModelPathExpression<Owner, Root, T['target']> : undefined;
    events: T['events'];
    schema: T['schema'];
};

type MergeCollect<A, B> = {
    states: A extends { states: infer AS } ? (B extends { states: infer BS } ? AS | BS : AS) : never;
    finalStates: A extends { finalStates: infer AF } ? (B extends { finalStates: infer BF } ? AF | BF : AF) : never;
    transitions: A extends { transitions: infer AT } ? (B extends { transitions: infer BT } ? AT | BT : AT) : never;
    initials: A extends { initials: infer AI } ? B extends { initials: infer BI } ? MergeEventMaps<AI & Record<string, string>, BI & Record<string, string>> : AI : never;
    attributes: A extends { attributes: infer AA } ? B extends { attributes: infer BA } ? MergeEventMaps<AA & Record<string, unknown>, BA & Record<string, unknown>> : AA : never;
    operations: A extends { operations: infer AO } ? B extends { operations: infer BO } ? MergeEventMaps<AO & Record<string, (...args: any[]) => any>, BO & Record<string, (...args: any[]) => any>> : AO : never;
    eventSchemas: A extends { eventSchemas: infer AE } ? B extends { eventSchemas: infer BE } ? MergeEventMaps<AE & Record<string, unknown>, BE & Record<string, unknown>> : AE : never;
};

type ModelStateMetaFromParts<
    RootPath extends string,
    Parts extends readonly unknown[],
> = {
    name: RootPath;
    states: (CollectModelParts<Parts, RootPath, RootPath, Parts>['states']) & string;
    finalStates: (CollectModelParts<Parts, RootPath, RootPath, Parts>['finalStates']) & string;
    transitions: CollectModelParts<Parts, RootPath, RootPath, Parts>['transitions'];
    initials: CollectModelParts<Parts, RootPath, RootPath, Parts>['initials'];
    attributes: InferredAttributes<Parts>;
    operations: InferredOperations<Parts>;
    eventSchemas: MergeEventMaps<
        EventSchemasFromPartialsWithContext<Parts, Parts, RootPath>,
        EventSchemaFromTransitions<
            CollectModelParts<Parts, RootPath, RootPath, Parts>['transitions']
        >
    >;
};

type EventSchemaFromTransitions<Transitions> =
    [Transitions] extends [never]
        ? {}
        : {
            [Name in TransitionEventNames<Transitions>]: EventSchemaForTransitionEvent<Transitions, Name>;
        };

type TransitionEventNames<Transitions> =
    Transitions extends { events: infer EventName }
        ? EventName & string
        : never;

type EventSchemaForTransitionEvent<Transitions, EventName extends string> =
    Transitions extends infer Transition
        ? Transition extends { events: infer E; schema: infer S }
            ? EventName extends E
                ? S extends Record<string, unknown>
                    ? EventName extends keyof S
                        ? S[EventName]
                        : unknown
                    : unknown
                : never
            : never
        : never;

type EventFromSchemaMap<SchemaMap extends Record<string, unknown>> = {
    [Name in keyof SchemaMap & string]: Event<Name, SchemaMap[Name]>
}[keyof SchemaMap & string];

type EventNameFromUnion<U> =
    U extends Event<infer Name, any>
        ? Name
        : never;

type EventUnionFromMap<SchemaMap> =
    SchemaMap extends Record<string, unknown> ? EventFromSchemaMap<SchemaMap> : never;

type EventUnionFromTransitions<Transitions> =
    TransitionEventNames<Transitions> extends infer Name
        ? Name extends string
            ? Event<Name, EventSchemaForTransitionEvent<Transitions, Name>>
            : never
        : never;

type ModelTransitionEventsFromParts<Transitions> = EventUnionFromTransitions<Transitions>;

type ModelNameFromInstance<M extends TypedModel<any, any, any, any, any, any, any, Instance>> =
    M extends TypedModel<any, any, any, any, any, any, infer TName, any> ? TName : string;

type ModelEventSchemas<M> =
    ModelStateMeta<M> extends { eventSchemas: infer E }
        ? E extends Record<string, unknown>
            ? E
            : ModelEventMap<M>
        : ModelEventMap<M>;

type EventMapKeys<M> = keyof ModelEventSchemas<M> & string;

type EventSchemaFromMapFor<
    M,
    N extends string,
> = ModelEventMap<M> extends infer E
    ? E extends Record<string, unknown>
        ? N extends keyof E
            ? E[N]
            : never
        : never
    : never;

type EventSchemaFromTransitionsFor<
    M,
    N extends string,
> = EventSchemaForTransitionEvent<TransitionMetaModel<M>, N>;

type EventSchemaFor<M, N extends string> =
    N extends EventMapKeys<M>
        ? [EventSchemaFromTransitionsFor<M, N>] extends [never]
            ? [EventSchemaFromMapFor<M, N>] extends [never]
                ? unknown
                : EventSchemaFromMapFor<M, N>
            : EventSchemaFromTransitionsFor<M, N>
        : unknown;

type StatePathsOfModel<M> = ModelStateMeta<M>['states'];
type FinalStatePathsOfModel<M> = ModelStateMeta<M>['finalStates'];
type TransitionMetaModel<M> = ModelStateMeta<M>['transitions'];

type EventNamesFromMap<M> = Exclude<EventMapKeys<M>, never>;
type EventNamesFromTransitions<M> = Exclude<TransitionMetaModel<M>, never> extends infer T
    ? T extends { events: infer E }
        ? E
        : never
    : never;

type CompletionStateCandidates<M> = FinalStatePathsOfModel<M> extends infer FinalPath
    ? FinalPath extends string
        ? ParentPath<FinalPath>
        : never
    : never;

export type StatePathsOf<M extends TypedModel<any, any, any, any, any, any, any, any>> =
    StatePathsOfModel<M>;

export type RelativeStatePathsOf<M extends TypedModel<any, any, any, any, any, any, any, any>> =
    RelativeFromAbsolute<StatePathsOf<M>>;

export type LeafStatesOf<M extends TypedModel<any, any, any, any, any, any, any, any>> =
    StatePathsOf<M> extends infer StatePath
        ? StatePath extends string
            ? HasStateDescendant<StatePath, StatePathsOf<M>> extends true
                ? never
                : StatePath
            : never
        : never;

type HasStateDescendant<StatePath extends string, Set extends string> =
    Set extends `${StatePath}/${string}` ? true : false;

export type AttributesOf<M extends TypedModel<any, any, any, any, any, any, any, any>> =
    ModelStateMeta<M> extends { attributes: infer A }
        ? A extends Record<string, unknown>
            ? A
            : {}
        : {};

export type AttributeKeysOf<M extends TypedModel<any, any, any, any, any, any, any, any>> =
    keyof AttributesOf<M> & string;

export type OperationsOf<M extends TypedModel<any, any, any, any, any, any, any, any>> =
    ModelStateMeta<M> extends { operations: infer O }
        ? O
        : ModelOperationMap<M>;

export type OperationKeysOf<M extends TypedModel<any, any, any, any, any, any, any, any>> =
    keyof OperationsOf<M> & string;

export type CallableOperationKeysOf<M extends TypedModel<any, any, any, any, any, any, any, any>> =
    OperationKeysOf<M>;

export type GuardOperationKeysOf<M extends TypedModel<any, any, any, any, any, any, any, any>> = {
    [K in OperationKeysOf<M>]:
        IsAny<ReturnType<Extract<OperationsOf<M>[K], (...args: any[]) => any>>> extends true
            ? never
            : ReturnType<Extract<OperationsOf<M>[K], (...args: any[]) => any>> extends boolean
                ? K
                : never;
}[OperationKeysOf<M>];

export type FinalStatesOf<M extends TypedModel<any, any, any, any, any, any, any, any>> =
    FinalStatePathsOfModel<M>;

export type IsFinalState<
    M extends TypedModel<any, any, any, any, any, any, any, any>,
    Path extends string,
> = Path extends FinalStatePathsOfModel<M> ? true : false;

export type CompletionStatePathsOf<M extends TypedModel<any, any, any, any, any, any, any, any>> =
    CompletionStateCandidates<M>;

export type DoneEventNamesOf<M extends TypedModel<any, any, any, any, any, any, any, any>> =
    CompletionStatePathsOf<M> extends infer CompletionPath
        ? CompletionPath extends string
            ? `done:${CompletionPath}`
            : never
        : never;

export type DoneEventOf<M extends TypedModel<any, any, any, any, any, any, any, any>> =
    DoneEventNamesOf<M> extends infer Name
        ? Name extends string
            ? Event<Name>
            : never
        : never;

export type CompletionEventsOf<M extends TypedModel<any, any, any, any, any, any, any, any>> = DoneEventOf<M>;

export type EventNamesFromState<
    M extends TypedModel<any, any, any, any, any, any, any, any>,
    StatePath extends string,
> = TransitionMetaModel<M> extends infer T
    ? T extends { source: StatePath; events: infer E }
        ? E
        : never
    : never;

export type EventsForState<
    M extends TypedModel<any, any, any, any, any, any, any, any>,
    StatePath extends string,
> = EventOfName<M, EventNamesFromState<M, StatePath>>;

export type EventNamesOf<M extends TypedModel<any, any, any, any, any, any, any, any>> =
    Exclude<EventNamesFromMap<M>, DoneEventNamesOf<M>>;

export type EventOfName<
    M extends TypedModel<any, any, any, any, any, any, any, any>,
    Name extends string,
> = Name extends EventNamesOf<M>
    ? Event<Name, EventSchemaFor<M, Name>>
    : never;

export type DispatchEvent<Name extends string = string, Data = unknown> =
    Omit<Event<Name, Data>, 'data'> & {
        readonly data?: Data;
    };

export type DispatchEventOfName<
    M extends TypedModel<any, any, any, any, any, any, any, any>,
    Name extends string,
> = Name extends EventNamesOf<M>
    ? EventOfName<M, Name> extends Event<Name, infer Data>
        ? DispatchEvent<Name, Data>
        : never
    : never;

export type DispatchEventsOf<
    M extends TypedModel<any, any, any, any, any, any, any, any>,
> = DispatchEventOfName<M, EventNamesOf<M>>;

export type TargetsFromState<
    M extends TypedModel<any, any, any, any, any, any, any, any>,
    StatePath extends string,
> = TransitionMetaModel<M> extends infer T
    ? T extends { source: StatePath; events: infer _; target: infer Target }
        ? Target extends string
            ? Target
            : never
        : never
    : never;

export type TargetsFromStateAndEvent<
    M extends TypedModel<any, any, any, any, any, any, any, any>,
    StatePath extends string,
    EventName extends string,
> = TransitionMetaModel<M> extends infer T
    ? T extends { source: StatePath; events: infer E; target: infer Target }
        ? EventName extends E
            ? (Target extends string ? Target : never)
            : never
        : never
    : never;

export type SourcesForEvent<
    M extends TypedModel<any, any, any, any, any, any, any, any>,
    EventName extends string,
> = TransitionMetaModel<M> extends infer T
    ? T extends { source: infer Source; events: infer E }
        ? EventName extends E
            ? Source
            : never
        : never
    : never;

export type CanTransition<
    M extends TypedModel<any, any, any, any, any, any, any, any>,
    StatePath extends string,
    TargetPath extends string,
    EventName extends string,
> = TargetPath extends TargetsFromStateAndEvent<M, StatePath, EventName> ? true : false;

export type ChildrenOf<
    M extends TypedModel<any, any, any, any, any, any, any, any>,
    StatePath extends string,
> = StatePathsOf<M> extends infer Candidate
    ? Candidate extends string
        ? ParentPath<Candidate> extends StatePath
            ? Candidate
            : never
        : never
    : never;

export type ParentOf<
    M extends TypedModel<any, any, any, any, any, any, any, any>,
    StatePath extends string,
> = ParentPath<StatePath>;

export type DescendantsOf<
    M extends TypedModel<any, any, any, any, any, any, any, any>,
    StatePath extends string,
> = StatePathsOf<M> extends infer Candidate
    ? Candidate extends `${StatePath}/${string}`
        ? Candidate
        : never
    : never;

export type AncestorsOf<
    M extends TypedModel<any, any, any, any, any, any, any, any>,
    StatePath extends string,
> = StatePathsOf<M> extends infer Candidate
    ? Candidate extends string
        ? IsStatePathPrefix<Candidate, StatePath> extends true
            ? Candidate
            : never
        : never
    : never;

export type InitialStateOf<
    M extends TypedModel<any, any, any, any, any, any, any, any>,
    StatePath extends string,
> = StatePath extends string ? Extract<InitialStateCandidates<M>[StatePath], string> : never;

type InitialStateCandidates<M extends TypedModel<any, any, any, any, any, any, any, any>> =
    ModelStateMeta<M>['initials'];

export type SnapshotOf<M extends TypedModel<any, any, any, any, any, any, any, any>> = {
    readonly id: string;
    readonly ID: string;
    readonly qualifiedName: string;
    readonly QualifiedName: string;
    readonly state: StatePathsOf<M>;
    readonly State: StatePathsOf<M>;
    readonly attributes: Readonly<AttributesOf<M>>;
    readonly Attributes: Readonly<AttributesOf<M>>;
    readonly queueLen: number;
    readonly QueueLen: number;
    readonly transitions: readonly TransitionSnapshotOf<M>[];
    readonly Transitions: readonly TransitionSnapshotOf<M>[];
    readonly events: readonly EventSnapshotOf<M>[];
    readonly Events: readonly EventSnapshotOf<M>[];
};

type EventTargetForName<
    M extends TypedModel<any, any, any, any, any, any, any, any>,
    EventName extends string,
> = TransitionMetaModel<M> extends infer T
    ? T extends { events: infer E; target: infer Target }
        ? EventName extends E
            ? Target
            : never
        : never
    : never;

export type EventSnapshotOf<M extends TypedModel<any, any, any, any, any, any, any, any>> = {
    [Name in EventNamesFromTransitions<M>]: Readonly<{
        readonly event: Name;
        readonly Name: Name;
        readonly Kind: Kind;
        readonly target: EventTargetForName<M, Name>;
        readonly Target: EventTargetForName<M, Name>;
        readonly guard: boolean;
        readonly Guard: boolean;
        readonly schema?: EventSchemaFor<M, Name>;
        readonly Schema?: EventSchemaFor<M, Name>;
    }>;
}[EventNamesFromTransitions<M>];

export type TransitionSnapshotOf<M extends TypedModel<any, any, any, any, any, any, any, any>> =
    TransitionMetaModel<M> extends infer Transition
        ? Transition extends {
            source: infer Source;
            target: infer Target;
            events: infer Events;
        }
            ? Readonly<{
                readonly name: string;
                readonly Name: string;
                readonly kind: Kind;
                readonly Kind: Kind;
                readonly source: Source & string;
                readonly Source: Source & string;
                readonly target: Target extends string ? Target : undefined;
                readonly Target: Target extends string ? Target : undefined;
                readonly events: readonly (Events & string)[];
                readonly Events: readonly (Events & string)[];
                readonly guard: boolean;
                readonly Guard: boolean;
            }>
            : never
        : never;

export type BehaviorCallbackFor<
    M extends TypedModel<any, any, any, any, any, any, any, any>,
> = (ctx: Context, instance: M['__hsm_instance'] & Instance, event: EventOfName<M, EventNamesOf<M> & string>) => unknown;

type OperationSignature<
    M extends TypedModel<any, any, any, any, any, any, any, any>,
    K extends keyof OperationsOf<M> & string,
> = Extract<OperationsOf<M>[K], (...args: any[]) => any>;

export type MachineInstanceFor<
    M extends TypedModel<any, any, any, any, any, any, any, Instance>,
    I extends Instance,
> = M extends TypedModel<infer A, infer O, any, any, any, any, any, any>
    ? Omit<I, "dispatch" | "state" | "takeSnapshot" | "get" | "set" | "call"> & {
        __hsm_model: M;
        dispatch(event: DispatchEventsOf<M>): Completion;
        dispatch(ctx: Context, event: DispatchEventsOf<M>): Completion;
        Dispatch(event: DispatchEventsOf<M>): Completion;
        Dispatch(ctx: Context, event: DispatchEventsOf<M>): Completion;
        state(): StatePathsOf<M>;
        State(): StatePathsOf<M>;
        takeSnapshot(): SnapshotOf<M>;
        TakeSnapshot(): SnapshotOf<M>;
        get<K extends keyof A & string>(name: K): AttributeRead<A[K]>;
        get(name: string): AttributeRead;
        Get<K extends keyof A & string>(name: K): AttributeRead<A[K]>;
        Get(name: string): AttributeRead;
        set<K extends keyof A & string>(name: K, value: A[K]): Completion;
        set<Name extends string>(
            name: Name extends keyof A & string ? never : Name,
            value: unknown,
        ): Completion;
        Set<K extends keyof A & string>(name: K, value: A[K]): Completion;
        Set<Name extends string>(
            name: Name extends keyof A & string ? never : Name,
            value: unknown,
        ): Completion;
        call<K extends keyof O & string>(
            name: K,
            ...args: Parameters<Extract<O[K], (...args: any[]) => any>>
        ): Promise<Awaited<ReturnType<Extract<O[K], (...args: any[]) => any>>>>;
        call(name: string, ...args: unknown[]): Promise<unknown>;
        Call<K extends keyof O & string>(
            name: K,
            ...args: Parameters<Extract<O[K], (...args: any[]) => any>>
        ): Promise<Awaited<ReturnType<Extract<O[K], (...args: any[]) => any>>>>;
        Call(name: string, ...args: unknown[]): Promise<unknown>;
        start(ctx?: Context, data?: unknown): Promise<I>;
        Start(ctx?: Context, data?: unknown): Promise<I>;
        stop(): Completion;
        Stop(): Completion;
        restart(data?: unknown): Completion;
        Restart(data?: unknown): Completion;
    }
    : never;

type FlattenGroupMember<Member> =
    Member extends Group<infer Members>
        ? FlattenGroupMembers<Members>
        : [Member];

type FlattenGroupMembers<Members extends readonly unknown[]> =
    Members extends readonly [infer Head, ...infer Tail]
        ? [
            ...FlattenGroupMember<Head>,
            ...FlattenGroupMembers<Tail>,
        ]
        : [];

type GroupModelOf<Member> =
    Member extends { __hsm_model: infer Model }
        ? Model extends TypedModel<any, any, any, any, any, any, any, any>
            ? Model
            : never
        : never;

type GroupDispatchEventOf<Member> =
    GroupModelOf<Member> extends infer Model extends TypedModel<any, any, any, any, any, any, any, any>
        ? DispatchEventsOf<Model>
        : Member extends { dispatch(event: infer Event): unknown }
            ? Event
            : EventRecord;

type GroupAttributeKeysOf<Member> =
    GroupModelOf<Member> extends infer Model extends TypedModel<any, any, any, any, any, any, any, any>
        ? AttributeKeysOf<Model>
        : string;

type GroupAttributeValueOf<Member, Key extends string> =
    GroupModelOf<Member> extends infer Model extends TypedModel<any, any, any, any, any, any, any, any>
        ? Key extends AttributeKeysOf<Model>
            ? AttributesOf<Model>[Key]
            : never
        : unknown;

type SharedAttributeKeysOfFlattenedMembers<Members extends readonly unknown[]> =
    Members extends readonly [infer Head, ...infer Tail]
        ? GroupAttributeKeysOf<Head> & SharedAttributeKeysOfFlattenedMembers<Tail>
        : string;

type SharedAttributeKeysOfGroupMembers<Members extends readonly unknown[]> =
    SharedAttributeKeysOfFlattenedMembers<FlattenGroupMembers<Members>>;

type SharedAttributeValueOfFlattenedMembers<
    Members extends readonly unknown[],
    Key extends string,
> =
    Members extends readonly [infer Head, ...infer Tail]
        ? GroupAttributeValueOf<Head, Key> & SharedAttributeValueOfFlattenedMembers<Tail, Key>
        : unknown;

type SharedAttributeValueOfGroupMembers<
    Members extends readonly unknown[],
    Key extends string,
> = SharedAttributeValueOfFlattenedMembers<FlattenGroupMembers<Members>, Key>;

type FirstGroupMember<Members extends readonly unknown[]> =
    FlattenGroupMembers<Members> extends readonly [infer Head, ...infer _Tail]
        ? Head
        : never;

type GroupOperationKeysOf<Member> =
    GroupModelOf<Member> extends infer Model extends TypedModel<any, any, any, any, any, any, any, any>
        ? OperationKeysOf<Model>
        : string;

type GroupOperationSignatureOf<Member, Key extends string> =
    GroupModelOf<Member> extends infer Model extends TypedModel<any, any, any, any, any, any, any, any>
        ? Key extends OperationKeysOf<Model>
            ? OperationSignature<Model, Key>
            : (...args: any[]) => unknown
        : (...args: any[]) => unknown;

type GroupEventUnion<Members extends readonly unknown[]> =
    FlattenGroupMembers<Members>[number] extends infer Member
        ? Member extends unknown
            ? GroupDispatchEventOf<Member>
            : never
        : never;

type GroupOperationKeys<Members extends readonly unknown[]> =
    GroupOperationKeysOf<FirstGroupMember<Members>>;

type GroupOperationSignature<
    Members extends readonly unknown[],
    Key extends string,
> = GroupOperationSignatureOf<FirstGroupMember<Members>, Key>;

type GroupSnapshotOfMember<Member> =
    GroupModelOf<Member> extends infer Model extends TypedModel<any, any, any, any, any, any, any, any>
        ? SnapshotOf<Model>
        : Member extends { takeSnapshot(): infer CurrentSnapshot }
            ? CurrentSnapshot
            : Snapshot;

type GroupSnapshotsOfFlattenedMembers<Members extends readonly unknown[]> =
    Members extends readonly [infer Head, ...infer Tail]
        ? readonly [
            GroupSnapshotOfMember<Head>,
            ...GroupSnapshotsOfFlattenedMembers<Tail>,
        ]
        : readonly [];

export type GroupSnapshotOf<Members extends readonly unknown[]> =
    GroupSnapshotsOfFlattenedMembers<FlattenGroupMembers<Members>>;

type BuilderWithSpec<Signature, Spec> = Signature & { readonly __hsmSpec: Spec };

type BehaviorArgument<EventType extends EventRecord = EventRecord> =
    | ((ctx: Context, instance: Instance, evt: EventType) => unknown)
    | string
    | { dispatch(ctx: Context, event: EventType): Completion };

function attachSpec<Signature, Spec>(
    builder: Signature,
    spec: Spec,
): BuilderWithSpec<Signature, Spec> {
    return Object.assign(builder as Signature, {
        __hsmSpec: spec,
    }) as BuilderWithSpec<Signature, Spec>;
}

type InternalRuntime = {
  dispatch: (ctx: Context, event: EventRecord) => Completion;
  start: (ctx?: Context, data?: unknown) => Promise<Instance>;
  state: () => string;
  context: () => Context;
  clock: ClockConfig;
  get: (name: string) => AttributeRead;
  set: (name: string, value: unknown) => Completion;
  invoke: (name: string, ctx: Context, args: Array<unknown>) => unknown;
  call: (name: string, ...args: unknown[]) => Promise<unknown>;
  restart: (data?: unknown) => Completion;
  takeSnapshot: () => Snapshot;
  onAfter: (bucket: keyof HSM["after"], key: string, listener: () => void) => () => void;
  stop: () => Completion;
  readonly id: string;
  readonly model: any;
  readonly name: string;
  readonly queue: Queue;
  readonly processing: boolean;
};

export type { Snapshot, ClockConfig, QueueShape };

type InternalRuntimeMap = WeakMap<object, InternalRuntime>;
const runtimeByInstance: InternalRuntimeMap = new WeakMap();
const submachineRoots = new WeakMap<State, string>();
const modelRebaseRoots = new WeakMap<Model, string[]>();
const contextHSM = new WeakMap<Context, Dispatchable>();
const contextOwner = new WeakMap<Context, Dispatchable>();
const contextParents = new WeakMap<Context, Context | undefined>();
const contextValues = new WeakMap<Context, Map<unknown, unknown>>();

export const Keys = Object.freeze({
    HSM: "hsm",
    Owner: "owner",
    Instances: "instances",
});

function bindRuntime(instance: object, runtime: InternalRuntime): void {
    runtimeByInstance.set(instance, runtime);
}

function runtimeFor(instance: unknown): InternalRuntime | undefined {
    if (!instance || typeof instance !== "object") {
        return undefined;
    }
    return runtimeByInstance.get(instance);
}

function isDispatchable(value: unknown): value is Dispatchable {
    return !!value &&
        typeof value === "object" &&
        typeof (value as { context?: unknown }).context === "function" &&
        typeof (value as { dispatch?: unknown }).dispatch === "function";
}

export function fromContext(ctx: Context): readonly [Dispatchable | undefined, boolean] {
    var value = ctx.Value(Keys.HSM);
    if (value && isDispatchable(value)) {
        return [value, true];
    }
    var fallback = contextHSM.get(ctx);
    return [fallback, fallback !== undefined];
}

export function instancesFromContext(ctx: Context): readonly [Record<string, Instance>, boolean] {
    var value = ctx.Value(Keys.Instances);
    if (value && typeof value === "object") {
        return [value as Record<string, Instance>, true];
    }
    return [ctx.instances, false];
}

function parentContextForStart(ctx: Context, instance: Instance): Context {
    var current: Context | undefined = ctx;
    while (current) {
        var values = contextValues.get(current);
        if (values && values.has(Keys.HSM) && values.get(Keys.HSM) === instance) {
            return contextParents.get(current) || new Context();
        }
        current = contextParents.get(current);
    }
    return ctx;
}

function rebaseAbsolutePath(model: Model, stack: AnyModelElement[], name: string): string {
    if (!isAbsolute(name) || name === model.qualifiedName) {
        return name;
    }
    var relativeName = name.slice(1);
    var parts = relativeName.split("/");
    var sourceRoot = "/" + parts[0];
    for (var i = stack.length - 1; i >= 0; i--) {
        var element = stack[i];
        if (
            isStateElement(element) &&
            isKind(element.kind, kinds.SubmachineState) &&
            submachineRoots.get(element) === sourceRoot
        ) {
            return join(element.qualifiedName, parts.slice(1).join("/"));
        }
    }
    var rebaseRoots = modelRebaseRoots.get(model);
    if (rebaseRoots) {
        for (var rootIndex = 0; rootIndex < rebaseRoots.length; rootIndex++) {
            var root = rebaseRoots[rootIndex];
            if (root === model.qualifiedName) {
                continue;
            }
            if (name === root) {
                return model.qualifiedName;
            }
            if (isAncestor(root, name)) {
                return join(model.qualifiedName, name.slice(root.length + 1));
            }
        }
    }
    if (isAncestor(model.qualifiedName, name)) {
        return name;
    }
    return join(model.qualifiedName, relativeName);
}



export function join(...segments: string[]): string {

    var parts: string[] = []; // Stores the normalized path components (e.g., ['a', 'b'])
    var currentIsAbsolute = false; // Flag to track if the *resulting* path should be absolute

    // Loop through each input segment
    for (var i = 0; i < segments.length; i++) {
        var segment = segments[i];

        // Skip null, undefined, or empty segments.
        if (segment === null || segment === undefined || segment.length === 0) {
            continue;
        }

        // If the current segment starts with '/', it resets the path.
        // All previous parts are discarded, and the new path effectively becomes absolute from here.
        if (segment[0] === '/') {
            parts = []; // Reset parts array
            currentIsAbsolute = true;
        }

        var startIndex = 0;
        var currentPartEnd = 0;
        var part = '';
        // Iterate through the segment to extract components between slashes
        while (currentPartEnd < segment.length) {
            if (segment[currentPartEnd] === '/') {
                // If we found a component (i.e., not multiple slashes like // or a leading slash at start of segment)
                if (currentPartEnd > startIndex) {
                    part = segment.substring(startIndex, currentPartEnd);

                    // Process the extracted part
                    if (part === '..') {
                        // If absolute path and at root (parts is empty), '..' has no effect (e.g., /../ -> /)
                        if (currentIsAbsolute && parts.length === 0) {
                            // Do nothing
                        }
                        // If the last part pushed was not '..', we can pop it (e.g., /a/b/../ -> /a/)
                        else if (parts.length > 0 && parts[parts.length - 1] !== '..') {
                            parts.pop(); // Go up one directory
                        }
                        // Otherwise (parts is empty and relative, or last part was '..'), push '..'
                        else {
                            parts.push(part);
                        }
                    } else if (part !== '.') { // Ignore '.' (e.g., a/./b -> a/b)
                        parts.push(part);
                    }
                }
                startIndex = currentPartEnd + 1; // Move past the current separator
            }
            currentPartEnd++;
        }

        // Handle the last component of the segment (if any) after the loop finishes
        if (currentPartEnd > startIndex) {
            part = segment.substring(startIndex, currentPartEnd);
            // Process the last extracted part, same logic as above
            if (part === '..') {
                if (currentIsAbsolute && parts.length === 0) {
                    // Do nothing
                } else if (parts.length > 0 && parts[parts.length - 1] !== '..') {
                    parts.pop();
                } else {
                    parts.push(part);
                }
            } else if (part !== '.') {
                parts.push(part);
            }
        }
    }

    // Join the processed parts into a single string
    var joinedPath = parts.join('/');

    // If the resulting path should be absolute, prepend '/'
    if (currentIsAbsolute) {
        joinedPath = '/' + joinedPath;
    }

    // Determine if the *final* path should have a trailing slash.
    // This is true if the *last original input segment* ended with a slash,
    // AND the resulting path is not just the root ('/').
    var hasTrailingSlash = false;
    if (segments.length > 0) {
        var lastInputSegment = segments[segments.length - 1];
        // Check if the last non-empty segment ends with a slash
        if (lastInputSegment && lastInputSegment.length > 0 && lastInputSegment[lastInputSegment.length - 1] === '/') {
            hasTrailingSlash = true;
        }
    }

    // Handle final path resolution:
    // 1. If path is empty (e.g., join('a', '..')), return '.' for relative, '/' for absolute.
    if (joinedPath.length === 0) {
        return currentIsAbsolute ? '/' : '.';
    }
    // 2. If it should have a trailing slash and isn't just '/', append it.
    else if (hasTrailingSlash && joinedPath !== '/') {
        return joinedPath + "/";
    }

    // 3. Otherwise, return the path as is.
    return joinedPath;
}

function slice(args: IArguments, start: number = 0): any[] {
    var result = [];
    for (var i = start; i < args.length; i++) {
        result.push(args[i]);
    }
    return result;
}



export function dirname(path: string): string {
    // Handle null, undefined, or empty path strings
    if (path === undefined || path === null || path.length === 0) {
        return '.';
    }

    // Determine if the original path was absolute (starts with '/').
    // This helps distinguish e.g., '/foo' (dirname is '/') from 'foo' (dirname is '.').
    var originalPathWasAbsolute = (path[0] === '/');

    // --- Step 1: Trim trailing separators ---
    // Find the index of the last non-separator character.
    // This effectively removes trailing slashes, so 'a/b/c/' becomes 'a/b/c'.
    // If path is '/', '///', etc., 'i' will become -1.
    var i = path.length - 1;
    while (i >= 0 && path[i] === '/') {
        i--;
    }

    // 'p' is the path without trailing separators.
    // Example: If path was 'a/b/c/', p becomes 'a/b/c'.
    // Example: If path was '/', p becomes ''.
    var p = path.substring(0, i + 1);

    // --- Step 2: Handle cases where 'p' is empty after trimming ---
    // This means the original path was composed solely of separators (e.g., '/', '///')
    // or was initially an empty string.
    if (p.length === 0) {
        // If the original path was absolute (e.g., '/'), return '/'.
        // Otherwise (e.g., '' -> should be '.'), return '.'.
        return originalPathWasAbsolute ? '/' : '.';
    }

    // --- Step 3: Find the last separator in the (now trimmed) path 'p' ---
    var lastSeparatorIndex = p.lastIndexOf('/');

    // --- Step 4: Determine the result based on the last separator index ---

    // Case A: No separator found in 'p' (e.g., 'foo', or '/foo' where 'p' became 'foo').
    if (lastSeparatorIndex < 0) {
        // If the original path was absolute (e.g., '/foo'), its dirname is '/'.
        // Otherwise (e.g., 'foo'), its dirname is '.'.
        return originalPathWasAbsolute ? '/' : '.';
    }

    // Case B: A separator was found. Extract the part of 'p' before that separator.
    var result =
 (p.substring(0, lastSeparatorIndex));

    // Case C: The extracted 'result' is empty (e.g., original '/a', 'p' was '/a', lastSeparatorIndex was 0).
    // This means the last component was the only component after a root.
    if (result.length === 0) {
        // If the original path was absolute, the dirname is '/'.
        // (This correctly handles '/a' -> '/')
        return originalPathWasAbsolute ? '/' : '.';
    }

    // Otherwise, return the extracted directory path.
    return result;
}


export function isAbsolute(path: string): boolean {
    var c = path.charAt(0);
    // Unix-style: "/foo"
    if (c === '/') return true;

    // Windows-style: "C:\foo" or "C:/foo"
    return path.length > 2 && path.charAt(1) === ':' && path.charAt(2) === '/';
}

// #endregion

// #region AbortController





export class Context {
    listeners: Array<() => void>;
    instances: Record<string, Instance>;
    done: boolean;

    constructor(
        parent?: Context,
        values?: Iterable<readonly [unknown, unknown]> | Record<string, unknown>,
    ) {
        this.listeners = [];
        var localValues = values && typeof (values as { [Symbol.iterator]?: unknown })[Symbol.iterator] === "function"
            ? new Map(values as Iterable<readonly [unknown, unknown]>)
            : new Map(Object.entries(values || {}));
        var instances = localValues.get(Keys.Instances);
        var inheritedInstances = parent ? parent.Value(Keys.Instances) : undefined;
        this.instances = instances && typeof instances === "object"
            ? instances as Record<string, Instance>
            : inheritedInstances && typeof inheritedInstances === "object"
            ? inheritedInstances as Record<string, Instance>
            : {};
        this.done = false;
        contextParents.set(this, parent);
        contextValues.set(this, localValues);
        if (parent && parent.done) {
            this.done = true;
        } else if (parent) {
            var cancelFromParent = () => {
                parent.removeEventListener("done", cancelFromParent);
                this.cancel();
            };
            parent.addEventListener("done", cancelFromParent);
            this.addEventListener("done", () => {
                parent.removeEventListener("done", cancelFromParent);
            });
        }
    }

    addEventListener(_type: "done", listener: () => void): void {
        if (this.done) {
            listener();
            return;
        }
        this.listeners.push(listener);
    }

    removeEventListener(_type: "done", listener: () => void): void {
        var index = this.listeners.indexOf(listener);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }

    cancel(): void {
        if (this.done) {
            return;
        }
        this.done = true;
        var listeners = this.listeners.slice();
        for (var i = 0; i < listeners.length; i++) {
            listeners[i]();
        }
    }

    Cancel(): void {
        this.cancel();
    }

    Value(key: unknown): unknown {
        var values = contextValues.get(this);
        if (values && values.has(key)) {
            return values.get(key);
        }
        var parent = contextParents.get(this);
        return parent ? parent.Value(key) : undefined;
    }

    value(key: unknown): unknown {
        return this.Value(key);
    }

    WithValue(key: unknown, value: unknown): Context {
        return new Context(this, new Map([[key, value]]));
    }

    withValue(key: unknown, value: unknown): Context {
        return this.WithValue(key, value);
    }

    WithCancel(): readonly [Context, () => void] {
        var ctx = new Context(this);
        return [ctx, () => ctx.cancel()];
    }

    withCancel(): readonly [Context, () => void] {
        return this.WithCancel();
    }
}



// #endregion



































// Define special events
export const InitialEvent = {
    kind: kinds.CompletionEvent,
    qualifiedName: "hsm/initial",
    name: "hsm/initial"
};

export const AnyEvent = {
    kind: kinds.Event,
    qualifiedName: "*",
    name: "*"
};


export const FinalEvent = {
    name: 'hsm/final',
    kind: kinds.CompletionEvent
};


export const ErrorEvent = {
    name: 'hsm/error',
    kind: kinds.ErrorEvent
};

export const DefaultClock: Required<ClockConfig> = {
    setTimeout:
        typeof setTimeout === "function"
            ? ((callback: (...args: Array<unknown>) => void, timeout?: number, ...args: Array<unknown>) =>
                  setTimeout(callback, timeout || 0, ...args)) as TimerFunction
            : function (_callback, _timeout, ..._args) {
                  return 0 as unknown as TimerHandle;
              },
    clearTimeout: typeof clearTimeout === "function"
        ? ((id: TimerHandle | undefined) => {
              if (id !== undefined) {
                  clearTimeout(id as unknown as number);
              }
          })
        : function () { },
    now: typeof Date !== "undefined" && typeof Date.now === "function" ? Date.now : function () {
        return 0;
    },
};

function isConfigObject(value: unknown): value is Config {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function configID(config: Config | undefined): string | undefined {
    return config?.ID ?? config?.id;
}

function configName(config: Config | undefined): string | undefined {
    return config?.Name ?? config?.name;
}

function configData(config: Config | undefined): unknown {
    return config?.Data ?? config?.data;
}

function configClock(config: Config | undefined): PartialClockConfig | undefined {
    return config?.Clock ?? config?.clock;
}

function configQueue(config: Config | undefined): QueueShape | undefined {
    return config?.Queue ?? config?.queue;
}

function validateQueueShape(fifo: QueueShape | undefined): QueueShape | undefined {
    if (!fifo) {
        return undefined;
    }
    var hasCanonical = "Push" in fifo || "Pop" in fifo || "Len" in fifo;
    var canonicalComplete =
        typeof (fifo as Partial<CanonicalQueueShape>).Push === "function" &&
        typeof (fifo as Partial<CanonicalQueueShape>).Pop === "function" &&
        typeof (fifo as Partial<CanonicalQueueShape>).Len === "function";
    var lowercaseComplete =
        typeof (fifo as Partial<LowercaseQueueShape>).push === "function" &&
        typeof (fifo as Partial<LowercaseQueueShape>).pop === "function" &&
        typeof (fifo as Partial<LowercaseQueueShape>).len === "function";
    if (hasCanonical ? canonicalComplete : lowercaseComplete) {
        return fifo;
    }
    throw new TypeError("Queue requires complete Push/Pop/Len or push/pop/len hooks");
}

function isThenable(value: unknown): boolean {
    return value !== undefined && value !== null &&
        (typeof value === "object" || typeof value === "function") &&
        typeof (value as { then?: unknown }).then === "function";
}

function isAsyncFunction(value: unknown): boolean {
    return typeof value === "function" &&
        (value as { constructor?: { name?: string } }).constructor?.name === "AsyncFunction";
}

function errorCompletion(error: Error): Completion {
    var completion = Promise.reject(error) as Completion & { __hsmError?: Error };
    completion.__hsmError = error;
    completion.catch(function () {});
    return completion;
}

function validateNameNoSlash(kind: string, name: string): void {
    if (name.indexOf("/") !== -1) {
        throw new TypeError(kind + ' name "' + name + '" cannot contain "/"');
    }
}

function isRelativePathReference(name: string): boolean {
    return name === "." || name === ".." || name.startsWith("./") || name.startsWith("../");
}

function setModelMember(model: Model, member: AnyModelElement): void {
    if (model.members[member.qualifiedName]) {
        throw new Error("duplicate state " + member.qualifiedName);
    }
    model.members[member.qualifiedName] = member;
}

function modelElementIndex(model: Model): number {
    var count = 0;
    for (var qualifiedName in model.members) {
        var member = model.members[qualifiedName];
        if (!isKind(member.kind, kinds.Attribute, kinds.Operation)) {
            count++;
        }
    }
    return count;
}

function directStateChildren(model: Model, owner: State): State[] {
    var children: State[] = [];
    for (var qualifiedName in model.members) {
        var member = model.members[qualifiedName];
        if (
            member !== owner &&
            isStateElement(member) &&
            dirname(member.qualifiedName) === owner.qualifiedName
        ) {
            children.push(member);
        }
    }
    return children;
}

function containingSubmachine(model: Model, qualifiedName: string | undefined): string | undefined {
    if (!qualifiedName) {
        return undefined;
    }
    var current = dirname(qualifiedName);
    while (current && current !== "/" && current !== model.qualifiedName) {
        var member = model.members[current];
        if (member && isStateElement(member) && isKind(member.kind, kinds.SubmachineState)) {
            return current;
        }
        current = dirname(current);
    }
    return undefined;
}

function validateModelTopology(model: Model): void {
    for (var qualifiedName in model.members) {
        var member = model.members[qualifiedName];
        if (isStateElement(member)) {
            validateStateTopology(model, member);
        }
        if (isVertex(member) && isKind(member.kind, kinds.Pseudostate)) {
            validatePseudostateTopology(model, member);
        }
        if (isTransitionElement(member)) {
            validateTransitionTopology(model, member);
        }
        if (isBehaviorElement(member)) {
            validateBehaviorTopology(model, member);
        }
    }
    for (var attributeName in model.attributes) {
        var attribute = model.attributes[attributeName];
        var changeEvent = model.events[attributeName];
        if (
            !attribute.hasType &&
            !attribute.hasDefault &&
            !(changeEvent && isKind(changeEvent.kind, kinds.ChangeEvent))
        ) {
            throw new Error("invalid attribute " + attribute.qualifiedName);
        }
    }
}

function validateStateTopology(model: Model, state: State): void {
    var children = directStateChildren(model, state);
    var hasHistoryDefault = false;
    for (var qualifiedName in model.members) {
        var member = model.members[qualifiedName];
        if (
            isVertex(member) &&
            isKind(member.kind, kinds.ShallowHistory, kinds.DeepHistory) &&
            dirname(member.qualifiedName) === state.qualifiedName &&
            member.transitions.length > 0
        ) {
            hasHistoryDefault = true;
            break;
        }
    }
    if (
        isKind(state.kind, kinds.FinalState) &&
        (
            state.entry.length > 0 ||
            state.exit.length > 0 ||
            state.activities.length > 0 ||
            state.deferred.length > 0 ||
            state.transitions.length > 0 ||
            !!state.initial ||
            children.length > 0
        )
    ) {
        throw new Error("final state " + state.qualifiedName + " cannot have behavior, children, initial, defer, or transitions");
    }
    if (
        !isKind(state.kind, kinds.FinalState) &&
        children.length > 1 &&
        !hasHistoryDefault &&
        !state.initial
    ) {
        throw new Error("missing initial for " + state.qualifiedName);
    }
    if (state.initial && !isVertex(model.members[state.initial])) {
        throw new Error('target "' + state.initial + '" not found');
    }
    for (var entryIndex = 0; entryIndex < state.entry.length; entryIndex++) {
        var entryBehavior = getBehavior(model, state.entry[entryIndex]);
        if (!entryBehavior) {
            throw new Error("missing behavior " + state.entry[entryIndex]);
        }
        if (isAsyncFunction(entryBehavior.operation)) {
            throw new Error("entry must be a synchronous function");
        }
    }
    for (var exitIndex = 0; exitIndex < state.exit.length; exitIndex++) {
        var exitBehavior = getBehavior(model, state.exit[exitIndex]);
        if (!exitBehavior) {
            throw new Error("missing behavior " + state.exit[exitIndex]);
        }
        if (isAsyncFunction(exitBehavior.operation)) {
            throw new Error("exit must be a synchronous function");
        }
    }
    for (var activityIndex = 0; activityIndex < state.activities.length; activityIndex++) {
        if (!getBehavior(model, state.activities[activityIndex])) {
            throw new Error("missing behavior " + state.activities[activityIndex]);
        }
    }
}

function validatePseudostateTopology(model: Model, vertex: Vertex): void {
    if (isKind(vertex.kind, kinds.Choice)) {
        if (vertex.transitions.length === 0) {
            throw new Error("choice_missing_fallback: choice " + vertex.qualifiedName + " requires a fallback transition");
        }
        for (var i = 0; i < vertex.transitions.length - 1; i++) {
            var branch = getTransition(model, vertex.transitions[i]);
            if (branch && !branch.guard) {
                throw new Error("choice_default_not_last: choice " + vertex.qualifiedName + " fallback transition must be last");
            }
        }
        var last = getTransition(model, vertex.transitions[vertex.transitions.length - 1]);
        if (!last || last.guard) {
            throw new Error("choice_missing_fallback: choice " + vertex.qualifiedName + " requires a fallback transition");
        }
    }
    if (isKind(vertex.kind, kinds.ShallowHistory, kinds.DeepHistory)) {
        if (dirname(vertex.qualifiedName) === model.qualifiedName) {
            throw new Error("history must be declared within a nested StateElement");
        }
        if (vertex.transitions.length === 0) {
            throw new Error("history requires a default transition");
        }
    }
    if (isKind(vertex.kind, kinds.EntryPoint)) {
        if (vertex.transitions.length === 0) {
            throw new Error("entry point target " + vertex.qualifiedName + " not found");
        }
        for (var entryIndex = 0; entryIndex < vertex.transitions.length; entryIndex++) {
            var entryTransition = getTransition(model, vertex.transitions[entryIndex]);
            var entryTarget = getVertex(model, entryTransition?.target);
            if (!entryTarget) {
                throw new Error('target "' + entryTransition?.target + '" not found');
            }
            if (isKind(entryTarget.kind, kinds.EntryPoint, kinds.ExitPoint)) {
                throw new Error("entry point target " + vertex.qualifiedName + " is not a state");
            }
        }
    }
}

function validateTransitionTopology(model: Model, transition: Transition): void {
    var source = getVertex(model, transition.source);
    if (!source) {
        throw new Error('source "' + transition.source + '" not found');
    }
    var target = getVertex(model, transition.target);
    if (transition.target && !target) {
        throw new Error('target "' + transition.target + '" not found');
    }
    if (!transition.target && transition.effect.length === 0) {
        throw new Error("target or effect is required for transition " + transition.qualifiedName);
    }
    var sourceBoundary = containingSubmachine(model, transition.source);
    var targetBoundary = containingSubmachine(model, transition.target);
    var ownerBoundary = containingSubmachine(model, transition.qualifiedName);
    var ownerMatchesSourceBoundary = !!(
        ownerBoundary &&
        sourceBoundary &&
        (
            ownerBoundary === sourceBoundary ||
            isAncestor(ownerBoundary, sourceBoundary) ||
            isAncestor(sourceBoundary, ownerBoundary)
        )
    );
    var ownerMatchesTargetBoundary = !!(
        ownerBoundary &&
        targetBoundary &&
        (
            ownerBoundary === targetBoundary ||
            isAncestor(ownerBoundary, targetBoundary) ||
            isAncestor(targetBoundary, ownerBoundary)
        )
    );
    if (
        sourceBoundary &&
        !ownerMatchesSourceBoundary &&
        source &&
        !isKind(source.kind, kinds.ExitPoint)
    ) {
        throw new Error("submachine internal source " + transition.source);
    }
    if (
        target &&
        targetBoundary &&
        targetBoundary !== sourceBoundary &&
        !ownerMatchesTargetBoundary
    ) {
        if (!isKind(target.kind, kinds.EntryPoint)) {
            throw new Error("cannot target internal state " + transition.target);
        }
    }
    if (
        sourceBoundary &&
        transition.target &&
        targetBoundary !== sourceBoundary &&
        source &&
        target &&
        !isKind(target.kind, kinds.EntryPoint) &&
        !isKind(source.kind, kinds.ExitPoint)
    ) {
        throw new Error("submachine boundary target " + transition.target + " leaves " + sourceBoundary);
    }
    if (
        target &&
        isKind(target.kind, kinds.EntryPoint) &&
        sourceBoundary === targetBoundary &&
        source &&
        !isKind(source.kind, kinds.ExitPoint)
    ) {
        throw new Error("entry point target cannot be internal");
    }
    if (transition.guard) {
        var guard = getConstraint(model, transition.guard);
        if (!guard) {
            throw new Error("missing behavior " + transition.guard);
        }
        if (isAsyncFunction(guard.expression)) {
            throw new Error("guard must be a synchronous function");
        }
    }
    for (var i = 0; i < transition.effect.length; i++) {
        var effectBehavior = getBehavior(model, transition.effect[i]);
        if (!effectBehavior) {
            throw new Error("missing behavior " + transition.effect[i]);
        }
        if (isAsyncFunction(effectBehavior.operation)) {
            throw new Error("effect must be a synchronous function");
        }
    }
    for (var eventIndex = 0; eventIndex < transition.events.length; eventIndex++) {
        var event = model.events[transition.events[eventIndex]];
        if (!event) {
            continue;
        }
        var sourceName = event.source || event.name;
        if (isKind(event.kind, kinds.ChangeEvent) && !model.attributes[sourceName]) {
            throw new Error("missing attribute " + sourceName);
        }
    }
}

function validateBehaviorTopology(model: Model, behavior: Behavior): void {
    if (behavior.operationName) {
        var operation = model.operations[behavior.operationName];
        if (!operation) {
            throw new Error('missing operation "' + behavior.operationName + '"');
        }
        if (!isKind(behavior.kind, kinds.Concurrent) && isAsyncFunction(operation.implementation)) {
            throw new Error("behavior must be a synchronous function");
        }
    }
}

export function Config(config?: Config): Config;
export function Config(
    ID?: string,
    Name?: string,
    Data?: unknown,
    Clock?: PartialClockConfig,
    Queue?: QueueShape,
): Config;
export function Config(
    configOrID?: Config | string,
    Name?: string,
    Data?: unknown,
    Clock?: PartialClockConfig,
    Queue?: QueueShape,
): Config {
    var input = isConfigObject(configOrID)
        ? configOrID
        : {
              ID: configOrID,
              Name,
              Data,
              Clock,
              Queue,
          };
    var id = configID(input);
    var name = configName(input);
    var data = configData(input);
    var clockValue = configClock(input);
    var queueValue = configQueue(input);
    return {
        ID: id,
        Name: name,
        Data: data,
        Clock: clockValue,
        Queue: queueValue,
        id,
        name,
        data,
        clock: clockValue,
        queue: queueValue,
    };
}


export function event<Name extends string = string, Schema = unknown>(
    name: Name,
    schema?: Schema,
): Event<Name, Schema> {
    return {
        kind: kinds.Event,
        name,
        schema,
    } as unknown as Event<Name, Schema>;
}


function apply(
    model: Model,
    stack: Array<AnyModelElement>,
    partials: ReadonlyArray<(model: Model, stack: Array<AnyModelElement>) => unknown>,
): void {
    for (var i = 0; i < partials.length; i++) {
        var partial = partials[i];
        if (typeof partial === "function") {
            partial(model, stack);
        }
    }
}


function qualifyModelName(model: Model, name: string): string {
    if (isAbsolute(name)) {
        return isAncestor(model.qualifiedName, name) || model.qualifiedName === name
            ? name
            : join(model.qualifiedName, name.slice(1));
    }
    return join(model.qualifiedName, name);
}

function uniqueModelRoots(names: string[]): string[] {
    var result: string[] = [];
    var seen: Record<string, boolean> = {};
    for (var i = 0; i < names.length; i++) {
        var name = names[i];
        if (!name || seen[name]) {
            continue;
        }
        seen[name] = true;
        result.push(name);
    }
    return result;
}

function rebaseOwnedPath(sourceRoot: string, targetRoot: string, name: string | undefined): string | undefined {
    if (!name) {
        return name;
    }
    if (name === sourceRoot) {
        return targetRoot;
    }
    if (isAncestor(sourceRoot, name)) {
        return join(targetRoot, name.slice(sourceRoot.length + 1));
    }
    return name;
}

function rebaseModelPath(sourceRoot: string, modelRoot: string, name: string | undefined): string | undefined {
    if (!name) {
        return name;
    }
    if (name === sourceRoot) {
        return modelRoot;
    }
    if (isAncestor(sourceRoot, name)) {
        return join(modelRoot, name.slice(sourceRoot.length + 1));
    }
    return name;
}

function rebasePathList(sourceRoot: string, targetRoot: string, names: string[]): string[] {
    var result: string[] = [];
    for (var i = 0; i < names.length; i++) {
        var rebased = rebaseOwnedPath(sourceRoot, targetRoot, names[i]);
        if (rebased) {
            result.push(rebased);
        }
    }
    return result;
}

function rebaseEventName(model: Model, machine: Model, eventName: string): string {
    var event = machine.events[eventName];
    if (event && (isKind(event.kind, kinds.ChangeEvent) || isKind(event.kind, kinds.CallEvent))) {
        return rebaseModelPath(machine.qualifiedName, model.qualifiedName, eventName) || eventName;
    }
    return rebaseOwnedPath(machine.qualifiedName, "", eventName) === eventName
        ? eventName
        : rebaseOwnedPath(machine.qualifiedName, "", eventName)!.replace(/^\//, "");
}

function rebaseSubmachineEventName(model: Model, machine: Model, stateRoot: string, eventName: string): string {
    var event = machine.events[eventName];
    if (event && (isKind(event.kind, kinds.ChangeEvent) || isKind(event.kind, kinds.CallEvent))) {
        return rebaseModelPath(machine.qualifiedName, model.qualifiedName, eventName) || eventName;
    }
    return rebaseOwnedPath(machine.qualifiedName, stateRoot, eventName) || eventName;
}

function rebaseTransitionPaths(
    sourceRoot: string,
    targetRoot: string,
    paths: Record<Path, TransitionPath>,
): Record<Path, TransitionPath> {
    var rebased: Record<Path, TransitionPath> = {};
    for (var current in paths) {
        var rebasedCurrent = rebaseOwnedPath(sourceRoot, targetRoot, current);
        if (!rebasedCurrent) {
            continue;
        }
        rebased[rebasedCurrent] = {
            enter: rebasePathList(sourceRoot, targetRoot, paths[current].enter),
            exit: rebasePathList(sourceRoot, targetRoot, paths[current].exit),
        };
    }
    return rebased;
}

function copySubmachine(model: Model, state: State, machine: Model): void {
    var sourceRoot = machine.qualifiedName;
    var targetRoot = state.qualifiedName;
    state.initial = rebaseOwnedPath(sourceRoot, targetRoot, machine.initial) || "";
    state.transitions.push(...rebasePathList(sourceRoot, targetRoot, machine.transitions));
    state.deferred.push(...machine.deferred.map(function (eventName) {
        return rebaseSubmachineEventName(model, machine, targetRoot, eventName);
    }));

    for (var attributeName in machine.attributes) {
        var attribute = machine.attributes[attributeName];
        var qualifiedName = rebaseModelPath(sourceRoot, model.qualifiedName, attribute.qualifiedName);
        if (!qualifiedName) {
            continue;
        }
        model.attributes[qualifiedName] = {
            ...attribute,
            kind: kinds.Attribute,
            qualifiedName,
        };
        var existingAttributeMember = model.members[qualifiedName];
        if (existingAttributeMember && !isKind(existingAttributeMember.kind, kinds.Attribute)) {
            throw new Error("attribute '" + qualifiedName + "' conflicts with existing model member");
        }
        model.members[qualifiedName] = model.attributes[qualifiedName];
    }

    for (var operationName in machine.operations) {
        var operation = machine.operations[operationName];
        var qualifiedName = rebaseModelPath(sourceRoot, model.qualifiedName, operation.qualifiedName);
        if (!qualifiedName) {
            continue;
        }
        model.operations[qualifiedName] = {
            ...operation,
            kind: kinds.Operation,
            qualifiedName,
        };
        var existingOperationMember = model.members[qualifiedName];
        if (existingOperationMember && !isKind(existingOperationMember.kind, kinds.Operation)) {
            throw new Error("operation '" + qualifiedName + "' conflicts with existing model member");
        }
        model.members[qualifiedName] = model.operations[qualifiedName];
    }

    for (var eventName in machine.events) {
        var event = machine.events[eventName];
        var rebasedEventName = rebaseSubmachineEventName(model, machine, targetRoot, eventName);
        model.events[rebasedEventName] = {
            ...event,
            name: rebasedEventName,
            qualifiedName: rebaseSubmachineEventName(model, machine, targetRoot, event.qualifiedName || eventName),
            source: event.source ? rebaseSubmachineEventName(model, machine, targetRoot, event.source) : event.source,
            target: event.target ? rebaseSubmachineEventName(model, machine, targetRoot, event.target) : event.target,
        };
    }

    for (var qualifiedName in machine.members) {
        if (qualifiedName === sourceRoot) {
            continue;
        }
        var member = machine.members[qualifiedName];
        var rebasedName = rebaseOwnedPath(sourceRoot, targetRoot, qualifiedName);
        if (!rebasedName) {
            continue;
        }
        if (isTransitionElement(member)) {
            model.members[rebasedName] = {
                ...member,
                qualifiedName: rebasedName,
                source: rebaseOwnedPath(sourceRoot, targetRoot, member.source) || member.source,
                target: rebaseOwnedPath(sourceRoot, targetRoot, member.target) || member.target,
                events: member.events.map(function (eventName) {
                    return rebaseSubmachineEventName(model, machine, targetRoot, eventName);
                }),
                effect: rebasePathList(sourceRoot, targetRoot, member.effect),
                guard: rebaseOwnedPath(sourceRoot, targetRoot, member.guard) || member.guard,
                paths: rebaseTransitionPaths(sourceRoot, targetRoot, member.paths),
            };
        } else if (isStateElement(member)) {
            model.members[rebasedName] = {
                ...member,
                qualifiedName: rebasedName,
                transitions: rebasePathList(sourceRoot, targetRoot, member.transitions),
                entry: rebasePathList(sourceRoot, targetRoot, member.entry),
                exit: rebasePathList(sourceRoot, targetRoot, member.exit),
                activities: rebasePathList(sourceRoot, targetRoot, member.activities),
                deferred: member.deferred.map(function (eventName) {
                    return rebaseSubmachineEventName(model, machine, targetRoot, eventName);
                }),
                initial: rebaseOwnedPath(sourceRoot, targetRoot, member.initial) || "",
            };
        } else if (isBehaviorElement(member)) {
            model.members[rebasedName] = {
                ...member,
                qualifiedName: rebasedName,
                operationName: rebaseModelPath(sourceRoot, model.qualifiedName, member.operationName) || member.operationName,
                Owner: member.Owner
                    ? function (name = rebasedName) {
                        return dirname(name);
                    }
                    : member.Owner,
            };
        } else if (isConstraintElement(member)) {
            model.members[rebasedName] = {
                ...member,
                qualifiedName: rebasedName,
            };
        } else if (isVertex(member)) {
            model.members[rebasedName] = {
                ...member,
                qualifiedName: rebasedName,
                transitions: rebasePathList(sourceRoot, targetRoot, member.transitions),
            };
        }
    }
}


function registerEvent(model: Model, event: EventRecord): EventRecord {
    if (!model.events) {
        model.events = {};
    }
    var existing = model.events[event.name];
    if (!existing) {
        model.events[event.name] = event;
        return event;
    }
    return existing;
}


function resolveOperation(model: Model, value: string): Expression {
    return function (ctx: Context, instance: Instance, event: EventRecord) {
        var runtime = runtimeFor(instance);
        if (!runtime) {
            return false;
        }
        var name = qualifyModelName(model, value);
        return !!runtime.invoke(name, ctx, [event]);
    };
}

function hasThen(value: unknown): value is Thenable {
    return (
        !!value &&
        typeof (value as Record<string, unknown>).then === 'function'
    );
}

function hasAddEventListener(value: unknown): value is DoneEventTarget {
    return (
        !!value &&
        typeof (value as Record<string, unknown>).addEventListener === 'function'
    );
}

function hasOn(value: unknown): value is OnEventTarget {
    return (
        !!value &&
        typeof (value as Record<string, unknown>).on === 'function'
    );
}

function toSignalLike(value: unknown): SignalLike | undefined {
    if (hasThen(value)) {
        return value as Thenable;
    }
    if (hasAddEventListener(value) || hasOn(value)) {
        return value as DoneEventTarget & OnEventTarget;
    }
    return undefined;
}

function coerceDuration(value: unknown): number {
    var numericValue = Number(value);
    return isNaN(numericValue) ? 0 : numericValue;
}

function coerceTimepoint(value: unknown): number {
    if (value instanceof Date) {
        return value.getTime();
    }
    return coerceDuration(value);
}

function isRuntimeTypeToken(value: unknown): value is Function {
    return typeof value === "function";
}

function matchesRuntimeTypeToken(type: unknown, value: unknown): boolean {
    if (!isRuntimeTypeToken(type)) {
        return true;
    }
    if (type === String) {
        return typeof value === "string";
    }
    if (type === Number) {
        return typeof value === "number";
    }
    if (type === Boolean) {
        return typeof value === "boolean";
    }
    if (type === BigInt) {
        return typeof value === "bigint";
    }
    if (type === Symbol) {
        return typeof value === "symbol";
    }
    if (type === Array) {
        return Array.isArray(value);
    }
    if (value === null || (typeof value !== "object" && typeof value !== "function")) {
        return false;
    }
    var prototype = (type as { prototype?: unknown }).prototype;
    return prototype === undefined
        ? value instanceof type
        : Object.getPrototypeOf(value) === prototype;
}

function inferRuntimeTypeToken(value: unknown): Function | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (Array.isArray(value)) {
        return Array;
    }
    switch (typeof value) {
        case "string":
            return String;
        case "number":
            return Number;
        case "boolean":
            return Boolean;
        case "bigint":
            return BigInt;
        case "symbol":
            return Symbol;
        case "object":
            return (value as object).constructor;
        default:
            return undefined;
    }
}

function freezeSnapshotObject<T extends object>(value: T): Readonly<T> {
    try {
        return Object.freeze(value);
    } catch (_error) {
        return value;
    }
}

function cloneSnapshotValue(value: unknown, seen?: Map<object, unknown>): unknown {
    if (value === null || (typeof value !== "object" && typeof value !== "function")) {
        return value;
    }
    if (typeof value === "function") {
        return value;
    }
    var objectValue = value as object;
    var visited = seen || new Map<object, unknown>();
    if (visited.has(objectValue)) {
        return visited.get(objectValue);
    }
    if (value instanceof Date) {
        var dateCopy = new Date(value.getTime());
        visited.set(objectValue, dateCopy);
        return freezeSnapshotObject(dateCopy);
    }
    if (value instanceof RegExp) {
        var regexpCopy = new RegExp(value.source, value.flags);
        regexpCopy.lastIndex = value.lastIndex;
        visited.set(objectValue, regexpCopy);
        return freezeSnapshotObject(regexpCopy);
    }
    if (ArrayBuffer.isView(value)) {
        var viewCopy = new (value.constructor as { new (source: typeof value): typeof value })(value);
        visited.set(objectValue, viewCopy);
        return viewCopy;
    }
    if (value instanceof ArrayBuffer) {
        var bufferCopy = value.slice(0);
        visited.set(objectValue, bufferCopy);
        return freezeSnapshotObject(bufferCopy);
    }
    if (Array.isArray(value)) {
        var arrayCopy: unknown[] = [];
        visited.set(objectValue, arrayCopy);
        for (var i = 0; i < value.length; i++) {
            arrayCopy[i] = cloneSnapshotValue(value[i], visited);
        }
        return freezeSnapshotObject(arrayCopy);
    }
    if (value instanceof Map) {
        var mapCopy = new Map<unknown, unknown>();
        visited.set(objectValue, mapCopy);
        value.forEach(function (entryValue, entryKey) {
            mapCopy.set(
                cloneSnapshotValue(entryKey, visited),
                cloneSnapshotValue(entryValue, visited),
            );
        });
        return freezeSnapshotObject(mapCopy);
    }
    if (value instanceof globalThis.Set) {
        var setCopy = new globalThis.Set<unknown>();
        visited.set(objectValue, setCopy);
        value.forEach(function (entryValue) {
            setCopy.add(cloneSnapshotValue(entryValue, visited));
        });
        return freezeSnapshotObject(setCopy);
    }
    var prototype = Object.getPrototypeOf(value);
    var copy = Object.create(prototype) as Record<PropertyKey, unknown>;
    visited.set(objectValue, copy);
    var keys = Reflect.ownKeys(value);
    for (var keyIndex = 0; keyIndex < keys.length; keyIndex++) {
        var key = keys[keyIndex];
        if (Object.prototype.propertyIsEnumerable.call(value, key)) {
            copy[key] = cloneSnapshotValue((value as Record<PropertyKey, unknown>)[key], visited);
        }
    }
    return freezeSnapshotObject(copy);
}

function cloneRuntimeValue(value: unknown, seen?: Map<object, unknown>): unknown {
    if (value === null || (typeof value !== "object" && typeof value !== "function")) {
        return value;
    }
    if (typeof value === "function") {
        return value;
    }
    var objectValue = value as object;
    var visited = seen || new Map<object, unknown>();
    if (visited.has(objectValue)) {
        return visited.get(objectValue);
    }
    if (value instanceof Date) {
        var dateCopy = new Date(value.getTime());
        visited.set(objectValue, dateCopy);
        return dateCopy;
    }
    if (value instanceof RegExp) {
        var regexpCopy = new RegExp(value.source, value.flags);
        regexpCopy.lastIndex = value.lastIndex;
        visited.set(objectValue, regexpCopy);
        return regexpCopy;
    }
    if (ArrayBuffer.isView(value)) {
        var viewCopy = new (value.constructor as { new (source: typeof value): typeof value })(value);
        visited.set(objectValue, viewCopy);
        return viewCopy;
    }
    if (value instanceof ArrayBuffer) {
        var bufferCopy = value.slice(0);
        visited.set(objectValue, bufferCopy);
        return bufferCopy;
    }
    if (Array.isArray(value)) {
        var arrayCopy: unknown[] = [];
        visited.set(objectValue, arrayCopy);
        for (var i = 0; i < value.length; i++) {
            arrayCopy[i] = cloneRuntimeValue(value[i], visited);
        }
        return arrayCopy;
    }
    if (value instanceof Map) {
        var mapCopy = new Map<unknown, unknown>();
        visited.set(objectValue, mapCopy);
        value.forEach(function (entryValue, entryKey) {
            mapCopy.set(
                cloneRuntimeValue(entryKey, visited),
                cloneRuntimeValue(entryValue, visited),
            );
        });
        return mapCopy;
    }
    if (value instanceof globalThis.Set) {
        var setCopy = new globalThis.Set<unknown>();
        visited.set(objectValue, setCopy);
        value.forEach(function (entryValue) {
            setCopy.add(cloneRuntimeValue(entryValue, visited));
        });
        return setCopy;
    }
    var prototype = Object.getPrototypeOf(value);
    var copy = Object.create(prototype) as Record<PropertyKey, unknown>;
    visited.set(objectValue, copy);
    var keys = Reflect.ownKeys(value);
    for (var keyIndex = 0; keyIndex < keys.length; keyIndex++) {
        var key = keys[keyIndex];
        if (Object.prototype.propertyIsEnumerable.call(value, key)) {
            copy[key] = cloneRuntimeValue((value as Record<PropertyKey, unknown>)[key], visited);
        }
    }
    return copy;
}

function snapshotAttributes(attributes: Record<string, unknown>): Snapshot["attributes"] {
    var copy: Record<string, unknown> = {};
    for (var key in attributes) {
        copy[key] = cloneSnapshotValue(attributes[key]);
    }
    return freezeSnapshotObject(copy);
}

function freezeSnapshotEvents(events: SnapshotEvent[]): Snapshot["events"] {
    for (var i = 0; i < events.length; i++) {
        freezeSnapshotObject(events[i]);
    }
    return freezeSnapshotObject(events);
}

function freezeSnapshotTransitions(transitions: TransitionSnapshot[]): Snapshot["transitions"] {
    for (var i = 0; i < transitions.length; i++) {
        freezeSnapshotObject(transitions[i].events as string[]);
        freezeSnapshotObject(transitions[i]);
    }
    return freezeSnapshotObject(transitions);
}

function makeSnapshot(
    id: string,
    qualifiedName: string,
    state: string,
    attributes: Snapshot["attributes"],
    queueLen: number,
    transitions: Snapshot["transitions"],
    events?: Snapshot["events"],
    extra?: Record<string, unknown>,
): Snapshot {
    var snapshotEvents = events || freezeSnapshotEvents([]);
    return freezeSnapshotObject({
        id,
        ID: id,
        qualifiedName,
        QualifiedName: qualifiedName,
        state,
        State: state,
        attributes,
        Attributes: attributes,
        queueLen,
        QueueLen: queueLen,
        transitions,
        Transitions: transitions,
        events: snapshotEvents,
        Events: snapshotEvents,
        ...(extra || {}),
    });
}

function makeTransitionSnapshot(transition: Transition, model: Model): TransitionSnapshot {
    var events = freezeSnapshotObject(transition.events.slice());
    var kind = transition.kind;
    if (isKind(kind, kinds.External)) {
        kind = 67343;
    } else if (isKind(kind, kinds.Self)) {
        kind = 67344;
    } else if (isKind(kind, kinds.Internal)) {
        kind = 67345;
    } else if (isKind(kind, kinds.Local)) {
        kind = 67346;
    }
    var guarded = !!transition.guard;
    for (var i = 0; i < transition.events.length; i++) {
        var event = model.events[transition.events[i]];
        if (event && isKind(event.kind, kinds.TimeEvent)) {
            guarded = true;
            break;
        }
    }
    return {
        name: transition.qualifiedName,
        Name: transition.qualifiedName,
        kind: kind,
        Kind: kind,
        source: transition.source,
        Source: transition.source,
        target: transition.target,
        Target: transition.target,
        events,
        Events: events,
        guard: guarded,
        Guard: guarded,
    };
}

function makeEventSnapshot(
    transition: Transition,
    eventName: string,
    schema: unknown,
): SnapshotEvent {
    return {
        event: eventName,
        Name: eventName,
        Kind: kinds.Event,
        target: transition.target,
        Target: transition.target,
        guard: !!transition.guard,
        Guard: !!transition.guard,
        schema,
        Schema: schema,
    };
}

function cloneEventForDispatch(event: EventRecord): EventRecord {
    var copy = Object.create(Object.getPrototypeOf(event)) as Record<PropertyKey, unknown>;
    var keys = Object.keys(event);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        copy[key] = (event as unknown as Record<PropertyKey, unknown>)[key];
    }
    for (var j = 0; j < EVENT_METADATA_KEYS.length; j++) {
        var metadataKey = EVENT_METADATA_KEYS[j];
        var value = event[metadataKey];
        if (value !== undefined || metadataKey in event) {
            copy[metadataKey] = value;
        }
    }
    if ("data" in event) {
        copy.data = event.data;
    }
    var name = copy.name === undefined ? copy.Name : copy.name;
    if (name !== undefined) {
        copy.name = name;
        copy.Name = copy.Name === undefined ? name : copy.Name;
    }
    var kind = copy.kind === undefined ? copy.Kind : copy.kind;
    copy.kind = kind === undefined ? kinds.Event : kind;
    copy.Kind = copy.Kind === undefined ? copy.kind : copy.Kind;
    var source = copy.source === undefined ? copy.Source : copy.source;
    if (source !== undefined) {
        copy.source = source;
        copy.Source = copy.Source === undefined ? source : copy.Source;
    }
    var target = copy.target === undefined ? copy.Target : copy.target;
    if (target !== undefined) {
        copy.target = target;
        copy.Target = copy.Target === undefined ? target : copy.Target;
    }
    var id = copy.id === undefined ? copy.ID : copy.id;
    if (id !== undefined) {
        copy.id = id;
        copy.ID = copy.ID === undefined ? id : copy.ID;
    }
    var qualifiedName = copy.qualifiedName === undefined ? copy.QualifiedName : copy.qualifiedName;
    if (qualifiedName !== undefined) {
        copy.qualifiedName = qualifiedName;
        copy.QualifiedName = copy.QualifiedName === undefined ? qualifiedName : copy.QualifiedName;
    }
    var schema = copy.schema === undefined ? copy.Schema : copy.schema;
    if (schema !== undefined) {
        copy.schema = schema;
        copy.Schema = copy.Schema === undefined ? schema : copy.Schema;
    }
    return copy as EventRecord;
}

function withThenable<T>(value: T, callback: (value: any) => unknown): unknown {
    if (hasThen(value)) {
        return Promise.resolve(value).then(callback);
    }
    return callback(value);
}

function getState(model: Model, path: Path | undefined): State | undefined {
    if (!path) {
        return undefined;
    }
    var member = model.members[path];
    return isStateElement(member) ? member : undefined;
}

function getVertex(model: Model, path: Path | undefined): Vertex | undefined {
    if (!path) {
        return undefined;
    }
    var member = model.members[path];
    return isVertex(member) ? member : undefined;
}

function getTransition(model: Model, path: Path | undefined): Transition | undefined {
    if (!path) {
        return undefined;
    }
    var member = model.members[path];
    return isTransitionElement(member) ? member : undefined;
}

function getBehavior(model: Model, path: Path | undefined): Behavior | undefined {
    if (!path) {
        return undefined;
    }
    var member = model.members[path];
    return isBehaviorElement(member) ? member : undefined;
}

function getConstraint(model: Model, path: Path | undefined): Constraint | undefined {
    if (!path) {
        return undefined;
    }
    var member = model.members[path];
    return isConstraintElement(member) ? member : undefined;
}


// Helper functions

export function isAncestor(ancestor: string, descendant: string): boolean {
    // Simple cases
    if (ancestor === descendant) return false;
    if (ancestor === '/') return isAbsolute(descendant); // root is ancestor of all absolute paths
    return descendant.startsWith(ancestor + "/")
}


export function lca(a: string, b: string): string {
    if (a === b) return dirname(a);
    if (!a) return b;
    if (!b) return a;
    if (dirname(a) === dirname(b)) return dirname(a);
    if (isAncestor(a, b)) return a;
    if (isAncestor(b, a)) return b;
    return lca(dirname(a), dirname(b));
}

type AfterBucket = "entered" | "exited" | "processed" | "dispatched" | "executed";

function isStateElement(element: AnyModelElement): element is State {
    return !!element && isKind(element.kind, kinds.State);
}

function isModelElement(element: AnyModelElement): element is Model {
    return !!element && isKind(element.kind, kinds.Model);
}

function isTransitionElement(element: AnyModelElement): element is Transition {
    return !!element && isKind(element.kind, kinds.Transition);
}

function isConstraintElement(element: AnyModelElement): element is Constraint {
    return !!element && isKind(element.kind, kinds.Constraint);
}

function isBehaviorElement(element: AnyModelElement): element is Behavior {
    return !!element && isKind(element.kind, kinds.Behavior);
}

function isVertex(element: AnyModelElement): element is Vertex {
    return !!element && isKind(element.kind, kinds.Vertex);
}

function isChoiceElement(element: AnyModelElement): element is Vertex {
    return !!element && isKind(element.kind, kinds.Choice);
}

function findState(stack: AnyModelElement[]): State | undefined {
    return find(stack, kinds.State) as State | undefined;
}

function findTransition(stack: AnyModelElement[]): Transition | undefined {
    return find(stack, kinds.Transition) as Transition | undefined;
}

function findModel(stack: AnyModelElement[]): Model | undefined {
    return find(stack, kinds.Model) as Model | undefined;
}

function findVertex(stack: AnyModelElement[]): Vertex | undefined {
    return find(stack, kinds.Vertex) as Vertex | undefined;
}



export class Queue {
    front: EventRecord[] = [];
    back: Array<EventRecord | undefined> = [];
    backHead = 0;
    private fifo?: QueueShape;
    private context: Context;

    constructor(fifo?: QueueShape, context?: Context) {
        this.fifo = validateQueueShape(fifo);
        this.context = context || new Context();
    }

    setContext(context: Context): void {
        this.context = context;
    }

    len(): number | Error {
        if (this.fifo) {
            const lenOrError = "Len" in this.fifo
                ? this.fifo.Len(this.context)
                : this.fifo.len();
            if (isThenable(lenOrError)) {
                return new TypeError("Queue Len/len must be synchronous");
            }
            return typeof lenOrError === "number" ? this.front.length + lenOrError : lenOrError;
        }
        return this.front.length + (this.back.length - this.backHead);
    }

    pop(): EventRecord | undefined | Error {
        var event: EventRecord | undefined | Error;
        if (this.front.length > 0) {
            event = this.front.pop() as Event | undefined; // O(1) for completion events
        } else if (this.fifo) {
            event = "Pop" in this.fifo
                ? this.fifo.Pop(this.context)
                : this.fifo.pop();
            if (isThenable(event)) {
                event = new TypeError("Queue Pop/pop must be synchronous");
            }
        } else if (this.backHead < this.back.length) {
            event = this.back[this.backHead];
            this.back[this.backHead] = undefined; // Help GC
            this.backHead++;

            // Reset the array when we've consumed all events to prevent unbounded growth
            if (this.backHead === this.back.length) {
                this.back = [];
                this.backHead = 0;
            }
        }
        return event;
    }

    push(event: EventRecord): void | Error {
        if (isKind(event.kind, kinds.CompletionEvent)) {
            this.front.push(event);
        } else if (this.fifo) {
            const error = "Push" in this.fifo
                ? this.fifo.Push(this.context, event)
                : this.fifo.push(event);
            return isThenable(error) ? new TypeError("Queue Push/push must be synchronous") : error;
        } else {
            this.back.push(event);
        }
    }
}

function isQueueError(value: unknown): boolean {
    if (value === undefined || value === null) {
        return false;
    }
    if (typeof value !== "object") {
        return true;
    }
    return !("name" in value) || !("kind" in value);
}


function finalizeTransitionKind(model: Model, transition: Transition): void {
    if (transition.kind !== kinds.Transition) {
        return;
    }
    var targetElement = getVertex(model, transition.target);
    if (
        targetElement &&
        isKind(targetElement.kind, kinds.EntryPoint) &&
        transition.source === dirname(targetElement.qualifiedName)
    ) {
        transition.kind = kinds.External;
    } else if (transition.target === transition.source) {
        transition.kind = kinds.Self;
    } else if (!transition.target) {
        transition.kind = kinds.Internal;
    } else if (isAncestor(transition.source, transition.target)) {
        transition.kind = kinds.Local;
    } else {
        transition.kind = kinds.External;
    }
}

function finalizeEnterPath(model: Model, lcaPath: string, target: string | undefined): string[] {
    var enter: string[] = [];
    var entering = target;
    while (
        entering &&
        entering !== lcaPath &&
        entering !== model.qualifiedName &&
        entering !== ""
    ) {
        enter.unshift(entering);
        entering = dirname(entering);
    }
    return enter;
}

function finalizeExitPath(lcaPath: string, current: string): string[] {
    var exit: string[] = [];
    var exiting = current;
    while (exiting && exiting !== lcaPath && exiting !== "." && exiting !== "/") {
        exit.push(exiting);
        exiting = dirname(exiting);
    }
    return exit;
}

function finalizeCurrentVerticesFor(model: Model, source: Vertex): string[] {
    if (isKind(source.kind, kinds.Initial)) {
        return [dirname(source.qualifiedName)];
    }
    if (isKind(source.kind, kinds.Choice, kinds.Junction)) {
        return [source.qualifiedName];
    }
    var current: string[] = [];
    for (var qualifiedName in model.members) {
        var member = model.members[qualifiedName];
        if (
            isVertex(member) &&
            (
                qualifiedName === source.qualifiedName ||
                isAncestor(source.qualifiedName, qualifiedName)
            )
        ) {
            current.push(qualifiedName);
        }
    }
    return current;
}

function finalizeTransitionPathForCurrent(
    model: Model,
    current: string,
    transition: Transition,
): TransitionPath {
    if (!transition.target) {
        return EMPTY_PATH;
    }
    var source = getVertex(model, transition.source);
    if (source && isKind(source.kind, kinds.ExitPoint) && transition.target === dirname(source.qualifiedName)) {
        return EMPTY_PATH;
    }
    if (source && isKind(source.kind, kinds.EntryPoint)) {
        var sourceBoundary = dirname(source.qualifiedName);
        var sourceBoundaryElement = model.members[sourceBoundary];
        if (!(sourceBoundaryElement && isStateElement(sourceBoundaryElement) && isKind(sourceBoundaryElement.kind, kinds.SubmachineState))) {
            sourceBoundary = dirname(sourceBoundary);
        }
        return {
            enter: finalizeEnterPath(model, dirname(sourceBoundary), transition.target),
            exit: [],
        };
    }
    var target = getVertex(model, transition.target);
    if (target && isKind(target.kind, kinds.EntryPoint)) {
        var targetBoundary = dirname(target.qualifiedName);
        var targetBoundaryElement = model.members[targetBoundary];
        if (!(targetBoundaryElement && isStateElement(targetBoundaryElement) && isKind(targetBoundaryElement.kind, kinds.SubmachineState))) {
            targetBoundary = dirname(targetBoundary);
        }
        var entryLca = isKind(transition.kind, kinds.Self)
            ? dirname(transition.source)
            : lca(current, targetBoundary);
        if (isKind(transition.kind, kinds.Self) && source && isKind(source.kind, kinds.ExitPoint)) {
            entryLca = dirname(targetBoundary);
        }
        if (isKind(transition.kind, kinds.External) && transition.source === targetBoundary) {
            entryLca = dirname(targetBoundary);
        }
        return {
            enter: [transition.target],
            exit: finalizeExitPath(entryLca, current),
        };
    }
    var lcaPath = isKind(transition.kind, kinds.Self)
        ? dirname(transition.source)
        : lca(current, transition.target);
    if (
        isKind(transition.kind, kinds.Local) &&
        target &&
        isStateElement(target) &&
        isKind(target.kind, kinds.SubmachineState) &&
        isAncestor(target.qualifiedName, current)
    ) {
        lcaPath = dirname(target.qualifiedName);
    }
    return {
        enter: finalizeEnterPath(model, lcaPath, transition.target),
        exit: finalizeExitPath(lcaPath, current),
    };
}

function buildTransitionPaths(model: Model): void {
    for (var qualifiedName in model.members) {
        var transition = model.members[qualifiedName];
        if (!isTransitionElement(transition)) {
            continue;
        }
        transition.paths = {};
        finalizeTransitionKind(model, transition);
        var source = getVertex(model, transition.source);
        if (!source) {
            continue;
        }
        var currentVertices = finalizeCurrentVerticesFor(model, source);
        for (var i = 0; i < currentVertices.length; i++) {
            var current = currentVertices[i];
            transition.paths[current] = finalizeTransitionPathForCurrent(model, current, transition);
        }
    }
}

function finalizeTransitionKinds(model: Model): void {
    for (var qualifiedName in model.members) {
        var transition = model.members[qualifiedName];
        if (isTransitionElement(transition)) {
            finalizeTransitionKind(model, transition);
        }
    }
}

function buildTransitionTable(model: Model): void {

    // For each state in the model
    for (var stateName in model.members) {
        var state = model.members[stateName];
        if (!isStateElement(state) && !isModelElement(state)) continue;

        // Initialize tables for this state
        model.transitionMap[stateName] =
 ({});

        // Collect all transitions accessible from this state by walking up hierarchy
        var transitionsByEvent: TransitionTable = {};
        var currentPath =
(stateName);
        var depth = 0;
        var shadowedEvents: Record<string, boolean> = {};

        while (currentPath) {
            var currentState = model.members[currentPath];
            if (currentState && (isStateElement(currentState) || isModelElement(currentState))) {
                var stateOrModel = currentState;
                // Process transitions at this level
                for (var i = 0; i < stateOrModel.transitions.length; i++) {
                    var transitionName = stateOrModel.transitions[i];
                    var transition =
 (model.members[transitionName]);

                    if (isTransitionElement(transition) && transition.events) {
	                        // Process each event this transition handles
	                        for (var j = 0; j < transition.events.length; j++) {
	                            var transitionEventName = (transition.events[j]);

		                            if (
		                                dirname(transition.qualifiedName) !== currentPath &&
		                                stateOrModel.deferred.indexOf(transitionEventName) !== -1 &&
		                                !transitionHandlesAtOrBelow(transition, currentPath, model.qualifiedName)
		                            ) {
		                                continue;
		                            }
	                            if (!transitionsByEvent[transitionEventName]) {
	                                if (shadowedEvents[transitionEventName]) {
	                                    continue;
                                }
                                if (!transition.paths[stateName]) {
                                    continue;
                                }
                                transitionsByEvent[transitionEventName] = [];
                            }
                            if (shadowedEvents[transitionEventName]) {
                                continue;
                            }
                            if (!transition.paths[stateName]) {
                                continue;
                            }
                            transitionsByEvent[transitionEventName].push({
                                transition,
                                priority: depth,
                            });
	                    }
	                }
                }
                for (var deferredIndex = 0; deferredIndex < stateOrModel.deferred.length; deferredIndex++) {
                    shadowedEvents[stateOrModel.deferred[deferredIndex]] = true;
                }
            }

            // Move up to parent
            if (currentPath === '/' || !currentPath) break;
            var parentPath = dirname(currentPath);
            if (parentPath === currentPath) break; // Avoid infinite loop
            currentPath = parentPath;
            depth++;
        }

        // Sort transitions by priority (lower depth = higher priority)
        for (var eventName in transitionsByEvent) {
            var transitions = transitionsByEvent[eventName];
            transitions.sort(function (a, b) {
                return a.priority - b.priority;
            });

            // Extract just the transition objects
            model.transitionMap[stateName][eventName] = transitions.map(function (t) {
                return t.transition;
            });
        }
    }

}


function transitionDeclaredAtOrBelow(transition: Transition, owner: string): boolean {
    const transitionOwner = dirname(transition.qualifiedName);
    return transitionOwner === owner || isAncestor(owner, transitionOwner);
}

function transitionHandlesAtOrBelow(transition: Transition, owner: string, modelRoot: string): boolean {
    return (
        (transition.source === owner && dirname(owner) === modelRoot) ||
        isAncestor(owner, transition.source) ||
        transitionDeclaredAtOrBelow(transition, owner)
    );
}


function buildDeferredTable(model: Model): void {
    // For each state in the model
    for (var stateName in model.members) {
        var state =
 (model.members[stateName]);
        if (!isStateElement(state) && !isModelElement(state)) continue;
        model.deferredMap[stateName] =
 ({});
        var currentPath =
 (stateName);
        while (currentPath) {
            var currentState =
 (model.members[currentPath]);
            if (currentState && (isStateElement(currentState) || isModelElement(currentState))) {
                var stateOrModel = currentState;

                // Process deferred events at this level
                if (stateOrModel.deferred) {
                    for (var i = 0; i < stateOrModel.deferred.length; i++) {
                        var deferredEvent = stateOrModel.deferred[i];
	                        var transitions = model.transitionMap[stateName][deferredEvent];
	                        if (transitions && transitions.some(function (transition) { return !transition.guard; })) {
	                            continue;
	                        }
	                        // Only support exact event names for O(1) lookup
	                        // Skip wildcard patterns for performance
	                        if (deferredEvent.indexOf('*') === -1) {
	                            model.deferredMap[stateName][deferredEvent] = currentPath;
	                        }
                    }
                }
            }

            // Move up to parent
            if (currentPath === '/' || !currentPath) break;
            var parentPath = dirname(currentPath);
            if (parentPath === currentPath) break; // Avoid infinite loop
            currentPath = parentPath;
        }
    }
}

function buildHistoryTables(model: Model): void {
    var historyByOwner: Record<Path, Vertex[]> = {};
    for (var qualifiedName in model.members) {
        var member = model.members[qualifiedName];
        if (!isVertex(member) || !isKind(member.kind, kinds.ShallowHistory, kinds.DeepHistory)) {
            continue;
        }
        var owner = dirname(member.qualifiedName);
        if (!historyByOwner[owner]) {
            historyByOwner[owner] = [];
        }
        historyByOwner[owner].push(member);
    }

    for (var ownerName in historyByOwner) {
        model.historyPaths[ownerName] = {};
        for (var rememberedName in model.members) {
            var remembered = model.members[rememberedName];
            if (!isStateElement(remembered) || remembered.qualifiedName === ownerName) {
                continue;
            }
            if (!isAncestor(ownerName, remembered.qualifiedName)) {
                continue;
            }
            var enterPath: Path[] = [];
            var current = remembered.qualifiedName;
            while (current && current !== ownerName && current !== ".") {
                enterPath.unshift(current);
                current = dirname(current);
            }
            model.historyPaths[ownerName][remembered.qualifiedName] = enterPath;
        }
    }

    var skipOwners: string[] = [""];
    for (var skipOwner in historyByOwner) {
        skipOwners.push(skipOwner);
    }
    for (var stateName in model.members) {
        var state = model.members[stateName];
        if (!isStateElement(state)) {
            continue;
        }
        for (var skipIndex = 0; skipIndex < skipOwners.length; skipIndex++) {
            var skipOwner = skipOwners[skipIndex];
            var historyTargets: Record<Path, Path> = {};
            var child = state.qualifiedName;
            var parent = dirname(child);
            while (parent && parent !== "." && parent !== "/") {
                var parentElement = model.members[parent];
                if (parent !== skipOwner && parentElement && isKind(parentElement.kind, kinds.State)) {
                    var histories = historyByOwner[parent];
                    if (histories) {
                        for (var historyIndex = 0; historyIndex < histories.length; historyIndex++) {
                            var history = histories[historyIndex];
                            historyTargets[history.qualifiedName] = isKind(history.kind, kinds.ShallowHistory)
                                ? child
                                : state.qualifiedName;
                        }
                    }
                }
                if (parent === model.qualifiedName) {
                    break;
                }
                child = parent;
                parent = dirname(parent);
            }
            if (Object.keys(historyTargets).length) {
                model.historyTargets[state.qualifiedName + "\n" + skipOwner] = historyTargets;
            }
        }
    }
}


var EMPTY_PATH = {
    enter: [],
    exit: []
};


export class Instance {
    _hsm: HSM | null = null;

    dispatch(event: EventRecord): Completion;
    dispatch(ctx: Context, event: EventRecord): Completion;
    dispatch(ctxOrEvent: Context | EventRecord, maybeEvent?: EventRecord): Completion {
        var runtime = runtimeFor(this);
        if (!runtime) {
            return errorCompletion(new Error("dispatch requires a started HSM"));
        }
        var ctx = ctxOrEvent instanceof Context ? ctxOrEvent : this.context();
        var event = ctxOrEvent instanceof Context ? maybeEvent : ctxOrEvent;
        if (!event) {
            return errorCompletion(new Error("dispatch requires an event"));
        }
        return runtime.dispatch(
            ctx,
            eventForRecipient(event, dispatchSourceFromContext(ctx), runtime.id),
        );
    }

    Dispatch(event: EventRecord): Completion;
    Dispatch(ctx: Context, event: EventRecord): Completion;
    Dispatch(ctxOrEvent: Context | EventRecord, maybeEvent?: EventRecord): Completion {
        return maybeEvent === undefined
            ? this.dispatch(ctxOrEvent as EventRecord)
            : this.dispatch(ctxOrEvent as Context, maybeEvent);
    }

    state(): string {
        var runtime = runtimeFor(this);
        return runtime ? runtime.state() : "";
    }

    State(): string {
        return this.state();
    }

    context(): Context {
        var runtime = runtimeFor(this);
        return runtime ? (runtime.context() as unknown as Context) : new Context();
    }

    clock(): Required<ClockConfig> {
        var runtime = runtimeFor(this);
        return runtime ? runtime.clock : (DefaultClock as Required<ClockConfig>);
    }

    start(ctx?: Context, data?: unknown): Promise<this> {
        var runtime = runtimeFor(this);
        if (!runtime) {
            return Promise.reject(new Error("start requires an initialized instance"));
        }
        return runtime.start(ctx || this.context(), data).then((instance) => {
            return instance as this;
        });
    }

    Start(ctx?: Context, data?: unknown): Promise<this> {
        return this.start(ctx, data);
    }

    get(name: string): AttributeRead {
        var runtime = runtimeFor(this);
        return runtime ? runtime.get(name) : [undefined, false];
    }

    Get(name: string): AttributeRead {
        return this.get(name);
    }

    set(name: string, value: unknown): Completion {
        var runtime = runtimeFor(this);
        if (runtime) {
            return runtime.set(name, value);
        }
        return errorCompletion(new Error("set requires a started HSM"));
    }

    Set(name: string, value: unknown): Completion {
        return this.set(name, value);
    }

    call(name: string, ...args: unknown[]): Promise<unknown> {
        var runtime = runtimeFor(this);
        if (!runtime) {
            return errorCompletion(new Error("operation requires a started HSM"));
        }
        return runtime.call(name, ...args);
    }

    Call(name: string, ...args: unknown[]): Promise<unknown> {
        return this.call(name, ...args);
    }

    restart(data?: unknown): Completion {
        var runtime = runtimeFor(this);
        if (runtime) {
            return runtime.restart(data);
        }
        return errorCompletion(new Error("restart requires a started HSM"));
    }

    Restart(data?: unknown): Completion {
        return this.restart(data);
    }

    stop(): Completion {
        var runtime = runtimeFor(this);
        if (runtime) {
            return runtime.stop();
        }
        return Promise.resolve();
    }

    Stop(): Completion {
        return this.stop();
    }

    takeSnapshot(): Snapshot {
        var runtime = runtimeFor(this);
        return runtime
            ? runtime.takeSnapshot()
            : makeSnapshot("", "", "", freezeSnapshotObject({}), 0, freezeSnapshotTransitions([]), freezeSnapshotEvents([]));
    }

    TakeSnapshot(): Snapshot {
        return this.takeSnapshot();
    }
}

class HSM {
    static id = 0;

    private runtime: InternalRuntime;
    private instance: Instance;
    private ctx: Context;
    private model: Model;
    private currentState: Vertex;
    private queue: Queue;
    private active: Record<string, Active>;
    private processing: boolean;
    private id: string;
    private name: string;
    private attributes: Record<string, unknown>;
    private history: Record<string, string>;
    private after: Record<AfterBucket, Record<string, Array<() => void>>>;
    private clock: {
        setTimeout: TimerFunction;
        clearTimeout: CancelFunction;
        now: () => number;
    };
    private startData: unknown;

    constructor(
        ctxOrInstance: Context | Instance,
        instanceOrModel: Model | Instance,
        maybeModelOrConfig: Model | Config | undefined,
        maybeConfig?: Config,
    ) {
        if (!(ctxOrInstance instanceof Context)) {
            maybeConfig = maybeModelOrConfig as Config | undefined;
            maybeModelOrConfig = instanceOrModel as Model;
            instanceOrModel = ctxOrInstance;
            ctxOrInstance = new Context();
        }

        var existing = runtimeFor(instanceOrModel);
        if (
            existing &&
            existing.state() !== "" &&
            existing.state() !== existing.model.qualifiedName
        ) {
            throw new Error("instance already has a running HSM");
        }

        const runtimeID = configID(maybeConfig);
        const runtimeName = configName(maybeConfig);
        const runtimeClock = configClock(maybeConfig);
        const runtimeQueue = configQueue(maybeConfig);

        const id = (runtimeID || HSM.id++).toString();
        const name =
            runtimeName || (maybeModelOrConfig as Model).qualifiedName;

        this.instance = instanceOrModel as Instance;
        this.ctx = ctxOrInstance as Context;
        this.model = maybeModelOrConfig as Model;
        this.currentState = this.model;
        this.queue = new Queue(runtimeQueue, this.ctx);
        this.active = {};
        this.processing = false;
        this.id = id;
        this.name = name;
        this.attributes = {};
        this.history = {};
        this.after = {
            entered: {},
            exited: {},
            processed: {},
            dispatched: {},
            executed: {},
        };
        this.clock = {
            setTimeout: runtimeClock?.setTimeout || DefaultClock.setTimeout,
            clearTimeout: runtimeClock?.clearTimeout || DefaultClock.clearTimeout,
            now: runtimeClock?.now || DefaultClock.now,
        };
        this.startData = configData(maybeConfig);

        this.runtime = {
            dispatch: (ctx, event) => {
                return this.dispatch(ctx, event);
            },
            start: (ctx, data) => {
                return this.start(ctx, data);
            },
            state: () => {
                return this.state();
            },
            context: () => {
                return this.ctx;
            },
            clock: this.clock,
            get: (name) => {
                return this.get(name);
            },
            set: (name, value) => {
                return this.set(name, value);
            },
            invoke: (name, ctx, args) => {
                return this.invoke(name, ctx, args);
            },
            call: (name, ...args) => {
                return this.call(name, ...args);
            },
            restart: (data) => {
                return this.restart(data);
            },
            takeSnapshot: () => {
                return this.takeSnapshot();
            },
            onAfter: (bucket, key, listener) => {
                return this.onAfter(bucket, key, listener);
            },
            stop: () => {
                return this.stop();
            },
            id: this.id,
            model: this.model,
            name: this.name,
            queue: this.queue,
            processing: this.processing,
        };
        bindRuntime(this.instance, this.runtime);
    }

    start(ctx?: Context, data?: unknown): Promise<Instance> {
        if (this.currentState.qualifiedName !== this.model.qualifiedName || this.processing) {
            return Promise.reject(new Error("already started HSM"));
        }
        var parentContext = parentContextForStart(ctx || this.ctx, this.instance);
        var maybeInstances = parentContext.Value(Keys.Instances);
        var instances = maybeInstances && typeof maybeInstances === "object"
            ? maybeInstances as Record<string, Instance>
            : {};
        instances[this.id] = this.instance;
        var owner = parentContext.Value(Keys.HSM);
        var startedContext = new Context(parentContext, new Map<unknown, unknown>([
            [Keys.Instances, instances],
            [Keys.HSM, this.instance],
            [Keys.Owner, owner],
        ]));
        this.ctx = startedContext;
        if (isDispatchable(owner)) {
            contextOwner.set(this.ctx, owner);
        }
        contextHSM.set(this.ctx, this.instance);
        this.queue.setContext(this.ctx);
        if (data !== undefined) {
            this.startData = data;
        }
        this.processing = true;
        this.resetAttributes();
        this.history = {};

        var initialEvent = Object.create(InitialEvent);
        initialEvent.data = this.startData;
        var newState = this.enter(this.model, initialEvent, true);
        this.currentState = newState;
        this.process();
        return Promise.resolve(this.instance);
    }

    state(): string {
        if (
            this.currentState.qualifiedName === this.model.qualifiedName &&
            !this.processing &&
            (contextHSM.get(this.ctx) !== this.instance || this.ctx.done)
        ) {
            return "";
        }
        return this.currentState.qualifiedName;
    }

    private resetAttributes(): void {
        this.attributes = {};
        if (!this.model.attributes) {
            return;
        }
        for (var qualifiedName in this.model.attributes) {
            var attribute = this.model.attributes[qualifiedName];
            if (attribute && attribute.hasDefault) {
                this.attributes[qualifiedName] = cloneRuntimeValue(attribute.defaultValue);
            }
        }
    }

    private reconcileActiveActivities(stateName: string, event: EventRecord): void {
        var activeStates: Record<string, boolean> = {};
        var states: State[] = [];
        var current = stateName;
        var firedOneShotActivity = this.firedOneShotActivityName(event);
        while (current && current !== "." && current !== "/") {
            var state = getState(this.model, current);
            if (state) {
                activeStates[state.qualifiedName] = true;
                states.unshift(state);
            }
            if (current === this.model.qualifiedName) {
                break;
            }
            current = dirname(current);
        }

        for (var activeName in this.active) {
            var owner = dirname(activeName);
            if (activeStates[owner]) {
                continue;
            }
            var inactiveBehavior = getBehavior(this.model, activeName);
            if (inactiveBehavior) {
                this.terminate(inactiveBehavior);
            } else {
                this.active[activeName].context.cancel();
                delete this.active[activeName];
            }
        }

        for (var stateIndex = 0; stateIndex < states.length; stateIndex++) {
            var activeState = states[stateIndex];
            for (var activityIndex = 0; activityIndex < activeState.activities.length; activityIndex++) {
                var activityName = activeState.activities[activityIndex];
                if (this.active[activityName]) {
                    continue;
                }
                if (activityName === firedOneShotActivity) {
                    continue;
                }
                var activity = getBehavior(this.model, activityName);
                if (activity) {
                    this.execute(activity, event);
                }
            }
        }
    }

    private firedOneShotActivityName(event: EventRecord): string | undefined {
        if (!isKind(event.kind, kinds.TimeEvent)) {
            return undefined;
        }
        var transitionName = dirname(event.name);
        var firedTransition = getTransition(this.model, transitionName);
        var source = getState(this.model, firedTransition ? firedTransition.source : undefined);
        if (!firedTransition || !source) {
            return undefined;
        }
        var suffix = event.name.slice(transitionName.length + 1);
        var timerIndex = 0;
        var firedIndex = -1;
        for (var i = 0; i < source.transitions.length; i++) {
            var candidate = getTransition(this.model, source.transitions[i]);
            if (!candidate) {
                continue;
            }
            var hasMatchingTimerEvent = false;
            for (var eventIndex = 0; eventIndex < candidate.events.length; eventIndex++) {
                var candidateEventName = candidate.events[eventIndex];
                var candidateEvent = this.model.events[candidateEventName];
                if (
                    candidateEvent &&
                    isKind(candidateEvent.kind, kinds.TimeEvent) &&
                    candidateEventName.slice(dirname(candidateEventName).length + 1) === suffix
                ) {
                    hasMatchingTimerEvent = true;
                    break;
                }
            }
            if (!hasMatchingTimerEvent) {
                continue;
            }
            if (candidate.qualifiedName === firedTransition.qualifiedName) {
                firedIndex = timerIndex;
            }
            timerIndex++;
        }
        if (firedIndex === -1) {
            return undefined;
        }
        var activityIndex = 0;
        for (var j = 0; j < source.activities.length; j++) {
            var activityName = source.activities[j];
            var isMatchingTimerActivity = suffix === "timepoint"
                ? activityName.indexOf("/activity_at_") !== -1
                : (
                    activityName.indexOf("/activity_after_") !== -1 ||
                    activityName.indexOf("/activity_every_") !== -1
                );
            if (!isMatchingTimerActivity) {
                continue;
            }
            if (activityIndex === firedIndex) {
                return activityName.indexOf("/activity_every_") === -1
                    ? activityName
                    : undefined;
            }
            activityIndex++;
        }
        return undefined;
    }

    private notify(bucket: AfterBucket, key: string): void {
        var listeners = this.after[bucket][key];
        if (!listeners || listeners.length === 0) {
            return;
        }
        delete this.after[bucket][key];
        for (var i = 0; i < listeners.length; i++) {
            listeners[i]();
        }
    }

    onAfter(bucket: AfterBucket, key: string, listener: () => void): () => void {
        if (!this.after[bucket][key]) {
            this.after[bucket][key] = [];
        }
        var listeners = this.after[bucket][key];
        listeners.push(listener);
        return () => {
            var current = this.after[bucket][key];
            if (!current) {
                return;
            }
            var index = current.indexOf(listener);
            if (index !== -1) {
                current.splice(index, 1);
            }
            if (current.length === 0) {
                delete this.after[bucket][key];
            }
        };
    }

    private get(name: string): AttributeRead {
        var qualifiedName = qualifyModelName(this.model, name);
        if (!this.model.attributes[qualifiedName]) {
            return [undefined, false];
        }
        if (!Object.prototype.hasOwnProperty.call(this.attributes, qualifiedName)) {
            return [undefined, false];
        }
        return [cloneRuntimeValue(this.attributes[qualifiedName]), true];
    }

    private set(name: string, value: unknown): Completion {
        if (this.currentState.qualifiedName === this.model.qualifiedName && !this.processing) {
            return errorCompletion(new Error("set requires a started HSM"));
        }
        var qualifiedName = qualifyModelName(this.model, name);
        var attribute = this.model.attributes
            ? this.model.attributes[qualifiedName]
            : undefined;
        if (!attribute) {
            return errorCompletion(new Error('missing attribute "' + name + '"'));
        }
        if (attribute.hasType && !matchesRuntimeTypeToken(attribute.valueType, value)) {
            return errorCompletion(new Error('attribute "' + name + '" rejected value'));
        }
        var hadValue = Object.prototype.hasOwnProperty.call(this.attributes, qualifiedName);
        var old = this.attributes[qualifiedName];
        var stored = cloneRuntimeValue(value);
        this.attributes[qualifiedName] = stored;
        if (hadValue && Object.is(old, value)) {
            return Promise.resolve();
        }
        var event = {
            kind: kinds.ChangeEvent,
            name: qualifiedName,
            source: qualifiedName,
            data: {
                name: qualifiedName,
                old: cloneRuntimeValue(old),
                new: cloneRuntimeValue(stored),
            },
        };
        return this.dispatch(this.ctx, event);
    }

    private call(name: string, ...args: unknown[]): Promise<unknown> {
        if (this.currentState.qualifiedName === this.model.qualifiedName && !this.processing) {
            return errorCompletion(new Error("operation requires a started HSM"));
        }
        var argsList = args;
        var qualifiedName = qualifyModelName(this.model, name);
        var event = {
            kind: kinds.CallEvent,
            name: qualifiedName,
            source: qualifiedName,
            data: {
                name: qualifiedName,
                args: argsList,
            },
        };
        var result: unknown;
        try {
            result = this.invoke(name, this.ctx, argsList);
        } catch (error) {
            return errorCompletion(error instanceof Error ? error : new Error(String(error)));
        }
        return Promise.resolve(result).then((value) => {
            this.dispatch(this.ctx, event);
            return value;
        });
    }

    private invoke(name: string, ctx: Context, args: Array<unknown>): unknown {
        var qualifiedName = qualifyModelName(this.model, name);
        var operation = this.model.operations && this.model.operations[qualifiedName];
        if (!operation) {
            throw new Error('missing operation "' + qualifiedName + '"');
        }
        var fn = operation.implementation;
        if (!fn) {
            var methodName = operation.name;
            var maybeMethod = (this.instance as unknown as Record<string, unknown>)[methodName];
            if (typeof maybeMethod === "function") {
                fn = maybeMethod as (...args: unknown[]) => unknown;
            }
        }
        if (typeof fn !== "function") {
            throw new Error('invalid operation "' + qualifiedName + '"');
        }
        var candidates = [
            [ctx, this.instance, ...args],
            [ctx, ...args],
            [this.instance, ...args],
            args,
        ];
        for (var i = 0; i < candidates.length; i++) {
            var candidate = candidates[i] as Array<unknown>;
            if (fn.length === candidate.length) {
                return fn.apply(this.instance, candidate);
            }
        }
        return fn.apply(this.instance, [ctx, this.instance, ...args] as Array<unknown>);
    }

    restart(data?: unknown): Completion {
        if (this.currentState.qualifiedName === this.model.qualifiedName && !this.processing) {
            return errorCompletion(new Error("restart requires a started HSM"));
        }
        this.stop();
        if (data !== undefined) {
            this.startData = data;
        }
        this.currentState = this.model;
        return this.start(undefined, this.startData).then(function () {});
    }

    private takeSnapshot(): Snapshot {
        if (this.currentState.qualifiedName === this.model.qualifiedName && !this.processing) {
            throw new Error("take snapshot requires a started HSM");
        }
        var events: SnapshotEvent[] = [];
        var transitions: TransitionSnapshot[] = [];
        var seenTransitions: Record<string, boolean> = {};
        var currentStateName = this.currentState
            ? this.currentState.qualifiedName
            : this.model.qualifiedName;
        var transitionsByEvent: Record<string, Array<Transition>> =
            this.model.transitionMap[currentStateName] || {};
        for (var eventName in transitionsByEvent) {
            var transitionList = transitionsByEvent[eventName];
            for (var i = 0; i < transitionList.length; i++) {
                var schema = this.model.events[eventName]
                    ? this.model.events[eventName].schema
                    : undefined;
                var transition = transitionList[i];
                if (!seenTransitions[transition.qualifiedName]) {
                    seenTransitions[transition.qualifiedName] = true;
                    transitions.push(makeTransitionSnapshot(transition, this.model));
                }
                events.push(makeEventSnapshot(transition, eventName, schema));
            }
        }
        return makeSnapshot(
            this.id,
            this.name,
            currentStateName,
            snapshotAttributes(this.attributes),
            this.len(),
            freezeSnapshotTransitions(transitions),
            freezeSnapshotEvents(events),
        );
    }

    private followHistoryDefault(
        vertex: Vertex,
        event: EventRecord,
    ): Vertex | undefined {
	        for (var i = 0; i < vertex.transitions.length; i++) {
	            var transitionName = vertex.transitions[i];
	            var transitionCandidate = getTransition(this.model, transitionName);
	            if (!transitionCandidate) {
	                continue;
	            }
	            if (transitionCandidate.guard) {
	                var guard = getConstraint(this.model, transitionCandidate.guard);
	                if (guard) {
                        var historyGuardResult = guard.expression(this.ctx, this.instance, event);
                        if (isThenable(historyGuardResult)) {
                            throw new Error("guard must be a synchronous function");
                        }
                        if (!historyGuardResult) {
                            continue;
                        }
                    }
	            }
	            return this.transition(vertex, transitionCandidate, event);
	        }
	        return undefined;
	    }

    dispatch(_ctx: Context, event: EventRecord): Completion {
        if (
            this.currentState.qualifiedName === this.model.qualifiedName &&
            !this.processing
        ) {
            return errorCompletion(new Error("dispatch requires a started HSM"));
        }
        var dispatchEvent = cloneEventForDispatch(event);
        var pushError = this.queue.push(dispatchEvent);
        if (pushError) {
            this.queue.push(Object.create(ErrorEvent, {
                data: { value: pushError },
            }));
        }
        this.notify("dispatched", dispatchEvent.name);

        if (this.processing) {
            return Promise.resolve();
        }
        this.processing = true;
        try {
            this.process(dispatchEvent);
        } catch (error) {
            this.processing = false;
            return errorCompletion(error instanceof Error ? error : new Error(String(error)));
        }
        return Promise.resolve();
    }

    private queueActivityWork(work: () => Completion): Completion {
        var wasProcessing = this.processing;
        this.processing = true;
        var completion: Completion;
        try {
            completion = work();
        } finally {
            this.processing = wasProcessing;
        }
        var syncError = (completion as Completion & { __hsmError?: Error }).__hsmError;
        if (syncError) {
            return completion;
        }
        return Promise.resolve().then(() => {
            if (this.processing) {
                return;
            }
            this.processing = true;
            try {
                this.process();
            } catch (error) {
                this.processing = false;
                throw error instanceof Error ? error : new Error(String(error));
            }
        });
    }

    private process(currentEvent?: EventRecord): void {
        var deferredEvents: EventRecord[] = [];
        var deferredOwners: string[] = [];
        var deferredCount = 0;
        var event = this.pop();

        while (event) {
            var currentStateName = this.currentState.qualifiedName;
            var eventName = event.name;
            var transitioned = false;
            var transitionSource: string | undefined = undefined;
            var deferredLookup = this.model.deferredMap[currentStateName];
            var deferOwner = deferredLookup && deferredLookup[eventName];

            if (currentEvent !== undefined && event !== currentEvent && deferOwner !== undefined) {
                deferredOwners[deferredCount] = deferOwner;
                deferredEvents[deferredCount] = event;
                deferredCount++;
                this.notify("processed", event.name);
                event = this.pop();
                continue;
            }

            try {
                var transitionLookup = this.model.transitionMap[currentStateName] || {};
                var transitions = transitionLookup[eventName];
                if ((!transitions || transitions.length === 0) && eventName !== AnyEvent.name) {
                    transitions = transitionLookup[AnyEvent.name];
                }
                if (transitions && transitions.length > 0) {
                    for (var i = 0; i < transitions.length; i++) {
                        var transition = transitions[i];
                        if (transition.guard) {
                            var guard = getConstraint(this.model, transition.guard);
                            if (guard) {
                                var guardResult = guard.expression(
                                    this.ctx,
                                    this.instance,
                                    event,
                                );
                                if (isThenable(guardResult)) {
                                    throw new Error("guard must be a synchronous function");
                                }
                                if (!guardResult) {
                                    continue;
                                }
                            }
                        }
                        var nextState = this.transition(this.currentState, transition, event);
                        transitioned = true;
                        transitionSource = transition.source;
                        if (nextState.qualifiedName !== currentStateName) {
                            this.currentState = nextState;
                        }
                        break;
                    }
                }
            } catch (error) {
                if (error instanceof Error && error.message.includes("unhandled exit point")) {
                    throw error;
                }
                this.reconcileActiveActivities(currentStateName, event);
                this.push(
                    Object.create(ErrorEvent, {
                        data: { value: error },
                    }),
                );
            }

            if (!transitioned) {
                if (deferOwner !== undefined) {
                    deferredOwners[deferredCount] = deferOwner;
                    deferredEvents[deferredCount] = event;
                    deferredCount++;
                    this.notify("processed", event.name);
                    event = this.pop();
                    continue;
                }
            }

            if (transitioned && deferredCount > 0) {
                var activeState = this.currentState.qualifiedName;
                for (var deferredIndex = 0; deferredIndex < deferredCount; deferredIndex++) {
                    var discard = false;
                    var deferOwnerPath = deferredOwners[deferredIndex];
                    var current = dirname(deferOwnerPath);
                    while (current && current !== "." && current !== "/") {
                        var currentState = this.model.members[current];
                        if (currentState && isStateElement(currentState) && isKind(currentState.kind, kinds.SubmachineState)) {
                            discard =
                                activeState !== current &&
                                !isAncestor(current, activeState) &&
                                !(transitionSource && isAncestor(current, transitionSource));
                            break;
                        }
                        if (current === this.model.qualifiedName) {
                            break;
                        }
                        current = dirname(current);
                    }
                    if (!discard) {
                        this.push(deferredEvents[deferredIndex]);
                    }
                }
                deferredCount = 0;
            }

            this.notify("processed", event.name);
            event = this.pop();
        }

        for (var i = 0; i < deferredCount; i++) {
            this.push(deferredEvents[i]);
        }

        this.processing = false;
        this.notify("processed", "__next__");
    }

    private push(event: EventRecord): void {
        const error = this.queue.push(event);
        if (error && !isKind(event.kind, kinds.ErrorEvent)) {
            this.queue.push(Object.create(ErrorEvent, { data: { value: error } }));
        }
    }

    private pop(): EventRecord | undefined {
        while (true) {
            const eventOrError = this.queue.pop();
            if (!isQueueError(eventOrError)) {
                return eventOrError as EventRecord | undefined;
            }
            this.queue.push(Object.create(ErrorEvent, { data: { value: eventOrError } }));
        }
    }

    private len(): number {
        const lenOrError = this.queue.len();
        if (typeof lenOrError === "number") {
            return lenOrError;
        }
        if (lenOrError) {
            this.queue.push(Object.create(ErrorEvent, { data: { value: lenOrError } }));
        }
        return 0;
    }

    private transition(
        current: Vertex,
        transition: Transition,
        event: EventRecord,
    ): Vertex {
        var path = transition.paths[current.qualifiedName];
        if (!path) {
            path = EMPTY_PATH;
        }
        var target = getVertex(this.model, transition.target);
        var skipHistoryOwner =
            target && isKind(target.kind, kinds.ShallowHistory, kinds.DeepHistory)
                ? dirname(target.qualifiedName)
                : undefined;
        if (path.exit.length > 0) {
            var historyTargets = this.model.historyTargets[path.exit[0] + "\n" + (skipHistoryOwner || "")];
            if (historyTargets) {
                for (var historyName in historyTargets) {
                    this.history[historyName] = historyTargets[historyName];
                }
            }
        }
        for (var i = 0; i < path.exit.length; i++) {
            var exitingName = path.exit[i];
            var exiting = this.model.members[exitingName];
            if (exiting && isStateElement(exiting)) {
                this.exit(exiting, event);
                this.notify("exited", exitingName);
            }
        }

        for (var i = 0; i < transition.effect.length; i++) {
            var effectName = transition.effect[i];
            var behavior = getBehavior(this.model, effectName);
            if (behavior) {
                this.execute(behavior, event);
            }
        }

        var enteredState: Vertex | undefined;
        for (var i = 0; i < path.enter.length; i++) {
            var enteringName = path.enter[i];
            var entering = getVertex(this.model, enteringName);
            if (entering) {
                var defaultEntry =
                    entering.qualifiedName === transition.target;
                enteredState = this.enter(entering, event, defaultEntry);
            }
        }

        var finalState: Vertex | undefined = enteredState || getVertex(this.model, transition.target);
        return finalState || current;
    }

    private enter(
        vertex: Vertex,
        event: EventRecord,
        defaultEntry: boolean,
    ): Vertex {
        if (isStateElement(vertex)) {
            var state: State = vertex;

            for (var i = 0; i < state.entry.length; i++) {
                var entryName = state.entry[i];
                var behavior = getBehavior(this.model, entryName);
                if (behavior) {
                    this.execute(behavior, event);
                }
            }
            this.notify("entered", state.qualifiedName);

            for (var i = 0; i < state.activities.length; i++) {
                var activityName = state.activities[i];
                var behavior = getBehavior(this.model, activityName);
                if (behavior) {
                    this.execute(behavior, event);
                }
            }

            if (isKind(state.kind, kinds.FinalState)) {
                this.push({
                    name: FinalEvent.name,
                    kind: FinalEvent.kind,
                    source: state.qualifiedName,
                });
                return state;
            }

            if (defaultEntry && state.initial) {
                var initial = getVertex(this.model, state.initial);
                if (!initial) {
                    return state;
                }
                var initialTransition = getTransition(
                    this.model,
                    initial.transitions[0],
                );
                if (initialTransition) {
                    return this.transition(state, initialTransition, event);
                }
            }
            return state;
        }

        if (
            isKind(vertex.kind, kinds.EntryPoint)
        ) {
            var entryVertex = vertex;
            if (!entryVertex.transitions.length) {
                return entryVertex;
            }
            var entryTransition = getTransition(this.model, entryVertex.transitions[0]);
            if (!entryTransition) {
                return entryVertex;
            }
            return this.transition(entryVertex, entryTransition, event);
        }

        if (
            isKind(vertex.kind, kinds.ExitPoint)
        ) {
            var exitVertex = vertex;
            for (var exitIndex = 0; exitIndex < exitVertex.transitions.length; exitIndex++) {
                var exitTransition = getTransition(this.model, exitVertex.transitions[exitIndex]);
                if (!exitTransition || exitTransition.target !== dirname(exitVertex.qualifiedName)) {
                    continue;
                }
                if (exitTransition.guard) {
                    var returnGuard = getConstraint(this.model, exitTransition.guard);
                    if (returnGuard) {
                        var returnGuardResult = returnGuard.expression(this.ctx, this.instance, event);
                        if (isThenable(returnGuardResult)) {
                            throw new Error("guard must be a synchronous function");
                        }
                        if (!returnGuardResult) {
                            continue;
                        }
                    }
                }
                this.transition(exitVertex, exitTransition, event);
            }
            for (var handlerIndex = 0; handlerIndex < exitVertex.transitions.length; handlerIndex++) {
                var handlerTransition = getTransition(this.model, exitVertex.transitions[handlerIndex]);
                if (!handlerTransition || handlerTransition.target === dirname(exitVertex.qualifiedName)) {
                    continue;
                }
                if (handlerTransition.guard) {
                    var handlerGuard = getConstraint(this.model, handlerTransition.guard);
                    if (handlerGuard) {
                        var handlerGuardResult = handlerGuard.expression(this.ctx, this.instance, event);
                        if (isThenable(handlerGuardResult)) {
                            throw new Error("guard must be a synchronous function");
                        }
                        if (!handlerGuardResult) {
                            continue;
                        }
                    }
                }
                return this.transition(exitVertex, handlerTransition, event);
            }
            throw new Error('unhandled exit point "' + exitVertex.qualifiedName + '"');
        }

        if (
            isKind(vertex.kind, kinds.Choice) ||
            isKind(vertex.kind, kinds.Junction)
        ) {
            var choiceVertex = vertex;
            var chosenTransition: Transition | undefined = undefined;
            for (var i = 0; i < choiceVertex.transitions.length; i++) {
                var transitionName = choiceVertex.transitions[i];
                var choiceTransition = getTransition(this.model, transitionName);
                if (!choiceTransition) {
                    continue;
                }

                if (choiceTransition.guard) {
                    var guard = getConstraint(this.model, choiceTransition.guard);
                    if (guard) {
                        var choiceGuardResult = guard.expression(this.ctx, this.instance, event);
                        if (isThenable(choiceGuardResult)) {
                            throw new Error("guard must be a synchronous function");
                        }
                        if (choiceGuardResult) {
                            chosenTransition = choiceTransition;
                            break;
                        }
                    }
                } else {
                    chosenTransition = choiceTransition;
                    break;
                }
            }

            if (chosenTransition) {
                return this.transition(choiceVertex, chosenTransition, event);
            }
            throw new Error("No transition found for choice vertex " + choiceVertex.qualifiedName);
        }

        if (
            isKind(vertex.kind, kinds.ShallowHistory) ||
            isKind(vertex.kind, kinds.DeepHistory)
        ) {
            var parent = dirname(vertex.qualifiedName);
            var resolved = this.history[vertex.qualifiedName];
            if (!resolved) {
                var historyResult = this.followHistoryDefault(vertex, event);
                if (historyResult) {
                    return historyResult;
                }
                var parentState = getState(this.model, parent);
                if (parentState && parentState.initial) {
                var initialVertex = getVertex(this.model, parentState.initial);
                if (initialVertex && initialVertex.transitions.length > 0) {
                    var initialTransition = getTransition(
                        this.model,
                        initialVertex.transitions[0],
                    );
                    if (initialTransition) {
                        return this.transition(
                            parentState,
                            initialTransition,
                            event,
                        );
                    }
                }
                }
                return vertex;
            }

            var enterPath = this.model.historyPaths[parent]?.[resolved] || [];
            var currentVertex = vertex;
            var isShallowHistory = isKind(vertex.kind, kinds.ShallowHistory);
            for (var i = 0; i < enterPath.length; i++) {
                var entering = getVertex(this.model, enterPath[i]);
                if (!entering) {
                    break;
                }
                currentVertex = this.enter(
                    entering,
                    event,
                    isShallowHistory && entering.qualifiedName === resolved,
                );
            }
            return currentVertex;
        }

        return vertex;
    }

    private exit(state: State, event: EventRecord): void {
        for (var i = 0; i < state.activities.length; i++) {
            var activityName = state.activities[i];
            var activity = getBehavior(this.model, activityName);
            if (activity) {
                this.terminate(activity);
            }
        }

        for (var i = 0; i < state.exit.length; i++) {
            var exitName = state.exit[i];
            var behavior = getBehavior(this.model, exitName);
            if (behavior) {
                this.execute(behavior, event);
            }
        }
    }

    private execute(behavior: Behavior, event: EventRecord): void {
        var error = undefined;
        var operation = behavior.operation;
        var self = this;
        if (!operation && behavior.operationName) {
            operation = function (
                ctx: Context,
                instance: Instance,
                evt: EventRecord,
            ) {
                return self.invoke(behavior.operationName, ctx, [evt]);
            };
        }
        if (!operation) {
            return;
        }
        if (isKind(behavior.kind, kinds.Concurrent)) {
            var controller = new Context(this.ctx);
            var runtime = this;
            var activityInstance = new Proxy(this.instance, {
                get(target, property) {
                    if (property === "set" || property === "Set") {
                        return function (name: string, value: unknown): Completion {
                            return runtime.queueActivityWork(function () {
                                return runtime.set(name, value);
                            });
                        };
                    }
                    var value = Reflect.get(target, property, target);
                    return typeof value === "function" ? value.bind(target) : value;
                },
                set(target, property, value) {
                    return Reflect.set(target, property, value, target);
                },
            });
            bindRuntime(activityInstance, this.runtime);
            try {
                var machineContext = this.ctx;
                var asyncOperationPromise = Promise.resolve(
                    operation(controller, activityInstance, event),
                );
                this.active[behavior.qualifiedName] = {
                    context: controller,
                    promise: asyncOperationPromise.catch(function (error) {
                        var active = self.active[behavior.qualifiedName];
                        if (!active || active.context !== controller || controller.done) {
                            return;
                        }
                        self.dispatch(
                            machineContext,
                            Object.create(ErrorEvent, {
                                data: { value: error },
                            }),
                        );
                    }).then(function () {
                        var active = self.active[behavior.qualifiedName];
                        if (!active || active.context !== controller || controller.done) {
                            return;
                        }
                        self.notify("executed", behavior.qualifiedName);
                        self.notify(
                            "executed",
                            behavior.Owner ? behavior.Owner() : dirname(behavior.qualifiedName),
                        );
                    }),
                };
            } catch (err) {
                if (!controller.done) {
                    error = err;
                }
            }
        } else {
            var result = operation(this.ctx, this.instance, event);
            if (isThenable(result)) {
                throw new Error("sequential behavior must be synchronous");
            }
            this.notify("executed", behavior.qualifiedName);
            this.notify("executed", dirname(behavior.qualifiedName));
        }
        if (error) {
            this.dispatch(
                this.ctx,
                Object.create(ErrorEvent, {
                    data: { value: error },
                }),
            );
        }
    }

    private terminate(activity: Behavior): void {
        var active = this.active[activity.qualifiedName];
        if (active) {
            active.context.cancel();
            delete this.active[activity.qualifiedName];
        }
    }

    stop(): Completion {
        if (this.currentState.qualifiedName === this.model.qualifiedName && !this.processing) {
            return Promise.resolve();
        }
        this.processing = true;
        while (
            this.currentState &&
            this.currentState.qualifiedName !== this.model.qualifiedName
        ) {
            var currentState = getState(this.model, this.currentState.qualifiedName);
            if (!currentState) {
                break;
            }
            this.exit(currentState, FinalEvent);
            var parentState = getState(
                this.model,
                dirname(this.currentState.qualifiedName),
            );
            if (!parentState) {
                break;
            }
            this.currentState = parentState;
        }
        this.processing = false;
        this.queue.front.length = 0;
        this.queue.back = [];
        this.queue.backHead = 0;
        this.ctx.cancel();
        delete this.ctx.instances[this.id];
        return Promise.resolve();
    }
}

function find(
    stack: AnyModelElement[],
    ...kindsToMatch: Kind[]
): AnyModelElement | undefined {
    for (var i = stack.length - 1; i >= 0; i--) {
        var element = stack[i];
        for (var j = 0; j < kindsToMatch.length; j++) {
            if (isKind(element.kind, kindsToMatch[j])) {
                return element;
            }
        }
    }
    return undefined;
}


export function New<
    M extends TypedModel<
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        Instance
    >,
    ModelInstance extends NonNullable<M['__hsm_instance']> & Instance =
        NonNullable<M['__hsm_instance']> & Instance,
>(
    instance: ModelInstance,
    model: M,
    maybeConfig?: Config,
): MachineInstanceFor<M, ModelInstance>;
export function New(
    instance: Instance,
    model: Model,
    maybeConfig?: Config,
): MachineInstanceFor<
    TypedModel<any, any, any, any, any, any, any, Instance>,
    Instance
> {
    new HSM(instance, model, maybeConfig);
    return instance as MachineInstanceFor<
        TypedModel<any, any, any, any, any, any, any, Instance>,
        Instance
    >;
}

export function Start<TInstance extends Instance>(
    ctx: Context | null | undefined,
    instance: TInstance,
    data?: unknown,
): Promise<TInstance> {
    return instance.start(ctx || instance.context(), data);
}

export function Started<
    M extends TypedModel<
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        Instance
    >,
    ModelInstance extends NonNullable<M['__hsm_instance']> & Instance =
        NonNullable<M['__hsm_instance']> & Instance,
>(
    ctx: Context | null | undefined,
    instance: ModelInstance,
    model: M,
    maybeConfig?: Config,
): Promise<MachineInstanceFor<M, ModelInstance>> {
    var bound = New(instance, model, maybeConfig);
    return Start(ctx, bound, configData(maybeConfig)).then(function () {
        return bound;
    });
}


export function start<
    M extends TypedModel<
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        Instance
    >,
    ModelInstance extends NonNullable<M['__hsm_instance']> & Instance =
        NonNullable<M['__hsm_instance']> & Instance,
>(
    instance: ModelInstance,
    model: M,
    maybeConfig?: Config,
): MachineInstanceFor<M, ModelInstance>;
export function start<
    M extends TypedModel<
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        Instance
    >,
    ModelInstance extends NonNullable<M['__hsm_instance']> & Instance =
        NonNullable<M['__hsm_instance']> & Instance,
>(
    ctx: Context,
    instance: ModelInstance,
    model: M,
    maybeConfig?: Config,
): MachineInstanceFor<M, ModelInstance>;
export function start(
    ctxOrInstance: Context | Instance,
    instance: Model | Instance,
    model: Model | Config,
    maybeConfig?: Config,
): MachineInstanceFor<
    TypedModel<any, any, any, any, any, any, any, Instance>,
    Instance
> {
    var context = ctxOrInstance;
    var runtimeModel = model;
    var runtimeInstance = instance;
    if (!(context instanceof Context)) {
        maybeConfig = model as Config;
        runtimeModel = instance as Model;
        runtimeInstance = ctxOrInstance as Instance;
        context = new Context();
    }
    var sm = new HSM(
        context,
        runtimeInstance as Instance,
        runtimeModel as Model,
        maybeConfig,
    );
    void sm.start(context as Context, configData(maybeConfig));
    return runtimeInstance as MachineInstanceFor<
        TypedModel<any, any, any, any, any, any, any, Instance>,
        Instance
    >;
}

export function state<
    Name extends string,
    const Parts extends readonly ModelElementSpec[] = readonly ModelElementSpec[],
>(
    name: Name,
    ...partials: BuilderTuple<ValidateStateLocalSpecs<Parts>>
) {
    validateNameNoSlash("State", name);
    return attachSpec(
        function (model: Model, stack: AnyModelElement[]): State {
            var namespace =
     (find(stack, kinds.State, kinds.Model));

            var qualifiedName = join(namespace.qualifiedName, name);

            var stateObj = {
                qualifiedName: qualifiedName,
                kind: kinds.State,
                transitions: [],
                entry: [],
                exit: [],
                activities: [],
                deferred: [],
            };

            setModelMember(model, stateObj);
            stack.push(stateObj);
            apply(model, stack, partials);
            stack.pop();

            return stateObj;
        },
        {
            kind: 'state',
            name,
            parts: partials as unknown as Parts,
        } as StateSpec<Name, Parts>,
    );
}

export function submachineState<
    Name extends string,
    const Parts extends readonly ModelElementSpec[] = readonly ModelElementSpec[],
>(
    name: Name,
    machine: Model,
    ...partials: BuilderTuple<ValidateStateLocalSpecs<Parts>>
) {
    validateNameNoSlash("SubmachineState", name);
    return attachSpec(
        function (model: Model, stack: AnyModelElement[]): State {
            var namespace = (find(stack, kinds.State, kinds.Model));
            var qualifiedName = join(namespace.qualifiedName, name);
            var stateObj: State = {
                qualifiedName,
                kind: kinds.SubmachineState,
                transitions: [],
                entry: [],
                exit: [],
                activities: [],
                deferred: [],
                initial: "",
            };
            setModelMember(model, stateObj);
            stack.push(stateObj);
            submachineRoots.set(stateObj, machine.qualifiedName);
            apply(model, stack, machine.partials);
            apply(model, stack, partials);
            stack.pop();
            return stateObj;
        },
        {
            kind: 'submachineState',
            name,
            parts: partials as unknown as Parts,
        } as SubmachineStateSpec<Name, Parts>,
    );
}


export function initial<
    const Clauses extends readonly TransitionBuilderClause[] = readonly TransitionBuilderClause[],
>(
    ...partials: TransitionBuilderTuple<Clauses>
): BuilderWithSpec<(model: Model, stack: AnyModelElement[]) => Transition | undefined, InitialSpec<Clauses>>;
export function initial<
    Name extends string,
    const Clauses extends readonly TransitionBuilderClause[] = readonly TransitionBuilderClause[],
>(
    name: Name,
    ...partials: TransitionBuilderTuple<Clauses>
): BuilderWithSpec<(model: Model, stack: AnyModelElement[]) => Transition | undefined, InitialSpec<Clauses>>;
export function initial(
    nameOrPartial: string | ((...args: unknown[]) => unknown),
    ...partials: Array<(model: Model, stack: AnyModelElement[]) => unknown>
) {
    var name = '.initial';

    // If first argument is a string, it's the name of the initial pseudostate
    if (typeof nameOrPartial === 'string') {
        name = nameOrPartial;
    } else if (typeof nameOrPartial === 'function') {
        // If it's a partial function, add it to the beginning of partials
        partials = [nameOrPartial, ...partials];
    }

    return attachSpec(
        function (model: Model, stack: AnyModelElement[]) {
            var state = findState(stack);
            if (!state) {
                throw new Error("initial must be declared inside a state");
            }

            var initialName = join(state.qualifiedName, name);
            var initialObj: Vertex = {
                qualifiedName: initialName,
                kind: kinds.Initial,
                transitions: [],
            };

            setModelMember(model, initialObj);
            state.initial = initialName;

            // Add the initial event trigger
            var resolvedPartials = [source(initialObj.qualifiedName), on(InitialEvent), ...partials] as Array<
                BuilderWithSpec<
                    (model: Model, stack: AnyModelElement[]) => unknown,
                    TransitionBuilderClause
                >
            >;

            // Create the transition with all partials
            stack.push(initialObj);
            var transitionObj = transition(...resolvedPartials)(model, stack);
            stack.pop();

            return transitionObj;
        },
        {
            kind: 'initial',
            name,
            parts: partials,
        } as InitialSpec<any>,
    );
}

export function transition<
    const Clauses extends readonly TransitionBuilderClause[] = readonly TransitionBuilderClause[],
>(
    ...partials: TransitionBuilderTuple<Clauses>
) {
    return attachSpec(
        function (
            model: Model,
            stack: AnyModelElement[],
        ): Transition {
        var vertex = findVertex(stack);
        if (!vertex) {
            throw new Error("transition must be declared inside a vertex");
        }

        var name = 'transition_' + modelElementIndex(model);

        var transitionObj: Transition = {
            qualifiedName: join(vertex.qualifiedName, name),
            kind: kinds.Transition, // Will be updated later
            source: ".",
            guard: '',
            effect:
([]),
            events:
([]),
            paths:
 ({}) as Record<Path, TransitionPath>,
            target: undefined,
        };

        setModelMember(model, transitionObj);
        stack.push(transitionObj);
        apply(model, stack, partials);
        stack.pop();

        // Default source to the current vertex if not explicitly set
        if (transitionObj.source == "." || !transitionObj.source) {
            transitionObj.source = vertex.qualifiedName;
        }
        var sourceElement = getVertex(model, transitionObj.source);
        if (!sourceElement) {
            throw new Error("invalid transition source " + transitionObj.source);
        }
        sourceElement.transitions.push(transitionObj.qualifiedName);
        return transitionObj;
    },
    {
        kind: 'transition',
        parts: partials as unknown as Clauses,
    } as TransitionSpec<Clauses>
    );
}


export function source<Name extends string>(
    name: Name,
): BuilderWithSpec<(model: any, stack: any) => unknown, SourceClause<Name>> {
    return attachSpec(
        function (model: Model, stack: AnyModelElement[]) {
            var transition = findTransition(stack);
            if (!transition) {
                return undefined;
            }

            var resolvedName: string = name;
            if (!isAbsolute(resolvedName)) {
                var ancestor = findState(stack);
                if (ancestor) {
                    resolvedName = join(ancestor.qualifiedName, resolvedName);
                }
            } else {
                resolvedName = rebaseAbsolutePath(model, stack, resolvedName);
            }

            transition.source = resolvedName;
            return transition;
        },
        {
            kind: 'source',
            name,
        } as SourceClause<Name>,
    );
}


export function target<Name extends string>(
    name: Name,
): BuilderWithSpec<(model: any, stack: any) => unknown, TargetClause<Name>> {
    return attachSpec(
        function (model: Model, stack: AnyModelElement[]) {
            var transition = findTransition(stack);
            if (!transition) {
                return undefined;
            }

            var resolvedName: string = name;
            if (!isAbsolute(resolvedName)) {
                var ancestor = findState(stack);
                if (ancestor) {
                    resolvedName = join(ancestor.qualifiedName, resolvedName);
                }
            } else {
                resolvedName = rebaseAbsolutePath(model, stack, resolvedName);
            }
            transition.target = resolvedName;
            return transition;
        },
        {
            kind: 'target',
            name,
        } as TargetClause<Name>,
    );
}


export function on<Name extends string>(
    eventName: Name,
): BuilderWithSpec<(model: any, stack: any) => unknown, EventClause<Name, unknown>>;
export function on<Name extends string, Schema = unknown>(
    eventRecord: Event<Name, Schema>,
): BuilderWithSpec<(model: any, stack: any) => unknown, EventClause<Name, Schema>>;
export function on(
    eventOrRecord: string | Event<string, unknown>,
): BuilderWithSpec<(model: any, stack: any) => unknown, EventClause<string, unknown>> {
    const event = eventOrRecord;
    return attachSpec(
        function (model: Model, stack: AnyModelElement[]) {
            var transition = findTransition(stack);
            if (!transition) {
                return undefined;
            }

            var eventName = typeof event === 'string' ? event : event.name;
            transition.events.push(eventName);
            if (typeof event !== 'string') {
                registerEvent(model, event);
            }
            return transition;
        },
        {
            kind: 'on',
            name: typeof eventOrRecord === 'string'
                ? eventOrRecord
                : eventOrRecord.name,
            schema:
                typeof eventOrRecord === 'string'
                    ? undefined
                    : eventOrRecord.schema,
        } as EventClause<string, unknown>,
    );
}


export function onSet<Name extends string>(
    name: Name,
): BuilderWithSpec<(model: any, stack: any) => unknown, OnSetClause<Name>> {
    validateNameNoSlash("OnSet", name);
    return attachSpec(
        function (model: Model, stack: AnyModelElement[]) {
            var transition = findTransition(stack);
            if (!transition) {
                return undefined;
            }
            var qualifiedName = qualifyModelName(model, name);
            transition.events.push(qualifiedName);
            registerEvent(model, {
                kind: kinds.ChangeEvent,
                name: qualifiedName,
                source: qualifiedName
            });
            if (!model.attributes[qualifiedName]) {
                var existing = model.members[qualifiedName];
                if (existing && !isKind(existing.kind, kinds.Attribute)) {
                    throw new Error("attribute '" + qualifiedName + "' conflicts with existing model member");
                }
                model.attributes[qualifiedName] = {
                    kind: kinds.Attribute,
                    name: name,
                    qualifiedName: qualifiedName,
                    hasDefault: false,
                    hasType: false,
                };
                model.members[qualifiedName] = model.attributes[qualifiedName];
            }
            return transition;
        },
        {
            kind: 'onSet',
            name,
        } as OnSetClause<Name>,
    );
}


export function onCall<Name extends string>(
    name: Name,
): BuilderWithSpec<(model: any, stack: any) => unknown, OnCallClause<Name>> {
    validateNameNoSlash("OnCall", name);
    return attachSpec(
        function (model: Model, stack: AnyModelElement[]) {
            var transition = findTransition(stack);
            if (!transition) {
                return undefined;
            }
            var qualifiedName = qualifyModelName(model, name);
            transition.events.push(qualifiedName);
            registerEvent(model, {
                kind: kinds.CallEvent,
                name: qualifiedName,
                source: qualifiedName
            });
            return transition;
        },
        {
            kind: 'onCall',
            name,
        } as OnCallClause<Name>,
    );
}


export function when<Name extends string>(
    expr: Name,
): BuilderWithSpec<(model: Model, stack: AnyModelElement[]) => unknown, WhenClause<Name>>;
export function when(
    expr:
        | string
        | ((
              ctx: Context,
              instance: Instance,
              evt: EventRecord,
          ) => unknown),
) {
    if (typeof expr === 'string') {
        return onSet(expr);
    }
    return function (model: Model, stack: AnyModelElement[]) {
        var transition = findTransition(stack);
        if (!transition) {
            return undefined;
        }
        var hasAttributeEvent = false;
        for (var qualifiedName in model.members) {
            var member = model.members[qualifiedName];
            if (
                isKind(member.kind, kinds.Attribute) &&
                dirname(member.qualifiedName) === model.qualifiedName &&
                transition.events.indexOf(member.qualifiedName) === -1
            ) {
                transition.events.push(member.qualifiedName);
                registerEvent(model, {
                    kind: kinds.ChangeEvent,
                    name: member.qualifiedName,
                    source: member.qualifiedName,
                });
                hasAttributeEvent = true;
            }
        }
        if (!hasAttributeEvent) {
            transition.events.push(AnyEvent.name);
            registerEvent(model, AnyEvent);
        }
        var guardName = join(transition.qualifiedName, 'when');
        model.members[guardName] = {
            qualifiedName: guardName,
            kind: kinds.Constraint,
            expression: function (ctx, instance, evt) {
                var result = expr(ctx, instance, evt);
                if (isThenable(result)) {
                    throw new Error("guard must be a synchronous function");
                }
                return Boolean(result);
            },
        };
        transition.guard = guardName;
    };
}


function pushBehaviors(
    namePrefix: string,
    kind: Kind,
    namesList: string[],
    model: Model,
    operations: ReadonlyArray<BehaviorArgument>,
) {
    for (var i = 0; i < operations.length; i++) {
        var operation = operations[i];
        var qualifiedName = namePrefix + '_' + namesList.length;
        var behaviorOperation: Operation | null = null;
        var operationName: string | undefined = undefined;
        if (typeof operation === 'function') {
            behaviorOperation = operation;
        } else if (typeof operation === 'string') {
            operationName = qualifyModelName(model, operation);
        } else if (operation && typeof operation.dispatch === "function") {
            const dispatchable = operation;
            behaviorOperation = function (ctx, _instance, event) {
                return dispatchable.dispatch(ctx, event);
            };
        }
        var behavior = {
            qualifiedName: qualifiedName,
            kind: kind,
            operation: behaviorOperation,
            operationName: operationName
        };
        model.members[qualifiedName] = behavior;
        namesList.push(qualifiedName);
    }
}


export function entry<
    EventType extends EventRecord = EventRecord,
    const Operations extends readonly BehaviorArgument<EventType>[] = readonly BehaviorArgument<EventType>[],
>(
    ...operations: Operations
) {
    return attachSpec(
        function (model: Model, stack: AnyModelElement[]) {
            var state = findState(stack);
            if (!state) {
                return undefined;
            }
            pushBehaviors(join(state.qualifiedName, 'entry'), kinds.Sequential, state.entry, model, operations);
            return state;
        },
        {
            kind: 'entry',
            value: operations,
        } as EntrySpec<Operations>,
    );
}


export function exit<
    EventType extends EventRecord = EventRecord,
    const Operations extends readonly BehaviorArgument<EventType>[] = readonly BehaviorArgument<EventType>[],
>(
    ...operations: Operations
) {
    return attachSpec(
        function (model: Model, stack: AnyModelElement[]) {
            var state = findState(stack);
            if (!state) {
                return undefined;
            }
            pushBehaviors(join(state.qualifiedName, 'exit'), kinds.Sequential, state.exit, model, operations);
            return state;
        },
        {
            kind: 'exit',
            value: operations,
        } as ExitSpec<Operations>,
    );
}


export function activity<
    EventType extends EventRecord = EventRecord,
    const Operations extends readonly BehaviorArgument<EventType>[] = readonly BehaviorArgument<EventType>[],
>(
    ...operations: Operations
) {
    return attachSpec(
        function (model: Model, stack: AnyModelElement[]) {
            var state = findState(stack);
            if (!state) {
                return undefined;
            }
            pushBehaviors(join(state.qualifiedName, 'activity'), kinds.Concurrent, state.activities, model, operations);
            return state;
        },
        {
            kind: 'activity',
            value: operations,
        } as ActivitySpec<Operations>,
    );
}


export function effect<const Operations extends readonly BehaviorArgument[]>(
    ...operations: Operations
) {
    return attachSpec(
        function (model: Model, stack: AnyModelElement[]) {
            var transition = findTransition(stack);
            if (!transition) {
                return undefined;
            }
            pushBehaviors(join(transition.qualifiedName, 'effect'), kinds.Sequential, transition.effect, model, operations);
            return transition;
        },
        {
            kind: 'effect',
            value: operations,
        } as EffectClause<Operations>,
    );
}

function makeObservationEvent(
    source: string,
    occurrence: string,
    event: EventRecord,
): EventRecord {
    return {
        kind: kinds.Event,
        name: "hsm/observation",
        source,
        data: {
            event,
            occurrence,
            time: Date.now(),
        },
    };
}

export function observe<const Targets extends readonly unknown[]>(
    ...targetsOrOperation: Targets
): BuilderWithSpec<(model: Model, stack: AnyModelElement[]) => unknown, ObserveSpec<Targets>> {
    return attachSpec(
        function (model: Model) {
            var observer: Operation | undefined;
            var targets: string[] = [];
            for (var i = 0; i < targetsOrOperation.length; i++) {
                var targetOrOperation = targetsOrOperation[i];
                if (typeof targetOrOperation === "function") {
                    observer = targetOrOperation as Operation;
                } else if (typeof targetOrOperation === "string") {
                    targets.push(targetOrOperation);
                } else if (targetOrOperation && typeof targetOrOperation === "object") {
                    var eventName = (targetOrOperation as EventRecord).name;
                    var qualifiedName = (targetOrOperation as Element).qualifiedName;
                    if (typeof eventName === "string") {
                        targets.push(eventName);
                    } else if (typeof qualifiedName === "string") {
                        targets.push(qualifiedName);
                    }
                }
            }
            var operation = observer || function () {};
            model.partials.push(function () {
                var observeAll = targets.length === 0;
                for (var qualifiedName in model.members) {
                    var member = model.members[qualifiedName];
                    if (isBehaviorElement(member) && (observeAll || targets.indexOf(qualifiedName) !== -1)) {
                        var original = member.operation;
                        const behaviorName = member.qualifiedName;
                        const originalOperation = original;
                        member.operation = function (ctx, instance, event) {
                            operation(ctx, instance, makeObservationEvent(behaviorName, "behavior", event));
                            return originalOperation ? originalOperation(ctx, instance, event) : undefined;
                        };
                    }
                    if (!isTransitionElement(member)) {
                        continue;
                    }
                    var matchesTransition = observeAll || targets.indexOf(qualifiedName) !== -1;
                    var matchesEvent = false;
                    for (var eventIndex = 0; eventIndex < member.events.length; eventIndex++) {
                        if (targets.indexOf(member.events[eventIndex]) !== -1) {
                            matchesEvent = true;
                            break;
                        }
                    }
                    if (!matchesTransition && !matchesEvent) {
                        continue;
                    }
                    var behaviorName = join(member.qualifiedName, "observation");
                    const transitionName = qualifiedName;
                    model.members[behaviorName] = {
                        qualifiedName: behaviorName,
                        kind: kinds.Sequential,
                        operation: function (ctx, instance, event) {
                            operation(ctx, instance, makeObservationEvent(transitionName, "event", event));
                        },
                    };
                    member.effect.unshift(behaviorName);
                }
            });
        },
        {
            kind: 'observe',
            targets: targetsOrOperation,
        } as ObserveSpec<Targets>,
    );
}


export function guard<Name extends string>(
    expression: Name,
): BuilderWithSpec<
    (model: Model, stack: AnyModelElement[]) => unknown,
    GuardClause<Name>
>;
export function guard<EventType extends EventRecord>(
    expression: (ctx: Context, instance: Instance, event: EventType) => boolean,
): GuardBuilder<EventType>;
export function guard(
    expression: string | ((ctx: Context, instance: Instance, event: EventRecord) => boolean),
) {
    return attachSpec(
        function (model: Model, stack: AnyModelElement[]) {
            var transition = findTransition(stack);
            if (!transition) {
                return undefined;
            }

            var name = join(transition.qualifiedName, 'guard');

            var constraint = {
                qualifiedName: name,
                kind: kinds.Constraint,
                expression:
                    typeof expression === "function"
                        ? (expression as Expression)
                        : resolveOperation(model, expression as string),
            };

            model.members[name] = constraint;
            transition.guard = name;
        },
        {
            kind: 'guard',
            value: expression,
        } as GuardClause<string | ((ctx: Context, instance: Instance, event: EventRecord) => boolean)>,
    );
}


export function attribute<Name extends string, TypeToken extends Function>(
    name: Name,
    type: TypeToken,
): BuilderWithSpec<(model: Model) => unknown, AttributeSpec<Name, AttributeValueFromTypeToken<TypeToken>>>;
export function attribute<Name extends string, TypeToken extends Function, Value extends AttributeValueFromTypeToken<TypeToken>>(
    name: Name,
    type: TypeToken,
    defaultValue: Value,
): BuilderWithSpec<(model: Model) => unknown, AttributeSpec<Name, AttributeValueFromTypeToken<TypeToken>>>;
export function attribute<Name extends string, Value = unknown>(
    name: Name,
    defaultValue?: Value,
): BuilderWithSpec<(model: Model) => unknown, AttributeSpec<Name, Value>>;
export function attribute<Name extends string, Value = unknown>(
    name: Name,
    type: undefined,
    defaultValue: Value,
): BuilderWithSpec<(model: Model) => unknown, AttributeSpec<Name, Value>>;
export function attribute<Name extends string, Value = unknown>(
    name: Name,
    typeOrDefault?: Value | Function,
    maybeDefault?: Value,
): BuilderWithSpec<(model: Model) => unknown, AttributeSpec<Name, Value>> {
    validateNameNoSlash("Attribute", name);
    var hasExplicitAny = arguments.length > 2 && typeOrDefault === undefined;
    var hasType = !hasExplicitAny && isRuntimeTypeToken(typeOrDefault);
    var hasDefault = hasExplicitAny || (hasType ? arguments.length > 2 : arguments.length > 1);
    var defaultValue = hasExplicitAny ? maybeDefault : hasType ? maybeDefault : typeOrDefault;
    var valueType = hasType
        ? typeOrDefault
        : hasDefault && !hasExplicitAny
            ? inferRuntimeTypeToken(defaultValue)
            : undefined;
    var hasRuntimeType = hasType || valueType !== undefined;
    if (hasType && hasDefault && !matchesRuntimeTypeToken(valueType, defaultValue)) {
        throw new TypeError("Attribute default value does not match declared type");
    }
    return attachSpec(
        function (model: Model): unknown {
            var qualifiedName = qualifyModelName(model, name);
            var existing = model.members[qualifiedName];
            if (existing && !isKind(existing.kind, kinds.Attribute)) {
                throw new Error("attribute '" + qualifiedName + "' conflicts with existing model member");
            }
            var attributeDefinition: AttributeDefinition = {
                kind: kinds.Attribute,
                name: name,
                qualifiedName: qualifiedName,
                hasDefault: hasDefault,
                defaultValue: defaultValue,
                hasType: hasRuntimeType,
                valueType: valueType,
            };
            model.attributes[qualifiedName] = attributeDefinition;
            model.members[qualifiedName] = attributeDefinition;
            return undefined;
        },
        {
            kind: 'attribute',
            name,
            value: defaultValue as Value,
        } as AttributeSpec<Name, Value>,
    );
}


export function operation<Name extends string>(
    name: Name,
): BuilderWithSpec<(model: Model) => unknown, OperationSpec<Name, (...args: any[]) => any>>;
export function operation<
    Name extends string,
    Fn extends Function,
>(
    name: Name,
    implementation: Fn,
): BuilderWithSpec<
    (model: Model) => unknown,
    OperationSpec<Name, Extract<Fn, (...args: any[]) => any>>
>;
export function operation<
    Name extends string,
    Fn extends Function,
>(
    name: Name,
    implementation?: Fn,
): BuilderWithSpec<
    (model: Model) => unknown,
    OperationSpec<Name, Extract<Fn, (...args: any[]) => any>>
> {
    validateNameNoSlash("Operation", name);
    return attachSpec(
        function (model: Model): unknown {
            var qualifiedName = qualifyModelName(model, name);
            var existing = model.members[qualifiedName];
            if (existing && !isKind(existing.kind, kinds.Operation)) {
                throw new Error("operation '" + qualifiedName + "' conflicts with existing model member");
            }
            var operationDefinition: OperationDefinition = {
                kind: kinds.Operation,
                name: name,
                qualifiedName: qualifiedName,
                implementation: implementation as Extract<Fn, (...args: any[]) => any> | undefined
            };
            model.operations[qualifiedName] = operationDefinition;
            model.members[qualifiedName] = operationDefinition;
            return undefined;
        },
        {
            kind: 'operation',
            name,
            impl: implementation as Extract<Fn, (...args: any[]) => any>,
        } as OperationSpec<Name, Extract<Fn, (...args: any[]) => any>>,
    );
}

export function validator(
    modelValidator: ModelValidator,
): BuilderWithSpec<(model: Model) => unknown, ValidatorSpec> {
    return attachSpec(
        function (): unknown {
            return undefined;
        },
        {
            kind: 'validator',
            validator: modelValidator,
        } as ValidatorSpec,
    );
}

export function finalizer(
    modelFinalizer: ModelFinalizer,
): BuilderWithSpec<(model: Model) => unknown, FinalizerSpec> {
    return attachSpec(
        function (): unknown {
            return undefined;
        },
        {
            kind: 'finalizer',
            finalizer: modelFinalizer,
        } as FinalizerSpec,
    );
}


export function after<Name extends string>(
    duration: Name,
): BuilderWithSpec<(model: Model, stack: AnyModelElement[]) => unknown, AfterClause<Name>>;
export function after(
    duration: TimeExpression,
): BuilderWithSpec<(model: Model, stack: AnyModelElement[]) => unknown, AfterClause<TimeExpression>>;
export function after(duration: string | TimeExpression) {
    return attachSpec(function (model: Model, stack: AnyModelElement[]) {
        var transition = findTransition(stack);
        if (!transition) {
            return undefined;
        }

        var eventName = join(transition.qualifiedName, 'duration');

        var event = {
            name: eventName,
            kind: kinds.TimeEvent
        };

        transition.events.push(eventName);
        registerEvent(model, event);

        model.partials.push(function () {
            var source = getState(model, transition.source);
            if (!source) {
                return;
            }
            pushBehaviors(
                join(source.qualifiedName, 'activity_after_' + source.activities.length),
                kinds.Concurrent, // Activities can be concurrent/asynchronous
                source.activities,
                model,
                [
                    function (ctx, instance, evt) {
                        var runtime = runtimeFor(instance);
                        if (!runtime) {
                            return;
                        }
                        var delay = typeof duration === 'string'
                            ? coerceDuration(instance.get(duration)[0])
                            : duration(ctx, instance, evt);
                        return withThenable(delay, function (value) {
                            if (ctx.done) {
                                return;
                            }
                            var coerceDelay = coerceDuration(value);
                            if (coerceDelay < 0) {
                                return;
                            }
                            return new Promise<void>(function (resolve) {
                                var timeout = runtime.clock.setTimeout(function () {
                                    ctx.removeEventListener('done', cancelTimer);
                                    if (ctx.done) {
                                        runtime.clock.clearTimeout(timeout);
                                        resolve();
                                        return;
                                    }
                                    // Dispatch timer event asynchronously to avoid blocking the main thread
                                    instance.dispatch(event);
                                    resolve(); // Resolve the activity's promise after dispatch
                                }, coerceDelay);

                                var cancelTimer = function () {
                                    ctx.removeEventListener('done', cancelTimer);
                                    runtime.clock.clearTimeout(timeout);
                                    resolve(); // Resolve if aborted
                                };
                                ctx.addEventListener('done', cancelTimer);
                            });
                        });
                    }]
            );
        });
    }, {
        kind: 'after',
        value: duration,
    } as AfterClause<string | TimeExpression>);
}


export function every<Name extends string>(
    duration: Name,
): BuilderWithSpec<(model: Model, stack: AnyModelElement[]) => unknown, EveryClause<Name>>;
export function every(
    duration: TimeExpression,
): BuilderWithSpec<(model: Model, stack: AnyModelElement[]) => unknown, EveryClause<TimeExpression>>;
export function every(duration: string | TimeExpression) {
    return attachSpec(function (model: Model, stack: AnyModelElement[]) {
        var transition = findTransition(stack);
        if (!transition) {
            return undefined;
        }

        var eventName = join(transition.qualifiedName, 'duration');

        var event = {
            name: eventName,
            kind: kinds.TimeEvent
        };

        transition.events.push(eventName);
        registerEvent(model, event);

        model.partials.push(function () {
            var source = getState(model, transition.source);
            if (!source) {
                return;
            }
            pushBehaviors(
                join(source.qualifiedName, 'activity_every_' + source.activities.length),
                kinds.Concurrent, // Activities can be concurrent/asynchronous
                source.activities,
                model,
                [
                    function (ctx, instance, evt) {
                        var runtime = runtimeFor(instance);
                        if (!runtime) {
                            return;
                        }
                        var readInterval = function (): unknown {
                            return typeof duration === 'string'
                                ? instance.get(duration)[0]
                                : duration(ctx, instance, evt);
                        };
                        var schedule = function (
                            value: unknown,
                            resolve: () => void,
                            reject: (error: unknown) => void,
                        ): void {
                            if (ctx.done) {
                                resolve();
                                return;
                            }
                            var coerceInterval = Number(value);
                            if (isNaN(coerceInterval)) {
                                reject(new Error("invalid interval"));
                                return;
                            }
                            if (coerceInterval <= 0) {
                                resolve();
                                return;
                            }
                            var cancelTimer = function () {
                                ctx.removeEventListener('done', cancelTimer);
                                runtime.clock.clearTimeout(timeout);
                                resolve(); // Resolve if aborted
                            };
                            var timeout = runtime.clock.setTimeout(function tick() {
                                ctx.removeEventListener('done', cancelTimer);
                                if (ctx.done) {
                                    runtime.clock.clearTimeout(timeout);
                                    resolve();
                                    return;
                                }
                                Promise.resolve(instance.dispatch(event)).then(function () {
                                    if (ctx.done) {
                                        resolve();
                                        return;
                                    }
                                    var nextInterval = readInterval();
                                    if (isThenable(nextInterval)) {
                                        Promise.resolve(nextInterval).then(
                                            function (resolvedInterval) {
                                                schedule(resolvedInterval, resolve, reject);
                                            },
                                            reject,
                                        );
                                        return;
                                    }
                                    schedule(nextInterval, resolve, reject);
                                }, reject);
                            }, coerceInterval);
                            ctx.addEventListener('done', cancelTimer);
                        };
                        var interval = readInterval();
                        return withThenable(interval, function (value) {
                            return new Promise<void>(function (resolve, reject) {
                                schedule(value, resolve, reject);
                            });
                        });
                    }]
            );
        });
    }, {
        kind: 'every',
        value: duration,
    } as EveryClause<string | TimeExpression>);
}


export function at<Name extends string>(
    timepoint: Name,
): BuilderWithSpec<(model: Model, stack: AnyModelElement[]) => unknown, AtClause<Name>>;
export function at(
    timepoint:
        ((
            ctx: Context,
            instance: Instance,
            evt: EventRecord,
        ) => number | Date | Promise<number> | Promise<Date>),
): BuilderWithSpec<(model: Model, stack: AnyModelElement[]) => unknown, AtClause<TimeExpression>>;
export function at(
    timepoint:
        | string
        | ((
            ctx: Context,
            instance: Instance,
            evt: EventRecord,
        ) => number | Date | Promise<number> | Promise<Date>),
) {
    return attachSpec(function (model: Model, stack: AnyModelElement[]) {
        var transition = findTransition(stack);
        if (!transition) {
            return undefined;
        }
        var eventName = join(transition.qualifiedName, 'timepoint');
        var event = {
            name: eventName,
            kind: kinds.TimeEvent
        };

        transition.events.push(eventName);
        registerEvent(model, event);

        model.partials.push(function () {
            var source = getState(model, transition.source);
            if (!source) {
                return;
            }
            pushBehaviors(
                join(source.qualifiedName, 'activity_at_' + source.activities.length),
                kinds.Concurrent,
                source.activities,
                model,
                [function (ctx, instance, evt) {
                    var runtime = runtimeFor(instance);
                    if (!runtime) {
                        return;
                    }
                    var timepointValue = typeof timepoint === 'string'
                        ? coerceTimepoint(instance.get(timepoint)[0])
                        : timepoint(ctx, instance, evt);
                    return withThenable(timepointValue, function (value) {
                        if (ctx.done) {
                            return;
                        }
                        var deadline = coerceTimepoint(value);
                        var delay = deadline - runtime.clock.now();
                        if (delay < 0) {
                            delay = 0;
                        }
                        return new Promise<void>(function (resolve) {
                            var timeout = runtime.clock.setTimeout(function () {
                                ctx.removeEventListener('done', cancelTimer);
                                if (ctx.done) {
                                    runtime.clock.clearTimeout(timeout);
                                    resolve();
                                    return;
                                }
                                instance.dispatch(event);
                                resolve();
                            }, delay);
                            var cancelTimer = function () {
                                ctx.removeEventListener('done', cancelTimer);
                                runtime.clock.clearTimeout(timeout);
                                resolve();
                            };
                            ctx.addEventListener('done', cancelTimer);
                        });
                    });
                }]
            );
        });
    }, {
        kind: 'at',
        value: timepoint,
    } as AtClause<string | TimeExpression>);
}


export function defer<
    const EventNames extends readonly string[],
>(
    ...eventNames: EventNames
): BuilderWithSpec<
    (model: Model, stack: AnyModelElement[]) => unknown,
    DeferSpec<EventNames>
> {
    var names = eventNames;
    return attachSpec(
        function (model: Model, stack: AnyModelElement[]) {
            var state = findState(stack);
            if (!state) {
                return undefined;
            }

            // Add event names to the deferred array
            for (var i = 0; i < names.length; i++) {
                state.deferred.push(names[i]);
            }

            return state;
        },
        {
            kind: 'defer',
            eventNames,
        } as DeferSpec<EventNames>,
    );
}


export function final<Name extends string>(
    name: Name,
) {
    validateNameNoSlash("Final", name);
    return attachSpec(
        function (model: Model, stack: AnyModelElement[]) {
            var parent = findState(stack);
            if (!parent) {
                return undefined;
            }

            var qualifiedName = join(parent.qualifiedName, name);

            var finalState = {
                qualifiedName: qualifiedName,
                kind: kinds.FinalState,
                entry: [],
                exit: [],
                activities: [],
                deferred: [],
                transitions: [],
                initial: undefined,
            };

            setModelMember(model, finalState);

            return finalState;
        },
        {
            kind: 'final',
            name,
        } as FinalSpec<Name>,
    );
}

function findConnectionPoint(
    model: Model,
    boundary: string | undefined,
    name: string,
    pointKind: Kind,
): Vertex | undefined {
    if (!boundary) {
        return undefined;
    }
    var direct: Vertex | undefined;
    var nested: Vertex | undefined;
    for (var qualifiedName in model.members) {
        var member = model.members[qualifiedName];
        if (!isVertex(member) || !isKind(member.kind, pointKind)) {
            continue;
        }
        if (qualifiedName.split('/').pop() !== name) {
            continue;
        }
        if (dirname(qualifiedName) === boundary) {
            direct = member;
            break;
        }
        if (isAncestor(boundary, qualifiedName) && !nested) {
            nested = member;
        }
    }
    return direct || nested;
}

export function entryPoint<
    Name extends string,
    const Parts extends readonly TransitionBuilderClause[] = readonly TransitionBuilderClause[],
>(
    name: Name,
    ...partials: TransitionBuilderTuple<Parts>
) {
    validateNameNoSlash("EntryPoint", name);
    return attachSpec(
        function (model: Model, stack: AnyModelElement[]) {
            var activeTransition = findTransition(stack);
            if (activeTransition) {
                model.partials.push(function () {
                    if (!activeTransition.target) {
                        throw new Error("entry point selector can only target a SubmachineState");
                    }
                    var boundary = getState(model, activeTransition.target);
                    if (!boundary) {
                        throw new Error('target "' + activeTransition.target + '" not found');
                    }
                    if (!isKind(boundary.kind, kinds.SubmachineState)) {
                        throw new Error("entry point selector can only target a SubmachineState");
                    }
                    var entry = findConnectionPoint(
                        model,
                        activeTransition.target,
                        name,
                        kinds.EntryPoint,
                    );
                    if (!entry) {
                        throw new Error("state '" + activeTransition.target + "' has no entry point '" + name + "'");
                    }
                    activeTransition.target = entry.qualifiedName;
                });
                return undefined;
            }
            var namespace = find(stack, kinds.State, kinds.Model);
            if (!namespace) {
                return undefined;
            }
            var qualifiedName = join(namespace.qualifiedName, name);
            var entry: Vertex = {
                qualifiedName,
                kind: kinds.EntryPoint,
                transitions: [],
            };
            setModelMember(model, entry);
            stack.push(entry);
            if (partials.length > 0) {
                transition(...partials)(model, stack);
            }
            stack.pop();
            return entry;
        },
        {
            kind: 'entryPoint',
            name,
            parts: partials as unknown as Parts,
        } as EntryPointSpec<Name, Parts>,
    );
}

export function exitPoint<
    Name extends string,
    const Parts extends readonly TransitionBuilderClause[] = readonly TransitionBuilderClause[],
>(
    name: Name,
    ...partials: TransitionBuilderTuple<Parts>
) {
    validateNameNoSlash("ExitPoint", name);
    return attachSpec(
        function (model: Model, stack: AnyModelElement[]) {
            var activeTransition = findTransition(stack);
            if (activeTransition) {
                model.partials.push(function () {
                    var boundary = getState(model, activeTransition.source);
                    if (!boundary) {
                        throw new Error('source "' + activeTransition.source + '" not found');
                    }
                    if (!isKind(boundary.kind, kinds.SubmachineState)) {
                        throw new Error("ExitPoint outcome can only be handled by a SubmachineState");
                    }
                    var exit = findConnectionPoint(
                        model,
                        activeTransition.source,
                        name,
                        kinds.ExitPoint,
                    );
                    if (!exit) {
                        throw new Error("state '" + activeTransition.source + "' has no exit point '" + name + "'");
                    }
                    var oldSource = getVertex(model, activeTransition.source);
                    if (oldSource) {
                        oldSource.transitions = oldSource.transitions.filter(function (transitionName) {
                            return transitionName !== activeTransition.qualifiedName;
                        });
	                    }
	                    activeTransition.source = exit.qualifiedName;
	                    if (activeTransition.guard) {
	                        var index = exit.transitions.length;
	                        for (var currentIndex = 0; currentIndex < exit.transitions.length; currentIndex++) {
	                            var existing = getTransition(model, exit.transitions[currentIndex]);
	                            if (
	                                existing &&
	                                !existing.guard &&
	                                existing.target !== dirname(exit.qualifiedName)
	                            ) {
	                                index = currentIndex;
	                                break;
	                            }
	                        }
	                        exit.transitions.splice(index, 0, activeTransition.qualifiedName);
	                    } else {
	                        exit.transitions.push(activeTransition.qualifiedName);
	                    }
	                });
	                return undefined;
	            }
            var namespace = find(stack, kinds.State, kinds.Model);
            if (!namespace) {
                return undefined;
            }
            var qualifiedName = join(namespace.qualifiedName, name);
            var exit: Vertex = {
                qualifiedName,
                kind: kinds.ExitPoint,
                transitions: [],
            };
            setModelMember(model, exit);
            stack.push(exit);
            if (partials.length > 0) {
                transition(target(dirname(qualifiedName)), ...partials)(model, stack);
            }
            stack.pop();
            return exit;
        },
        {
            kind: 'exitPoint',
            name,
            parts: partials as unknown as Parts,
        } as ExitPointSpec<Name, Parts>,
    );
}


export function shallowHistory(
    elementOrName: string | ((...args: unknown[]) => unknown),
) {
    var partials = slice(arguments, 1) as Array<
        (model: Model, stack: AnyModelElement[]) => unknown
    >;
    var name = '';
    if (typeof elementOrName === 'string') {
        name = elementOrName;
        validateNameNoSlash("ShallowHistory", name);
    } else if (typeof elementOrName === 'function') {
        partials.unshift(elementOrName);
    }
    return function (model: Model, stack: AnyModelElement[]) {
        var owner = findState(stack);
        if (!owner) {
            return undefined;
        }
        if (!name) {
            name = 'shallow_history_' + modelElementIndex(model);
        }
        var qualifiedName = join(owner.qualifiedName, name);
        var history = {
            qualifiedName: qualifiedName,
            kind: kinds.ShallowHistory,
            transitions: []
        };
        setModelMember(model, history);
        stack.push(history);
        apply(model, stack, partials);
        stack.pop();
        return history;
    };
}


export function deepHistory(
    elementOrName: string | ((...args: unknown[]) => unknown),
) {

    var partials = slice(arguments, 1) as Array<
        (model: Model, stack: AnyModelElement[]) => unknown
    >;
    var name = '';
    if (typeof elementOrName === 'string') {
        name = elementOrName;
        validateNameNoSlash("DeepHistory", name);
    } else if (typeof elementOrName === 'function') {
        partials.unshift(elementOrName);
    }
    return function (model: Model, stack: AnyModelElement[]) {
        var owner = findState(stack);
        if (!owner) {
            return undefined;
        }
        if (!name) {
            name = 'deep_history_' + modelElementIndex(model);
        }
        var qualifiedName = join(owner.qualifiedName, name);
        var history = {
            qualifiedName: qualifiedName,
            kind: kinds.DeepHistory,
            transitions: []
        };
        setModelMember(model, history);
        stack.push(history);
        apply(model, stack, partials);
        stack.pop();
        return history;
    };
}


export function choice<
    Name extends string,
    const Parts extends readonly ModelElementSpec[] = readonly ModelElementSpec[],
>(
    name: Name,
    ...partials: ModelElementBuilderTuple<Parts>
): BuilderWithSpec<(model: Model, stack: AnyModelElement[]) => Vertex | undefined, ChoiceSpec<Name, Parts>>;
export function choice<
    const Parts extends readonly ModelElementSpec[] = readonly ModelElementSpec[],
>(
    ...partials: ModelElementBuilderTuple<Parts>
): BuilderWithSpec<(model: Model, stack: AnyModelElement[]) => Vertex | undefined, ChoiceSpec<string, Parts>>;
export function choice(
    elementOrName?: string | ((...args: unknown[]) => unknown),
    ...partials: Array<(model: Model, stack: AnyModelElement[]) => unknown>
) {
    var name = '';

    // If first argument is a string, it's the name of the choice pseudostate
    if (typeof elementOrName === 'string') {
        name = elementOrName;
        validateNameNoSlash("Choice", name);
    } else if (typeof elementOrName === 'function') {
        // If it's a partial function, add it to the beginning of partials
        partials.unshift(elementOrName);
    }

    return attachSpec(
        function (model: Model, stack: AnyModelElement[]) {
            // Find the appropriate owner for this choice
            var owner = find(stack, kinds.Transition, kinds.State);
            if (!owner) {
                return undefined;
            }

            if (isTransitionElement(owner)) {
                var transition = owner;
                var source = transition.source;
                var ownerVertex = getVertex(model, source);
                if (!ownerVertex) {
                    return undefined;
                }
                if (isKind(ownerVertex.kind, kinds.Pseudostate)) {
                    owner = find(stack, kinds.State);
                } else if (isStateElement(ownerVertex)) {
                    owner = ownerVertex;
                } else {
                    return undefined;
                }
            }
            if (!owner || !isStateElement(owner)) {
                return undefined;
            }
            if (name === "") {
                name = "choice_" + modelElementIndex(model);
            }

            var qualifiedName = join(owner.qualifiedName, name);

            var choice = {
                qualifiedName: qualifiedName,
                kind: kinds.Choice,
                transitions: [],
            };
            setModelMember(model, choice);
            stack.push(choice);
            apply(model, stack, partials);
            stack.pop();

            return choice;
        },
        {
            kind: 'choice',
            name,
            parts: partials,
        } as ChoiceSpec<string, readonly unknown[]>,
    );
}


export function dispatchAll(ctx: Context, event: EventRecord): Completion {
    return dispatchTo(ctx, event);
}

function dispatchIDMatches(pattern: string, id: string): boolean {
    if (pattern === id) {
        return true;
    }
    if (pattern.indexOf("*") === -1 && pattern.indexOf("?") === -1) {
        return false;
    }
    var escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    var expression = "^" + escaped.replace(/\*/g, ".*").replace(/\?/g, ".") + "$";
    return new RegExp(expression).test(id);
}

function dispatchSourceFromContext(ctx: Context): string | undefined {
    var current = fromContext(ctx)[0];
    if (current instanceof Instance) {
        var runtime = runtimeFor(current);
        return runtime ? runtime.id : undefined;
    }
    if (current instanceof Group) {
        return current.id || undefined;
    }
    return undefined;
}

function eventForRecipient(
    event: EventRecord,
    source: string | undefined,
    target: string,
): EventRecord {
    var name = event.name === undefined ? event.Name : event.name;
    var kind = event.kind === undefined ? event.Kind : event.kind;
    var id = event.id === undefined ? event.ID : event.id;
    var eventSource = event.source === undefined
        ? event.Source === undefined ? source : event.Source
        : event.source;
    var eventTarget = event.target === undefined
        ? event.Target === undefined ? target : event.Target
        : event.target;
    var qualifiedName = event.qualifiedName === undefined
        ? event.QualifiedName
        : event.qualifiedName;
    var schema = event.schema === undefined ? event.Schema : event.schema;
    return {
        name: name as string,
        Name: event.Name === undefined ? name : event.Name,
        data: event.data,
        kind: kind as Kind,
        Kind: event.Kind === undefined ? (kind === undefined ? kinds.Event : kind) : event.Kind,
        id,
        ID: event.ID === undefined ? id : event.ID,
        source: eventSource,
        Source: event.Source === undefined ? eventSource : event.Source,
        target: eventTarget,
        Target: event.Target === undefined ? eventTarget : event.Target,
        schema,
        Schema: event.Schema === undefined ? schema : event.Schema,
        qualifiedName,
        QualifiedName: event.QualifiedName === undefined ? qualifiedName : event.QualifiedName,
        metadata: (event as { metadata?: unknown }).metadata,
    } as EventRecord;
}

function dispatchToCandidates(
    ctx: Context,
    event: EventRecord,
    ids: string[],
): Completion {
    var registry = instancesFromContext(ctx)[0];
    var source = dispatchSourceFromContext(ctx);
    var completions: Completion[] = [];
    var seen: Record<string, boolean> = {};
    for (var key in registry) {
        var instance = registry[key];
        if (!(instance instanceof Instance)) {
            continue;
        }
        var runtime = runtimeFor(instance);
        if (
            !runtime ||
            runtime.state() === "" ||
            runtime.state() === runtime.model.qualifiedName
        ) {
            continue;
        }
        var runtimeID = runtime.id;
        if (seen[runtimeID]) {
            continue;
        }
        var matched = ids.length === 0;
        for (var i = 0; !matched && i < ids.length; i++) {
            matched = dispatchIDMatches(ids[i], runtimeID);
        }
        if (!matched) {
            continue;
        }
        seen[runtimeID] = true;
        completions.push(instance.dispatch(ctx, eventForRecipient(event, source, runtimeID)));
    }
    return Promise.all(completions).then(function () {});
}

function makeModel(
    name: string,
    sourcePartials: Array<(model: Model, stack: AnyModelElement[]) => void>,
    sourceRoots?: string[],
): Model {
    validateNameNoSlash("Model", name);
    var modelValidator: ModelValidator = new DefaultModelValidator();
    var modelFinalizer: ModelFinalizer = new DefaultModelFinalizer();
    for (var partialIndex = 0; partialIndex < sourcePartials.length; partialIndex++) {
        var spec = (sourcePartials[partialIndex] as { __hsmSpec?: ModelElementSpec }).__hsmSpec;
        if (!spec) {
            continue;
        }
        if (spec.kind === 'validator') {
            modelValidator = spec.validator;
        } else if (spec.kind === 'finalizer') {
            modelFinalizer = spec.finalizer;
        }
    }

    var model: Model = {
        qualifiedName: join('/', name),
        kind: kinds.Model,
        members: {} as Record<Path, AnyModelElement>,
        transitions: [] as string[],
        entry: [] as string[],
        exit: [] as string[],
        activities: [] as string[],
        deferred: [] as string[],
        initial: "",
        transitionMap: {} as Record<Path, Record<Path, any[]>>,
        deferredMap: {} as Record<Path, Record<string, string>>,
        historyPaths: {},
        historyTargets: {},
        events: {},
        attributes: {},
        operations: {},
        partials: [] as Array<(model: Model, stack: AnyModelElement[]) => void>,
    };
    var rebaseRoots = uniqueModelRoots(sourceRoots && sourceRoots.length > 0
        ? sourceRoots
        : [model.qualifiedName]);
    modelRebaseRoots.set(model, rebaseRoots);
    model.members[model.qualifiedName] = model;
    registerEvent(model, InitialEvent);
    registerEvent(model, FinalEvent);
    registerEvent(model, ErrorEvent);
    registerEvent(model, AnyEvent);

    var stack = [model];
    apply(model, stack, sourcePartials);

    while (model.partials.length > 0) {
        var currentPartials = model.partials.slice();
        model.partials = [];
        for (var i = 0; i < currentPartials.length; i++) {
            currentPartials[i](model, stack);
        }
    }

    finalizeTransitionKinds(model);
    modelValidator.validate(model);
    model = modelFinalizer.finalize(model);
    model.partials = sourcePartials.slice();
    modelRebaseRoots.set(model, uniqueModelRoots([...rebaseRoots, model.qualifiedName]));
    return model;
}


export function define<
    RootName extends string,
    const Parts extends readonly ModelElementSpec[] = readonly ModelElementSpec[],
>(
    name: RootName,
    ...partials: ValidatedModelElementBuilderTuple<Parts, Parts, Parts, `/${RootName}`>
): TypedModelFromInfer<RootName, Parts>;
export function define<
    ModelSpec extends TypedModel<
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        Instance
    > = never,
>(
    name: string,
    ...partials:
        [ModelSpec] extends [never]
            ? never
            : Array<(model: Model, stack: AnyModelElement[]) => void>
): ModelSpec;
export function define(
    name: string,
    ...partials: Array<(model: Model, stack: AnyModelElement[]) => void>
) {
    return makeModel(name, partials);
}


export function redefine<
    Source extends TypedModel<any, any, any, any, any, any, any, any>,
    const Parts extends readonly ModelElementSpec[] = readonly ModelElementSpec[],
>(
    model: Source,
    ...partials: ModelElementBuilderTuple<Parts>
): RedefinedModelFromInfer<Source, ModelRootNameOf<Source>, Parts>;
export function redefine<
    Source extends TypedModel<any, any, any, any, any, any, any, any>,
    RootName extends string,
    const Parts extends readonly ModelElementSpec[] = readonly ModelElementSpec[],
>(
    model: Source,
    name: RootName,
    ...partials: ModelElementBuilderTuple<Parts>
): RedefinedModelFromInfer<Source, RootName, Parts>;
export function redefine<M extends Model>(
    model: M,
    ...partials: Array<(model: Model, stack: AnyModelElement[]) => void>
): M;
export function redefine<M extends Model>(
    model: M,
    name: string,
    ...partials: Array<(model: Model, stack: AnyModelElement[]) => void>
): M;
export function redefine(
    model: Model,
    nameOrPartial?: string | ((model: Model, stack: AnyModelElement[]) => void),
    ...partials: Array<(model: Model, stack: AnyModelElement[]) => void>
): Model {
    var name = model.qualifiedName.replace(/^\//, "");
    var additions = partials;
    if (typeof nameOrPartial === "string") {
        validateNameNoSlash("Model", nameOrPartial);
        name = nameOrPartial;
    } else if (typeof nameOrPartial === "function") {
        additions = [nameOrPartial, ...partials];
    }
    return makeModel(
        name,
        [...model.partials, ...additions],
        uniqueModelRoots([...(modelRebaseRoots.get(model) || []), model.qualifiedName]),
    );
}


export function dispatchTo(
    ctx: Context,
    event: EventRecord,
    ...ids: string[]
): Completion {
    return dispatchToCandidates(ctx, event, ids);
}

export function dispatch(
    ctx: Context | null | undefined,
    dispatchable: Dispatchable | null | undefined,
    event: EventRecord,
): Completion;
export function dispatch(
    dispatchable: Dispatchable | null | undefined,
    event: EventRecord,
): Completion;
export function dispatch(
    ctxOrDispatchable: Context | Dispatchable | null | undefined,
    maybeDispatchableOrEvent: Dispatchable | EventRecord | null | undefined,
    maybeEvent?: EventRecord,
): Completion {
    if (ctxOrDispatchable instanceof Context && arguments.length < 3) {
        var currentEvent = maybeDispatchableOrEvent as EventRecord | undefined;
        if (currentEvent) {
            var current = fromContext(ctxOrDispatchable)[0];
            if (current) {
                return current.dispatch(ctxOrDispatchable, currentEvent);
            }
        }
        return errorCompletion(new Error("dispatch requires a started HSM"));
    }
    var hasExplicitContext = arguments.length >= 3;
    var dispatchable = hasExplicitContext
        ? maybeDispatchableOrEvent as Dispatchable | null | undefined
        : ctxOrDispatchable as Dispatchable | null | undefined;
    var event = hasExplicitContext
        ? maybeEvent
        : maybeDispatchableOrEvent as EventRecord | undefined;
    if (dispatchable && event) {
        var ctx = ctxOrDispatchable instanceof Context ? ctxOrDispatchable : dispatchable.context();
        if (ctxOrDispatchable instanceof Context && dispatchable instanceof Instance) {
            var runtime = runtimeFor(dispatchable);
            if (runtime) {
                return dispatchable.dispatch(
                    ctx,
                    eventForRecipient(event, dispatchSourceFromContext(ctx), runtime.id),
                );
            }
        }
        return dispatchable.dispatch(ctx, event);
    }
    return errorCompletion(new Error("dispatch requires a started HSM"));
}

export function get(
    ctxOrInstance: Context | Instance | null | undefined,
    maybeInstanceOrName: Instance | string | null | undefined,
    maybeName?: string,
): AttributeRead {
    var hasExplicitContext = ctxOrInstance instanceof Context ||
        (ctxOrInstance == null && maybeInstanceOrName != null && typeof maybeInstanceOrName !== "string");
    var instance = hasExplicitContext
        ? maybeInstanceOrName
        : ctxOrInstance;
    var name = hasExplicitContext
        ? maybeName
        : (maybeInstanceOrName as string);
    if (ctxOrInstance instanceof Context && !hasExplicitContext) {
        return [undefined, false];
    }
    if (!name) {
        return [undefined, false];
    }
    if (!instance) {
        if (ctxOrInstance instanceof Context) {
            var current = fromContext(ctxOrInstance)[0];
            if (current instanceof Instance) {
                return current.get(name);
            }
        }
        return [undefined, false];
    }
    var runtime = runtimeFor(instance);
    return runtime ? runtime.get(name) : [undefined, false];
}

export function set(
    ctxOrInstance: Context | Instance | null | undefined,
    maybeInstanceOrName: Instance | string | null | undefined,
    maybeNameOrValue: unknown,
    maybeValue?: unknown,
): Completion {
    var hasExplicitContext = ctxOrInstance instanceof Context ||
        (ctxOrInstance == null && maybeInstanceOrName != null && typeof maybeInstanceOrName !== "string");
    var instance = hasExplicitContext
        ? maybeInstanceOrName
        : ctxOrInstance;
    var name = hasExplicitContext
        ? (maybeNameOrValue as string)
        : (maybeInstanceOrName as string);
    var value = hasExplicitContext ? maybeValue : maybeNameOrValue;
    if (!instance) {
        if (ctxOrInstance instanceof Context) {
            var current = fromContext(ctxOrInstance)[0];
            if (current instanceof Instance) {
                return current.set(name, value);
            }
        }
        return errorCompletion(new Error("set requires a started HSM"));
    }
    var runtime = runtimeFor(instance);
    if (runtime) {
        return runtime.set(name, value);
    }
    return errorCompletion(new Error("set requires a started HSM"));
}

export function call(
    ctxOrInstance: Context | Instance | null | undefined,
    maybeInstanceOrName: Instance | string | null | undefined,
    maybeName?: string,
    ...args: unknown[]
): Promise<unknown> {
    var hasExplicitContext = ctxOrInstance instanceof Context ||
        (ctxOrInstance == null && maybeInstanceOrName != null && typeof maybeInstanceOrName !== "string");
    var instance = hasExplicitContext
        ? maybeInstanceOrName
        : ctxOrInstance;
    var name = hasExplicitContext
        ? maybeName
        : (maybeInstanceOrName as string);
    if (!instance) {
        if (ctxOrInstance instanceof Context && name) {
            var current = fromContext(ctxOrInstance)[0];
            if (current instanceof Instance) {
                return current.call(name, ...args);
            }
        }
        return errorCompletion(new Error("operation requires a started HSM"));
    }
    var callArgs = slice(arguments, hasExplicitContext ? 3 : 2);
    var runtime = runtimeFor(instance);
    if (runtime) {
        return runtime.call(name, ...callArgs);
    }
    return Promise.reject(new Error("operation requires a started HSM"));
}

export function stop(instance: Instance | Group): Completion {
    return instance.stop();
}

export function restart(instance: Instance | Group, data?: unknown): Completion {
    return instance.restart(data);
}

export function takeSnapshot(ctxOrInstance: Context | Group, group: Group): GroupSnapshotOf<readonly Instance[]>;
export function takeSnapshot(ctxOrInstance: Group): GroupSnapshotOf<readonly Instance[]>;
export function takeSnapshot(ctxOrInstance: Context | Instance, maybeInstance?: Instance): Snapshot;
export function takeSnapshot(ctxOrInstance: Context | Instance | Group, maybeInstance?: Instance | Group): Snapshot | GroupSnapshotOf<readonly Instance[]> {
    if (ctxOrInstance instanceof Group) {
        return ctxOrInstance.takeSnapshot();
    }
    if (maybeInstance instanceof Group) {
        return maybeInstance.takeSnapshot();
    }
    var instance = ctxOrInstance instanceof Context ? maybeInstance : ctxOrInstance;
    var runtime = runtimeFor(instance);
    if (!runtime) {
        throw new Error("take snapshot requires a started HSM");
    }
    return runtime.takeSnapshot();
}

function waitAfter(
    ctx: Context,
    instance: Instance,
    bucket: AfterBucket,
    key: string,
): Promise<void> {
    return new Promise<void>(function (resolve) {
        var runtime = runtimeFor(instance);
        if (!runtime) {
            resolve();
            return;
        }
        var removeAfter = function () {};
        var settled = false;
        var cleanup = function () {
            if (settled) {
                return;
            }
            settled = true;
            removeAfter();
            ctx.removeEventListener("done", cleanup);
        };
        ctx.addEventListener("done", cleanup);
        if (settled || ctx.done) {
            return;
        }
        removeAfter = runtime.onAfter(bucket, key, function () {
            if (ctx.done) {
                cleanup();
                return;
            }
            cleanup();
            resolve();
        });
    });
}

export function afterProcess(
    ctx: Context,
    instance: Instance,
    maybeEvent?: EventRecord,
): Promise<void> {
    return new Promise<void>(function (resolve) {
        var runtime = runtimeFor(instance);
        if (!runtime) {
            resolve();
            return;
        }
        if (maybeEvent) {
            waitAfter(ctx, instance, 'processed', maybeEvent.name).then(resolve);
            return;
        }
        if (!runtime.processing) {
            resolve();
            return;
        }
        waitAfter(ctx, instance, 'processed', '__next__').then(resolve);
    });
}

export function afterDispatch(ctx: Context, instance: Instance, event: EventRecord): Promise<void> {
    return waitAfter(ctx, instance, 'dispatched', event.name);
}

export function afterEntry(
    ctx: Context,
    instance: Instance,
    stateName: string,
): Promise<void> {
    return waitAfter(ctx, instance, 'entered', stateName);
}

export function afterExit(
    ctx: Context,
    instance: Instance,
    stateName: string,
): Promise<void> {
    return waitAfter(ctx, instance, 'exited', stateName);
}

export function afterExecuted(
    ctx: Context,
    instance: Instance,
    stateOrBehavior: string,
): Promise<void> {
    return waitAfter(ctx, instance, 'executed', stateOrBehavior);
}

export function id(instance) {
    var runtime = runtimeFor(instance);
    return runtime ? runtime.id : '';
}

export function qualifiedName(instance) {
    var runtime = runtimeFor(instance);
    return runtime ? runtime.name : '';
}

export function name(instance) {
    var runtime = runtimeFor(instance);
    if (!runtime) {
        return '';
    }
    var parts = runtime.name.split('/');
    return parts[parts.length - 1] || runtime.name;
}

export function clock(instance) {
    if (instance instanceof Group) {
        return instance.clock();
    }
    var runtime = runtimeFor(instance);
    return runtime ? runtime.clock : DefaultClock;
}


export class Group<Members extends readonly unknown[] = readonly Instance[]> {
    instances: Instance[] = [];
    id = "";
    readonly __hsm_group_members?: Members;

    constructor(...instances: unknown[]) {
        var start = 0;
        if (typeof instances[0] === "string") {
            this.id = instances[0];
            start = 1;
        }
        for (var i = start; i < instances.length; i++) {
            var instance = instances[i];
            if (!instance) {
                continue;
            }
            if (instance instanceof Group) {
                for (var j = 0; j < instance.instances.length; j++) {
                    this.instances.push(instance.instances[j]);
                }
                continue;
            }
            this.instances.push(instance as Instance);
        }
    }

    context(): Context {
        var values = new Map<unknown, unknown>([[Keys.HSM, this]]);
        if (this.instances.length) {
            var instances = this.instances[0].context().Value(Keys.Instances);
            if (instances && typeof instances === "object") {
                values.set(Keys.Instances, instances);
            }
        }
        return new Context(undefined, values);
    }

    dispatch(event: GroupEventUnion<Members>): Completion;
    dispatch(ctx: Context, event: GroupEventUnion<Members>): Completion;
    dispatch(ctxOrEvent: Context | GroupEventUnion<Members>, maybeEvent?: GroupEventUnion<Members>): Completion {
        var self = this;
        var ctx = ctxOrEvent instanceof Context ? ctxOrEvent : this.context();
        var event = ctxOrEvent instanceof Context ? maybeEvent : ctxOrEvent;
        if (!event) {
            return errorCompletion(new Error("dispatch requires an event"));
        }
        return Promise.resolve().then(function () {
            var completions: Completion[] = [];
            var source = dispatchSourceFromContext(ctx);
            for (var i = 0; i < self.instances.length; i++) {
                var runtime = runtimeFor(self.instances[i]);
                if (
                    !runtime ||
                    runtime.state() === "" ||
                    runtime.state() === runtime.model.qualifiedName
                ) {
                    continue;
                }
                completions.push(self.instances[i].dispatch(ctx, eventForRecipient(event, source, runtime.id)));
            }
            return Promise.all(completions).then(function () {});
        });
    }

    set<K extends SharedAttributeKeysOfGroupMembers<Members>>(
        name: K,
        value: SharedAttributeValueOfGroupMembers<Members, K>,
    ): Completion {
        var completions: Completion[] = [];
        for (var i = 0; i < this.instances.length; i++) {
            var runtime = runtimeFor(this.instances[i]);
            if (
                !runtime ||
                runtime.state() === "" ||
                runtime.state() === runtime.model.qualifiedName
            ) {
                continue;
            }
            completions.push(this.instances[i].set(name, value));
        }
        return Promise.all(completions).then(function () {});
    }

    call<K extends GroupOperationKeys<Members>>(
        name: K,
        ...args: Parameters<GroupOperationSignature<Members, K>>
    ): Promise<Awaited<ReturnType<GroupOperationSignature<Members, K>>>> {
        if (!this.instances.length) {
            return Promise.resolve(undefined) as Promise<Awaited<ReturnType<GroupOperationSignature<Members, K>>>>;
        }
        return this.instances[0].call(name, ...args) as Promise<Awaited<ReturnType<GroupOperationSignature<Members, K>>>>;
    }

    state(): string[] {
        var states: string[] = [];
        for (var i = 0; i < this.instances.length; i++) {
            states.push(this.instances[i].state());
        }
        return states;
    }

    stop(): Completion {
        var completions: Completion[] = [];
        for (var i = 0; i < this.instances.length; i++) {
            completions.push(this.instances[i].stop());
        }
        return Promise.all(completions).then(function () {});
    }

    restart(data?: unknown): Completion {
        var completions: Completion[] = [];
        for (var i = 0; i < this.instances.length; i++) {
            completions.push(this.instances[i].restart(data === undefined ? undefined : cloneRuntimeValue(data)));
        }
        return Promise.all(completions).then(function () {});
    }

    takeSnapshot(): GroupSnapshotOf<Members> {
        var members: Snapshot[] = [];
        for (var i = 0; i < this.instances.length; i++) {
            var snapshot = this.instances[i].takeSnapshot();
            members.push(snapshot);
        }
        return freezeSnapshotObject(members) as GroupSnapshotOf<Members>;
    }

    clock(): ClockConfig {
        return DefaultClock;
    }
}

export function makeGroup<const Members extends readonly unknown[]>(
    groupID: string,
    ...instances: Members
): Group<FlattenGroupMembers<Members>>;
export function makeGroup<const Members extends readonly unknown[]>(
    ...instances: Members
): Group<FlattenGroupMembers<Members>>;
export function makeGroup() {
    return new Group(...slice(arguments, 0)) as any;
}

export const NullKind = kinds.Null;
export const ElementKind = kinds.Element;
export const PartialKind = kinds.Partial;
export const VertexKind = kinds.Vertex;
export const ConstraintKind = kinds.Constraint;
export const BehaviorKind = kinds.Behavior;
export const NamespaceKind = kinds.Namespace;
export const ConcurrentKind = kinds.Concurrent;
export const SequentialKind = kinds.Sequential;
export const StateMachineKind = kinds.StateMachine;
export const AttributeKind = kinds.Attribute;
export const OperationKind = kinds.Operation;
export const StateKind = kinds.State;
export const SubmachineStateKind = kinds.SubmachineState;
export const ModelKind = kinds.Model;
export const TransitionKind = kinds.Transition;
export const InternalKind = kinds.Internal;
export const ExternalKind = kinds.External;
export const LocalKind = kinds.Local;
export const SelfKind = kinds.Self;
export const EventKind = kinds.Event;
export const CompletionEventKind = kinds.CompletionEvent;
export const ChangeEventKind = kinds.ChangeEvent;
export const ErrorEventKind = kinds.ErrorEvent;
export const TimeEventKind = kinds.TimeEvent;
export const CallEventKind = kinds.CallEvent;
export const PseudostateKind = kinds.Pseudostate;
export const InitialKind = kinds.Initial;
export const EntryPointKind = kinds.EntryPoint;
export const ExitPointKind = kinds.ExitPoint;
export const FinalStateKind = kinds.FinalState;
export const ChoiceKind = kinds.Choice;
export const JunctionKind = kinds.Junction;
export const DeepHistoryKind = kinds.DeepHistory;
export const ShallowHistoryKind = kinds.ShallowHistory;
export const ObservationKind = kinds.Observation;
export const Define = define;
export const Redefine = redefine;
export const State = state;
export const SubmachineState = submachineState;
export const Final = final;
export const ShallowHistory = shallowHistory;
export const DeepHistory = deepHistory;
export const Choice = choice;
export const EntryPoint = entryPoint;
export const ExitPoint = exitPoint;
export const Transition = transition;
export const Initial = initial;
export const Event = event;
export const On = on;
export const OnCall = onCall;
export const OnSet = onSet;
export const When = when;
export const After = after;
export const Every = every;
export const At = at;
export const Target = target;
export const Source = source;
export const Entry = entry;
export const Exit = exit;
export const Activity = activity;
export const Effect = effect;
export const Observe = observe;
export const Guard = guard;
export const Defer = defer;
export const Attribute = attribute;
export const Operation = operation;
export const Validator = validator;
export const Finalizer = finalizer;
export const Dispatch = dispatch;
export const DispatchAll = dispatchAll;
export const DispatchTo = dispatchTo;
export const Get = get;
export const Set = set;
export const Call = call;
export const Restart = restart;
export const Stop = stop;
export const TakeSnapshot = takeSnapshot;
export const MakeGroup = makeGroup;
export const FromContext = fromContext;
export const InstancesFromContext = instancesFromContext;
export const LCA = lca;
export const IsAncestor = isAncestor;
export const ID = id;
export const QualifiedName = qualifiedName;
export const Name = name;
export const Clock = clock;
export { apply, find };
