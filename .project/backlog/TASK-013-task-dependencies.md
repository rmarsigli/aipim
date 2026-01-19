---
title: "Implement Task Dependency Management"
created: 2026-01-18T20:20:00-03:00
last_updated: 2026-01-18T20:20:00-03:00
priority: P3
estimated_hours: 4
actual_hours: 0
status: backlog
blockers: []
tags: [task-management, dependencies, workflow]
related_files: [src/templates/base/.project/_templates/task-template.md]
---

# Task: Implement Task Dependency Management

## Objective

Add dependency tracking to task template and create `aipim deps` command to visualize task dependency graph. Prevents starting tasks that depend on incomplete work.

**Success:**
- [ ] Tasks can declare dependencies in frontmatter
- [ ] Tasks can declare what they block
- [ ] `aipim deps` shows dependency tree
- [ ] Warning when starting task with unmet dependencies
- [ ] Recommends task order based on dependencies

## Context

**Why:** Starting tasks in wrong order wastes time. You discover halfway through that you need data/API/feature from another incomplete task.

**Scenario:**
```
You: "Let's implement Prometheus predictions!"
*2 hours in*
You: "Wait... I need Elo data from Oracle profiling..."
You: "Oracle isn't done yet. Wasted 2 hours."

Better:
$ aipim start TASK-020

⚠️  Warning: TASK-020 has unmet dependencies!

TASK-020: Prometheus Predictions
  Depends on:
    ❌ TASK-015: Oracle Profiling (in-progress, 50% done)
    ❌ TASK-018: Game History API (not started)

Recommendation: Complete dependencies first.
Start TASK-015 instead? [Y/n]
```

**Current Pain:**
- No visibility into task order
- Discover dependencies too late
- Rework when dependencies change
- Unclear which task to do next

**Dependencies:**
- [ ] Task template with frontmatter
- [ ] Backlog task parsing

**Related:** Task management workflow

## Implementation

### Phase 1: Update Task Template (1h)
- [ ] Add dependency fields to task frontmatter:
  ```yaml
  ---
  title: "Prometheus Predictions"
  depends_on:
    - TASK-015  # Oracle Profiling (needs Elo data)
    - TASK-018  # Game History API
  blocks:
    - TASK-025  # Apollo (needs win probability)
    - TASK-030  # Dashboard (needs predictions)
  dependency_type: hard  # or soft (nice-to-have)
  ---
  ```
- [ ] Add to both task-template.md and backlog template
- [ ] Document dependency types:
  - **hard:** MUST be done first (blocks completely)
  - **soft:** SHOULD be done first (can work around)

### Phase 2: Dependency Visualization (2h)
- [ ] Create `aipim deps` command
- [ ] Parse all tasks (backlog + current + completed)
- [ ] Build dependency graph
- [ ] Display tree:
  ```
  $ aipim deps

  🔗 Task Dependency Graph

  ✅ TASK-015: Oracle Profiling [COMPLETED]
     └─> 🔄 TASK-020: Prometheus Predictions [IN PROGRESS]
         └─> 🚫 TASK-025: Apollo Suggestions [BLOCKED]

  ✅ TASK-018: Game History API [COMPLETED]
     └─> 🔄 TASK-020: Prometheus Predictions [IN PROGRESS]

  ⏳ TASK-006: Feature-First Docs [READY TO START]

  Legend:
  ✅ Completed | 🔄 In Progress | ⏳ Ready | 🚫 Blocked
  ```
- [ ] Show blocked tasks (dependencies not met)
- [ ] Recommend next task (no dependencies or all met)

### Phase 3: Validation & Warnings (0.5h)
- [ ] When starting task (`mv backlog/TASK-X current-task.md`):
  - Check dependencies
  - Warn if unmet
  - Suggest alternative task
- [ ] Detect circular dependencies:
  ```
  ⚠️  Circular dependency detected!
  TASK-020 → TASK-025 → TASK-020
  ```
- [ ] Show dependency completion percentage:
  ```
  TASK-020 dependencies: 1/2 met (50%)
  ✅ TASK-015: Oracle (done)
  ❌ TASK-018: API (blocked)
  ```

### Phase 4: Documentation (0.5h)
- [ ] Update basic-usage.md with dependency workflow
- [ ] Add examples of hard vs soft dependencies
- [ ] Document `aipim deps` command

## Definition of Done

### Functionality
- [ ] Tasks declare dependencies
- [ ] `aipim deps` shows graph correctly
- [ ] Warnings work when starting blocked task
- [ ] Circular dependency detection
- [ ] Completion percentage calculation

### Testing
- [ ] Create 5 tasks with dependencies
- [ ] Include circular dependency (should warn)
- [ ] Test `aipim deps` output
- [ ] Try starting blocked task (should warn)
- [ ] Complete dependency, verify unblocking

### Code Quality
- [ ] Graph rendering clear
- [ ] Handles missing task references
- [ ] Documented frontmatter format

### Documentation
- [ ] Time logged
- [ ] Dependency examples
- [ ] Workflow guide

### Git
- [ ] Atomic commits
- [ ] Convention: feat(tasks): add dependency management
- [ ] No conflicts

## Testing

### Manual
- [ ] Create dependency chain: A → B → C
- [ ] Run `aipim deps`
- [ ] Try starting C (should warn)
- [ ] Complete A, verify B becomes ready
- [ ] Test circular: D → E → D

