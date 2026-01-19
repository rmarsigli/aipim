---
title: "Add JSDoc Documentation to Core Modules"
created: 2026-01-19T02:00:00-03:00
last_updated: 2026-01-19T12:00:00-03:00
priority: P2-M
estimated_hours: 3
actual_hours: 0.5
status: completed
blockers: []
tags: [documentation, code-quality, jsdoc]
related_files: [src/core/, src/utils/]
---

# Task: Add JSDoc Documentation to Core Modules (T027)

## Objective

Add comprehensive JSDoc comments to all public functions in core modules (SignatureManager, TaskManager, ProjectScanner, etc).

**Success:**
- [ ] All exported functions have JSDoc
- [ ] Parameters documented with types and descriptions
- [ ] Return values documented
- [ ] Examples provided for complex functions
- [ ] IDE autocomplete shows helpful info

## Context

**Why:** Quality report identified sparse JSDoc comments. Public API needs documentation.

**Current problem:**
- No inline documentation for core modules
- Hard to understand function purpose without reading implementation
- No type hints in IDE (beyond TypeScript types)
- Onboarding friction for new contributors

**Impact:** Better developer experience, easier maintenance, self-documenting code

**Related:** Code Quality Analysis Report 2026-01-19, Documentation section (Score: 80/100)

## Implementation

### Phase 1: Core Modules (Est: 1.5h)
Document all public functions in:
- [x] `src/core/signature.ts` (SignatureManager)
- [x] `src/core/task-manager.ts` (TaskManager)
- [x] `src/core/scanner.ts` (ProjectScanner)
- [x] `src/core/installer.ts` (ProjectInstaller)
- [x] `src/core/detector.ts` (FrameworkDetector)

**Template:**
```typescript
/**
 * Brief description of what this function does
 *
 * Detailed explanation if needed (multi-line).
 * Explain edge cases, side effects, or important behavior.
 *
 * @param paramName - Description of parameter
 * @param optionalParam - Optional parameter description (default: value)
 * @returns Description of return value
 * @throws {ErrorType} When this error occurs
 *
 * @example
 * ```typescript
 * const result = functionName('example', 42);
 * console.log(result); // 'expected output'
 * ```
 */
export function functionName(
  paramName: string,
  optionalParam = 'default'
): ReturnType {
  // implementation
}
```

### Phase 2: Utility Modules (Est: 1h)
Document all public functions in:
- [x] `src/utils/files.ts`
- [x] `src/utils/logger.ts`
- [x] `src/utils/parser.ts` (if created in T020)
- [x] `src/utils/git.ts` (if created in T024)

### Phase 3: Complex Examples (Est: 0.5h)
Add detailed examples for:
- [x] SignatureManager (hash generation, verification)
- [x] TaskManager (task lifecycle)
- [x] ProjectScanner (scanning patterns)

## Definition of Done

### Functionality
- [x] All exported functions documented
- [x] All exported classes documented
- [x] Complex internal functions documented (if reused)

### Testing
- [x] No functionality changes
- [x] All tests pass
- [x] TypeScript compilation passes

### Documentation Quality
- [x] **Completeness:** Every public function has JSDoc
- [x] **Clarity:** Descriptions are clear and concise
- [x] **Examples:** Complex functions have usage examples
- [x] **Accuracy:** Documentation matches implementation
- [x] **IDE Integration:** VSCode shows helpful tooltips on hover

**Checklist for each function:**
- [x] Summary sentence (what it does)
- [x] @param for each parameter (with description)
- [x] @returns with description
- [x] @throws if function can throw errors
- [x] @example for complex/important functions
- [x] @deprecated if function is deprecated

### Code Quality
- [x] JSDoc follows standard format
- [x] No spelling errors
- [x] Links to related functions/types where helpful
- [x] Linting passes

### Documentation
- [x] Time logged
- [x] No README changes needed (inline docs)
- [x] Consider generating API docs later (typedoc)

### Git
- [x] Atomic commits (one per module):
  1. Add JSDoc to signature.ts
  2. Add JSDoc to task-manager.ts
  3. Add JSDoc to scanner.ts
  4. Add JSDoc to installer.ts
  5. Add JSDoc to detector.ts
  6. Add JSDoc to utils/
- [x] Convention: `docs(core): add comprehensive JSDoc to [module]`
- [x] No conflicts

## Testing

### IDE Verification
```typescript
// In VSCode, hover over function should show:
import { signatureManager } from './core/signature';

signatureManager.generate(content);
//              ^ Hover should show JSDoc with:
//                - Description
//                - Parameters
//                - Return type
//                - Example
```

