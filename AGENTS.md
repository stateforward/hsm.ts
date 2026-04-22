# hsm.ts Agent Instructions

`hsm.ts` is a standalone TypeScript implementation of the HSM runtime and DSL.

## Non-negotiable rules

- `hsm.js` is an implementation reference only. Do not import from it, depend on it at runtime, or treat it as the source of truth for package architecture.
- The runtime in `src/hsm.ts` must be real TypeScript, not JavaScript copied into a `.ts` file.
- JSDoc-based structural typing is forbidden in the TypeScript runtime. Use actual TypeScript types, interfaces, classes, generics, and typed functions.
- `// @ts-nocheck` is forbidden in `hsm.ts`.
- Prototype-mutation constructor patterns from the JS runtime are not acceptable in the TypeScript runtime unless there is a strong, documented reason.
- Do not paper over runtime typing problems by moving all safety into `src/index.ts`. The runtime itself must typecheck.

## Rewrite expectations

- Prefer direct TypeScript implementations over façade-only fixes.
- If behavior is copied from `hsm.js`, translate it into idiomatic TypeScript rather than preserving JS-era structure.
- Keep public runtime semantics aligned with `hsm.go` and `hsm.js` where intended, but express them with native TypeScript code.
- When parity and implementation quality conflict, stop and make the tradeoff explicit instead of hiding it behind declaration files.

## Verification bar

- `src/hsm.ts` must pass TypeScript checking without `@ts-nocheck`.
- Public declaration output must come from the actual TypeScript implementation, not from hand-waving around broken runtime types.
- Tests should validate the TypeScript runtime directly, not just a typed façade.