## Technical Notes

**Frontmatter Format:**

```yaml
---
title: "Implement Prometheus Predictions"
depends_on:
  - TASK-015  # Must complete first
  - TASK-018  # Must complete first
blocks:
  - TASK-025  # Can't start until this completes
dependency_type: hard  # or soft
---
```

**Dependency Graph Algorithm:**

```typescript
interface Task {
    id: string
    title: string
    status: 'backlog' | 'in-progress' | 'completed' | 'blocked'
    depends_on: string[]
    blocks: string[]
}

function buildDependencyGraph(tasks: Task[]): DependencyGraph {
    const graph: Map<string, Task> = new Map()

    // Build graph
    tasks.forEach(task => {
        graph.set(task.id, task)
    })

    // Calculate blocked status
    tasks.forEach(task => {
        const unmetDeps = task.depends_on.filter(depId => {
            const dep = graph.get(depId)
            return dep && dep.status !== 'completed'
        })

        if (unmetDeps.length > 0) {
            task.status = 'blocked'
        }
    })

    return graph
}

function detectCircularDependency(graph: DependencyGraph): string[] {
    // DFS to detect cycles
    const visited = new Set()
    const recursionStack = new Set()
    const cycles: string[] = []

    function dfs(taskId: string, path: string[]) {
        visited.add(taskId)
        recursionStack.add(taskId)
        path.push(taskId)

        const task = graph.get(taskId)
        if (task) {
            for (const depId of task.depends_on) {
                if (!visited.has(depId)) {
                    dfs(depId, [...path])
                } else if (recursionStack.has(depId)) {
                    // Cycle found
                    const cycleStart = path.indexOf(depId)
                    cycles.push(path.slice(cycleStart).join(' → ') + ' → ' + depId)
                }
            }
        }

        recursionStack.delete(taskId)
    }

    graph.forEach((_, taskId) => {
        if (!visited.has(taskId)) {
            dfs(taskId, [])
        }
    })

    return cycles
}
```

**Visualization Output:**

```
$ aipim deps

🔗 Task Dependency Graph

Completed Tasks:
  ✅ TASK-001: Session Metrics (5.5h)
  ✅ TASK-002: Task Breakdown (2h)
  ✅ TASK-004: Context Pruning (2.5h)
  ✅ TASK-015: Oracle Profiling (12h)
  ✅ TASK-018: Game History API (8h)

Ready to Start (no blockers):
  ⏳ TASK-006: Feature-First Docs (3h)
  ⏳ TASK-007: Quality Analyzer (8h)
  ⏳ TASK-010: Session Resume (4h)

In Progress:
  🔄 TASK-009: Session Starter (6h, 50% done)
  🔄 TASK-020: Prometheus Predictions (10h, 30% done)
      Dependencies: 2/2 met ✅
        ✅ TASK-015: Oracle
        ✅ TASK-018: Game History API

Blocked:
  🚫 TASK-025: Apollo Opening Suggestions (12h)
      Dependencies: 0/1 met (0%)
        ❌ TASK-020: Prometheus (in-progress, ETA: 7h)
      Estimated unblock: 2026-01-20

💡 Recommendation:
   Next task: TASK-010 (Session Resume) - 4h, no dependencies
```

**Warning When Starting Blocked Task:**

```bash
$ mv .project/backlog/TASK-025-apollo.md .project/current-task.md

⚠️  Warning: TASK-025 has unmet dependencies!

TASK-025: Apollo Opening Suggestions
  Depends on:
    ❌ TASK-020: Prometheus (in-progress, 30% done, ~7h remaining)

Starting this task now may result in:
- Rework when TASK-020 changes
- Blocked progress waiting for data
- Wasted effort

Recommendations:
1. Complete TASK-020 first (continue where you left off)
2. Start TASK-010 instead (no dependencies, 4h)
3. Override and start anyway (not recommended)

Choose: [1/2/3]
```

**Soft Dependencies:**

```yaml
# Soft dependency (nice-to-have, not blocking)
depends_on:
  - TASK-015  # hard (must have)
  - TASK-019  # soft (helps but not required)
dependency_type: mixed

# Task shows:
Dependencies: 1/2 hard met, 0/1 soft met
Can start with workarounds for TASK-019
```

**Benefits:**

1. **Prevents Rework:**
   - Don't start tasks that depend on incomplete work
   - Clear task order

2. **Better Planning:**
   - Visual dependency graph
   - See critical path
   - Estimate based on dependencies

3. **Team Coordination:**
   - See who's blocking whom
   - Prioritize unblocking tasks

4. **Smart Recommendations:**
   - AI/CLI suggests next best task
   - Considers dependencies + effort + priority

## Blockers & Risks

**Current:**
- [ ] None

**Potential:**
1. Risk: Dependencies change mid-work
   - Mitigation: Easy to update frontmatter
2. Risk: Circular dependencies
   - Mitigation: Detection algorithm warns
3. Risk: Over-engineering dependencies
   - Mitigation: Use soft deps for nice-to-haves

## References

- Project management: Critical path method
- Directed Acyclic Graphs (DAG)
- Make/Bazel dependency systems
- Related: Task management workflow

## Completion

- [ ] All DoD checked
- [ ] Time logged
- [ ] Context updated
- [ ] Documentation complete
