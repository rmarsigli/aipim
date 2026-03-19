### Skill: React Guidelines
- **Functional Only**: Write functional components exclusively. Never create class components for new code.
- **Hooks Rules**: Never call hooks conditionally or inside loops. Extract complex stateful logic into custom hooks (`use*.ts`).
- **State Granularity**: Prefer local state. Lift state only when two components genuinely share it. Use `useReducer` for state with multiple related sub-values.
- **Effects**: Use `useEffect` only to synchronize with external systems (DOM, subscriptions, third-party libs). Never use it to derive state — compute it inline or with `useMemo`.
- **Memoization**: Apply `useMemo`/`useCallback` only when a measurable performance issue exists. Do not pre-optimize.
- **Keys**: Never use array index as a `key` for dynamic lists. Use stable, unique identifiers from the data.
- **Props Typing**: Define all component props with TypeScript interfaces. Never use implicit `any` for props or event handlers.
- **Mutations in Events**: Trigger data mutations (API calls, state updates) inside event handlers, not inside effects.
