### Skill: Strict TypeScript Setup
- **No `any`**: The use of `any` is strictly prohibited. If a type is unknown at runtime, use `unknown` and implement type guards/narrowing.
- **Return Types**: All exported functions and methods must have explicit return types (`function fn(): string`). Do not rely on inference for boundaries.
- **Interfaces over Types**: Use `interface` for object shapes instead of `type`. Use `type` only for unions, intersections, or primitives.
- **ESM Syntax**: Enforce strict ESM imports with `.js` extensions for local files if running in Node without bundlers (e.g. `import { foo } from './foo.js'`).
- **Null Safety**: Always use Optional Chaining (`?.`) and Nullish Coalescing (`??`) over older explicit null checks where applicable.
