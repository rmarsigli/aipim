# Troubleshooting

## AI creates incomplete tasks

**Fix:** Be explicit
```
"Create task using .project/_templates/v1/task-template.md"
```

## Context restoration slow

**Fix:** Improve context.md quality
- More specific "Current State" (2-3 sentences)
- Clear "Next Action" (exactly what to do)
- Recent decisions (why choices were made)

## Hitting token limits frequently

**Fix:**
1. Archive old context sessions (keep last 3 only)
2. Load fewer files in memory (use `view` tool)
3. Clear conversation more often

## DoD validation fails

**Fix:**
```bash
# See what failed
.project/scripts/validate-dod.sh

# Fix issues, then re-run
.project/scripts/validate-dod.sh
```
