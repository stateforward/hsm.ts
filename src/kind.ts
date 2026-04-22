export type Kind = number;

const length = 48;
const idLength = 8;
const depthMax = length / idLength;
const idMask = (1 << idLength) - 1;

let counter = 0;

const nextId = () => {
  const id = counter & idMask;
  counter += 1;
  return id;
};

const extractId = (kindValue: number, depth: number) =>
  Math.floor(kindValue / Math.pow(2, idLength * depth)) & idMask;

export const bases = (id: number) => {
  const baseKinds = Array<number>(depthMax).fill(0);

  for (let index = 1; index < depthMax; index += 1) {
    baseKinds[index - 1] = extractId(id, index);
  }

  return baseKinds;
};

export function kind(...baseKinds: number[]) {
  let result = nextId();
  const used: Record<number, true> = {};
  let usedCount = 0;

  for (const base of baseKinds) {
    for (let depth = 0; depth < depthMax; depth += 1) {
      const baseId = extractId(base, depth);
      if (baseId === 0) {
        break;
      }
      if (used[baseId]) {
        continue;
      }

      used[baseId] = true;
      usedCount += 1;
      result += baseId * Math.pow(2, usedCount * idLength);
    }
  }

  return result;
}

export function isKind(kindValue: number, ...baseKinds: number[]) {
  for (const base of baseKinds) {
    const baseId = base & idMask;
    if (kindValue === baseId) {
      return true;
    }

    for (let depth = 0; depth < depthMax; depth += 1) {
      const currentId = extractId(kindValue, depth);
      if (currentId === baseId) {
        return true;
      }
    }
  }

  return false;
}

export const makeKind = (...baseKinds: number[]) => kind(...baseKinds);

export const kinds = {
  Null: makeKind(),
  Element: makeKind(),
  Partial: 0,
  Vertex: 0,
  Constraint: 0,
  Behavior: 0,
  Namespace: 0,
  Concurrent: 0,
  Sequential: 0,
  StateMachine: 0,
  Attribute: 0,
  State: 0,
  Model: 0,
  Transition: 0,
  Internal: 0,
  External: 0,
  Local: 0,
  Self: 0,
  Event: 0,
  CompletionEvent: 0,
  ChangeEvent: 0,
  ErrorEvent: 0,
  TimeEvent: 0,
  CallEvent: 0,
  Pseudostate: 0,
  Initial: 0,
  FinalState: 0,
  Choice: 0,
  Junction: 0,
  DeepHistory: 0,
  ShallowHistory: 0,
} satisfies Record<string, Kind>;

kinds.Partial = makeKind(kinds.Element);
kinds.Vertex = makeKind(kinds.Element);
kinds.Constraint = makeKind(kinds.Element);
kinds.Behavior = makeKind(kinds.Element);
kinds.Namespace = makeKind(kinds.Element);
kinds.Concurrent = makeKind(kinds.Behavior);
kinds.Sequential = makeKind(kinds.Behavior);
kinds.StateMachine = makeKind(kinds.Concurrent, kinds.Namespace);
kinds.Attribute = makeKind(kinds.Element);
kinds.State = makeKind(kinds.Vertex, kinds.Namespace);
kinds.Model = makeKind(kinds.State);
kinds.Transition = makeKind(kinds.Element);
kinds.Internal = makeKind(kinds.Transition);
kinds.External = makeKind(kinds.Transition);
kinds.Local = makeKind(kinds.Transition);
kinds.Self = makeKind(kinds.Transition);
kinds.Event = makeKind(kinds.Element);
kinds.CompletionEvent = makeKind(kinds.Event);
kinds.ChangeEvent = makeKind(kinds.Event);
kinds.ErrorEvent = makeKind(kinds.CompletionEvent);
kinds.TimeEvent = makeKind(kinds.Event);
kinds.CallEvent = makeKind(kinds.Event);
kinds.Pseudostate = makeKind(kinds.Vertex);
kinds.Initial = makeKind(kinds.Pseudostate);
kinds.FinalState = makeKind(kinds.State);
kinds.Choice = makeKind(kinds.Pseudostate);
kinds.Junction = makeKind(kinds.Pseudostate);
kinds.DeepHistory = makeKind(kinds.Pseudostate);
kinds.ShallowHistory = makeKind(kinds.Pseudostate);

export const Kinds = kinds;
export const MakeKind = makeKind;
export const IsKind = isKind;
