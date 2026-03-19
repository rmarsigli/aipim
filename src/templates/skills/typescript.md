### Skill: Strict TypeScript Setup
- **No `any`**: The use of `any` is strictly prohibited. Use `unknown` with type guards or narrowing for runtime-uncertain values.
- **Return Types**: All exported functions and methods must have explicit return types. Do not rely on inference at public boundaries.
- **`satisfies` Operator**: Use `satisfies` to validate a value matches a type without widening it (`const config = { ... } satisfies Config`).
- **`as const`**: Use `as const` for literal objects/arrays that must not be widened (`const ROLES = ['admin', 'user'] as const`).
- **Interfaces vs Types**: Use `interface` for object shapes (supports declaration merging). Use `type` only for unions, intersections, or mapped types.
- **Readonly**: Prefer `readonly` arrays (`readonly string[]`) and `Readonly<T>` for data that must not be mutated after creation.
- **ESM Syntax**: Use `.js` extensions on local imports in Node ESM projects (`import { foo } from './foo.js'`). Never use `require()`.
- **Null Safety**: Use `?.` and `??` over explicit null checks. Avoid non-null assertion (`!`) unless provably safe — add a comment if you use it.
- **Generic Constraints**: Always constrain generics (`<T extends object>`). Never leave generics unconstrained when the shape is known.
