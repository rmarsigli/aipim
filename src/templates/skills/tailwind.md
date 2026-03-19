### Skill: TailwindCSS v4 Guidelines
- **Philosophy**: Tailwind v4 is CSS-first. Avoid `@apply` loops and complex SCSS abstractions.
- **Arbitrary Values**: Use arbitrary values `w-[320px]` sparingly; strictly prefer theme variables.
- **Custom Properties**: Use CSS variables integrated with Tailwind instead of overriding the entire config file.
- **Hover/Focus**: Group pseudo-classes logically (`hover:bg-blue-500 focus:ring-2 focus:ring-blue-300`).
- **Data Attributes**: Use `data-[state=active]:bg-gray-100` for dynamic state styling rather than toggling multiple atomic classes in JS.
