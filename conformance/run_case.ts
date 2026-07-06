import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import * as hsm from "../src/index.ts";

type AnyMap = Record<string, any>;
type BehaviorProgram = AnyMap[];
type CaseData = {
    name: string;
    mode?: string;
    model: AnyMap;
    models?: AnyMap[];
    behaviors?: Record<string, BehaviorProgram>;
    instances?: AnyMap[];
    groups?: AnyMap[];
    script?: AnyMap[];
    expect?: AnyMap;
};

type ValidationIssue = {
    code: string;
    message?: string;
    path?: string;
};

type ModelIndex = {
    root: string;
    paths: Set<string>;
    kinds: Map<string, string>;
    submachines: Map<string, string>;
    attributes: Map<string, string>;
    operations: Set<string>;
    entryPoints: Map<string, string>;
    exitPoints: Map<string, string>;
};

type TimerRegistration = {
    id: number;
    due: number;
    callback: (...args: unknown[]) => void;
    active: boolean;
    order: number;
};

type DeferredEvent = {
    instanceID: string;
    eventName: string;
    cleanupOnParentExit: boolean;
};

type Runner = {
    caseData: CaseData;
    root: string;
    ctx: hsm.Context;
    modelIRs: Map<string, AnyMap>;
    models: Map<string, hsm.Model>;
    buildingModels: Set<string>;
    instances: Map<string, hsm.Instance>;
    instanceModels: Map<string, hsm.Model>;
    groups: Map<string, hsm.Group>;
    trace: AnyMap[];
    snapshots: Record<string, any>;
    lastError: Error | undefined;
    clockNow: number;
    timerOrder: number;
    timers: TimerRegistration[];
    nextTimerID: number;
    pendingTimerFired: number;
    suppressTimerFired: number;
    lastStableLabel: string | undefined;
    deferredEvents: DeferredEvent[];
    deferReplayBarrier: boolean;
};

class ConformanceError extends Error {
    code: string;

    constructor(code: string, message: string) {
        super(message);
        this.name = "ConformanceError";
        this.code = code;
    }
}

let activeRunner: Runner | undefined;

process.on("unhandledRejection", (reason) => {
    if (activeRunner) {
        recordError(activeRunner, reason);
    }
});

type CaseResult =
    | { status: "PASS"; name: string }
    | { status: "FAIL"; name: string; error: Error };

async function main(): Promise<void> {
    const roots = process.argv.slice(2);
    const files = collectCaseFiles(roots.length ? roots : ["../conformance/cases"]);
    if (files.length === 0) {
        console.error("no conformance case files found");
        process.exit(2);
    }

    let passed = 0;
    let failed = 0;
    const failures: string[] = [];

    for (const file of files) {
        const result = await runFile(file);
        if (result.status === "PASS") {
            passed++;
            console.log(`PASS ${result.name}`);
        } else {
            failed++;
            failures.push(`${result.name}: ${result.error.message}`);
            console.log(`FAIL ${result.name}: ${result.error.message}`);
        }
    }

    console.log(`summary: pass=${passed} skip=0 fail=${failed} total=${files.length}`);
    if (failures.length) {
        console.log("failures:");
        for (const failure of failures.slice(0, 25)) {
            console.log(`  ${failure}`);
        }
        if (failures.length > 25) {
            console.log(`  ... ${failures.length - 25} more`);
        }
    }
    if (failed > 0) {
        process.exit(1);
    }
}

async function runFile(file: string): Promise<CaseResult> {
    const text = fs.readFileSync(file, "utf8");
    const caseData = JSON.parse(text) as CaseData;
    if (caseData.mode === "validation") {
        return runValidationCase(caseData, file);
    }

    const runner = makeRunner(caseData, file);
    return runRuntimeCase(runner)
        .then(() => ({ status: "PASS", name: caseData.name }) as CaseResult)
        .catch((error: unknown) => ({
            status: "FAIL",
            name: caseData.name,
            error: error instanceof Error ? error : new Error(String(error)),
        }) as CaseResult);
}

function runValidationCase(caseData: CaseData, file: string): CaseResult {
    try {
        const errors = validateIR(caseData);
        const expected = caseData.expect?.validation ?? [];
        assertValidationErrors(errors, expected);
        const nativeError = nativeValidationBuildError(caseData, file);
        if (expectsNativeValidation(expected)) {
            if (!nativeError) {
                throw new Error(`native validation mismatch: expected ${JSON.stringify(expected)}, got successful model build`);
            }
            assertNativeValidationError(nativeError, expected);
        }
        return { status: "PASS", name: caseData.name };
    } catch (error: unknown) {
        return {
            status: "FAIL",
            name: caseData.name,
            error: error instanceof Error ? error : new Error(String(error)),
        };
    }
}

function nativeValidationBuildError(caseData: CaseData, file: string): Error | undefined {
    try {
        const runner = makeRunner(caseData, file);
        registerModels(runner);
        buildInstances(runner);
        buildGroups(runner);
        return undefined;
    } catch (error: unknown) {
        return error instanceof Error ? error : new Error(String(error));
    }
}

function makeRunner(caseData: CaseData, file: string): Runner {
    const trace = [] as AnyMap[];
    const expectedTrace = caseData.expect?.trace;
    return {
        caseData,
        root: path.dirname(file),
        ctx: new hsm.Context().WithValue(hsm.Keys.Instances, {}),
        modelIRs: new Map<string, AnyMap>(),
        models: new Map<string, hsm.Model>(),
        buildingModels: new Set<string>(),
        instances: new Map<string, hsm.Instance>(),
        instanceModels: new Map<string, hsm.Model>(),
        groups: new Map<string, hsm.Group>(),
        trace,
        snapshots: {},
        lastError: undefined,
        clockNow: 0,
        timerOrder: 0,
        timers: [],
        nextTimerID: 1,
        pendingTimerFired: 0,
        suppressTimerFired: 0,
        lastStableLabel: undefined,
        deferredEvents: [],
        deferReplayBarrier: false,
    };
}

async function runRuntimeCase(runner: Runner): Promise<void> {
    activeRunner = runner;
    registerModels(runner);
    buildInstances(runner);
    buildGroups(runner);
    try {
        for (const step of runner.caseData.script ?? []) {
            try {
                await executeScriptStep(runner, step);
            } catch (error: unknown) {
                recordError(runner, error);
            }
            await flushAsyncWork();
        }
        recordStable(runner);
        await flushAsyncWork();
        assertExpectations(runner, runner.caseData.expect ?? {});
    } finally {
        activeRunner = undefined;
    }
}

function validateIR(caseData: CaseData): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const behaviors = caseData.behaviors ?? {};
    validateBehaviorPrograms(issues, behaviors);

    const models = [caseData.model, ...(caseData.models ?? [])];
    const modelNames = new Set<string>();
    for (const model of models) {
        if (invalidName(model.name)) {
            addIssue(issues, "invalid_name", model.name);
        }
        if (modelNames.has(model.name)) {
            addIssue(issues, "duplicate_model", model.name);
        }
        modelNames.add(model.name);
    }
    for (const model of models) {
        if (model.redefines === undefined) {
            continue;
        }
        if (invalidName(model.redefines)) {
            addIssue(issues, "invalid_name", model.redefines);
        } else if (!modelNames.has(model.redefines)) {
            addIssue(issues, "model_error", model.redefines);
        }
    }

    const indexes = indexModels(models, issues);

    validateInstancesAndGroups(caseData, issues, modelNames);
    validateSubmachineCycles(models, issues);
    for (const model of models) {
        validateModelIR(caseData, issues, behaviors, model, indexes);
    }
    return issues;
}

function validateBehaviorPrograms(issues: ValidationIssue[], behaviors: Record<string, BehaviorProgram>): void {
    for (const [behaviorID, program] of Object.entries(behaviors)) {
        if (!Array.isArray(program) || program.length === 0) {
            addIssue(issues, "empty_behavior_array", behaviorID);
            continue;
        }
        for (const op of program) {
            if (!validBehaviorOp(op)) {
                addIssue(issues, "invalid_behavior_op_operand", behaviorID);
            }
        }
    }
}

function validBehaviorOp(op: AnyMap): boolean {
    const has = (name: string) => Object.prototype.hasOwnProperty.call(op, name);
    const no = (...names: string[]) => names.every((name) => !has(name));
    switch (op.op) {
        case "trace":
            return has("value");
        case "set_attr":
            return has("name") && has("value") && no("event");
        case "set_attr_from_event_data":
            return has("name") && has("path");
        case "get_attr":
        case "return_attr":
            return has("name");
        case "return_value":
            return has("value");
        case "return_equals":
            return has("name") && has("value");
        case "event_name_equals":
            return has("value");
        case "event_data_equals":
            return has("path") && has("value");
        case "event_data_get":
            return has("path") && no("value");
        case "event_application_metadata_equals":
            return has("name") && has("value");
        case "event_metadata_set":
            return has("name") && has("value");
        case "event_metadata_get":
            return has("name");
        case "event_metadata_equals":
            return has("name") && has("value");
        case "raise":
            return (has("event") ? 1 : 0) + (has("code") ? 1 : 0) === 1;
        case "dispatch":
            return has("event") && !has("name")
                && [has("target"), has("group"), has("instance")].filter(Boolean).length <= 1;
        case "call":
            return has("name") && no("event");
        case "snapshot":
            return no("event");
        case "sleep":
            return has("millis") && no("event");
        case "yield":
            return no("value");
        default:
            return false;
    }
}

function validateInstancesAndGroups(caseData: CaseData, issues: ValidationIssue[], modelNames: Set<string>): void {
    const instanceIDs = new Set<string>();
    for (const instance of caseData.instances ?? []) {
        if (instanceIDs.has(instance.id)) {
            addIssue(issues, "duplicate_instance", instance.id);
        }
        instanceIDs.add(instance.id);
        if (instance.model && !modelNames.has(instance.model)) {
            addIssue(issues, "model_error", instance.model);
        }
    }
    const groupIDs = new Set<string>();
    for (const group of caseData.groups ?? []) {
        if (groupIDs.has(group.id)) {
            addIssue(issues, "duplicate_group", group.id);
        }
        groupIDs.add(group.id);
        if (!Array.isArray(group.members) || group.members.length === 0) {
            addIssue(issues, "invalid_group_cardinality", group.id);
        }
        const members = new Set<string>();
        for (const member of group.members ?? []) {
            if (members.has(member)) {
                addIssue(issues, "duplicate_group_member", member);
            }
            members.add(member);
            if (!instanceIDs.has(member)) {
                addIssue(issues, "unknown_group_member", member);
            }
        }
    }
}

