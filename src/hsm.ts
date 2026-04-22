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
type AnyModelElement = State | Transition | Behavior | Constraint | Vertex;
type TransitionTable = Record<Path, TransitionCandidate[]>;
type TransitionCandidate = {
    transition: Transition;
    priority: number;
};

type EventRecord = {
  kind: Kind;
  name: string;
  data?: any;
  schema?: any;
  source?: string;
  target?: string;
  id?: string;
  qualifiedName?: string;
};

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

type AttributeDefinition = {
    name: string;
    qualifiedName: string;
    hasDefault: boolean;
    defaultValue?: any;
};

type OperationDefinition = {
    name: string;
    qualifiedName: string;
    implementation: (...args: unknown[]) => unknown;
};

type Model = State & {
  members: Record<Path, AnyModelElement>;
  transitionMap: Record<Path, Record<Path, any[]>>;
  deferredMap: Record<Path, Record<Path, boolean>>;
  events: Record<string, EventRecord>;
  attributes: Record<string, AttributeDefinition>;
  operations: Record<string, OperationDefinition>;
  partials: Array<(model: Model, stack: AnyModelElement[]) => void>;
};

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

type Snapshot = {
    id: string;
    qualifiedName: string;
    state: string;
    attributes: Record<string, any>;
    queueLen: number;
    events: Array<{
        event: string;
        target?: string;
        guard: boolean;
        schema?: any;
    }>;
};

type ActiveContext = {
  listeners: Array<() => void>;
  instances: Record<string, Instance>;
  done: boolean;
};

type Active = {
  context: ActiveContext;
  promise: Promise<void>;
};

type Config = {
    id?: string;
    name?: string;
    data?: any;
    clock?: {
        setTimeout?: TimerFunction;
        clearTimeout?: CancelFunction;
        now?: () => number;
    };
};
type ClockConfig = {
    setTimeout: TimerFunction;
    clearTimeout: CancelFunction;
    now: () => number;
};

type QueueShape = {
  front: EventRecord[];
  back: Array<EventRecord | undefined>;
  backHead: number;
  len: () => number;
};

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

export type AttributeSpec<Name extends string = string, Value = unknown> = {
    kind: 'attribute';
    name: Name;
    value: Value;
};

export type OperationSpec<
    Name extends string = string,
    Fn extends (...args: any[]) => any = (...args: any[]) => any,
> = {
    kind: 'operation';
    name: Name;
    impl: Fn;
};

export type ModelElementSpec =
    | TransitionSpec<readonly TransitionBuilderClause[]>
    | StateSpec<string, readonly unknown[]>
    | InitialSpec<readonly TransitionBuilderClause[]>
    | FinalSpec
    | ShallowHistorySpec<string, readonly unknown[]>
    | DeepHistorySpec<string, readonly unknown[]>
    | ChoiceSpec<string, readonly unknown[]>
    | EntrySpec
    | ExitSpec
    | ActivitySpec
    | AttributeSpec
    | OperationSpec
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
> =
    Parts extends readonly [infer H, ...infer T]
        ? H extends EventClause<infer Name, infer Schema>
            ? { [K in Name]: Schema extends undefined ? unknown : Schema } &
              EventSchemasFromPartialsWithContext<T, ModelParts>
            : H extends OnSetClause<infer Name>
                ? {
                    [K in `set:${Name}`]: {
                        name: Name;
                        old: EventValueFromAttribute<ModelParts, Name>;
                        new: EventValueFromAttribute<ModelParts, Name>;
                    };
                } & EventSchemasFromPartialsWithContext<T, ModelParts>
                : H extends OnCallClause<infer Name>
                    ? {
                        [K in `call:${Name}`]: {
                            name: Name;
                            args: EventArgsFromOperation<ModelParts, Name>;
                        };
                    } & EventSchemasFromPartialsWithContext<T, ModelParts>
                    : H extends WhenClause<infer Name>
                        ? {
                            [K in `set:${Name}`]: {
                                name: Name;
                                old: EventValueFromAttribute<ModelParts, Name>;
                                new: EventValueFromAttribute<ModelParts, Name>;
                            };
                        } & EventSchemasFromPartialsWithContext<T, ModelParts>
                        : H extends TransitionSpec<infer Clauses>
                            ? EventSchemasFromClausesWithContext<Clauses, ModelParts> &
                              EventSchemasFromPartialsWithContext<T, ModelParts>
                            : H extends StateSpec<infer _Name, infer S>
                                ? EventSchemasFromPartialsWithContext<S, ModelParts> &
                                  EventSchemasFromPartialsWithContext<T, ModelParts>
                                : EventSchemasFromPartialsWithContext<T, ModelParts>
        : {};

type EventSchemasFromPartials<Parts extends readonly unknown[]> =
    EventSchemasFromPartialsWithContext<Parts, Parts>;

type EventSchemasFromClausesWithContext<
    Clauses extends readonly unknown[],
    ModelParts extends readonly unknown[],
> =
    Clauses extends readonly [infer H, ...infer T]
        ? H extends EventClause<infer Name, infer Schema>
            ? { [K in Name]: Schema extends undefined ? unknown : Schema } &
              EventSchemasFromClausesWithContext<T, ModelParts>
                : H extends OnSetClause<infer Name>
                ? {
                    [K in `set:${Name}`]: {
                        name: Name;
                        old: EventValueFromAttribute<ModelParts, Name>;
                        new: EventValueFromAttribute<ModelParts, Name>;
                    };
                } & EventSchemasFromClausesWithContext<T, ModelParts>
                : H extends OnCallClause<infer Name>
                    ? {
                        [K in `call:${Name}`]: {
                            name: Name;
                            args: EventArgsFromOperation<ModelParts, Name>;
                        };
                    } & EventSchemasFromClausesWithContext<T, ModelParts>
                    : H extends WhenClause<infer Name>
                        ? {
                            [K in `set:${Name}`]: {
                                name: Name;
                                old: EventValueFromAttribute<ModelParts, Name>;
                                new: EventValueFromAttribute<ModelParts, Name>;
                            };
                        } & EventSchemasFromClausesWithContext<T, ModelParts>
                        : EventSchemasFromClausesWithContext<T, ModelParts>
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
    Source extends string = Owner,
    Target extends string | undefined = undefined,
    Events extends string = never,
    Schemas extends Record<string, unknown> = {},
    ModelParts extends readonly unknown[] = readonly unknown[],