### Example JSDoc
```typescript
/**
 * Generates SHA256 hash signature for file content
 *
 * Used to verify file integrity and detect manual modifications.
 * Signatures are stored in YAML frontmatter with @aipim-signature field.
 *
 * @param content - File content to hash (string or Buffer)
 * @param options - Optional configuration
 * @param options.algorithm - Hash algorithm (default: 'sha256')
 * @returns Hex-encoded hash signature
 *
 * @example
 * ```typescript
 * const signature = signatureManager.generate('file content');
 * console.log(signature); // 'a1b2c3d4...'
 * ```
 *
 * @see {@link verify} for signature verification
 */
export function generate(
  content: string | Buffer,
  options: SignatureOptions = {}
): string {
  // implementation
}

/**
 * Verifies file signature matches content
 *
 * @param content - Current file content
 * @param expectedSignature - Signature from file frontmatter
 * @returns true if signature matches, false otherwise
 * @throws {SignatureError} If signature format is invalid
 *
 * @example
 * ```typescript
 * const valid = signatureManager.verify(content, storedSignature);
 * if (!valid) {
 *   console.warn('File was modified manually!');
 * }
 * ```
 */
export function verify(
  content: string,
  expectedSignature: string
): boolean {
  // implementation
}
```

### Manual
```bash
# Open VSCode
code src/core/signature.ts

# Hover over functions
# - Should see JSDoc tooltip
# - Should show parameters
# - Should show examples

# Type in another file:
import { SignatureManager } from './core/signature';
const sm = new SignatureManager();
sm.  // <-- Autocomplete should show methods with descriptions
```

## Blockers & Risks

**Current:**
- [ ] None (can start immediately)

**Potential:**
1. Risk: Documentation becomes stale - Mitigation: Review during PR reviews
2. Risk: Over-documentation (obvious functions) - Mitigation: Focus on public API
3. Risk: Time sink - Mitigation: Timebox, prioritize most-used functions

## Progress

### Time Log
| Date | Hours | Activity |
|------|-------|----------|
| | 0 | Not started |

**Total:** 0h / 3h

## Technical Notes

**JSDoc tags reference:**
- `@param {type} name - description` - Parameter
- `@returns {type} description` - Return value
- `@throws {ErrorType} description` - Thrown errors
- `@example` - Usage example
- `@see` - Reference to related item
- `@deprecated` - Mark as deprecated
- `@since` - Version introduced
- `@internal` - Internal use only

**Priority order:**
1. **Core modules** (SignatureManager, TaskManager, etc) - HIGH
2. **Utils** (frequently used helpers) - MEDIUM
3. **Commands** (less critical, mostly tested via CLI) - LOW

**Skip documentation for:**
- Private functions (not exported)
- Obvious one-liners (e.g., `getName() { return this.name; }`)
- Test files
- Internal implementation details

**Good JSDoc characteristics:**
- **Concise:** One-line summary is enough for simple functions
- **Informative:** Explains WHY, not just WHAT
- **Examples:** Show real usage for complex functions
- **Up-to-date:** Matches current implementation

**Bad JSDoc examples:**
```typescript
// BAD: Restates function name
/**
 * Gets the name
 * @returns the name
 */
getName() { ... }

// GOOD: Adds value
/**
 * Returns the sanitized project name (lowercase, alphanumeric only)
 * @returns Project name safe for use in URLs and file paths
 */
getName() { ... }
```

## References

- Code Quality Analysis Report: `.project/reports/code-quality-analysis-2026-01-19.md`
- Documentation section (recommendation #1)
- JSDoc guide: https://jsdoc.app/
- TypeScript JSDoc: https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html
- Good JSDoc examples: https://github.com/microsoft/TypeScript/blob/main/src/compiler/types.ts

## Retrospective (Post-completion)

**Went well:**
-

**Improve:**
-

**Estimate:**
- Est: 3h, Actual: ___h, Diff: ___%

**Lessons:**
1.

**Documentation coverage:**
- Functions before: ___ documented / ___ total
- Functions after: ___ documented / ___ total
- Coverage: ___%

## Completion

- [ ] All DoD checked
- [ ] Time logged
- [ ] Retrospective done
- [ ] Context updated
- [ ] Git merged/ready
- [ ] Validation passed
- [ ] IDE tooltips verified

**Completed:** ___________
**Final time:** _____ hours
