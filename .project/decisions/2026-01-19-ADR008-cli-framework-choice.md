---
number: 008
title: "Use Commander.js for CLI Framework"
date: 2026-01-19
status: accepted
authors: [Rafhael Marsigli]
review_date: 2026-07-19
tags: [architecture, dependencies, cli]
---

# ADR-008: Use Commander.js for CLI Framework

## Status

**Accepted**

Date: 2026-01-19

## Context

**Problem:**
AIPIM requires a robust CLI framework to handle commands, options, arguments, help text, and version display. The framework must be intuitive, well-documented, and provide a good developer experience.

**Current Situation:**
- AIPIM has 10+ commands (install, update, start, resume, validate, etc.)
- Complex option parsing needed (flags, multi-value, defaults)
- Need subcommand support with command-specific options
- Help text and usage generation required
- Version display and banner customization needed
- TypeScript support important for type safety

**Forces:**
- Technical: Need type-safe, well-tested CLI parsing
- DX: Must be easy to add new commands
- Bundle Size: Should be lightweight (<50KB)
- Ecosystem: Wide adoption and good documentation
- Maintenance: Active development and community support

## Decision

**We will:** Use Commander.js (v14.0.2+) as the CLI framework for AIPIM.

**Implementation:**
```typescript
// src/cli.ts
import { Command } from 'commander'

const program = new Command()

program
    .name('aipim')
    .description('Artificial Intelligence Project Instruction Manager')
    .version(version)
    .addHelpText('before', chalk.blue(banner))
    .option('-v, --verbose', 'Enable verbose logging')

program
    .command('install')
    .description('Install AIPIM in current directory')
    .option('-y, --yes', 'Skip confirmation prompts')
    .option('--ai <ais...>', 'AI tools to use')
    .option('--guidelines <frameworks...>', 'Framework guidelines')
    .action(async (options) => {
        await install(options as InstallOptions)
    })

program.parse()
```

**Rationale:**
1. **Technical fit**: Excellent TypeScript support, type-safe option handling
2. **Operational**: Lightweight (33KB), zero dependencies, battle-tested
3. **Strategic**: Industry standard (used by Vue CLI, Create React App, many others)

## Alternatives Considered

### Option A: Yargs

Feature-rich CLI parser with builder pattern API.

**Pros:**
- Very powerful option parsing
- Built-in validation and coercion
- Excellent for complex argument scenarios
- Good TypeScript support
- Middleware support