> = Clauses extends readonly [infer H, ...infer T]
    ? H extends SourceClause<infer Name>
        ? TransitionFromClauses<T, Owner, Name, Target, Events, Schemas, ModelParts>
        : H extends TargetClause<infer Name>
            ? TransitionFromClauses<T, Owner, Source, Name, Events, Schemas, ModelParts>
            : H extends EventClause<infer Name, infer Schema>
                ? TransitionFromClauses<
                    T,
                    Owner,
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
                        Source,
                        Target,
                        Events | `set:${Name}`,
                            MergeEventMaps<
                                Schemas,
                                {
                                    [K in `set:${Name}`]: {
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
                            Source,
                            Target,
                            Events | `call:${Name}`,
                            MergeEventMaps<
                                Schemas,
                                {
                                    [K in `call:${Name}`]: {
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
                                Source,
                                Target,
                                Events | `set:${Name}`,
                                MergeEventMaps<
                                    Schemas,
                                    {
                                        [K in `set:${Name}`]: {
                                            name: Name;
                                            old: EventValueFromAttribute<ModelParts, Name>;
                                            new: EventValueFromAttribute<ModelParts, Name>;
                                        };
                                    }
                                >,
                                ModelParts
                            >
                            : TransitionFromClauses<T, Owner, Source, Target, Events, Schemas, ModelParts>
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
> =
    Parts extends readonly [infer H, ...infer T]
        ? H extends StateSpec<any, infer ChildParts>
            ? EventSchemasFromPartialsWithContext<ChildParts, AllParts> &
              EventSchemasFromChildrenWithContext<T, AllParts>
            : H extends FinalSpec<any>
                ? EventSchemasFromChildrenWithContext<T, AllParts>
                : H extends InitialSpec<infer Clauses>
                    ? EventSchemasFromClausesWithContext<Clauses, AllParts> &
                      EventSchemasFromChildrenWithContext<T, AllParts>
                    : H extends TransitionSpec<infer Clauses>
                        ? EventSchemasFromClausesWithContext<Clauses, AllParts> &
                          EventSchemasFromChildrenWithContext<T, AllParts>
                        : EventSchemasFromChildrenWithContext<T, AllParts>
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
        TransitionFromClauses<Clauses, OwnerPath, OwnerPath, undefined, never, {}, ModelParts>,
        OwnerPath,
        ModelRoot
    >;
    attributes: {};
    operations: {};
    eventSchemas: EventSchemasFromClausesWithContext<Clauses, ModelParts>;
    initials: {};
};

type InitialsFromClauses<
    Clauses extends readonly unknown[],
    OwnerPath extends string,
    ModelRoot extends string,
> =
    NormalizeTransition<
        TransitionFromClauses<Clauses, OwnerPath, OwnerPath>,
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
        TransitionFromClauses<Clauses, OwnerPath, OwnerPath, undefined, never, {}, ModelParts>,
        OwnerPath,
        ModelRoot
    >;
    initials: InitialsFromClauses<Clauses, OwnerPath, ModelRoot>;
    attributes: {};
    operations: {};
    eventSchemas: EventSchemasFromClausesWithContext<Clauses, ModelParts>;
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
        EventSchemasFromPartialsWithContext<Parts, Parts>,
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
    id: string;
    qualifiedName: string;
    state: StatePathsOf<M>;
    attributes: AttributesOf<M>;
    queueLen: number;
    events: EventSnapshotOf<M>[];
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
    [Name in EventNamesFromTransitions<M>]: {
        event: Name;
        target: EventTargetForName<M, Name>;
        guard: boolean;
        schema?: EventSchemaFor<M, Name>;
    };
}[EventNamesFromTransitions<M>];

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
        dispatch(event: DispatchEventsOf<M>): void;
        state(): StatePathsOf<M>;
        takeSnapshot(): SnapshotOf<M>;
        get<K extends keyof A & string>(name: K): A[K];
        get(name: string): unknown;
        set<K extends keyof A & string>(name: K, value: A[K]): void;
        set(name: string, value: unknown): void;
        call<K extends keyof O & string>(
            name: K,
            ...args: Parameters<Extract<O[K], (...args: any[]) => any>>
        ): ReturnType<Extract<O[K], (...args: any[]) => any>>;
        call(name: string, ...args: unknown[]): unknown;
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
        : Member extends { dispatch(event: infer Event): void }
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
        ? [
            GroupSnapshotOfMember<Head>,
            ...GroupSnapshotsOfFlattenedMembers<Tail>,
        ]
        : [];

export type GroupSnapshotOf<Members extends readonly unknown[]> = Snapshot & {
    members: GroupSnapshotsOfFlattenedMembers<FlattenGroupMembers<Members>>;
};

type BuilderWithSpec<Signature, Spec> = Signature & { readonly __hsmSpec: Spec };

type BehaviorArgument<EventType extends EventRecord = EventRecord> =
    ((ctx: Context, instance: Instance, evt: EventType) => unknown) | string;

function attachSpec<Signature, Spec>(
    builder: Signature,
    spec: Spec,
): BuilderWithSpec<Signature, Spec> {
    return Object.assign(builder as Signature, {
        __hsmSpec: spec,
    }) as BuilderWithSpec<Signature, Spec>;
}

type InternalRuntime = {
  dispatch: (event: EventRecord) => void;
  state: () => string;
  context: () => ActiveContext;
  clock: ClockConfig;
  get: (name: string) => unknown;
  set: (name: string, value: unknown) => void;
  invoke: (name: string, ctx: Context, args: Array<unknown>) => unknown;
  call: (name: string, ...args: unknown[]) => unknown;
  restart: (data?: unknown) => void;
  takeSnapshot: () => Snapshot;
  onAfter: (bucket: keyof HSM["after"], key: string, listener: () => void) => void;
  stop: () => void;
  readonly id: string;
  readonly model: any;
  readonly name: string;
  readonly queue: QueueShape;
  readonly processing: boolean;
};

export type { Snapshot, Config, ClockConfig };

type InternalRuntimeMap = WeakMap<object, InternalRuntime>;
const runtimeByInstance: InternalRuntimeMap = new WeakMap();

function bindRuntime(instance: object, runtime: InternalRuntime): void {
    runtimeByInstance.set(instance, runtime);
}

function runtimeFor(instance: unknown): InternalRuntime | undefined {
    if (!instance || typeof instance !== "object") {
        return undefined;
    }
    return runtimeByInstance.get(instance);
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

    constructor() {
        this.listeners = [];
        this.instances = {};
        this.done = false;
    }

    addEventListener(_type: "done", listener: () => void): void {
        this.listeners.push(listener);
    }

    removeEventListener(_type: "done", listener: () => void): void {
        var index = this.listeners.indexOf(listener);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }
}



// #endregion



































// Define special events
export const InitialEvent = {
    kind: kinds.CompletionEvent,
    qualifiedName: "hsm_initial",
    name: "hsm_initial"
};

// AnyEvent is not used in this optimized version
// Wildcard events are not supported for performance reasons


export const FinalEvent = {
    name: 'hsm_final',
    kind: kinds.CompletionEvent
};


export const ErrorEvent = {
    name: 'hsm_error',
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

    len(): number {
        return this.front.length + (this.back.length - this.backHead);
    }

    pop(): EventRecord | undefined {
        var event: EventRecord | undefined;
        if (this.front.length > 0) {
            event = this.front.pop() as Event | undefined; // O(1) for completion events
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

    push(...events: EventRecord[]): void {
        for (var i = 0; i < events.length; i++) {
            var event = events[i];
            if (isKind(event.kind, kinds.CompletionEvent)) {
                this.front.push(event);
            } else {
                this.back.push(event);
            }
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

                            // Skip wildcard events - not supported
                            if (transitionEventName.indexOf('*') !== -1) {
                                continue;
                            }

                            // Regular event - add to lookup table
                        if (!transitionsByEvent[transitionEventName]) {
                                transitionsByEvent[transitionEventName] = [];
                            }
                            transitionsByEvent[transitionEventName].push({
                                transition,
                                priority: depth,
                            });
                        }
                    }
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
                        if (transitions && transitions.some(t => t.source === stateName)) {
                            continue;
                        }
                        // Only support exact event names for O(1) lookup
                        // Skip wildcard patterns for performance
                        if (deferredEvent.indexOf('*') === -1) {
                            model.deferredMap[stateName][deferredEvent] = true;
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


var EMPTY_PATH = {
    enter: [],
    exit: []
};


interface Instance {
    _hsm: HSM | null;
    dispatch(event: EventRecord): void;
    state(): string;
    context(): Context;
    clock(): Required<ClockConfig>;
    get(name: string): unknown;
    set(name: string, value: unknown): void;
    call(name: string, ...args: unknown[]): unknown;
    restart(data?: unknown): void;
    takeSnapshot(): Snapshot;
}

class InstanceImpl {
    dispatch(event: EventRecord): void {
        var runtime = runtimeFor(this);
        if (!runtime) {
            return;
        }
        runtime.dispatch(event);
    }

    state(): string {
        var runtime = runtimeFor(this);
        return runtime ? runtime.state() : "";
    }

    context(): Context {
        var runtime = runtimeFor(this);
        return runtime ? (runtime.context() as unknown as Context) : new Context();
    }

    clock(): Required<ClockConfig> {
        var runtime = runtimeFor(this);
        return runtime ? runtime.clock : (DefaultClock as Required<ClockConfig>);
    }

    get(name: string): unknown {
        var runtime = runtimeFor(this);
        return runtime ? runtime.get(name) : undefined;
    }

    set(name: string, value: unknown): void {
        var runtime = runtimeFor(this);
        if (runtime) {
            runtime.set(name, value);
        }
    }

    call(name: string, ...args: unknown[]): unknown {
        var runtime = runtimeFor(this);
        if (!runtime) {
            return undefined;
        }
        return runtime.call(name, ...args);
    }

    restart(data?: unknown): void {
        var runtime = runtimeFor(this);
        if (runtime) {
            runtime.restart(data);
        }
    }

    takeSnapshot(): Snapshot {
        var runtime = runtimeFor(this);
        return runtime
            ? runtime.takeSnapshot()
            : {
                  id: "",
                  qualifiedName: "",
                  state: "",
                  attributes: {},
                  queueLen: 0,
                  events: [],
              };
    }
}

type InstanceConstructor = {
    new (): Instance;
    (this: Instance): void;
    prototype: Instance;
};

export const Instance = (function (this: Instance) {
    if (this && typeof this === "object") {
        (this as Instance)._hsm = null;
    }
}) as InstanceConstructor;

(Instance.prototype as unknown as InstanceImpl) = InstanceImpl.prototype;

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
    private historyShallow: Record<string, string>;
    private historyDeep: Record<string, string>;
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

        const id = ((maybeConfig ? maybeConfig.id : "") || HSM.id++).toString();
        const name =
            (maybeConfig ? maybeConfig.name : "") || (maybeModelOrConfig as Model).qualifiedName;

        this.instance = instanceOrModel as Instance;
        this.ctx = ctxOrInstance as Context;
        this.model = maybeModelOrConfig as Model;
        this.currentState = this.model;
        this.queue = new Queue();
        this.active = {};
        this.processing = false;
        this.id = id;
        this.name = name;
        this.attributes = {};
        this.historyShallow = {};
        this.historyDeep = {};
        this.after = {
            entered: {},
            exited: {},
            processed: {},
            dispatched: {},
            executed: {},
        };
        this.clock = {
            setTimeout: maybeConfig?.clock?.setTimeout || DefaultClock.setTimeout,
            clearTimeout: maybeConfig?.clock?.clearTimeout || DefaultClock.clearTimeout,
            now: (maybeConfig?.clock?.now) || DefaultClock.now,
        };
        this.startData = maybeConfig ? maybeConfig.data : undefined;

        this.runtime = {
            dispatch: (event) => {
                this.dispatch(event);
            },
            state: () => {
                return this.state();
            },
            context: () => {
                return this.ctx as unknown as ActiveContext;
            },
            clock: this.clock,
            get: (name) => {
                return this.get(name);
            },
            set: (name, value) => {
                this.set(name, value);
            },
            invoke: (name, ctx, args) => {
                return this.invoke(name, ctx, args);
            },
            call: (name, ...args) => {
                return this.call(name, ...args);
            },
            restart: (data) => {
                this.restart(data);
            },
            takeSnapshot: () => {
                return this.takeSnapshot();
            },
            onAfter: (bucket, key, listener) => {
                this.onAfter(bucket, key, listener);
            },
            stop: () => {
                this.stop();
            },
            id: this.id,
            model: this.model,
            name: this.name,
            queue: this.queue,
            processing: this.processing,
        };
    }

    start(): this {
        this.processing = true;
        this.ctx.done = false;
        bindRuntime(this.instance, this.runtime);
        this.resetAttributes();

        var initialEvent = Object.create(InitialEvent);
        initialEvent.data = this.startData;
        var newState = this.enter(this.model, initialEvent, true);
        this.ctx.instances[this.id] = this.instance;
        this.currentState = newState;
        this.process();
        return this;
    }

    state(): string {
        return this.currentState ? this.currentState.qualifiedName : "";
    }

    private resetAttributes(): void {
        this.attributes = {};
        if (!this.model.attributes) {
            return;
        }
        for (var qualifiedName in this.model.attributes) {
            var attribute = this.model.attributes[qualifiedName];
            if (attribute && attribute.hasDefault) {
                this.attributes[qualifiedName] = attribute.defaultValue;
            }
        }
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

    onAfter(bucket: AfterBucket, key: string, listener: () => void): void {
        if (!this.after[bucket][key]) {
            this.after[bucket][key] = [];
        }
        this.after[bucket][key].push(listener);
    }

    private get(name: string): unknown {
        return this.attributes[qualifyModelName(this.model, name)];
    }

    private set(name: string, value: unknown): void {
        var qualifiedName = qualifyModelName(this.model, name);
        var hadValue = Object.prototype.hasOwnProperty.call(this.attributes, qualifiedName);
        var old = this.attributes[qualifiedName];
        this.attributes[qualifiedName] = value;
        if (hadValue && old === value) {
            return;
        }
        var event = {
            kind: kinds.ChangeEvent,
            name: qualifiedName,
            source: qualifiedName,
            data: {
                name: qualifiedName,
                old: old,
                new: value,
            },
        };
        this.dispatch(event);
    }

    private call(name: string, ...args: unknown[]): unknown {
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
        this.dispatch(event);
        return this.invoke(name, this.ctx, argsList);
    }

    private invoke(name: string, ctx: Context, args: Array<unknown>): unknown {
        var qualifiedName = qualifyModelName(this.model, name);
        var operation = this.model.operations && this.model.operations[qualifiedName];
        if (!operation) {
            throw new Error('missing operation "' + qualifiedName + '"');
        }
        var fn = operation.implementation;
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
            if (
                fn.length === candidate.length ||
                (fn.length <= candidate.length && fn.length >= 0)
            ) {
                return fn.apply(this.instance, candidate);
            }
        }
        return fn.apply(this.instance, args as Array<unknown>);
    }

    restart(data?: unknown): void {
        this.stop();
        this.startData = data;
        this.ctx.done = false;
        this.currentState = this.model;
        this.start();
    }

    private takeSnapshot(): Snapshot {
        var events: Snapshot["events"] = [];
        var currentStateName = this.currentState
            ? this.currentState.qualifiedName
            : this.model.qualifiedName;
        var transitionsByEvent: Record<string, Array<Transition>> =
            this.model.transitionMap[currentStateName] || {};
        for (var eventName in transitionsByEvent) {
            var transitionList = transitionsByEvent[eventName];
            for (var i = 0; i < transitionList.length; i++) {
                events.push({
                    event: eventName,
                    target: transitionList[i].target,
                    guard: !!transitionList[i].guard,
                    schema: this.model.events[eventName]
                        ? this.model.events[eventName].schema
                        : undefined,
                });
            }
        }
        return {
            id: this.id,
            qualifiedName: this.model.qualifiedName,
            state: currentStateName,
            attributes: Object.assign({}, this.attributes),
            queueLen: this.queue.len(),
            events: events,
        };
    }

    private recordHistory(stateName: string | undefined): void {
        if (!stateName) {
            return;
        }
        var child = stateName;
        var parent = dirname(child);
        while (parent && parent !== "." && parent !== "/") {
            var element = this.model.members[parent];
            if (element && isKind(element.kind, kinds.State)) {
                this.historyDeep[parent] = stateName;
                this.historyShallow[parent] = child;
            }
            if (parent === this.model.qualifiedName) {
                break;
            }
            child = parent;
            parent = dirname(parent);
        }
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
	                if (guard && !guard.expression(this.ctx, this.instance, event)) {
	                    continue;
	                }
	            }
	            return this.transition(vertex, transitionCandidate, event);
	        }
	        return undefined;
	    }

    dispatch(event: EventRecord): void {
        if (!event.kind) {
            event.kind = kinds.Event;
        }
        this.queue.push(event);
        this.notify("dispatched", event.name);

        if (this.processing) {
            return;
        }
        if (
            this.currentState.qualifiedName === this.model.qualifiedName &&
            this.ctx.done
        ) {
            return;
        }
        this.processing = true;
        this.process();
    }

    private process(): void {
        var deferred = new Array(this.queue.len() + 1);
        var deferredCount = 0;
        var event = this.queue.pop();

        while (event) {
            var currentStateName = this.currentState.qualifiedName;
            var eventName = event.name;
            var deferredLookup = this.model.deferredMap[currentStateName];
            var isDeferred = deferredLookup && deferredLookup[eventName] === true;

            if (isDeferred) {
                deferred[deferredCount++] = event;
                event = this.queue.pop();
                continue;
            }

                    var transitions = this.model.transitionMap[currentStateName][eventName];
                    if (transitions && transitions.length > 0) {
                        for (var i = 0; i < transitions.length; i++) {
                            var transition = transitions[i];
                            if (transition.guard) {
                                var guard = getConstraint(this.model, transition.guard);
                                if (guard) {
                                    try {
                                        var guardResult = guard.expression(
                                            this.ctx,
                                            this.instance,
                                    event,
                                );
                                if (!guardResult) {
                                    continue;
                                }
                            } catch (error) {
                                this.dispatch(
                                    Object.create(ErrorEvent, {
                                        data: { value: error },
                                    }),
                                );
                                continue;
                            }
                        }
                    }
                    var nextState = this.transition(this.currentState, transition, event);
                    if (nextState.qualifiedName !== this.currentState.qualifiedName) {
                        this.currentState = nextState;
                        for (var j = 0; j < deferredCount; j++) {
                            this.queue.push(deferred[j]);
                        }
                        deferredCount = 0;
                    }
                    break;
                }
            }

            this.notify("processed", event.name);
            event = this.queue.pop();
        }

        for (var i = 0; i < deferredCount; i++) {
            this.queue.push(deferred[i]);
        }

        this.processing = false;
        this.notify("processed", "__next__");
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
                    entering.qualifiedName === transition.target &&
                    transition.kind !== kinds.Self;
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
            this.recordHistory(state.qualifiedName);

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
                    if (guard && guard.expression(this.ctx, this.instance, event)) {
                        chosenTransition = choiceTransition;
                        break;
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
            var isShallowHistory = isKind(vertex.kind, kinds.ShallowHistory);
            var resolved = isShallowHistory
                ? this.historyShallow[parent]
                : this.historyDeep[parent];
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

            var enterPath: string[] = [];
            var currentPath = resolved;
            while (currentPath && currentPath !== parent && currentPath !== ".") {
                enterPath.unshift(currentPath);
                currentPath = dirname(currentPath);
            }
            var currentVertex = vertex;
            for (var i = 0; i < enterPath.length; i++) {
                var entering = getVertex(this.model, enterPath[i]);
                if (!entering) {
                    break;
                }
                currentVertex = this.enter(
                    entering,
                    event,
                    isShallowHistory && i === enterPath.length - 1,
                );
            }
            return currentVertex;
        }

        if (isKind(vertex.kind, kinds.FinalState)) {
            this.notify("entered", vertex.qualifiedName);
            if (dirname(vertex.qualifiedName) === this.model.qualifiedName) {
                this.stop();
            }
            return vertex;
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
                self.invoke(behavior.operationName, ctx, [evt]);
            };
        }
        if (!operation) {
            return;
        }
        if (isKind(behavior.kind, kinds.Concurrent)) {
            var controller = new Context();
            try {
                var asyncOperationPromise = Promise.resolve(
                    operation(controller, this.instance, event),
                );
                this.active[behavior.qualifiedName] = {
                    context: controller,
                    promise: asyncOperationPromise.catch(function (error) {
                        self.dispatch(
                            Object.create(ErrorEvent, {
                                data: { value: error },
                            }),
                        );
                    }).then(function () {
                        self.notify("executed", behavior.qualifiedName);
                        self.notify(
                            "executed",
                            behavior.Owner ? behavior.Owner() : dirname(behavior.qualifiedName),
                        );
                    }),
                };
            } catch (err) {
                error = err;
            }
        } else {
            try {
                operation(this.ctx, this.instance, event);
                this.notify("executed", behavior.qualifiedName);
                this.notify("executed", dirname(behavior.qualifiedName));
            } catch (err) {
                error = err;
            }
        }
        if (error) {
            this.dispatch(
                Object.create(ErrorEvent, {
                    data: { value: error },
                }),
            );
        }
    }

    private terminate(activity: Behavior): void {
        var active = this.active[activity.qualifiedName];
        if (active) {
            active.context.done = true;
            for (var i = 0; i < active.context.listeners.length; i++) {
                active.context.listeners[i]();
            }
            delete this.active[activity.qualifiedName];
        }
    }

    stop(): void {
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
        this.ctx.done = true;
        for (var i = 0; i < this.ctx.listeners.length; i++) {
            this.ctx.listeners[i]();
        }
        delete this.ctx.instances[this.id];
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
    sm.start();
    return runtimeInstance as MachineInstanceFor<
        TypedModel<any, any, any, any, any, any, any, Instance>,
        Instance
    >;
}


export function stop(instance: Instance): void {
    var runtime = runtimeFor(instance);
    if (runtime) {
        runtime.stop();
    }
}



export function state<
    Name extends string,
    const Parts extends readonly ModelElementSpec[] = readonly ModelElementSpec[],
>(
    name: Name,
    ...partials: BuilderTuple<ValidateStateLocalSpecs<Parts>>
) {
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

            model.members[stateObj.qualifiedName] = stateObj;
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

            model.members[initialName] = initialObj;
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

        var name = 'transition_' + Object.keys(model.members).length;

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

        model.members[transitionObj.qualifiedName] = transitionObj;
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

        // Determine transition kind and compute paths after all elements are processed
        model.partials.push(function () {
            if (transitionObj.target === transitionObj.source) {
                transitionObj.kind = kinds.Self;
            } else if (!transitionObj.target) {
                transitionObj.kind = kinds.Internal;
            } else if (isAncestor(transitionObj.source, transitionObj.target)) {
                transitionObj.kind = kinds.Local;
            } else {
                transitionObj.kind = kinds.External;
            }

            // Compute paths
            var lcaPath = lca(transitionObj.source, transitionObj.target);
            var enter =
 ([]);
            if (transitionObj.kind === kinds.Self) {
                enter.push(sourceElement.qualifiedName);
            } else {
                var entering = transitionObj.target;
                while (entering && entering !== lcaPath && entering !== '/') {
                    enter.unshift(entering);
                    entering = dirname(entering);
                }
            }

            if (sourceElement.kind === kinds.Initial) {
                transitionObj.paths[dirname(sourceElement.qualifiedName)] = {
                    enter: enter,
                    exit: [sourceElement.qualifiedName]
                };
                return transitionObj;
            }

            // Add another partial to compute all other exit paths after all elements are defined
            model.partials.push(function () {
                if (transitionObj.kind === kinds.Internal) {
                    // Internal transitions do not involve exiting/entering other states
                    return;
                }
                for (var qualifiedName in model.members) {
                    var element = getVertex(model, qualifiedName);
                    if (!element) {
                        continue;
                    }
                    if (
                        transitionObj.source !== qualifiedName &&
                        !isAncestor(transitionObj.source, qualifiedName)
                    ) {
                        continue;
                    }
                    var exit =
 ([]);
                    var exiting =
 (element.qualifiedName);
                    while (exiting !== lcaPath && exiting) {
                        exit.push(exiting);
                        exiting = dirname(exiting);
                        if (exiting === '/') {
                            break;
                        }
                    }
                    transitionObj.paths[element.qualifiedName] = {
                        enter: enter,
                        exit: exit
                    };
                }
            });
        });
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
            } else if (!isAncestor(model.qualifiedName, resolvedName)) {
                resolvedName = join(model.qualifiedName, resolvedName.slice(1));
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
                // Look for the nearest namespace (state or model) in the stack for path resolution
                var ancestor = findState(stack) || findModel(stack);
                if (ancestor) {
                    resolvedName = join(ancestor.qualifiedName, resolvedName);
                }
            } else if (!isAncestor(model.qualifiedName, resolvedName)) {
                resolvedName = join(model.qualifiedName, resolvedName.slice(1));
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
                model.attributes[qualifiedName] = {
                    name: name,
                    qualifiedName: qualifiedName,
                    hasDefault: false
                };
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
            model.partials.push(function () {
                if (!model.operations[qualifiedName]) {
                    throw new Error('missing operation "' + qualifiedName + '" for OnCall()');
                }
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
        var eventName = join(transition.qualifiedName, 'when_' + Object.keys(model.members).length);
        var event = {
            kind: kinds.TimeEvent,
            name: eventName
        };
        transition.events.push(eventName);
        registerEvent(model, event);
        model.partials.push(function () {
            var source = getState(model, transition.source);
            if (!source) {
                return;
            }
            pushBehaviors(
                join(source.qualifiedName, 'activity_when_' + source.activities.length),
                kinds.Concurrent,
                source.activities,
                model,
                [function (ctx, instance, evt) {
                    var signal = expr(ctx, instance, evt);
                    var signalLike = toSignalLike(signal);
                    if (!signalLike) {
                        return;
                    }
                    return new Promise<void>(function (resolve) {
                        var once = function () {
                            if (!ctx.done) {
                                instance.dispatch(event);
                            }
                            resolve();
                        };
                        if (hasThen(signalLike)) {
                            signalLike.then(once);
                        } else if (hasAddEventListener(signalLike)) {
                            signalLike.addEventListener("done", once);
                        } else if (hasOn(signalLike)) {
                            signalLike.on("ready", once);
                            signalLike.on("done", once);
                        }
                        ctx.addEventListener('done', resolve);
                    });
                }]
            );
        });
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
        var behavior = {
            qualifiedName: qualifiedName,
            kind: kind,
            operation: typeof operation === 'function' ? operation : null,
            operationName: typeof operation === 'string' ? qualifyModelName(model, operation) : undefined
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


export function attribute<Name extends string, Value = unknown>(
    name: Name,
    maybeDefault?: Value,
): BuilderWithSpec<(model: Model) => unknown, AttributeSpec<Name, Value>> {
    var hasDefault = arguments.length > 1;
    return attachSpec(
        function (model: Model): unknown {
            var qualifiedName = qualifyModelName(model, name);
            model.attributes[qualifiedName] = {
                name: name,
                qualifiedName: qualifiedName,
                hasDefault: hasDefault,
                defaultValue: maybeDefault
            };
            return undefined;
        },
        {
            kind: 'attribute',
            name,
            value: maybeDefault as Value,
        } as AttributeSpec<Name, Value>,
    );
}


export function operation<
    Name extends string,
    Fn extends Function,
>(
    name: Name,
    implementation: Fn,
): BuilderWithSpec<
    (model: Model) => unknown,
    OperationSpec<Name, Extract<Fn, (...args: any[]) => any>>
> {
    return attachSpec(
        function (model: Model): unknown {
            var qualifiedName = qualifyModelName(model, name);
            model.operations[qualifiedName] = {
                name: name,
                qualifiedName: qualifiedName,
                implementation: implementation as Extract<Fn, (...args: any[]) => any>
            };
            return undefined;
        },
        {
            kind: 'operation',
            name,
            impl: implementation as Extract<Fn, (...args: any[]) => any>,
        } as OperationSpec<Name, Extract<Fn, (...args: any[]) => any>>,
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

        var eventName = join(transition.qualifiedName, 'after_' + Object.keys(model.members).length);

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
                            ? coerceDuration(instance.get(duration))
                            : duration(ctx, instance, evt);
                        return withThenable(delay, function (value) {
                            if (ctx.done) {
                                return;
                            }
                            var coerceDelay = coerceDuration(value);
                            if (coerceDelay <= 0) {
                                return;
                            }
                            return new Promise<void>(function (resolve) {
                                var timeout = runtime.clock.setTimeout(function () {
                                    // Dispatch timer event asynchronously to avoid blocking the main thread
                                    instance.dispatch(event);
                                    resolve(); // Resolve the activity's promise after dispatch
                                }, coerceDelay);

                            ctx.addEventListener('done', function () {
                                runtime.clock.clearTimeout(timeout);
                                resolve(); // Resolve if aborted
                            });
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

        var eventName = join(transition.qualifiedName, 'every_' + Object.keys(model.members).length);

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
                        var interval = typeof duration === 'string'
                            ? coerceDuration(instance.get(duration))
                            : duration(ctx, instance, evt);
                        return withThenable(interval, function (value) {
                            if (ctx.done) {
                                return;
                            }
                            var coerceInterval = coerceDuration(value);
                            if (coerceInterval <= 0) {
                                return;
                            }
                            return new Promise<void>(function (resolve) {
                                var timeout = runtime.clock.setTimeout(function tick() {
                                    if (ctx.done) {
                                        runtime.clock.clearTimeout(timeout);
                                        resolve();
                                        return;
                                    }
                                    instance.dispatch(event);
                                    timeout = runtime.clock.setTimeout(tick, coerceInterval);
                                }, coerceInterval);
                                ctx.addEventListener('done', function () {
                                    runtime.clock.clearTimeout(timeout);
                                    resolve(); // Resolve if aborted
                                });
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
        var eventName = join(transition.qualifiedName, 'at_' + Object.keys(model.members).length);
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
                        ? coerceTimepoint(instance.get(timepoint))
                        : timepoint(ctx, instance, evt);
                    return withThenable(timepointValue, function (value) {
                        if (ctx.done) {
                            return;
                        }
                        var deadline = coerceTimepoint(value);
                        var delay = deadline - runtime.clock.now();
                        if (delay <= 0) {
                            instance.dispatch(event);
                            return;
                        }
                        return new Promise<void>(function (resolve) {
                            var timeout = runtime.clock.setTimeout(function () {
                                instance.dispatch(event);
                                resolve();
                            }, delay);
                            ctx.addEventListener('done', function () {
                                runtime.clock.clearTimeout(timeout);
                                resolve();
                            });
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

            model.members[qualifiedName] = finalState;

            return finalState;
        },
        {
            kind: 'final',
            name,
        } as FinalSpec<Name>,
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
    } else if (typeof elementOrName === 'function') {
        partials.unshift(elementOrName);
    }
    return function (model: Model, stack: AnyModelElement[]) {
        var owner = findState(stack);
        if (!owner) {
            return undefined;
        }
        if (!name) {
            name = 'shallow_history_' + Object.keys(model.members).length;
        }
        var qualifiedName = join(owner.qualifiedName, name);
        var history = {
            qualifiedName: qualifiedName,
            kind: kinds.ShallowHistory,
            transitions: []
        };
        model.members[qualifiedName] = history;
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
    } else if (typeof elementOrName === 'function') {
        partials.unshift(elementOrName);
    }
    return function (model: Model, stack: AnyModelElement[]) {
        var owner = findState(stack);
        if (!owner) {
            return undefined;
        }
        if (!name) {
            name = 'deep_history_' + Object.keys(model.members).length;
        }
        var qualifiedName = join(owner.qualifiedName, name);
        var history = {
            qualifiedName: qualifiedName,
            kind: kinds.DeepHistory,
            transitions: []
        };
        model.members[qualifiedName] = history;
        stack.push(history);
        apply(model, stack, partials);
        stack.pop();
        return history;
    };
}


export function choice(elementOrName: string | ((...args: unknown[]) => unknown)) {

    var partials = slice(arguments, 1);
    var name = '';

    // If first argument is a string, it's the name of the choice pseudostate
    if (typeof elementOrName === 'string') {
        name = elementOrName;
    } else if (typeof elementOrName === 'function') {
        // If it's a partial function, add it to the beginning of partials
        partials.unshift(elementOrName);
    }

    return function (model: Model, stack: AnyModelElement[]) {
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
            name = "choice_" + Object.keys(model.members).length;
        }

        var qualifiedName = join(owner.qualifiedName, name);

        var choice = {
            qualifiedName: qualifiedName,
            kind: kinds.Choice,
            transitions: [],
        };
        model.members[qualifiedName] = choice;
        stack.push(choice);
        apply(model, stack, partials);
        stack.pop();

        return choice;
    };
}


export function dispatchAll(ctx: Context, event: EventRecord): void {
    for (var id in ctx.instances) {
        var instance = ctx.instances[id];
        instance.dispatch(event);
    }
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
        deferredMap: {} as Record<Path, Record<string, boolean>>,
        events: {},
        attributes: {},
        operations: {},
        partials: [] as Array<(model: Model, stack: AnyModelElement[]) => void>,
    };
    model.members[model.qualifiedName] = model;
    registerEvent(model, InitialEvent);
    registerEvent(model, FinalEvent);
    registerEvent(model, ErrorEvent);
    var stack = [model];

    // Apply partials
    apply(model, stack, partials);

    // Process regular partials first
    while (model.partials.length > 0) {
        var currentPartials = model.partials.slice(); // Copy array
        model.partials = [];
        for (var i = 0; i < currentPartials.length; i++) {
            currentPartials[i](model, stack);
        }
    }

    // Build the optimized transition table
    buildTransitionTable(model);

    // Build the deferred event lookup table
    buildDeferredTable(model);

    return model;
}


export function dispatchTo(
    ctx: Context,
    event: EventRecord,
    ...ids: string[]
): void {
    if (!ids.length) {
        return dispatchAll(ctx, event);
    }
    for (var i = 0; i < ids.length; i++) {
        var instance = ctx.instances[ids[i]];
        if (instance) {
            instance.dispatch(event);
        }
    }
}

export function get(
    ctxOrInstance: Context | Instance,
    maybeInstanceOrName: Instance | string,
    maybeName?: string,
) {
    var instance = ctxOrInstance instanceof Context
        ? maybeInstanceOrName
        : ctxOrInstance;
    var name = ctxOrInstance instanceof Context
        ? maybeName
        : (maybeInstanceOrName as string);
    if (ctxOrInstance instanceof Context && typeof maybeName !== "string") {
        return undefined;
    }
    if (!name) {
        return undefined;
    }
    if (!instance) {
        return undefined;
    }
    var runtime = runtimeFor(instance);
    return runtime ? runtime.get(name) : undefined;
}

export function set(
    ctxOrInstance: Context | Instance,
    maybeInstanceOrName: Instance | string,
    maybeNameOrValue: unknown,
    maybeValue?: unknown,
) {
    var instance = ctxOrInstance instanceof Context
        ? maybeInstanceOrName
        : ctxOrInstance;
    var name = ctxOrInstance instanceof Context
        ? (maybeNameOrValue as string)
        : (maybeInstanceOrName as string);
    var value = ctxOrInstance instanceof Context ? maybeValue : maybeNameOrValue;
    if (!instance) {
        return;
    }
    var runtime = runtimeFor(instance);
    if (runtime) {
        runtime.set(name, value);
    }
}

export function call(
    ctxOrInstance: Context | Instance,
    maybeInstanceOrName: Instance | string,
    maybeName: string,
    ...args: unknown[]
) {
    var instance = ctxOrInstance instanceof Context
        ? maybeInstanceOrName
        : ctxOrInstance;
    var name = ctxOrInstance instanceof Context
        ? maybeName
        : (maybeInstanceOrName as string);
    if (!instance) {
        return undefined;
    }
    var callArgs = slice(arguments, ctxOrInstance instanceof Context ? 3 : 2);
    var runtime = runtimeFor(instance);
    if (runtime) {
        return runtime.call(name, ...callArgs);
    }
}

export function restart(instance: Instance, data: unknown): void {
    var runtime = runtimeFor(instance);
    if (runtime) {
        runtime.restart(data);
    }
}

export function takeSnapshot(ctxOrInstance: Context | Instance, maybeInstance?: Instance): Snapshot {
    var instance = ctxOrInstance instanceof Context ? maybeInstance : ctxOrInstance;
    var runtime = runtimeFor(instance);
    return runtime
        ? runtime.takeSnapshot()
        : {
            id: '',
            qualifiedName: '',
            state: '',
            attributes: {},
            queueLen: 0,
            events: []
        };
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
            runtime.onAfter('processed', maybeEvent.name, function () {
                resolve();
            });
            return;
        }
        if (!runtime.processing) {
            resolve();
            return;
        }
        runtime.onAfter('processed', '__next__', function () {
            resolve();
        });
    });
}

export function afterDispatch(ctx: Context, instance: Instance, event: EventRecord): Promise<void> {
    return new Promise<void>(function (resolve) {
        var runtime = runtimeFor(instance);
        if (!runtime) {
            resolve();
            return;
        }
        runtime.onAfter('dispatched', event.name, function () {
            resolve();
        });
    });
}

export function afterEntry(
    ctx: Context,
    instance: Instance,
    stateName: string,
): Promise<void> {
    return new Promise<void>(function (resolve) {
        var runtime = runtimeFor(instance);
        if (!runtime) {
            resolve();
            return;
        }
        runtime.onAfter('entered', stateName, function () {
            resolve();
        });
    });
}

export function afterExit(
    ctx: Context,
    instance: Instance,
    stateName: string,
): Promise<void> {
    return new Promise<void>(function (resolve) {
        var runtime = runtimeFor(instance);
        if (!runtime) {
            resolve();
            return;
        }
        runtime.onAfter('exited', stateName, function () {
            resolve();
        });
    });
}

export function afterExecuted(
    ctx: Context,
    instance: Instance,
    stateOrBehavior: string,
): Promise<void> {
    return new Promise<void>(function (resolve) {
        var runtime = runtimeFor(instance);
        if (!runtime) {
            resolve();
            return;
        }
        runtime.onAfter('executed', stateOrBehavior, function () {
            resolve();
        });
    });
}

export function id(instance) {
    var runtime = runtimeFor(instance);
    return runtime ? runtime.id : '';
}

export function qualifiedName(instance) {
    var runtime = runtimeFor(instance);
    return runtime ? runtime.model.qualifiedName : '';
}

export function name(instance) {
    var runtime = runtimeFor(instance);
    return runtime ? runtime.name : '';
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
    readonly __hsm_group_members?: Members;

    constructor(...instances: unknown[]) {
        for (var i = 0; i < instances.length; i++) {
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

    dispatch(event: GroupEventUnion<Members>): void {
        for (var i = 0; i < this.instances.length; i++) {
            this.instances[i].dispatch(event);
        }
    }

    set<K extends SharedAttributeKeysOfGroupMembers<Members>>(
        name: K,
        value: SharedAttributeValueOfGroupMembers<Members, K>,
    ): void {
        for (var i = 0; i < this.instances.length; i++) {
            this.instances[i].set(name, value);
        }
    }

    call<K extends GroupOperationKeys<Members>>(
        name: K,
        ...args: Parameters<GroupOperationSignature<Members, K>>
    ): ReturnType<GroupOperationSignature<Members, K>> {
        if (!this.instances.length) {
            return undefined as ReturnType<GroupOperationSignature<Members, K>>;
        }
        return this.instances[0].call(name, ...args) as ReturnType<GroupOperationSignature<Members, K>>;
    }

    stop(): void {
        for (var i = 0; i < this.instances.length; i++) {
            stop(this.instances[i]);
        }
    }

    restart(data?: unknown): void {
        for (var i = 0; i < this.instances.length; i++) {
            restart(this.instances[i], data);
        }
    }

    takeSnapshot(): GroupSnapshotOf<Members> {
        var members: Snapshot[] = [];
        var queueLen = 0;
        var events: Snapshot['events'] = [];
        var ids: string[] = [];
        var qualifiedNames: string[] = [];
        var states: string[] = [];
        for (var i = 0; i < this.instances.length; i++) {
            var snapshot = this.instances[i].takeSnapshot();
            members.push(snapshot);
            queueLen += snapshot.queueLen;
            ids.push(snapshot.id);
            qualifiedNames.push(snapshot.qualifiedName);
            states.push(snapshot.state);
            for (var j = 0; j < snapshot.events.length; j++) {
                events.push(snapshot.events[j]);
            }
        }
        return {
            id: ids.join(','),
            qualifiedName: qualifiedNames.join(','),
            state: states.join(' | '),
            attributes: {},
            queueLen,
            events,
            members: members as GroupSnapshotsOfFlattenedMembers<FlattenGroupMembers<Members>>,
        };
    }

    clock(): ClockConfig {
        return DefaultClock;
    }
}

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
export const StateKind = kinds.State;
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
export const FinalStateKind = kinds.FinalState;
export const ChoiceKind = kinds.Choice;
export const JunctionKind = kinds.Junction;
export const DeepHistoryKind = kinds.DeepHistory;
export const ShallowHistoryKind = kinds.ShallowHistory;
export const Define = define;
export const State = state;
export const Final = final;
export const ShallowHistory = shallowHistory;
export const DeepHistory = deepHistory;
export const Choice = choice;
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
export const Guard = guard;
export const Defer = defer;
export const Attribute = attribute;
export const Operation = operation;
export const DispatchAll = dispatchAll;
export const DispatchTo = dispatchTo;
export const Get = get;
export const Set = set;
export const Call = call;
export const Restart = restart;
export const TakeSnapshot = takeSnapshot;
export const MakeGroup = makeGroup;
export const LCA = lca;
export const IsAncestor = isAncestor;
export const ID = id;
export const QualifiedName = qualifiedName;
export const Name = name;
export const Clock = clock;
export { apply, find };
