### Skill: Svelte 5 Guidelines
- **Runes**: Use runes (`$state`, `$derived`, `$effect`, `$props`) for all reactive logic in Svelte 5. Do not use the legacy `$:` reactive declarations.
- **`$state`**: Declare component state with `let count = $state(0)`. For complex objects, mutations are tracked deeply — avoid replacing the whole object unnecessarily.
- **`$derived`**: Use `$derived` for computed values (`let doubled = $derived(count * 2)`). Never compute derived values inside `$effect`.
- **`$effect`**: Use `$effect` only for side effects that synchronize with external systems. Do not use it to update other `$state` — use `$derived` instead.
- **`$props`**: Declare component props with `let { name, value = 'default' } = $props()`. Always type props with TypeScript.
- **Events**: Pass callback props for component communication (`onclick`, `onchange`) rather than using `createEventDispatcher`.
- **Stores**: Prefer runes over Svelte stores for local state. Use stores only for shared cross-component state that lives outside the component tree.
- **No Unnecessary Reactivity**: Do not wrap non-reactive data in `$state`. Use plain `const` for constants and values that never change.