**Cons:**
- **Heavier weight** (~200KB vs Commander's 33KB)
- More verbose API
- Steeper learning curve
- Builder pattern can feel over-engineered for simple CLIs
- Slower performance (noticeable on cold starts)

**Rejected because:** Bundle size overhead not justified for AIPIM's needs. Commander provides sufficient features with better DX.

### Option B: oclif

Full-featured CLI framework by Heroku/Salesforce.

**Pros:**
- Enterprise-grade features
- Plugin system
- Auto-generated documentation
- Built-in testing utilities
- Command discovery

**Cons:**
- **Much heavier** (~1MB+ with dependencies)
- Opinionated project structure
- Over-engineered for simple CLIs
- Requires more boilerplate
- Class-based architecture (not always preferred)

**Rejected because:** Massive overkill for AIPIM. We don't need plugin system or enterprise features. Too opinionated.

### Option C: Custom Parser

Build custom argument parser using process.argv.

**Pros:**
- Zero dependencies
- Full control over behavior
- Minimal bundle size
- No learning curve for maintainers

**Cons:**
- **Reinventing the wheel**
- Edge cases difficult to handle (--flag=value, -- separator, etc.)
- No help text generation
- Time-consuming to build and maintain
- Error-prone (parsing is harder than it looks)
- No TypeScript inference

**Rejected because:** Not worth the development and maintenance cost. Commander is lightweight enough and provides significant value.

### Option D: Meow

Minimalist CLI helper by Sindre Sorhus.

**Pros:**
- Very lightweight (~10KB)
- Simple, clean API
- Good for simple CLIs
- Fast

**Cons:**
- **Too minimalist** for AIPIM's needs
- No subcommand support (requires manual routing)
- Basic help text generation
- Limited option parsing features
- Would need to build command routing ourselves

**Rejected because:** Too basic. Subcommand support is critical for AIPIM's 10+ commands. Would end up reimplementing Commander features.

## Consequences

### Positive
- [x] Simple, intuitive API (verified in production)
- [x] Excellent TypeScript support (verified)
- [x] Lightweight bundle size (33KB) (verified)
- [x] Auto-generated help text (verified)
- [x] Command hooks (preAction, postAction) (used for verbose mode)
- [x] Wide adoption (1M+ dependents on npm) (verified)
- [x] Active maintenance (v14 released 2024) (verified)
- [x] Zero dependencies (verified)

### Negative
- [x] Less powerful than Yargs for complex validation
  - Mitigation: We validate in command logic anyway, not a limitation
- [x] No built-in plugin system (like oclif)
  - Mitigation: Not needed for AIPIM's scope
- [x] Basic argument coercion only
  - Mitigation: Sufficient for our string/boolean/array needs

### Neutral
- Commands defined imperatively (not declarative)
- Help text customization requires manual formatting
- No built-in config file support (we don't need it)

## Implementation

**Plan:**
1. [x] Install Commander.js v14+
2. [x] Define base program with name, description, version
3. [x] Implement all commands (install, update, start, etc.)
4. [x] Add global options (--verbose, --version)
5. [x] Implement command hooks for logging
6. [x] Add custom banner to help text
7. [x] Type command options with TypeScript interfaces

**Technical:**
```typescript
// Command with typed options
interface InstallOptions {
    yes?: boolean
    preset?: string
    ai?: string[]
    guidelines?: string[]
    compact?: boolean
    full?: boolean
    dryRun?: boolean
}

program
    .command('install')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (options: unknown) => {
        await install(options as InstallOptions)
    })
```

**Bundle Analysis:**
```bash
commander@14.0.2: 33.2 KB (minified)
Zero transitive dependencies
```

## Validation

**Success Criteria:**
- [x] All commands work correctly ✅
- [x] Help text displays properly ✅
- [x] Options parsed correctly (flags, arrays, defaults) ✅
- [x] TypeScript types inferred correctly ✅
- [x] Bundle size acceptable (<50KB) ✅

**Monitoring:**
- Bundle size: Monitor in CI (should stay <50KB)
- Performance: Command startup time <100ms
- Community: Commander.js maintenance status (check quarterly)

**Review Date:** 2026-07-19

Review if:
- Commander.js becomes unmaintained
- Significant new CLI framework emerges with better DX
- Bundle size becomes a concern (unlikely)
- Need features not available in Commander (plugins, etc.)

## Lessons Learned

**Went Well:**
- Commander's API extremely intuitive, new commands easy to add
- TypeScript integration seamless
- Help text auto-generation saves maintenance effort
- Command hooks perfect for global --verbose flag
- Zero dependency overhead

**Improve:**
- Could document command addition pattern in CONTRIBUTING.md
- Consider adding command generator script for consistency

**Surprises:**
- `.action()` async support worked perfectly (no special handling needed)
- Custom banner integration cleaner than expected (`addHelpText`)
- Multi-value options (`--ai <ais...>`) just worked with arrays

## Related

**Depends on:**
- commander@^14.0.2

**Impacts:**
- All command files (src/commands/*.ts)
- CLI entry point (src/cli.ts)
- Help text displayed to users
- Future command additions

**Related ADRs:**
- ADR-006: Output vs Logging (CLI output handled separately)

## References

- Commander.js: https://github.com/tj/commander.js
- NPM Package: https://www.npmjs.com/package/commander
- TypeScript Guide: https://github.com/tj/commander.js/blob/master/docs/typescript.md
- Implementation: `src/cli.ts`
- Bundle Size: https://bundlephobia.com/package/commander@14.0.2

## Approval

**Decided by:** Rafhael Marsigli
**Date:** 2026-01-19
**Status:** ✅ Approved

---

**Version:** 1.0
**Last Updated:** 2026-01-19
