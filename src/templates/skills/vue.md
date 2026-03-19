### Skill: Vue 3 Guidelines
- **Composition API**: Always use `<script setup>` for new components. Never use Options API for new code.
- **Reactivity Primitives**: Use `ref()` for primitives, `reactive()` for complex objects. Never destructure `reactive()` directly — use `toRefs()` to preserve reactivity.
- **Computed**: Use `computed()` for all derived state. Never recalculate values inline inside the template.
- **Watchers**: Prefer `computed` over `watch` for derived values. Use `watchEffect` when a side effect depends on multiple reactive sources.
- **Emits**: Declare emits with typed `defineEmits<{ eventName: [payload: Type] }>()`. Never emit undeclared events.
- **Props**: Declare props with `defineProps<{ ... }>()`. Provide default values via `withDefaults`. Mark props that must not be mutated as `readonly`.
- **Composables**: Extract reusable stateful logic into composables (`use*.ts`). Keep components as thin orchestration layers.
- **Template Expressions**: Keep template expressions simple and readable. Move complex logic to `computed` properties or methods.