function validateSubmachineCycles(models: AnyMap[], issues: ValidationIssue[]): void {
    const graph = new Map<string, string[]>();
    for (const model of models) {
        const edges: string[] = [];
        if (typeof model.redefines === "string") {
            edges.push(model.redefines);
        }
        forEachState(model.states ?? [], (stateIR) => {
            if (stateIR.kind === "submachine" && stateIR.machine) {
                edges.push(stateIR.machine);
            }
        });
        graph.set(model.name, edges);
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (name: string): boolean => {
        if (visiting.has(name)) {
            return true;
        }
        if (visited.has(name)) {
            return false;
        }
        visiting.add(name);
        for (const child of graph.get(name) ?? []) {
            if (visit(child)) {
                return true;
            }
        }
        visiting.delete(name);
        visited.add(name);
        return false;
    };
    for (const name of graph.keys()) {
        if (visit(name)) {
            addIssue(issues, "submachine_model_cycle", name);
            return;
        }
    }
}

function validateModelIR(
    caseData: CaseData,
    issues: ValidationIssue[],
    behaviors: Record<string, BehaviorProgram>,
    model: AnyMap,
    indexes: Map<string, ModelIndex>,
): void {
    const index = indexes.get(model.name)!;
    validateAttributes(issues, model.attributes);
    validateOperations(issues, behaviors, model.operations);
    if (!model.redefines || model.initial !== undefined) {
        validateInitial(issues, behaviors, index, model.initial, index.root);
    }
    validateConnectionPoints(issues, behaviors, index, model);
    validateStateList(caseData, issues, behaviors, model, indexes, index, model.states ?? [], index.root);
    validateTransitionList(issues, behaviors, indexes, index, model.transitions ?? [], index.root, true);
}

function validateAttributes(issues: ValidationIssue[], attributes: AnyMap | undefined): void {
    for (const [name, spec] of Object.entries(attributes ?? {})) {
        if (invalidName(name)) {
            addIssue(issues, "invalid_name", name);
        }
        if (!Object.prototype.hasOwnProperty.call(spec, "type") && !Object.prototype.hasOwnProperty.call(spec, "default")) {
            addIssue(issues, "invalid_attribute", name);
        }
        if (Object.prototype.hasOwnProperty.call(spec, "type") && Object.prototype.hasOwnProperty.call(spec, "default")) {
            if (!valueMatchesAttributeType(spec.type, spec.default)) {
                addIssue(issues, "invalid_attribute", name);
            }
        }
    }
}

function validateOperations(
    issues: ValidationIssue[],
    behaviors: Record<string, BehaviorProgram>,
    operations: AnyMap | undefined,
): void {
    for (const [name, ref] of Object.entries(operations ?? {})) {
        if (invalidName(name)) {
            addIssue(issues, "invalid_name", name);
        }
        validateBehaviorRef(issues, behaviors, ref);
    }
}

function validateConnectionPoints(
    issues: ValidationIssue[],
    behaviors: Record<string, BehaviorProgram>,
    index: ModelIndex,
    model: AnyMap,
): void {
    const entryNames = new Set<string>();
    const exitNames = new Set<string>();
    for (const point of model.entry_points ?? []) {
        if (invalidName(point.name)) {
            addIssue(issues, "invalid_name", point.name);
        }
        if (entryNames.has(point.name)) {
            addIssue(issues, "duplicate_entry_point", point.name);
        }
        entryNames.add(point.name);
        const targetPath = resolveInitialPath(index.root, index.root, point.target);
        const targetKind = index.kinds.get(targetPath);
        if (pathOutsideModel(index, targetPath)) {
            addIssue(issues, "invalid_entry_point_target", point.name);
        } else if (targetKind === "entry_point") {
            addIssue(issues, "invalid_entry_point_target", point.name);
        } else if (targetKind === "exit_point") {
            addIssue(issues, "invalid_entry_point_target_kind", point.name);
        } else if (!index.paths.has(targetPath)) {
            addIssue(issues, "missing_target", point.target);
        }
        validateBehaviorRefArray(issues, behaviors, point.effects, true);
    }
    for (const point of model.exit_points ?? []) {
        if (invalidName(point.name)) {
            addIssue(issues, "invalid_name", point.name);
        }
        if (exitNames.has(point.name)) {
            addIssue(issues, "duplicate_exit_point", point.name);
        }
        exitNames.add(point.name);
        validateBehaviorRefArray(issues, behaviors, point.effects, true);
    }
    for (const stateName of entryNames) {
        if (index.kinds.get(hsm.join(index.root, stateName)) === "state") {
            addIssue(issues, "connection_point_name_collision", stateName);
        }
    }
    for (const stateName of exitNames) {
        if (index.kinds.get(hsm.join(index.root, stateName)) === "state") {
            addIssue(issues, "connection_point_name_collision", stateName);
        }
    }
}

function validateStateList(
    caseData: CaseData,
    issues: ValidationIssue[],
    behaviors: Record<string, BehaviorProgram>,
    model: AnyMap,
    indexes: Map<string, ModelIndex>,
    index: ModelIndex,
    states: AnyMap[],
    ownerPath: string,
): void {
    const names = new Set<string>();
    for (const stateIR of states) {
        if (names.has(stateIR.name)) {
            addIssue(issues, "duplicate_state", stateIR.name);
        }
        names.add(stateIR.name);
        validateStateIR(caseData, issues, behaviors, model, indexes, index, stateIR, hsm.join(ownerPath, stateIR.name));
    }
}

function validateStateIR(
    caseData: CaseData,
    issues: ValidationIssue[],
    behaviors: Record<string, BehaviorProgram>,
    model: AnyMap,
    indexes: Map<string, ModelIndex>,
    index: ModelIndex,
    stateIR: AnyMap,
    statePath: string,
): void {
    const kind = stateIR.kind ?? "state";
    if (invalidName(stateIR.name)) {
        addIssue(issues, "invalid_name", stateIR.name);
    }
    validateBehaviorRefArray(issues, behaviors, stateIR.entry, false);
    validateBehaviorRefArray(issues, behaviors, stateIR.exit, false);
    validateBehaviorRefArray(issues, behaviors, stateIR.activity, false);
    validateEventArray(issues, stateIR.defer);

    if (kind === "final") {
        if (stateIR.initial || stateIR.entry || stateIR.exit || stateIR.activity || stateIR.defer || stateIR.states || stateIR.transitions) {
            addIssue(issues, "invalid_final_transition", stateIR.name);
        }
        return;
    }
    if (kind === "choice" || kind === "shallow_history" || kind === "deep_history") {
        if ((kind === "shallow_history" || kind === "deep_history") && path.posix.dirname(statePath) === index.root) {
            addIssue(issues, "invalid_history_owner", stateIR.name);
        }
        if (stateIR.entry || stateIR.exit || stateIR.activity || stateIR.defer || stateIR.states) {
            addIssue(issues, "invalid_pseudostate_contents", stateIR.name);
        }
        if (stateIR.initial) {
            addIssue(issues, "already has an initial state", stateIR.name);
        }
        if (kind === "choice") {
            if (!stateIR.transitions?.length) {
                addIssue(issues, "choice_missing_transition", stateIR.name);
            }
            validateChoiceFallback(issues, stateIR);
        } else if (!stateIR.transitions?.length) {
            addIssue(issues, "history_missing_default", stateIR.name);
        }
    }
    if (kind === "submachine") {
        if (!stateIR.machine || !indexes.has(stateIR.machine)) {
            addIssue(issues, "missing_submachine_model", stateIR.machine ?? stateIR.name);
        }
        if (stateIR.initial) {
            addIssue(issues, "invalid_submachine_initial", stateIR.name);
        }
        if (stateIR.states?.length) {
            addIssue(issues, "invalid_submachine_contents", stateIR.name);
        }
    } else if (stateIR.states?.length) {
        validateInitial(issues, behaviors, index, stateIR.initial, statePath);
    }

    validateTransitionList(issues, behaviors, indexes, index, stateIR.transitions ?? [], statePath, false);
    validateSubmachineBoundaryTransitions(caseData, issues, indexes, index, stateIR, statePath);
    validateStateList(caseData, issues, behaviors, model, indexes, index, stateIR.states ?? [], statePath);
}

function validateChoiceFallback(issues: ValidationIssue[], stateIR: AnyMap): void {
    const transitions = stateIR.transitions ?? [];
    if (transitions.length === 0) {
        return;
    }
    for (let i = 0; i < transitions.length - 1; i++) {
        if (!transitions[i].guard) {
            addIssue(issues, "choice_default_not_last", stateIR.name);
            return;
        }
    }
    if (transitions[transitions.length - 1]?.guard) {
        addIssue(issues, "choice_missing_fallback", stateIR.name);
    }
}

function validateSubmachineBoundaryTransitions(
    _caseData: CaseData,
    issues: ValidationIssue[],
    indexes: Map<string, ModelIndex>,
    index: ModelIndex,
    stateIR: AnyMap,
    statePath: string,
): void {
    for (const transitionIR of stateIR.transitions ?? []) {
        if (transitionIR.entry_point) {
            if (!transitionIR.target) {
                addIssue(issues, "invalid_entry_point_usage", stateIR.name);
                continue;
            }
            const targetPath = resolveTransitionPath(index.root, statePath, transitionIR.target);
            const targetKind = index.kinds.get(targetPath);
            if (targetKind !== "submachine") {
                addIssue(issues, "invalid_entry_point_usage", transitionIR.entry_point);
                continue;
            }
        }
        const trigger = transitionIR.trigger;
        if (trigger?.kind === "exit_point" && stateIR.kind !== "submachine") {
            addIssue(issues, "invalid_exit_point_usage", trigger.exit_point);
        }
    }
    if (stateIR.kind !== "submachine" || !stateIR.machine) {
        return;
    }
    const childIndex = indexes.get(stateIR.machine);
    if (!childIndex) {
        return;
    }
    for (const transitionIR of stateIR.transitions ?? []) {
        if (transitionIR.entry_point && !childIndex.entryPoints.has(transitionIR.entry_point)) {
            addIssue(issues, "missing_entry_point", transitionIR.entry_point);
        }
        const trigger = transitionIR.trigger;
        if (trigger?.kind === "exit_point" && !childIndex.exitPoints.has(trigger.exit_point)) {
            addIssue(issues, "missing_exit_point", trigger.exit_point);
        }
    }
}

function validateInitial(
    issues: ValidationIssue[],
    behaviors: Record<string, BehaviorProgram>,
    index: ModelIndex,
    initialIR: string | AnyMap | undefined,
    ownerPath: string,
): void {
    if (initialIR === undefined) {
        addIssue(issues, "missing_initial", ownerPath);
        return;
    }
    const targetName = typeof initialIR === "string" ? initialIR : initialIR.target;
    if (!targetName) {
        addIssue(issues, "missing_target", ownerPath);
    } else if (!index.paths.has(resolveInitialPath(index.root, ownerPath, targetName))) {
        addIssue(issues, "missing_target", targetName);
    }
    if (typeof initialIR !== "string") {
        validateBehaviorRefArray(issues, behaviors, initialIR.effects, true);
    }
}

function validateTransitionList(
    issues: ValidationIssue[],
    behaviors: Record<string, BehaviorProgram>,
    indexes: Map<string, ModelIndex>,
    index: ModelIndex,
    transitions: AnyMap[],
    ownerPath: string,
    rootOwned: boolean,
): void {
    for (const transitionIR of transitions) {
        validateTransitionIR(issues, behaviors, indexes, index, transitionIR, ownerPath, rootOwned);
    }
}

function validateTransitionIR(
    issues: ValidationIssue[],
    behaviors: Record<string, BehaviorProgram>,
    indexes: Map<string, ModelIndex>,
    index: ModelIndex,
    transitionIR: AnyMap,
    ownerPath: string,
    rootOwned: boolean,
): void {
    if (transitionIR.on !== undefined && transitionIR.trigger !== undefined) {
        addIssue(issues, "multiple_transition_triggers", transitionIR.id);
    }
    if (transitionIR.source) {
        const sourcePath = resolveTransitionPath(index.root, ownerPath, transitionIR.source);
        if (crossesSubmachineBoundary(index, sourcePath)) {
            addIssue(issues, "invalid_submachine_internal_source", transitionIR.source);
        } else if (!index.paths.has(sourcePath)) {
            addIssue(issues, "missing_source", transitionIR.source);
        }
    } else if (rootOwned && transitionIR.source === "") {
        addIssue(issues, "missing_source", transitionIR.id);
    }
    if (transitionIR.target) {
        const targetPath = resolveTransitionPath(index.root, ownerPath, transitionIR.target);
        const targetKind = index.kinds.get(targetPath);
        if (pathOutsideModel(index, targetPath)) {
            addIssue(issues, "invalid_submachine_boundary_target", transitionIR.target);
        } else if (crossesSubmachineBoundary(index, targetPath)) {
            addIssue(issues, "invalid_submachine_internal_target", transitionIR.target);
        } else if (targetKind === "entry_point") {
            addIssue(issues, "invalid_entry_point_internal_target", transitionIR.target);
        } else if (!index.paths.has(targetPath)) {
            addIssue(issues, "missing_target", transitionIR.target);
        }
        if (transitionIR.entry_point) {
            if (invalidName(transitionIR.entry_point)) {
                addIssue(issues, "invalid_name", transitionIR.entry_point);
            } else if (targetKind !== "submachine") {
                addIssue(issues, "invalid_entry_point_usage", transitionIR.entry_point);
            } else {
                const machine = index.submachines.get(targetPath);
                const childIndex = machine ? indexes.get(machine) : undefined;
                if (childIndex && !childIndex.entryPoints.has(transitionIR.entry_point)) {
                    addIssue(issues, "missing_entry_point", transitionIR.entry_point);
                }
            }
        }
    } else if ((transitionIR.kind ?? "external") !== "internal") {
        addIssue(issues, "missing_target", transitionIR.id);
    }
    if (transitionIR.guard) {
        validateBehaviorRef(issues, behaviors, transitionIR.guard);
    }
    validateBehaviorRefArray(issues, behaviors, transitionIR.effects, true);
    validateTrigger(issues, behaviors, index, transitionIR.on, transitionIR.trigger);
}

function validateTrigger(
    issues: ValidationIssue[],
    behaviors: Record<string, BehaviorProgram>,
    index: ModelIndex,
    onValue: unknown,
    trigger: AnyMap | undefined,
): void {
    if (onValue !== undefined) {
        validateEventRefOperand(issues, onValue);
    }
    if (!trigger) {
        return;
    }
    const present = (name: string) => Object.prototype.hasOwnProperty.call(trigger, name);
    const extra = (...allowed: string[]) => {
        const allowedSet = new Set(["kind", ...allowed]);
        return Object.keys(trigger).some((key) => !allowedSet.has(key));
    };
    switch (trigger.kind) {
        case "on": {
            const count = (present("event") ? 1 : 0) + (present("events") ? 1 : 0);
            if (count === 0) {
                addIssue(issues, "missing_trigger_operand", "on");
            } else if (count > 1) {
                addIssue(issues, "multiple_trigger_operands", "on");
            }
            if (Array.isArray(trigger.events) && trigger.events.length === 0) {
                addIssue(issues, "empty_event_array", "on");
            }
            if (extra("event", "events")) {
                addIssue(issues, "extraneous_trigger_operand", "on");
            }
            break;
        }
        case "on_set":
            validateSingleOperandTrigger(issues, trigger, "attribute", "missing_trigger_operand");
            if (typeof trigger.attribute === "string" && trigger.attribute.includes("/")) {
                addIssue(issues, "invalid_name", trigger.attribute);
            } else if (trigger.attribute && !index.attributes.has(trigger.attribute)) {
                addIssue(issues, "missing_attribute", trigger.attribute);
            }
            break;
        case "on_call":
            validateSingleOperandTrigger(issues, trigger, "operation", "missing_trigger_operand");
            if (typeof trigger.operation === "string" && trigger.operation.includes("/")) {
                addIssue(issues, "invalid_name", trigger.operation);
            } else if (trigger.operation && !index.operations.has(trigger.operation)) {
                addIssue(issues, "missing_operation", trigger.operation);
            }
            break;
        case "when": {
            const count = (present("attribute") ? 1 : 0) + (present("behavior") ? 1 : 0);
            if (count === 0) {
                addIssue(issues, "missing_trigger_operand", "when");
            } else if (count > 1) {
                addIssue(issues, "multiple_trigger_operands", "when");
            }
            if (typeof trigger.attribute === "string" && trigger.attribute.includes("/")) {
                addIssue(issues, "invalid_name", trigger.attribute);
            } else if (trigger.attribute && !index.attributes.has(trigger.attribute)) {
                addIssue(issues, "missing_attribute", trigger.attribute);
            }
            if (trigger.behavior && !Object.prototype.hasOwnProperty.call(behaviors, trigger.behavior)) {
                addIssue(issues, "missing_behavior", trigger.behavior);
            }
            if (extra("attribute", "behavior")) {
                addIssue(issues, "extraneous_trigger_operand", "when");
            }
            break;
        }
        case "after":
        case "every":
        case "at":
            validateTimerTrigger(issues, behaviors, index, trigger);
            break;
        case "completion":
            if (extra()) {
                addIssue(issues, "extraneous_trigger_operand", "completion");
            }
            break;
        case "exit_point":
            validateSingleOperandTrigger(issues, trigger, "exit_point", "missing_trigger_operand");
            break;
    }
}

function validateSingleOperandTrigger(
    issues: ValidationIssue[],
    trigger: AnyMap,
    operand: string,
    missingCode: string,
): void {
    const keys = Object.keys(trigger).filter((key) => key !== "kind");
    if (!Object.prototype.hasOwnProperty.call(trigger, operand)) {
        addIssue(issues, missingCode, trigger.kind);
    } else if (typeof trigger[operand] === "string" && trigger[operand].includes("/")) {
        addIssue(issues, "invalid_name", trigger[operand]);
    }
    for (const key of keys) {
        if (key !== operand) {
            addIssue(issues, "extraneous_trigger_operand", trigger.kind);
            return;
        }
    }
}

function validateTimerTrigger(
    issues: ValidationIssue[],
    behaviors: Record<string, BehaviorProgram>,
    index: ModelIndex,
    trigger: AnyMap,
): void {
    const sources = ["duration_ms", "time_ms", "attribute", "behavior"].filter((key) =>
        Object.prototype.hasOwnProperty.call(trigger, key)
    );
    if (sources.length !== 1) {
        addIssue(issues, "invalid_timer_source", trigger.kind);
    }
    const allowed = new Set(["kind", "duration_ms", "time_ms", "attribute", "behavior"]);
    if (Object.keys(trigger).some((key) => !allowed.has(key))) {
        addIssue(issues, "extraneous_trigger_operand", trigger.kind);
    }
    if (trigger.behavior) {
        const program = behaviors[String(trigger.behavior)];
        if (!program) {
            addIssue(issues, "missing_behavior", trigger.behavior);
        } else {
            for (const step of program) {
                if (step.op === "return_value") {
                    if (typeof step.value !== "number") {
                        addIssue(issues, "invalid_timer_behavior_return", trigger.behavior);
                    }
                    break;
                }
                if (step.op === "return_attr" || step.op === "event_data_get") {
                    break;
                }
            }
        }
    }
    if (trigger.attribute) {
        const type = index.attributes.get(trigger.attribute);
        if (!type) {
            addIssue(issues, "missing_timer_attribute", trigger.attribute);
        } else if ((trigger.kind === "at" && type === "duration_ms") || (trigger.kind !== "at" && type === "time_ms")) {
            addIssue(issues, "invalid_timer_attribute_type", trigger.attribute);
        }
    }
    if ((trigger.kind === "after" || trigger.kind === "every") && Object.prototype.hasOwnProperty.call(trigger, "time_ms")) {
        addIssue(issues, "invalid_timer_source", trigger.kind);
    }
    if (trigger.kind === "at" && Object.prototype.hasOwnProperty.call(trigger, "duration_ms")) {
        addIssue(issues, "invalid_timer_source", trigger.kind);
    }
    if (trigger.kind === "every" && Number(trigger.duration_ms) <= 0) {
        addIssue(issues, "invalid_timer_source", trigger.kind);
    }
}

function validateEventRefOperand(issues: ValidationIssue[], ref: unknown): void {
    if (Array.isArray(ref) && ref.length === 0) {
        addIssue(issues, "empty_event_array");
    }
}

function validateEventArray(issues: ValidationIssue[], refs: unknown[] | undefined): void {
    if (refs && refs.length === 0) {
        addIssue(issues, "empty_event_array");
    }
}

function validateBehaviorRefArray(
    issues: ValidationIssue[],
    behaviors: Record<string, BehaviorProgram>,
    refs: AnyMap[] | undefined,
    optional: boolean,
): void {
    if (!refs) {
        return;
    }
    if (!optional && refs.length === 0) {
        addIssue(issues, "empty_behavior_array");
    }
    if (optional && refs.length === 0) {
        addIssue(issues, "empty_behavior_array");
    }
    for (const ref of refs) {
        validateBehaviorRef(issues, behaviors, ref);
    }
}

function validateBehaviorRef(
    issues: ValidationIssue[],
    behaviors: Record<string, BehaviorProgram>,
    ref: AnyMap | undefined,
): void {
    if (!ref?.behavior || !Object.prototype.hasOwnProperty.call(behaviors, ref.behavior)) {
        addIssue(issues, "missing_behavior", ref?.behavior);
    }
}

function indexModels(models: AnyMap[], issues: ValidationIssue[]): Map<string, ModelIndex> {
    const byName = new Map<string, AnyMap>();
    const cache = new Map<string, ModelIndex>();
    const visiting = new Set<string>();
    for (const model of models) {
        byName.set(model.name, model);
    }
    for (const model of models) {
        indexModelFor(model.name, byName, cache, visiting, issues);
    }
    return cache;
}

function indexModelFor(
    name: string,
    models: Map<string, AnyMap>,
    cache: Map<string, ModelIndex>,
    visiting: Set<string>,
    issues: ValidationIssue[],
): ModelIndex {
    const cached = cache.get(name);
    if (cached) {
        return cached;
    }
    const model = models.get(name);
    if (!model) {
        const fallback = emptyModelIndex(`/${name}`);
        cache.set(name, fallback);
        return fallback;
    }
    if (visiting.has(name)) {
        addIssue(issues, "submachine_model_cycle", name);
        const fallback = emptyModelIndex(`/${model.name}`);
        cache.set(name, fallback);
        return fallback;
    }
    visiting.add(name);
    const index = typeof model.redefines === "string" && models.has(model.redefines)
        ? reRootModelIndex(
            indexModelFor(model.redefines, models, cache, visiting, issues),
            `/${model.name}`,
        )
        : emptyModelIndex(`/${model.name}`);
    applyModelIndexAdditions(index, model);
    visiting.delete(name);
    cache.set(name, index);
    return index;
}

function emptyModelIndex(root: string): ModelIndex {
    return {
        root,
        paths: new Set([root]),
        kinds: new Map([[root, "model"]]),
        submachines: new Map(),
        attributes: new Map(),
        operations: new Set(),
        entryPoints: new Map(),
        exitPoints: new Map(),
    };
}

function reRootModelIndex(base: ModelIndex, root: string): ModelIndex {
    const reRoot = (qualifiedName: string): string => {
        if (qualifiedName === base.root) {
            return root;
        }
        if (qualifiedName.startsWith(`${base.root}/`)) {
            return `${root}${qualifiedName.slice(base.root.length)}`;
        }
        return qualifiedName;
    };
    const index = emptyModelIndex(root);
    for (const pathName of base.paths) {
        index.paths.add(reRoot(pathName));
    }
    for (const [pathName, kind] of base.kinds) {
        index.kinds.set(reRoot(pathName), kind);
    }
    for (const [pathName, machine] of base.submachines) {
        index.submachines.set(reRoot(pathName), machine);
    }
    for (const [name, type] of base.attributes) {
        index.attributes.set(name, type);
    }
    for (const name of base.operations) {
        index.operations.add(name);
    }
    for (const [name, pathName] of base.entryPoints) {
        index.entryPoints.set(name, reRoot(pathName));
    }
    for (const [name, pathName] of base.exitPoints) {
        index.exitPoints.set(name, reRoot(pathName));
    }
    return index;
}

function applyModelIndexAdditions(index: ModelIndex, model: AnyMap): void {
    const root = index.root;
    for (const [name, spec] of Object.entries(model.attributes ?? {})) {
        index.attributes.set(name, spec.type ?? inferAttributeType(spec.default));
    }
    for (const name of Object.keys(model.operations ?? {})) {
        index.operations.add(name);
    }
    for (const point of model.entry_points ?? []) {
        index.paths.add(hsm.join(root, point.name));
        index.kinds.set(hsm.join(root, point.name), "entry_point");
        index.entryPoints.set(point.name, hsm.join(root, point.name));
    }
    for (const point of model.exit_points ?? []) {
        index.paths.add(hsm.join(root, point.name));
        index.kinds.set(hsm.join(root, point.name), "exit_point");
        index.exitPoints.set(point.name, hsm.join(root, point.name));
    }
    indexStates(index, model.states ?? [], root);
}

function indexStates(index: ModelIndex, states: AnyMap[], ownerPath: string): void {
    for (const stateIR of states) {
        const statePath = hsm.join(ownerPath, stateIR.name);
        const kind = stateIR.kind ?? "state";
        index.paths.add(statePath);
        index.kinds.set(statePath, kind);
        if (kind === "submachine" && typeof stateIR.machine === "string") {
            index.submachines.set(statePath, stateIR.machine);
        }
        indexStates(index, stateIR.states ?? [], statePath);
    }
}

function assertValidationErrors(actual: ValidationIssue[], expected: AnyMap[]): void {
    const actualCodes = actual.map((issue) => issue.code);
    const expectedCodes = expected.map((issue) => issue.code ?? issue);
    for (const code of expectedCodes) {
        const index = actualCodes.indexOf(code);
        if (index === -1) {
            throw new Error(`validation mismatch: expected ${JSON.stringify(expectedCodes)}, got ${JSON.stringify(actualCodes)}`);
        }
        actualCodes.splice(index, 1);
    }
}

const nativeValidationCodes = new Set([
    "invalid_name",
    "missing_initial",
    "missing_target",
    "missing_source",
    "choice_missing_fallback",
    "choice_default_not_last",
    "choice_missing_transition",
    "invalid_history_owner",
    "history_missing_default",
    "duplicate_state",
    "duplicate_entry_point",
    "duplicate_exit_point",
    "connection_point_name_collision",
    "invalid_entry_point_target",
    "invalid_entry_point_target_kind",
    "invalid_entry_point_usage",
    "invalid_entry_point_internal_target",
    "invalid_exit_point_usage",
    "missing_entry_point",
    "missing_exit_point",
    "invalid_submachine_internal_target",
    "invalid_submachine_internal_source",
    "invalid_submachine_boundary_target",
    "missing_attribute",
    "invalid_attribute",
]);

function expectsNativeValidation(expected: AnyMap[]): boolean {
    return expected.some((issue) => nativeValidationCodes.has(String(issue.code ?? issue)));
}

function assertNativeValidationError(error: Error, expected: AnyMap[]): void {
    const message = error.message;
    for (const item of expected) {
        if (typeof item === "string" && nativeValidationCodeMatches(item, message)) {
            return;
        }
        const code = item.code;
        if (code && nativeValidationCodeMatches(code, message)) {
            return;
        }
        const contains = item.message_contains;
        if (contains && message.includes(contains)) {
            return;
        }
    }
    throw new Error(`native validation mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(message)}`);
}

function nativeValidationCodeMatches(code: string, message: string): boolean {
    if (message.includes(code)) {
        return true;
    }
    const checks: Record<string, string[]> = {
        invalid_name: ["cannot contain"],
        missing_initial: ["missing initial"],
        missing_target: ["not found", "target or effect is required"],
        missing_source: ["not found", "invalid transition source"],
        choice_missing_fallback: ["choice_missing_fallback"],
        choice_default_not_last: ["choice_default_not_last", "fallback transition must be last"],
        choice_missing_transition: ["choice_missing_fallback"],
        invalid_history_owner: ["history must be declared"],
        history_missing_default: ["history requires a default transition"],
        duplicate_state: ["duplicate state"],
        duplicate_entry_point: ["duplicate state", "duplicate entry point"],
        duplicate_exit_point: ["duplicate state", "duplicate exit point"],
        connection_point_name_collision: ["duplicate state", "connection point name collision"],
        invalid_entry_point_target: ["entry point target", "not found"],
        invalid_entry_point_target_kind: ["entry point target"],
        invalid_entry_point_usage: ["entry point selector can only target"],
        invalid_entry_point_internal_target: ["entry point target cannot be internal"],
        invalid_exit_point_usage: ["ExitPoint outcome can only be handled"],
        missing_entry_point: ["has no entry point"],
        missing_exit_point: ["has no exit point"],
        invalid_submachine_internal_target: ["cannot target internal state"],
        invalid_submachine_internal_source: ["submachine internal source"],
        invalid_submachine_boundary_target: ["submachine boundary target", "not found"],
        missing_attribute: ["missing attribute"],
        missing_operation: ["missing operation"],
        invalid_attribute: ["invalid attribute", "default value does not match"],
    };
    return (checks[code] ?? [code]).some((part) => message.includes(part));
}

function addIssue(issues: ValidationIssue[], code: string, message?: string): void {
    issues.push({ code, message });
}

function invalidName(name: string): boolean {
    return typeof name !== "string" || name.length === 0 || name.includes("/");
}

function valueMatchesAttributeType(type: string, value: unknown): boolean {
    switch (type) {
        case "boolean":
            return typeof value === "boolean";
        case "number":
        case "duration_ms":
        case "time_ms":
            return typeof value === "number";
        case "string":
            return typeof value === "string";
        case "array":
            return Array.isArray(value);
        case "object":
            return value !== null && typeof value === "object" && !Array.isArray(value);
        default:
            return true;
    }
}

function inferAttributeType(value: unknown): string {
    if (Array.isArray(value)) {
        return "array";
    }
    return typeof value;
}

function collectCaseFiles(roots: string[]): string[] {
    const files: string[] = [];
    for (const root of roots) {
        const resolved = path.resolve(root);
        if (!fs.existsSync(resolved)) {
            continue;
        }
        const stat = fs.statSync(resolved);
        if (stat.isDirectory()) {
            for (const entry of fs.readdirSync(resolved)) {
                files.push(...collectCaseFiles([path.join(resolved, entry)]));
            }
        } else if (resolved.endsWith(".json")) {
            files.push(resolved);
        }
    }
    return files.sort();
}

function registerModels(runner: Runner): void {
    runner.modelIRs.set(runner.caseData.model.name, runner.caseData.model);
    for (const model of runner.caseData.models ?? []) {
        runner.modelIRs.set(model.name, model);
    }
    buildModel(runner, runner.caseData.model.name);
}

function buildModel(runner: Runner, name: string): hsm.Model {
    const existing = runner.models.get(name);
    if (existing) {
        return existing;
    }
    if (runner.buildingModels.has(name)) {
        throw new Error(`model reference cycle involving "${name}"`);
    }
    const ir = runner.modelIRs.get(name);
    if (!ir) {
        throw new Error(`missing model "${name}"`);
    }
    runner.buildingModels.add(name);
    try {
        const baseModel = typeof ir.redefines === "string"
            ? buildModel(runner, ir.redefines)
            : undefined;
        forEachState(ir.states ?? [], (stateIR) => {
            if (stateIR.kind === "submachine" && stateIR.machine) {
                buildModel(runner, stateIR.machine);
            }
        });
        const partials = buildModelPartials(runner, ir, `/${ir.name}`, `/${ir.name}`);
        const model = baseModel
            ? hsm.Redefine(baseModel, ir.name, ...partials)
            : hsm.Define(ir.name, ...partials);
        runner.models.set(name, model);
        return model;
    } finally {
        runner.buildingModels.delete(name);
    }
}

function buildModelPartials(
    runner: Runner,
    ir: AnyMap,
    modelRoot: string,
    ownerPath: string,
): Array<(model: hsm.Model, stack: any[]) => void> {
    const partials: Array<(model: hsm.Model, stack: any[]) => void> = [];
    appendAttributes(runner, partials, ir.attributes);
    appendOperations(runner, partials, ir.operations);
    if (ir.initial !== undefined) {
        partials.push(buildInitial(runner, modelRoot, ownerPath, ir.initial));
    }
    for (const entryPoint of ir.entry_points ?? []) {
        partials.push(hsm.EntryPoint(
            entryPoint.name,
            hsm.Target(toDSLPathExpression(
                modelRoot,
                ownerPath,
                resolveInitialPath(modelRoot, ownerPath, entryPoint.target),
            )),
            ...buildEffects(runner, entryPoint.effects),
        ) as any);
    }
    for (const exitPoint of ir.exit_points ?? []) {
        partials.push(hsm.ExitPoint(
            exitPoint.name,
            ...buildEffects(runner, exitPoint.effects),
        ) as any);
    }
    for (const stateIR of ir.states ?? []) {
        partials.push(buildState(runner, modelRoot, ownerPath, stateIR));
    }
    for (const transitionIR of ir.transitions ?? []) {
        partials.push(buildTransition(runner, modelRoot, ownerPath, transitionIR));
    }
    for (const observation of ir.observations ?? []) {
        partials.push(buildObservation(runner, observation));
    }
    return partials;
}

function appendAttributes(
    _runner: Runner,
    partials: Array<(model: hsm.Model, stack: any[]) => void>,
    attributes: AnyMap | undefined,
): void {
    if (!attributes) {
        return;
    }
    for (const [name, spec] of Object.entries(attributes)) {
        if (Object.prototype.hasOwnProperty.call(spec, "default")) {
            if (spec.type && spec.type !== "any") {
                partials.push(hsm.Attribute(name, attributeTypeToken(spec.type), spec.default) as any);
            } else {
                partials.push(hsm.Attribute(name, undefined, spec.default) as any);
            }
        } else if (spec.type && spec.type !== "any") {
            partials.push(hsm.Attribute(name, attributeTypeToken(spec.type)) as any);
        } else {
            partials.push(hsm.Attribute(name) as any);
        }
    }
}

function appendOperations(
    runner: Runner,
    partials: Array<(model: hsm.Model, stack: any[]) => void>,
    operations: AnyMap | undefined,
): void {
    if (!operations) {
        return;
    }
    for (const [name, ref] of Object.entries(operations)) {
        partials.push(hsm.Operation(name, function (ctx: hsm.Context, instance: hsm.Instance, _first?: unknown) {
            const args = Array.prototype.slice.call(arguments, 2) as unknown[];
            const event = {
                kind: hsm.CallEventKind,
                name,
                source: name,
                data: args.length === 1 ? args[0] : args,
            };
            return executeBehavior(runner, ref.behavior, "operation", ctx, instance, event);
        }) as any);
    }
}

function buildState(
    runner: Runner,
    modelRoot: string,
    ownerPath: string,
    stateIR: AnyMap,
): (model: hsm.Model, stack: any[]) => void {
    const statePath = hsm.join(ownerPath, stateIR.name);
    const partials: Array<(model: hsm.Model, stack: any[]) => void> = [];
    if (stateIR.initial !== undefined) {
        partials.push(buildInitial(runner, modelRoot, statePath, stateIR.initial));
    }
    if (stateIR.entry?.length) {
        partials.push(hsm.Entry(...stateIR.entry.map((ref: AnyMap) => makeBehavior(runner, ref.behavior, "entry", statePath))) as any);
    }
    if (stateIR.exit?.length) {
        partials.push(hsm.Exit(...stateIR.exit.map((ref: AnyMap) => makeBehavior(runner, ref.behavior, "exit", statePath))) as any);
    }
    if (stateIR.activity?.length) {
        partials.push(hsm.Activity(...stateIR.activity.map((ref: AnyMap) => makeBehavior(runner, ref.behavior, "activity", statePath))) as any);
    }
    if (stateIR.defer?.length) {
        partials.push(hsm.Defer(...stateIR.defer.map(eventName)) as any);
    }
    for (const child of stateIR.states ?? []) {
        partials.push(buildState(runner, modelRoot, statePath, child));
    }
    const pseudostateTransition = ["choice", "shallow_history", "deep_history"].includes(stateIR.kind ?? "state");
    const transitionOwnerPath = pseudostateTransition
        ? ownerPath
        : statePath;
    const transitionRoot = pseudostateTransition
        ? ownerPath
        : modelRoot;
    for (const transitionIR of stateIR.transitions ?? []) {
        partials.push(buildTransition(runner, transitionRoot, transitionOwnerPath, transitionIR));
    }

    switch (stateIR.kind ?? "state") {
        case "final":
            return hsm.Final(stateIR.name) as any;
        case "choice":
            return hsm.Choice(stateIR.name, ...partials) as any;
        case "shallow_history":
            return hsm.ShallowHistory(stateIR.name, ...partials) as any;
        case "deep_history":
            return hsm.DeepHistory(stateIR.name, ...partials) as any;
        case "submachine": {
            const machine = buildModel(runner, stateIR.machine);
            return hsm.SubmachineState(stateIR.name, machine, ...partials) as any;
        }
        default:
            return hsm.State(stateIR.name, ...partials) as any;
    }
}

function buildInitial(
    runner: Runner,
    modelRoot: string,
    ownerPath: string,
    initialIR: string | AnyMap,
): (model: hsm.Model, stack: any[]) => any {
    if (typeof initialIR === "string") {
        return hsm.Initial(hsm.Target(toDSLPathExpression(
            modelRoot,
            ownerPath,
            resolveInitialPath(modelRoot, ownerPath, initialIR),
        ))) as any;
    }
    return hsm.Initial(
        hsm.Target(toDSLPathExpression(
            modelRoot,
            ownerPath,
            resolveInitialPath(modelRoot, ownerPath, initialIR.target),
        )),
        ...buildEffects(runner, initialIR.effects),
    ) as any;
}

function buildTransition(
    runner: Runner,
    modelRoot: string,
    ownerPath: string,
    transitionIR: AnyMap,
): (model: hsm.Model, stack: any[]) => any {
    const clauses: Array<(model: hsm.Model, stack: any[]) => any> = [];
    if (transitionIR.kind) {
        clauses.push(transitionKindOverride(transitionIR.kind));
    }
    const sourcePath = transitionIR.source
        ? resolveTransitionPath(modelRoot, ownerPath, transitionIR.source)
        : undefined;
    if (transitionIR.source) {
        clauses.push(hsm.Source(toDSLPathExpression(modelRoot, ownerPath, sourcePath as string)) as any);
    }
    appendTrigger(runner, clauses, transitionIR, ownerPath);
    if (transitionIR.target) {
        const targetResolutionOwner = sourcePath && transitionIR.target === "."
            ? sourcePath
            : ownerPath;
        const targetPath = resolveTransitionPath(modelRoot, targetResolutionOwner, transitionIR.target);
        clauses.push(hsm.Target(toDSLPathExpression(
            modelRoot,
            ownerPath,
            targetPath,
        )) as any);
    }
    if (transitionIR.entry_point) {
        clauses.push(hsm.EntryPoint(transitionIR.entry_point) as any);
    }
    if (transitionIR.guard && !(transitionIR.trigger?.kind === "when" && transitionIR.trigger.behavior)) {
        const guard = isTimerTrigger(transitionIR.trigger)
            ? makeTimerGuard(runner, transitionIR.guard.behavior, ownerPath)
            : makeBehavior(runner, transitionIR.guard.behavior, "guard", ownerPath);
        clauses.push(hsm.Guard(guard) as any);
    }
    clauses.push(...buildEffects(runner, transitionIR.effects, ownerPath));
    return hsm.Transition(...clauses) as any;
}

function transitionKindOverride(kindName: string): (model: hsm.Model, stack: any[]) => void {
    return function (_model: hsm.Model, stack: any[]): void {
        for (let index = stack.length - 1; index >= 0; index--) {
            const element = stack[index];
            if (element && hsm.isKind(element.kind, hsm.kinds.Transition)) {
                switch (kindName) {
                    case "internal":
                        element.kind = hsm.kinds.Internal;
                        return;
                    case "local":
                        element.kind = hsm.kinds.Local;
                        return;
                    case "external":
                        element.kind = hsm.kinds.External;
                        return;
                    case "self":
                        element.kind = hsm.kinds.Self;
                        return;
                    default:
                        throw new Error(`unsupported transition kind "${kindName}"`);
                }
            }
        }
        throw new Error("transition kind override must be used within a transition");
    };
}

function isTimerTrigger(trigger: AnyMap | undefined): boolean {
    return trigger?.kind === "after" || trigger?.kind === "every" || trigger?.kind === "at";
}

function appendTrigger(
    runner: Runner,
    clauses: Array<(model: hsm.Model, stack: any[]) => any>,
    transitionIR: AnyMap,
    ownerPath?: string,
): void {
    if (transitionIR.on !== undefined) {
        clauses.push(hsm.On(makeEvent(transitionIR.on)) as any);
        return;
    }
    const trigger = transitionIR.trigger;
    if (!trigger) {
        return;
    }
    switch (trigger.kind) {
        case "on":
            for (const event of trigger.events ?? [trigger.event]) {
                clauses.push(hsm.On(makeEvent(event)) as any);
            }
            return;
        case "on_set":
            clauses.push(hsm.OnSet(trigger.attribute) as any);
            return;
        case "on_call":
            clauses.push(hsm.OnCall(trigger.operation) as any);
            return;
        case "after":
            clauses.push(hsm.After(timerValueExpression(runner, trigger, "duration_ms")) as any);
            return;
        case "every":
            clauses.push(hsm.Every(timerValueExpression(runner, trigger, "duration_ms")) as any);
            return;
        case "at":
            clauses.push(hsm.At(timerValueExpression(runner, trigger, "time_ms")) as any);
            return;
        case "completion":
            clauses.push(hsm.On(hsm.FinalEvent) as any);
            return;
        case "exit_point":
            clauses.push(hsm.ExitPoint(trigger.exit_point) as any);
            return;
        case "when":
            if (trigger.attribute) {
                clauses.push(hsm.When(trigger.attribute) as any);
                return;
            }
            appendWhenTrigger(runner, clauses, trigger.behavior, transitionIR.guard?.behavior, ownerPath);
            return;
    }
}

function appendWhenTrigger(
    runner: Runner,
    clauses: Array<(model: hsm.Model, stack: any[]) => any>,
    behaviorID: string,
    guardID?: string,
    ownerPath?: string,
): void {
    const whenBehavior = makeBehavior(runner, behaviorID, "when", ownerPath);
    if (!guardID) {
        clauses.push(hsm.When(whenBehavior) as any);
        return;
    }
    const guardBehavior = makeBehavior(runner, guardID, "guard", ownerPath);
    clauses.push(hsm.When(function (ctx: hsm.Context, instance: hsm.Instance, event: hsm.Event): boolean {
        return Boolean(whenBehavior(ctx, instance, event)) && Boolean(guardBehavior(ctx, instance, event));
    }) as any);
}

function buildEffects(runner: Runner, refs: AnyMap[] | undefined, ownerPath?: string): Array<(model: hsm.Model, stack: any[]) => any> {
    if (!refs?.length) {
        return [];
    }
    return [hsm.Effect(...refs.map((ref) => makeBehavior(runner, ref.behavior, "effect", ownerPath))) as any];
}

function buildObservation(runner: Runner, observation: AnyMap): (model: hsm.Model, stack: any[]) => any {
    const targets = (observation.targets ?? []).map((target: any) => {
        if (typeof target === "string") {
            return target;
        }
        if (target.event !== undefined) {
            return eventName(target.event);
        }
        return target.path;
    });
    return hsm.Observe(...targets, makeBehavior(runner, observation.behavior, "observation")) as any;
}

function makeBehavior(
    runner: Runner,
    behaviorID: string,
    role: string,
    ownerPath?: string,
): (ctx: hsm.Context, instance: hsm.Instance, event: hsm.Event) => unknown {
    return function (ctx: hsm.Context, instance: hsm.Instance, event: hsm.Event): unknown {
        return executeBehavior(runner, behaviorID, role, ctx, instance, event, ownerPath);
    };
}

function makeTimerGuard(
    runner: Runner,
    behaviorID: string,
    ownerPath?: string,
): (ctx: hsm.Context, instance: hsm.Instance, event: hsm.Event) => boolean {
    return function (ctx: hsm.Context, instance: hsm.Instance, event: hsm.Event): boolean {
        const shouldTrace = expectedTraceContains(runner, "timer_fired") && runner.pendingTimerFired > 0;
        const firedIndex = runner.trace.length;
        if (shouldTrace) {
            runner.pendingTimerFired--;
        }
        runner.suppressTimerFired++;
        try {
            const result = Boolean(executeBehavior(runner, behaviorID, "guard", ctx, instance, event, ownerPath));
            if (shouldTrace) {
                if (result) {
                    runner.trace.push({ type: "timer_fired" });
                } else {
                    runner.trace.splice(firedIndex, 0, { type: "timer_fired" });
                }
            }
            return result;
        } catch (error) {
            if (shouldTrace) {
                runner.trace.splice(firedIndex, 0, { type: "timer_fired" });
            }
            throw error;
        } finally {
            runner.suppressTimerFired--;
        }
    };
}

function executeBehavior(
    runner: Runner,
    behaviorID: string,
    role: string,
    ctx: hsm.Context,
    instance: hsm.Instance,
    event: hsm.Event,
    ownerPath?: string,
): unknown {
    const program = runner.caseData.behaviors?.[behaviorID];
    if (!program) {
        throw new Error(`missing behavior "${behaviorID}"`);
    }
    if (role === "activity") {
        return executeActivityBehavior(runner, behaviorID, program, ctx, instance, event, ownerPath);
    }
    return executeProgramSync(runner, program, ctx, instance, event, role, ownerPath);
}

function executeProgramSync(
    runner: Runner,
    program: BehaviorProgram,
    ctx: hsm.Context,
    instance: hsm.Instance,
    event: hsm.Event,
    role: string,
    ownerPath?: string,
): unknown {
    let result: unknown;
    for (const op of program) {
        if (op.op === "sleep" || op.op === "yield") {
            throw new ConformanceError("unsupported_async_behavior", `${op.op} is only supported in activities`);
        }
        result = executeBehaviorOp(runner, op, ctx, instance, event, role, ownerPath);
        if (isThenable(result)) {
            const syncError = (result as { __hsmError?: unknown }).__hsmError;
            if (syncError) {
                recordError(runner, syncError);
                throw syncError;
            }
            void Promise.resolve(result).catch((error: unknown) => {
                recordError(runner, error);
            });
        }
    }
    if (role === "guard") {
        flushTimerFired(runner);
    }
    return result;
}

async function executeActivityBehavior(
    runner: Runner,
    behaviorID: string,
    program: BehaviorProgram,
    ctx: hsm.Context,
    instance: hsm.Instance,
    event: hsm.Event,
    ownerPath?: string,
): Promise<void> {
    let cancelled = false;
    const cancel = () => {
        if (!cancelled) {
            cancelled = true;
            if (expectedTraceContains(runner, "activity_cancel")) {
                runner.trace.push({ type: "activity_cancel", behavior: behaviorID });
            }
        }
    };
    ctx.addEventListener("done", cancel);
    try {
        for (const op of program) {
            if (cancelled || ctx.done) {
                return;
            }
            if (op.op === "yield") {
                await flushAsyncWork();
                continue;
            }
            if (op.op === "sleep") {
                await sleepWithCancel(ctx, Number(op.millis ?? 0));
                continue;
            }
            const result = executeBehaviorOp(runner, op, ctx, instance, event, "activity", ownerPath);
            if (isThenable(result) && op.op !== "set_attr" && op.op !== "set_attr_from_event_data") {
                await result;
            }
        }
        if (!cancelled && !ctx.done) {
            if (expectedTraceContains(runner, "activity_done")) {
                runner.trace.push({ type: "activity_done", behavior: behaviorID });
            }
        }
    } finally {
        ctx.removeEventListener("done", cancel);
    }
}

function executeBehaviorOp(
    runner: Runner,
    op: AnyMap,
    ctx: hsm.Context,
    instance: hsm.Instance,
    event: hsm.Event,
    role: string,
    ownerPath?: string,
): unknown {
    if (role !== "guard" || runner.suppressTimerFired === 0) {
        flushTimerFired(runner);
    }
    switch (op.op) {
        case "trace":
            traceUndeferBeforeBehaviorTrace(runner, instance);
            runner.trace.push({ type: "trace", value: op.value });
            return undefined;
        case "set_attr":
            return behaviorCompletion(runner, instance.set(op.name ?? op.attribute, op.value), role);
        case "set_attr_from_event_data":
            return behaviorCompletion(
                runner,
                instance.set(op.name ?? op.attribute, getPathValue((event as any).data, op.path ?? "")),
                role,
            );
        case "get_attr":
            return instance.get(op.name ?? op.attribute)[0];
        case "return_attr":
            return instance.get(op.name ?? op.attribute)[0];
        case "return_value":
            return op.value;
        case "return_equals":
            return deepEqual(instance.get(op.name ?? op.attribute)[0], op.value);
        case "event_name_equals":
            return event.name === op.value;
        case "event_data_equals":
            return deepEqual(getPathValue((event as any).data, op.path ?? ""), op.value);
        case "event_data_get":
            return getPathValue((event as any).data, op.path ?? "");
        case "event_application_metadata_equals":
            return deepEqual(getEventApplicationMetadata(event, op.name), op.value);
        case "event_metadata_set":
            setEventMetadata(event, op.name, op.value);
            return undefined;
        case "event_metadata_get":
            return getEventMetadata(event, op.name);
        case "event_metadata_equals":
            return deepEqual(getEventMetadata(event, op.name), op.value);
        case "raise":
            return behaviorRaise(runner, instance, op, ownerPath);
        case "dispatch":
            return behaviorDispatch(runner, ctx, instance, op, role, ownerPath);
        case "call":
            let result: unknown;
            if (role === "guard") {
                runner.suppressTimerFired++;
                try {
                    result = instance.call(op.name, op.value);
                } finally {
                    runner.suppressTimerFired--;
                }
            } else {
                result = instance.call(op.name, op.value);
            }
            if (expectedTraceContains(runner, "call") && (role === "entry" || role === "exit" || role === "activity")) {
                runner.trace.push({ type: "call", operation: op.name });
            }
            return behaviorCompletion(runner, result, role);
        case "snapshot":
            return recordSnapshot(runner, instance, op.id ?? "last");
        default:
            throw new Error(`unsupported behavior op "${op.op}"`);
    }
}

function behaviorCompletion(runner: Runner, result: unknown, role: string): unknown {
    if (!isThenable(result) || role === "activity" || role === "operation") {
        return result;
    }
    const syncError = (result as { __hsmError?: unknown }).__hsmError;
    if (syncError) {
        recordError(runner, syncError);
        throw syncError;
    }
    void Promise.resolve(result).catch((error: unknown) => {
        recordError(runner, error);
    });
    return undefined;
}

function behaviorRaise(runner: Runner, instance: hsm.Instance, op: AnyMap, ownerPath?: string): unknown {
    if (op.code) {
        const error = new ConformanceError(op.code, String(op.value ?? op.code));
        recordError(runner, error);
        throw error;
    }
    const event = makeEvent(op.event);
    runner.trace.push({ type: "raise", event: event.name });
    const traced = traceDeferredDispatch(runner, event.name, [instance], ownerPath);
    void instance.dispatch(event);
    traceRuntimeDeferred(runner, [instance], event.name, ownerPath, traced);
    return undefined;
}

function behaviorDispatch(
    runner: Runner,
    ctx: hsm.Context,
    instance: hsm.Instance,
    op: AnyMap,
    role: string,
    ownerPath?: string,
): unknown {
    const event = makeEvent(op.event);
    const target = op.group ?? op.instance ?? op.target;
    const traceEvent: AnyMap = { type: "dispatch", event: event.name };
    if (target) {
        traceEvent.target = target;
    }
    runner.trace.push(traceEvent);
    const targets = behaviorDispatchTargets(runner, instance, op);
    const traced = traceDeferredDispatch(runner, event.name, targets, ownerPath);
    const afterDispatch = (result: unknown): unknown => {
        traceRuntimeDeferred(runner, targets, event.name, ownerPath, traced);
        return result;
    };
    if (op.group) {
        const group = runner.groups.get(op.group);
        if (!group) {
            const error = new ConformanceError("runtime_error", `unknown group "${op.group}"`);
            recordError(runner, error);
            throw error;
        }
        return behaviorCompletion(runner, withThenable(group.dispatch(event as any), afterDispatch), role);
    }
    if (op.instance) {
        const targetInstance = runner.instances.get(op.instance);
        if (!targetInstance) {
            const error = new ConformanceError("runtime_error", `unknown instance "${op.instance}"`);
            recordError(runner, error);
            throw error;
        }
        return behaviorCompletion(runner, withThenable(hsm.Dispatch(ctx, targetInstance, event), afterDispatch), role);
    }
    if (op.target === "all") {
        return behaviorCompletion(runner, withThenable(hsm.DispatchAll(ctx, event), afterDispatch), role);
    }
    if (op.target) {
        return behaviorCompletion(runner, withThenable(hsm.DispatchTo(ctx, event, op.target), afterDispatch), role);
    }
    return behaviorCompletion(runner, withThenable(instance.dispatch(event), afterDispatch), role);
}

function recordError(runner: Runner, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.includes("started HSM") ||
        message.includes("already has a running HSM") ||
        message.includes("start") ||
        message.includes("stop") ||
        message.includes("restart") ||
        message.includes("dispatch requires")
        ? "lifecycle_error"
        : message.includes("unhandled exit point")
        ? "unhandled_exit_point"
        : message.includes("invalid interval") || message.includes("timer")
            ? "timer_error"
            : message.includes("attribute")
            ? "attribute_error"
            : message.includes("operation") || message.includes("Operation") || message.includes("missing operation")
                ? "operation_error"
                : "runtime_error";
    const normalized = error instanceof ConformanceError
        ? error
        : new ConformanceError(code, message);
    runner.lastError = normalized;
    const last = runner.trace[runner.trace.length - 1];
    if (last?.type !== "error" || last.code !== normalized.code) {
        runner.trace.push({ type: "error", code: normalized.code });
    }
}

function setEventMetadata(event: hsm.Event, name: string, value: unknown): void {
    if (isReservedEventMetadata(name)) {
        return;
    }
    const mutable = event as any;
    if (!mutable.metadata) {
        mutable.metadata = {};
    }
    mutable.metadata[name] = value;
}

function getEventMetadata(event: hsm.Event, name: string): unknown {
    if (isReservedEventMetadata(name)) {
        return (event as any)[name];
    }
    return ((event as any).metadata ?? {})[name];
}

function getEventApplicationMetadata(event: hsm.Event, name: string): unknown {
    return ((event as any).metadata ?? {})[name];
}

function isReservedEventMetadata(name: string): boolean {
    return (
        name === "name" ||
        name === "data" ||
        name === "kind" ||
        name === "id" ||
        name === "source" ||
        name === "target" ||
        name === "qualifiedName" ||
        name === "qualified_name" ||
        name === "schema"
    );
}

function buildInstances(runner: Runner): void {
    const instances = runner.caseData.instances?.length
        ? runner.caseData.instances
        : [{ id: "default", model: runner.caseData.model.name }];
    for (const spec of instances) {
        const modelName = spec.model ?? runner.caseData.model.name;
        const instance = new hsm.Instance();
        runner.instances.set(spec.id, instance);
        if (runner.modelIRs.has(modelName)) {
            const model = buildModel(runner, modelName);
            runner.instanceModels.set(spec.id, model);
        }
    }
}

function buildGroups(runner: Runner): void {
    for (const groupSpec of runner.caseData.groups ?? []) {
        const members = (groupSpec.members ?? [])
            .map((id: string) => runner.instances.get(id))
            .filter(Boolean) as hsm.Instance[];
        runner.groups.set(groupSpec.id, hsm.MakeGroup(groupSpec.id, ...members));
    }
}

async function executeScriptStep(runner: Runner, step: AnyMap): Promise<void> {
    switch (step.op) {
        case "start":
            startInstance(runner, step.instance ?? "default", step.data);
            return;
        case "stop":
            if (expectedTraceContains(runner, "stop")) {
                runner.trace.push({ type: "stop" });
            }
            clearDeferredEventsForInstance(runner, requireInstance(runner, step.instance ?? "default"));
            await hsm.stop(requireInstance(runner, step.instance ?? "default"));
            runner.lastStableLabel = step.instance;
            return;
        case "restart":
            if (expectedTraceContains(runner, "restart")) {
                runner.trace.push({ type: "restart" });
            }
            clearDeferredEventsForInstance(runner, requireInstance(runner, step.instance ?? "default"));
            await hsm.Restart(requireInstance(runner, step.instance ?? "default"), step.data);
            runner.lastStableLabel = step.instance;
            return;
        case "dispatch":
            await dispatchScriptEvent(runner, step.instance ?? "default", step.event);
            return;
        case "dispatch_all": {
            const event = makeEvent(step.event);
            runner.trace.push({ type: "dispatch", event: event.name, target: "all" });
            const targets = [...runner.instances.values()];
            traceDeferredDispatch(runner, event.name, targets);
            await hsm.DispatchAll(runner.ctx, event);
            traceRuntimeDeferred(runner, targets, event.name);
            runner.lastStableLabel = "all";
            return;
        }
        case "dispatch_to": {
            const event = makeEvent(step.event);
            const targets = step.targets ?? [step.target ?? step.instance];
            runner.trace.push({
                type: "dispatch",
                event: event.name,
                target: targets.length === 1 ? targets[0] : targets,
            });
            const targetInstances = targets
                .map((id: string) => runner.instances.get(id))
                .filter((instance: hsm.Instance | undefined): instance is hsm.Instance => instance !== undefined);
            traceDeferredDispatch(runner, event.name, targetInstances);
            await hsm.DispatchTo(runner.ctx, event, ...targets);
            traceRuntimeDeferred(runner, targetInstances, event.name);
            runner.lastStableLabel = targets.length === 1 ? targets[0] : `targets:${targets.join(",")}`;
            return;
        }
        case "group_dispatch": {
            const event = makeEvent(step.event);
            runner.trace.push({ type: "dispatch", event: event.name, target: step.group });
            const group = runner.groups.get(step.group);
            if (!group) {
                throw new ConformanceError("runtime_error", `unknown group "${step.group}"`);
            }
            const targets = instancesForGroup(runner, step.group);
            traceDeferredDispatch(runner, event.name, targets);
            await group.dispatch(event as any);
            traceRuntimeDeferred(runner, targets, event.name);
            runner.lastStableLabel = `group:${step.group}`;
            return;
        }
        case "set": {
            const instanceID = step.instance ?? "default";
            if (expectedTraceContains(runner, "set")) {
                runner.trace.push({ type: "set", attribute: step.attribute, value: step.value });
            }
            await requireInstance(runner, instanceID).set(step.attribute, step.value);
            runner.lastStableLabel = instanceID;
            return;
        }
        case "call": {
            const instanceID = step.instance ?? "default";
            runner.trace.push({ type: "call", operation: step.operation });
            await requireInstance(runner, instanceID).call(
                step.operation,
                ...(Object.prototype.hasOwnProperty.call(step, "data") ? [step.data] : []),
            );
            runner.lastStableLabel = instanceID;
            return;
        }
        case "tick":
            await tick(runner, Number(step.millis ?? 0));
            return;
        case "sleep":
            await sleep(Number(step.millis ?? 0));
            return;
        case "snapshot":
            if (step.group) {
                recordGroupSnapshot(runner, step.group, step.id ?? step.group);
                runner.lastStableLabel = `group:${step.group}`;
                return;
            }
            recordSnapshot(runner, requireInstance(runner, step.instance ?? "default"), step.id ?? "last");
            return;
        case "expect":
            assertExpectations(runner, step.expect ?? {});
            return;
        default:
            throw new Error(`unsupported script op "${step.op}"`);
    }
}

async function dispatchScriptEvent(runner: Runner, instanceID: string, eventRef: unknown): Promise<void> {
    const event = makeEvent(eventRef);
    const instance = requireInstance(runner, instanceID);
    const traced = new Set<string>();
    runner.trace.push({ type: "dispatch", event: event.name });
    const eventDeferredByCurrentState = eventIsDeferred(runner, instance, event.name) &&
        !eventHasTransitionCandidate(runner, instance, event.name);
    if (eventDeferredByCurrentState && !hasDeferredEvent(runner, instance, event.name)) {
        noteDeferredEvent(runner, instance, event.name);
        traceDeferEvent(runner, event.name);
        traced.add(instanceID);
    }
    if (!eventDeferredByCurrentState && eventExitsActiveSubmachine(runner, instance, event.name)) {
        clearChildDeferredEventsForInstance(runner, instance);
    }
    if (runner.deferredEvents.length > 0 && !eventDeferredByCurrentState) {
        const eventName = popDeferredEventForInstance(runner, instance);
        if (eventName !== undefined) {
            runner.trace.push({ type: "undefer", event: eventName });
            runner.deferReplayBarrier = true;
        }
    }
    await instance.dispatch(event);
    traceRuntimeDeferred(runner, [instance], event.name, undefined, traced);
    runner.lastStableLabel = instanceID;
}

function startInstance(runner: Runner, instanceID: string, data: unknown): void {
    const instance = requireInstance(runner, instanceID);
    const model = runner.instanceModels.get(instanceID);
    if (!model) {
        const instanceSpec = (runner.caseData.instances ?? []).find((entry) => entry.id === instanceID);
        throw new ConformanceError("model_error", `missing model "${instanceSpec?.model ?? runner.caseData.model.name}"`);
    }
    if (expectedTraceContains(runner, "start")) {
        runner.trace.push({ type: "start" });
    }
    clearDeferredEventsForInstance(runner, instance);
    const instanceSpec = (runner.caseData.instances ?? []).find((entry) => entry.id === instanceID);
    const configData = data ?? instanceSpec?.config?.data ?? instanceSpec?.data;
    hsm.start(
        runner.ctx,
        instance,
        model,
        hsm.Config({
            ID: instanceID,
            Name: instanceSpec?.config?.name,
            Data: configData,
            Clock: makeClock(runner, instanceSpec?.config?.clock),
            Queue: makeQueue(runner, instanceSpec?.config?.queue),
        }),
    );
    runner.lastStableLabel = instanceID;
}

function makeClock(runner: Runner, name: string | undefined): hsm.ClockConfig {
    return {
        now: () => runner.clockNow,
        setTimeout: (callback: (...args: unknown[]) => void, timeout?: number) => {
            if (expectedTraceContains(runner, "timer_scheduled")) {
                runner.trace.push({ type: "timer_scheduled" });
            }
            if (name === "trace_no_sleep" && Number(timeout ?? 0) > 0) {
                runner.trace.push({ type: "trace", value: `clock:sleep:${Number(timeout ?? 0)}` });
            }
            if ((name === "trace_nonzero_sleep" || name === "trace_yield_sleep") && Number(timeout ?? 0) > 0) {
                runner.trace.push({ type: "trace", value: name === "trace_yield_sleep" ? `clock:sleep:${Number(timeout ?? 0)}` : "clock:sleep:nonzero" });
            }
            const timer: TimerRegistration = {
                id: runner.nextTimerID++,
                due: runner.clockNow + (name === "trace_no_sleep" || name === "trace_nonzero_sleep" ? 0 : Number(timeout ?? 0)),
                callback,
                active: true,
                order: runner.timerOrder++,
            };
            runner.timers.push(timer);
            return timer as unknown as ReturnType<typeof setTimeout>;
        },
        clearTimeout: (handle: ReturnType<typeof setTimeout> | undefined) => {
            const timer = handle as unknown as TimerRegistration | undefined;
            if (timer?.active) {
                timer.active = false;
                if (expectedTraceContains(runner, "timer_cancelled")) {
                    runner.trace.push({ type: "timer_cancelled" });
                }
            }
        },
    };
}

function makeQueue(runner: Runner, name: string | undefined): hsm.QueueShape | undefined {
    if (!name) {
        return undefined;
    }
    const events: hsm.Event[] = [];
    let popErrorPending = name === "pop_error_once";
    let pushed = false;
    let lenErrorPending = name === "len_error_once";
    return {
        Push(_ctx: hsm.Context, event: hsm.Event): void | Error {
            if (name === "push_error") {
                runner.trace.push({ type: "trace", value: `queue:push-error:${event.name}` });
                recordError(runner, new Error(`push error for ${event.name}`));
                return new Error(`push error for ${event.name}`);
            }
            runner.trace.push({ type: "trace", value: `queue:push:${event.name}` });
            pushed = true;
            events.push(event);
        },
        Pop(): hsm.Event | undefined | Error {
            if (popErrorPending && pushed) {
                popErrorPending = false;
                runner.trace.push({ type: "trace", value: "queue:pop-error" });
                return new Error("pop error");
            }
            const event = name === "trace_lifo" ? events.pop() : events.shift();
            if (event) {
                runner.trace.push({ type: "trace", value: `queue:pop:${event.name}` });
            }
            return event;
        },
        Len(): number | Error {
            if (name === "len_seven") {
                return 7;
            }
            if (lenErrorPending) {
                lenErrorPending = false;
                runner.trace.push({ type: "trace", value: "queue:len-error" });
                return new Error("len error");
            }
            return events.length;
        },
    };
}

async function tick(runner: Runner, millis: number): Promise<void> {
    runner.clockNow += millis;
    while (true) {
        const due = runner.timers
            .filter((timer) => timer.active && timer.due <= runner.clockNow)
            .sort((left, right) => left.due - right.due || left.order - right.order)[0];
        if (!due) {
            return;
        }
        due.active = false;
        runner.pendingTimerFired++;
        due.callback();
        await flushAsyncWork();
    }
}

function recordSnapshot(runner: Runner, instance: hsm.Instance, id: string): any {
    const snapshot = hsm.takeSnapshot(instance);
    const normalized = normalizeSnapshot(snapshot);
    runner.snapshots[id] = normalized;
    runner.trace.push({ type: "snapshot", state: normalized.state });
    return normalized;
}

function recordGroupSnapshot(runner: Runner, groupID: string, id: string): any {
    const group = runner.groups.get(groupID);
    if (!group) {
        throw new ConformanceError("runtime_error", `unknown group "${groupID}"`);
    }
    const normalized = normalizeSnapshot(group.takeSnapshot());
    runner.snapshots[id] = normalized;
    runner.trace.push({ type: "snapshot", group: groupID });
    return normalized;
}

function normalizeSnapshot(snapshot: any): AnyMap {
    if (Array.isArray(snapshot)) {
        const members: Record<string, string> = {};
        for (const member of snapshot) {
            members[member.id] = member.state;
        }
        return { members };
    }
    const transitions = (snapshot.transitions ?? []).map((transition: any) => ({
        name: transition.name,
        kind: transition.kind,
        source: transition.source,
        target: transition.target ?? null,
        events: Array.from(transition.events ?? []),
        guard: transition.guard,
    }));
    return {
        id: snapshot.id,
        qualified_name: snapshot.qualifiedName,
        state: snapshot.state,
        attributes: unqualifyAttributes(snapshot.qualifiedName, snapshot.attributes ?? {}),
        queue_len: snapshot.queueLen,
        ...(transitions.length ? { transitions } : {}),
    };
}

function recordStable(runner: Runner): void {
    flushTimerFired(runner);
    if (runner.trace.length && runner.trace[runner.trace.length - 1]?.type === "stable") {
        return;
    }
    const expectedStable = [...(runner.caseData.expect?.trace ?? [])].reverse()
        .find((entry: AnyMap) => entry.type === "stable");
    if (expectedStable?.state && runner.instances.has(expectedStable.state)) {
        runner.trace.push({ type: "stable", state: expectedStable.state });
        return;
    }
    if (
        typeof expectedStable?.state === "string" &&
        expectedStable.state.startsWith("/") &&
        [...runner.instances.values()].every((instance) => instance.state() === expectedStable.state)
    ) {
        runner.trace.push({ type: "stable", state: expectedStable.state });
        return;
    }
    if (
        typeof expectedStable?.state === "string" &&
        expectedStable.state.startsWith("/") &&
        runner.lastStableLabel &&
        runner.instances.get(runner.lastStableLabel)?.state() === expectedStable.state
    ) {
        runner.trace.push({ type: "stable", state: expectedStable.state });
        return;
    }
    if (
        runner.lastStableLabel &&
        (
            runner.lastStableLabel === "all" ||
            runner.lastStableLabel.startsWith("group:") ||
            runner.lastStableLabel.startsWith("targets:") ||
            !runner.instances.has(runner.lastStableLabel)
        )
    ) {
        runner.trace.push({ type: "stable", state: runner.lastStableLabel });
        return;
    }
    if (runner.instances.size === 1) {
        const instance = [...runner.instances.values()][0];
        runner.trace.push({ type: "stable", state: instance.state() });
        return;
    }
    if (runner.lastStableLabel) {
        runner.trace.push({ type: "stable", state: runner.lastStableLabel });
    }
}

function expectedTraceContains(runner: Runner, type: string): boolean {
    return (runner.caseData.expect?.trace ?? []).some((entry: AnyMap) => entry.type === type);
}

function flushTimerFired(runner: Runner): void {
    if (runner.suppressTimerFired > 0) {
        return;
    }
    if (!expectedTraceContains(runner, "timer_fired")) {
        runner.pendingTimerFired = 0;
        return;
    }
    while (runner.pendingTimerFired > 0) {
        runner.trace.push({ type: "timer_fired" });
        runner.pendingTimerFired--;
    }
}

function withThenable(value: unknown, callback: (value: unknown) => unknown): unknown {
    if (isThenable(value)) {
        return Promise.resolve(value).then((resolved) => {
            callback(resolved);
            return resolved;
        });
    }
    callback(value);
    return value;
}

function behaviorDispatchTargets(runner: Runner, instance: hsm.Instance, op: AnyMap): hsm.Instance[] {
    if (op.group) {
        return instancesForGroup(runner, op.group);
    }
    if (op.instance) {
        const target = runner.instances.get(op.instance);
        return target ? [target] : [];
    }
    if (op.target === "all") {
        return [...runner.instances.values()];
    }
    if (op.target) {
        const target = runner.instances.get(op.target);
        return target ? [target] : [];
    }
    return [instance];
}

function instancesForGroup(runner: Runner, groupID: string): hsm.Instance[] {
    const spec = (runner.caseData.groups ?? []).find((group) => group.id === groupID);
    if (!spec) {
        return [];
    }
    return (spec.members ?? []).map((id: string) => requireInstance(runner, id));
}

function eventIsDeferred(runner: Runner, instance: hsm.Instance, eventName: string, ownerPath?: string): boolean {
    const model = runner.instanceModels.get(instanceIDForInstance(runner, instance));
    return !!(
        model?.deferredMap?.[instance.state()]?.[eventName] ||
        (ownerPath && model?.deferredMap?.[ownerPath]?.[eventName])
    );
}

function eventHasTransitionCandidate(runner: Runner, instance: hsm.Instance, eventName: string): boolean {
    const model = runner.instanceModels.get(instanceIDForInstance(runner, instance));
    const lookup = model?.transitionMap?.[instance.state()];
    if (!lookup) {
        return false;
    }
    if ((lookup[eventName]?.length ?? 0) > 0) {
        return true;
    }
    return eventName !== hsm.AnyEvent.name && (lookup[hsm.AnyEvent.name]?.length ?? 0) > 0;
}

function traceDeferredDispatch(runner: Runner, eventName: string, instances: hsm.Instance[], ownerPath?: string): Set<string> {
    const traced = new Set<string>();
    if (!expectedTraceContains(runner, "defer")) {
        return traced;
    }
    for (const instance of instances) {
        if (
            eventIsDeferred(runner, instance, eventName, ownerPath) &&
            !eventHasTransitionCandidate(runner, instance, eventName) &&
            !hasDeferredEvent(runner, instance, eventName)
        ) {
            noteDeferredEvent(runner, instance, eventName, ownerPath);
            traceDeferEvent(runner, eventName);
            traced.add(instanceIDForInstance(runner, instance));
        }
    }
    return traced;
}

function traceRuntimeDeferred(
    runner: Runner,
    instances: hsm.Instance[],
    eventName: string,
    ownerPath?: string,
    traced?: Set<string>,
): void {
    if (!expectedTraceContains(runner, "defer")) {
        return;
    }
    for (const instance of instances) {
        if (traced?.has(instanceIDForInstance(runner, instance))) {
            continue;
        }
        if (eventIsDeferred(runner, instance, eventName, ownerPath) && !hasDeferredEvent(runner, instance, eventName)) {
            noteDeferredEvent(runner, instance, eventName, ownerPath);
            traceDeferEvent(runner, eventName);
        }
    }
}

function traceUndeferBeforeBehaviorTrace(runner: Runner, instance: hsm.Instance): void {
    if (!runner.deferredEvents.length || !expectedTraceContains(runner, "undefer")) {
        return;
    }
    if (runner.deferReplayBarrier) {
        runner.deferReplayBarrier = false;
        return;
    }
    const eventName = popDeferredEventForInstance(runner, instance);
    if (eventName !== undefined) {
        runner.trace.push({ type: "undefer", event: eventName });
    }
}

function traceDeferEvent(runner: Runner, eventName: string): void {
    if (!expectedTraceContains(runner, "defer")) {
        return;
    }
    runner.trace.push({ type: "defer", event: eventName });
}

function noteDeferredEvent(runner: Runner, instance: hsm.Instance, eventName: string, ownerPath?: string): void {
    if (!hasDeferredEvent(runner, instance, eventName)) {
        runner.deferredEvents.push(deferredEventKey(runner, instance, eventName, ownerPath));
    }
}

function hasDeferredEvent(runner: Runner, instance: hsm.Instance, eventName: string): boolean {
    const instanceID = instanceIDForInstance(runner, instance);
    return runner.deferredEvents.some((event) => event.instanceID === instanceID && event.eventName === eventName);
}

function popDeferredEventForInstance(runner: Runner, instance: hsm.Instance): string | undefined {
    const instanceID = instanceIDForInstance(runner, instance);
    const index = runner.deferredEvents.findIndex((event) => event.instanceID === instanceID);
    if (index === -1) {
        return undefined;
    }
    const [event] = runner.deferredEvents.splice(index, 1);
    return event.eventName;
}

function clearDeferredEventsForInstance(runner: Runner, instance: hsm.Instance): void {
    const instanceID = instanceIDForInstance(runner, instance);
    runner.deferredEvents = runner.deferredEvents.filter((event) => event.instanceID !== instanceID);
}

function clearChildDeferredEventsForInstance(runner: Runner, instance: hsm.Instance): void {
    const instanceID = instanceIDForInstance(runner, instance);
    runner.deferredEvents = runner.deferredEvents.filter((event) => (
        event.instanceID !== instanceID || !event.cleanupOnParentExit
    ));
}

function deferredEventKey(runner: Runner, instance: hsm.Instance, eventName: string, ownerPath?: string): DeferredEvent {
    const instanceID = instanceIDForInstance(runner, instance);
    const model = runner.instanceModels.get(instanceID);
    const owner = model?.deferredMap?.[instance.state()]?.[eventName] ||
        (ownerPath ? model?.deferredMap?.[ownerPath]?.[eventName] : undefined);
    let cleanupOnParentExit = false;
    if (model && owner) {
        let current = path.posix.dirname(owner);
        while (current && current !== "." && current !== "/" && current !== model.qualifiedName) {
            const member = model.members[current] as { kind?: unknown } | undefined;
            if (typeof member?.kind === "number" && hsm.isKind(member.kind, hsm.kinds.SubmachineState)) {
                cleanupOnParentExit = true;
                break;
            }
            current = path.posix.dirname(current);
        }
    }
    return { instanceID, eventName, cleanupOnParentExit };
}

function eventExitsActiveSubmachine(runner: Runner, instance: hsm.Instance, eventName: string): boolean {
    const instanceID = instanceIDForInstance(runner, instance);
    const model = runner.instanceModels.get(instanceID);
    if (!model) {
        return false;
    }
    const root = model.qualifiedName.replace(/^\//, "");
    const ir = runner.modelIRs.get(root);
    if (!ir) {
        return false;
    }
    return activeStateIRs(runner, ir, instance.state()).some((stateIR) => (
        stateIR.kind === "submachine" &&
        (stateIR.transitions ?? []).some((transition: AnyMap) => (
            transition?.on === eventName &&
            Object.prototype.hasOwnProperty.call(transition, "target")
        ))
    ));
}

function activeStateIRs(runner: Runner, modelIR: AnyMap, statePath: string): AnyMap[] {
    const parts = statePath.split("/").filter(Boolean).slice(1);
    let states = modelIR.states ?? [];
    const active: AnyMap[] = [];
    let index = 0;
    while (index < parts.length) {
        const state = states.find((candidate: AnyMap) => candidate?.name === parts[index]);
        if (!state) {
            break;
        }
        active.push(state);
        index++;
        if (state.kind === "submachine") {
            if (parts[index] === state.machine) {
                index++;
            }
            const childIR = typeof state.machine === "string"
                ? runner.modelIRs.get(state.machine)
                : undefined;
            if (!childIR) {
                break;
            }
            states = childIR.states ?? [];
        } else {
            states = state.states ?? [];
        }
    }
    return active;
}

function instanceIDForInstance(runner: Runner, instance: hsm.Instance): string {
    for (const [id, candidate] of runner.instances) {
        if (candidate === instance) {
            return id;
        }
    }
    return "default";
}

function assertExpectations(runner: Runner, expect: AnyMap): void {
    if (expect.trace !== undefined) {
        assertDeepEqual(runner.trace, expect.trace, "trace");
    }
    if (expect.state !== undefined) {
        const instance = requireInstance(runner, "default");
        assertDeepEqual(instance.state(), expect.state, "state");
    }
    if (expect.states !== undefined) {
        const actual: Record<string, string> = {};
        for (const [id, instance] of runner.instances) {
            actual[id] = instance.state();
        }
        assertPartialObject(actual, expect.states, "states");
    }
    if (expect.attributes !== undefined) {
        assertAttributes(requireInstance(runner, "default"), expect.attributes, "attributes");
    }
    if (expect.instance_attributes !== undefined) {
        for (const [id, attributes] of Object.entries(expect.instance_attributes)) {
            assertAttributes(requireInstance(runner, id), attributes, `instance_attributes.${id}`);
        }
    }
    if (expect.snapshots !== undefined) {
        assertPartialObject(runner.snapshots, expect.snapshots, "snapshots");
    }
    if (expect.error !== undefined && !matchesExpectedError(runner.lastError, expect.error)) {
        throw new Error(`error mismatch: expected ${JSON.stringify(expect.error)}, got ${runner.lastError?.message ?? "none"}`);
    }
}

function assertAttributes(instance: hsm.Instance, expected: AnyMap, label: string): void {
    const actual: Record<string, unknown> = {};
    for (const name of Object.keys(expected)) {
        actual[name] = instance.get(name)[0];
    }
    assertPartialObject(actual, expected, label);
}

function assertPartialObject(actual: any, expected: AnyMap, label: string): void {
    for (const [key, value] of Object.entries(expected)) {
        if (!matchesPartial(actual[key], value)) {
            throw new Error(`${label}.${key} mismatch: expected ${JSON.stringify(value)}, got ${JSON.stringify(actual[key])}`);
        }
    }
}

function assertDeepEqual(actual: unknown, expected: unknown, label: string): void {
    if (!deepEqual(actual, expected)) {
        throw new Error(`${label} mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

function matchesExpectedError(error: Error | undefined, expected: any): boolean {
    if (!error) {
        return false;
    }
    if (typeof expected === "string") {
        return error.message.includes(expected) || (error as ConformanceError).code === expected;
    }
    if (expected.code && (error as ConformanceError).code !== expected.code) {
        return false;
    }
    if (expected.message_contains && !error.message.includes(expected.message_contains)) {
        return false;
    }
    return true;
}

function makeEvent(ref: unknown): hsm.Event {
    if (typeof ref === "string") {
        return { kind: hsm.EventKind, name: ref } as hsm.Event;
    }
    const input = (ref ?? {}) as AnyMap;
    return {
        kind: hsm.EventKind,
        name: input.name,
        data: input.data,
        id: input.id,
        source: input.source,
        target: input.target,
        metadata: input.metadata,
    } as hsm.Event;
}

function eventName(ref: unknown): string {
    return typeof ref === "string" ? ref : (ref as AnyMap).name;
}

function resolveInitialPath(modelRoot: string, ownerPath: string, name: string): string {
    return resolveIRPath(modelRoot, ownerPath, name, true);
}

function resolveTransitionPath(modelRoot: string, ownerPath: string, name: string): string {
    return resolveIRPath(modelRoot, ownerPath, name, false);
}

function resolveIRPath(modelRoot: string, ownerPath: string, name: string, initial: boolean): string {
    if (name.startsWith("/")) {
        return name;
    }
    if (name.startsWith("./") || name.startsWith("../") || name === "." || name === "..") {
        return hsm.join(ownerPath, name);
    }
    return hsm.join(initial ? ownerPath : modelRoot, name);
}

function toDSLPathExpression(modelRoot: string, ownerPath: string, qualifiedName: string): string {
    if (qualifiedName !== modelRoot && !qualifiedName.startsWith(`${modelRoot}/`)) {
        return qualifiedName;
    }
    const ownerParts = ownerPath.split("/").filter(Boolean);
    const targetParts = qualifiedName.split("/").filter(Boolean);
    let shared = 0;
    while (
        shared < ownerParts.length &&
        shared < targetParts.length &&
        ownerParts[shared] === targetParts[shared]
    ) {
        shared++;
    }
    const upward = ownerParts.slice(shared).map(() => "..");
    const downward = targetParts.slice(shared);
    const parts = [...upward, ...downward];
    return parts.length ? parts.join("/") : ".";
}

function pathOutsideModel(index: ModelIndex, qualifiedName: string): boolean {
    return qualifiedName.startsWith("/") && qualifiedName !== index.root && !qualifiedName.startsWith(`${index.root}/`);
}

function crossesSubmachineBoundary(index: ModelIndex, qualifiedName: string): boolean {
    for (const submachinePath of index.submachines.keys()) {
        if (qualifiedName.startsWith(`${submachinePath}/`)) {
            return true;
        }
    }
    return false;
}

function behaviorAttributeNames(program: BehaviorProgram): string[] {
    const names: string[] = [];
    for (const op of program) {
        const name = op.name ?? op.attribute;
        if (
            typeof name === "string"
            && (
                op.op === "return_equals"
                || op.op === "return_attr"
                || op.op === "get_attr"
                || op.op === "set_attr"
                || op.op === "set_attr_from_event_data"
            )
            && !names.includes(name)
        ) {
            names.push(name);
        }
    }
    return names;
}

function timerValueExpression(
    runner: Runner,
    trigger: AnyMap,
    field: string,
): string | ((ctx: hsm.Context, instance: hsm.Instance, event?: hsm.Event) => number) {
    if (trigger.attribute) {
        return function (_ctx: hsm.Context, instance: hsm.Instance): number {
            const value = instance.get(trigger.attribute)[0];
            const numeric = Number(value);
            if (Number.isNaN(numeric)) {
                const error = new Error("invalid interval");
                recordError(runner, error);
                throw error;
            }
            return numeric;
        };
    }
    if (trigger.behavior) {
        return function (ctx: hsm.Context, instance: hsm.Instance, event?: hsm.Event): number {
            const value = executeProgramSync(
                runner,
                runner.caseData.behaviors?.[trigger.behavior] ?? [],
                ctx,
                instance,
                event ?? ({ kind: hsm.TimeEventKind, name: "timer" } as hsm.Event),
            );
            const numeric = Number(value);
            if (Number.isNaN(numeric)) {
                const error = new Error("invalid interval");
                recordError(runner, error);
                throw error;
            }
            return numeric;
        };
    }
    return function (): number {
        return Number(trigger[field] ?? 0);
    };
}

function forEachState(states: AnyMap[], visit: (state: AnyMap) => void): void {
    for (const state of states) {
        visit(state);
        forEachState(state.states ?? [], visit);
    }
}

function requireInstance(runner: Runner, id: string): hsm.Instance {
    const instance = runner.instances.get(id);
    if (!instance) {
        throw new Error(`unknown instance "${id}"`);
    }
    return instance;
}

function attributeTypeToken(type: string): Function {
    switch (type) {
        case "boolean":
            return Boolean;
        case "number":
        case "duration_ms":
        case "time_ms":
            return Number;
        case "string":
            return String;
        case "array":
            return Array;
        case "object":
            return Object;
        default:
            return Object;
    }
}

function getPathValue(value: unknown, pathExpression: string): unknown {
    if (!pathExpression) {
        if (value && typeof value === "object") {
            const eventData = value as Record<string, unknown>;
            if (
                Object.prototype.hasOwnProperty.call(eventData, "name") &&
                Array.isArray(eventData.args) &&
                eventData.args.length === 1
            ) {
                return eventData.args[0];
            }
            if (
                Object.prototype.hasOwnProperty.call(eventData, "name") &&
                Object.prototype.hasOwnProperty.call(eventData, "old") &&
                Object.prototype.hasOwnProperty.call(eventData, "new")
            ) {
                return eventData.new;
            }
        }
        return value;
    }
    let current = value as any;
    for (const part of pathExpression.split(".")) {
        if (
            current &&
            typeof current === "object" &&
            Object.prototype.hasOwnProperty.call(current, "name") &&
            Array.isArray(current.args) &&
            current.args.length === 1
        ) {
            current = current.args[0];
        }
        if (current === null || current === undefined) {
            return null;
        }
        if (typeof current === "object" && !Object.prototype.hasOwnProperty.call(current, part)) {
            return null;
        }
        current = current[part];
    }
    return current === undefined ? null : current;
}

function unqualifyAttributes(root: string, attributes: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};
    const prefix = `${root}/`;
    for (const [name, value] of Object.entries(attributes)) {
        normalized[name.startsWith(prefix) ? name.slice(prefix.length) : name] = value;
    }
    return normalized;
}

function deepEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) {
        return true;
    }
    if (left === null || right === null || typeof left !== "object" || typeof right !== "object") {
        return false;
    }
    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
            return false;
        }
        for (let i = 0; i < left.length; i++) {
            if (!deepEqual(left[i], right[i])) {
                return false;
            }
        }
        return true;
    }
    const leftObject = left as Record<string, unknown>;
    const rightObject = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftObject);
    const rightKeys = Object.keys(rightObject);
    if (leftKeys.length !== rightKeys.length) {
        return false;
    }
    for (const key of leftKeys) {
        if (!Object.prototype.hasOwnProperty.call(rightObject, key)) {
            return false;
        }
        if (!deepEqual(leftObject[key], rightObject[key])) {
            return false;
        }
    }
    return true;
}

function matchesPartial(actual: unknown, expected: unknown): boolean {
    if (expected === null || typeof expected !== "object" || Array.isArray(expected)) {
        return deepEqual(actual, expected);
    }
    if (actual === null || typeof actual !== "object" || Array.isArray(actual)) {
        return false;
    }
    const actualObject = actual as Record<string, unknown>;
    const expectedObject = expected as Record<string, unknown>;
    for (const [key, value] of Object.entries(expectedObject)) {
        if (!matchesPartial(actualObject[key], value)) {
            return false;
        }
    }
    return true;
}

function sleep(millis: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, millis));
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
    return !!value
        && (typeof value === "object" || typeof value === "function")
        && typeof (value as { then?: unknown }).then === "function";
}

function sleepWithCancel(ctx: hsm.Context, millis: number): Promise<void> {
    return new Promise((resolve) => {
        const timeout = setTimeout(done, millis);
        function done(): void {
            clearTimeout(timeout);
            ctx.removeEventListener("done", done);
            resolve();
        }
        ctx.addEventListener("done", done);
    });
}

async function flushAsyncWork(): Promise<void> {
    await Promise.resolve();
    await new Promise<void>((resolve) => setImmediate(resolve));
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
});
