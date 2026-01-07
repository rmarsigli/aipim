## Vue 3 with TypeScript Development Guidelines

### MANDATORY CODING STANDARDS - NEVER VIOLATE THESE:
1. **ALWAYS** write everything in **INTERNATIONAL ENGLISH**
2. **NEVER** add semicolons at the end of lines
3. **ALL** files must be kebab-case (`user-profile.vue`, not `UserProfile.vue`)
4. **NO** inline comments, avoid **AVOID** comments unless absolutely necessary
5. In `.vue` and `.ts` files **ALWAYS** use tab for indentation with size 4
6. **NO** trailing commas in objects/arrays
7. Tailwind classes **ONLY**, no scoped `<style>` unless absolutely necessary
8. **STRICT TYPE!** Use `defineProps<Props>()` generic syntax
9. **MODERN** approach: Composition API via `<script setup lang="ts">`
10. **NEVER** create solo .md files in root

### VUE SPECIFIC:
- **Composition API**: Always use `<script setup>`
- **Reactivity**: Prefer `ref` over `reactive` for clarity
- **Components**: PascalCase for usage in templates (`<UserProfile />`)
- **State Management**: Use Pinia instead of Vuex
- **Composables**: Use `use` prefix for composable functions (e.g., `useAuth.ts`)
