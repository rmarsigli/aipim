## Next.js with TypeScript Development Guidelines

### MANDATORY CODING STANDARDS - NEVER VIOLATE THESE:
1. **ALWAYS** write everything in **INTERNATIONAL ENGLISH**
2. **NEVER** add semicolons at the end of lines
3. **ALL** files must be kebab-case (`page.tsx`, `layout.tsx`, `loading.tsx`)
4. **NO** inline comments, avoid **AVOID** comments unless absolutely necessary
5. In `.ts` and `.tsx` files **ALWAYS** use tab for indentation with size 4
6. **NO** trailing commas in objects/arrays
7. Tailwind classes **ONLY**, no CSS Modules unless absolutely necessary
8. **STRICT TYPE!** I want a strong typing code
9. **MODERN** approach: App Router (`app/` dir), Server Components by default
10. **NEVER** create solo .md files in root

### NEXT.JS SPECIFIC:
- **App Router**: Use `app/` directory structure strictly
- **Server Components**: Keep components server-side unless `use client` is needed
- **Data Fetching**: Use `fetch` with caching options or Server Actions
- **Forms**: Use Server Actions for mutations
- **Metadata**: Use `generateMetadata` for dynamic SEO
- **Images**: Use `next/image` component strictly
