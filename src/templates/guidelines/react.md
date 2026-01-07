## React with Typescript Development Guidelines

### MANDATORY CODING STANDARDS - NEVER VIOLATE THESE:
2. **ALWAYS** write everything in **INTERNATIONAL ENGLISH**
3. **NEVER** add semicolons at the end of lines
4. **ALL** files must be kebab-case (`tech-detector.tsx`, not `TechDetector.tsx`)
5. **NO** inline comments, avoid **AVOID** comments unless absolutely necessary
6. In `ts` and `tsx` files **ALWAYS** use tab for indentation with size 4
7. **NO** trailing commas in objects/arrays
8. Tailwind classes **ONLY**, no custom CSS unless absolutely necessary
9. **STRICT TYPE!** I want a strong typing code
10. **NEVER** create solo .md files in root (only `README.md`, `CONTRIBUTING.md`, `CODE_GUIDELINES.md`), use only  `./.ia` or  `./docs folder`
11. **MODERN** approach, bring insights if you feel necessary
12. Check `package.json` (if needed) to see current packages versions
13. Commits are **ALWAYS** atomic, follow [conventional commits](https://www.conventionalcommits.org/en)

### EXCEPTIONS TO CODING STANDARDS:
- **`src/components/ui/*`** - These are `shadcn/ui` importable modules, **DO NOT** edit them. Keep them as imported from `shadcn/ui`