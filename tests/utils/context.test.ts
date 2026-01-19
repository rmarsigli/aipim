import {
    parseContext,
    parseTask,
    calculateProgress,
    extractCheckpoints,
    extractObjective
} from '../../src/utils/context.js'
import { describe, test, expect } from '@jest/globals'

describe('parseContext', () => {
    test('parses valid context.md with all fields', () => {
        const content = `---
session: 5
last_updated: 2026-01-19T00:00:00-03:00
active_branches: [main, feature/test]
blockers: []
next_action: "Continue work on feature X"
---

# Current State

Working on feature X implementation.
Making good progress.

# Next Steps

1. Complete Phase 1
2. Start Phase 2
`
        const result = parseContext(content)

        expect(result.frontmatter.session).toBe('5')
        expect(result.frontmatter.next_action).toBe('"Continue work on feature X"')
        expect(result.frontmatter.active_branches).toEqual(['main', 'feature/test'])
        expect(result.nextAction).toBe('"Continue work on feature X"')
        expect(result.currentState).toContain('Working on feature X')
        expect(result.currentState).toContain('Making good progress')
    })

    test('handles context without current state section', () => {
        const content = `---
session: 1
next_action: "Start project"
---

# Next Steps

Do something
`
        const result = parseContext(content)

        expect(result.frontmatter.session).toBe('1')
        expect(result.currentState).toBe('')
    })

    test('handles empty frontmatter values', () => {
        const content = `---
session: 0
blockers: []
---

# Current State

Empty session
`
        const result = parseContext(content)

        expect(result.frontmatter.session).toBe('0')
        expect(result.nextAction).toBe('')
    })

    test('extracts current state until next heading', () => {
        const content = `---
session: 1
---

# Current State

Line 1
Line 2

# Active Work

Should not be included
`
        const result = parseContext(content)

        expect(result.currentState).toContain('Line 1')
        expect(result.currentState).toContain('Line 2')
        expect(result.currentState).not.toContain('Should not be included')
    })
})

describe('parseTask', () => {
    test('parses valid task file with all fields', () => {
        const content = `---
title: "Implement Feature X"
created: 2026-01-19T10:00:00-03:00
estimated_hours: 5
actual_hours: 3
status: in-progress
priority: P1-M
---

# Task: Implement Feature X

## Objective

Build the feature

### Phase 1: Planning

- [x] Complete
`
        const result = parseTask(content)

        expect(result.title).toBe('Implement Feature X')
        expect(result.estimated_hours).toBe('5')
        expect(result.actual_hours).toBe('3')
        expect(result.status).toBe('in-progress')
    })

    test('handles quoted title', () => {
        const content = `---
title: "My Task Title"
estimated_hours: 2
actual_hours: 1
status: completed
---`
        const result = parseTask(content)

        expect(result.title).toBe('My Task Title')
    })

    test('detects current phase', () => {
        const content = `---
title: "Multi-phase task"
estimated_hours: 10
actual_hours: 4
status: in-progress
---

### Phase 1: Setup

- [x] Done

### Phase 2: Implementation

- [ ] In progress
`
        const result = parseTask(content)

        // Function detects first phase, not necessarily current uncompleted one
        expect(result.currentPhase).toBe('Phase 1: Setup')
    })

    test('handles task without phases', () => {
        const content = `---
title: "Simple task"
estimated_hours: 1
actual_hours: 0.5
status: completed
---

No phases here
`
        const result = parseTask(content)

        expect(result.currentPhase).toBeNull()
    })

    test('handles missing fields', () => {
        const content = `---
title: "Minimal task"
---`
        const result = parseTask(content)

        expect(result.title).toBe('Minimal task')
        expect(result.estimated_hours).toBe('')
        expect(result.actual_hours).toBe('')
        expect(result.status).toBe('')
    })
})

