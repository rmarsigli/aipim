### Skill: TailwindCSS v4 Guidelines
- **Philosophy**: Tailwind v4 is CSS-first. Configure design tokens via `@theme` in CSS, not `tailwind.config.js`.
- **Arbitrary Values**: Use `w-[320px]` sparingly; strictly prefer theme tokens. Never use arbitrary values for colors — define them in `@theme` instead.
- **Custom Properties**: Define design tokens as CSS variables inside `@theme { --color-brand: oklch(...); }` and reference via utilities like `bg-brand`.
- **Hover/Focus**: Group pseudo-classes logically (`hover:bg-blue-500 focus:ring-2 focus:ring-blue-300`). Follow the order: responsive → state → pseudo-element.
- **Data Attributes**: Use `data-[state=active]:bg-gray-100` for dynamic state styling. Do not toggle multiple atomic classes in JS to represent a single state.
- **Dark Mode**: Use `dark:` variants consistently. Do not maintain separate class sets for dark mode in JavaScript.
- **Class Order**: Follow the convention layout → spacing → typography → color → state (`flex gap-4 text-sm text-gray-700 hover:text-black`).
- **No `@apply`**: Avoid `@apply` in component stylesheets. Compose utilities directly in markup or use CSS-native selectors with `@layer components` only when truly necessary.
