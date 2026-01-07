## Astro Development Guidelines

### MANDATORY CODING STANDARDS - NEVER VIOLATE THESE:
1. **ALWAYS** write everything in **INTERNATIONAL ENGLISH**
2. **NEVER** add semicolons at the end of lines
3. **ALL** files must be kebab-case (`nav-bar.astro`, not `NavBar.astro`)
4. **NO** inline comments, avoid **AVOID** comments unless absolutely necessary
5. In `.astro`, `.ts` and `.tsx` files **ALWAYS** use tab for indentation with size 4
6. **NO** trailing commas in objects/arrays
7. Tailwind classes **ONLY**, no scoped `<style>` unless absolutely necessary
8. **STRICT TYPE!** Use `interface Props` for component props
9. **MODERN** approach: Use Content Collections for data, View Transitions for navigation
10. **NEVER** create solo .md files in root (only `README.md` etc)

### ASTRO SPECIFIC:
- **Islands Architecture**: Use `client:load`, `client:visible` only when interactivity is required
- **Image Optimization**: Always use `<Image />` component from `astro:assets`
- **Routing**: Prefer file-based routing in `src/pages`
- **Data Fetching**: Do top-level await in frontmatter via `---` fences