describe('calculateProgress', () => {
    test('calculates progress for mixed checkboxes', () => {
        const content = `
- [x] Completed task 1
- [x] Completed task 2
- [ ] Pending task 1
- [ ] Pending task 2
- [ ] Pending task 3
`
        const result = calculateProgress(content)

        expect(result.completed).toBe(2)
        expect(result.total).toBe(5)
        expect(result.percentage).toBe(40)
    })

    test('handles all completed', () => {
        const content = `
- [x] Task 1
- [x] Task 2
- [x] Task 3
`
        const result = calculateProgress(content)

        expect(result.completed).toBe(3)
        expect(result.total).toBe(3)
        expect(result.percentage).toBe(100)
    })

    test('handles no completed tasks', () => {
        const content = `
- [ ] Task 1
- [ ] Task 2
`
        const result = calculateProgress(content)

        expect(result.completed).toBe(0)
        expect(result.total).toBe(2)
        expect(result.percentage).toBe(0)
    })

    test('handles no checkboxes', () => {
        const content = 'No checkboxes here'
        const result = calculateProgress(content)

        expect(result.completed).toBe(0)
        expect(result.total).toBe(0)
        expect(result.percentage).toBe(0)
    })

    test('is case insensitive for checked boxes', () => {
        const content = `
- [x] Lowercase
- [X] Uppercase
- [ ] Unchecked
`
        const result = calculateProgress(content)

        expect(result.completed).toBe(2)
        expect(result.total).toBe(3)
    })
})

describe('extractCheckpoints', () => {
    test('extracts last completed, current, and next items', () => {
        const content = `
- [x] Completed 1
- [x] Completed 2
- [x] Completed 3
- [x] Completed 4
- [ ] Current item
- [ ] Next item
- [ ] Future item
`
        const result = extractCheckpoints(content)

        expect(result.lastCompleted).toEqual(['Completed 2', 'Completed 3', 'Completed 4'])
        expect(result.current).toBe('Current item')
        expect(result.next).toBe('Next item')
    })

    test('handles fewer than 3 completed items', () => {
        const content = `
- [x] Only one completed
- [ ] Current
`
        const result = extractCheckpoints(content)

        expect(result.lastCompleted).toEqual(['Only one completed'])
        expect(result.current).toBe('Current')
        expect(result.next).toBeNull()
    })

    test('handles no current item', () => {
        const content = `
- [x] All completed
- [x] Nothing pending
`
        const result = extractCheckpoints(content)

        expect(result.lastCompleted).toEqual(['All completed', 'Nothing pending'])
        expect(result.current).toBeNull()
        expect(result.next).toBeNull()
    })

    test('handles only unchecked items', () => {
        const content = `
- [ ] First unchecked
- [ ] Second unchecked
`
        const result = extractCheckpoints(content)

        expect(result.lastCompleted).toEqual([])
        expect(result.current).toBe('First unchecked')
        expect(result.next).toBe('Second unchecked')
    })

    test('handles no checkboxes', () => {
        const content = 'No checkboxes'
        const result = extractCheckpoints(content)

        expect(result.lastCompleted).toEqual([])
        expect(result.current).toBeNull()
        expect(result.next).toBeNull()
    })

    test('trims whitespace from checkbox text', () => {
        const content = `
- [x]   Completed with spaces
- [ ]   Current with spaces
`
        const result = extractCheckpoints(content)

        expect(result.lastCompleted).toEqual(['Completed with spaces'])
        expect(result.current).toBe('Current with spaces')
    })
})

describe('extractObjective', () => {
    test('extracts objective from task file', () => {
        const content = `---
title: "My Task"
---

# Task: My Task

## Objective

This is the main objective of the task.
It describes what needs to be accomplished.

## Implementation

Should not be included
`
        const result = extractObjective(content)

        expect(result).toContain('This is the main objective')
        expect(result).toContain('It describes what needs to be accomplished')
        expect(result).not.toContain('Should not be included')
    })

    test('stops at next heading', () => {
        const content = `
## Objective

First line

## Context

Should not be here
`
        const result = extractObjective(content)

        expect(result).toBe('First line')
    })

    test('handles no objective section', () => {
        const content = `
# Task

No objective here
`
        const result = extractObjective(content)

        expect(result).toBe('')
    })

    test('skips lines starting with **', () => {
        const content = `
## Objective

**Success:**
This should be included
**Not this:**
`
        const result = extractObjective(content)

        expect(result).toContain('This should be included')
        expect(result).not.toContain('Success')
        expect(result).not.toContain('Not this')
    })

    test('handles empty objective section', () => {
        const content = `
## Objective

## Next Section
`
        const result = extractObjective(content)

        expect(result).toBe('')
    })
})
