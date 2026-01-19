---
title: "Integrate Automated Code Quality Analyzer"
created: 2026-01-18T19:05:00-03:00
last_updated: 2026-01-18T19:05:00-03:00
priority: P2-M
estimated_hours: 8
actual_hours: 0
status: backlog
blockers: []
tags: [automation, quality, testing]
related_files: [src/templates/base/.project/scripts/, docs/basic-usage.md]
---

# Task: Integrate Automated Code Quality Analyzer

## Objective

Standardize and automate the "brutally honest technical code review" process that currently requires manual prompt engineering. Create a script that runs language-agnostic quality analysis and generates actionable tasks from findings.

**Success:**
- [ ] Standardized quality analysis prompt
- [ ] Script runs analysis and parses output
- [ ] Auto-generates technical debt tasks
- [ ] Integrated into session end protocol
- [ ] Supports multiple languages (Python, PHP, Go, JS)

## Context

**Why:** Users currently craft long, manual prompts for code quality analysis ("brutally honest, 0-100 scores, technical, agnostic, etc"). This wastes time and produces inconsistent results. Standardizing this creates a reliable quality gate.

**User Pain Point:**
> "eu uso um texto feito a mao, podemos padronizar isso (nao sei como, sempre venho com aquele texao 'quero uma analise brutalmente sincera (mas sem estrapolar desnecessariamente, pra bom ou ruim), 100% técnica, agnóstica, com notas de 0 a 100 separadas e topicos e uma nota de 0 a 100 total, explique as notas, etc etc etc blablabla'"

**Dependencies:**
- [ ] Claude/Gemini API access (or manual copy-paste workflow)
- [ ] Task template for technical debt items

**Related:** Complements validate-dod.sh, runs after testing phase

## Implementation

### Phase 1: Standardize Analysis Prompt (2h)
- [ ] Create `prompts/code-quality-analysis.md` template
- [ ] Define scoring categories (0-100 each):
  - Architecture & Design
  - Code Quality & Readability
  - Performance & Scalability
  - Security & Safety
  - Testing & Coverage
  - Documentation
  - Technical Debt
- [ ] Include "brutally honest but fair" instruction
- [ ] Make language-agnostic (no framework assumptions)
- [ ] Add "actionable suggestions only" requirement

### Phase 2: Create Analysis Script (3h)
- [ ] Create `.project/scripts/analyze-quality.sh`
- [ ] Detect project language/framework
- [ ] Load appropriate prompt template
- [ ] Options:
  - `--manual`: Print prompt for copy-paste
  - `--auto`: Call API (if configured)
  - `--format=json`: Output structured results
- [ ] Parse AI response into structured format
- [ ] Save report to `.project/quality-reports/YYYY-MM-DD.md`

### Phase 3: Task Generation (2h)
- [ ] Parse quality report for issues <70 score
- [ ] Generate task files in `.project/backlog/`
- [ ] Format: `DEBT-XXX-{issue-name}.md`
- [ ] Include:
  - Issue description
  - Current score
  - Target score
  - Suggested fix
  - Estimated effort
- [ ] Link back to quality report

### Phase 4: Integration & Documentation (1h)
- [ ] Add to session end protocol in project-manager.md
- [ ] Update basic-usage.md with quality analysis workflow
- [ ] Create example quality report
- [ ] Document manual vs auto workflow

## Definition of Done

### Functionality
- [ ] Script runs without errors
- [ ] Generates consistent, actionable reports
- [ ] Auto-creates tasks from low scores
- [ ] Works with copy-paste (no API required)
- [ ] Supports Python, PHP, Go, JavaScript

### Testing
- [ ] Run on AIPIM project (meta!)
- [ ] Run on DelphiChess project (Python)
- [ ] Run on sample Laravel project (PHP)
- [ ] Verify task generation accuracy
- [ ] Test both manual and auto modes

### Performance
- [ ] Prompt template <2000 tokens
- [ ] Report parsing <1s
- [ ] Task generation <5s
- [ ] Full analysis completes in <5min (manual mode)

### Security
- [ ] No API keys in git
- [ ] Safe parsing of AI output
- [ ] Validate generated task files

### Code Quality
- [ ] Clear script structure
- [ ] Documented prompt template
- [ ] Error handling for API failures

### Documentation
- [ ] Time logged
- [ ] Integration guide in basic-usage.md
- [ ] Example report included
- [ ] Troubleshooting section

### Git
- [ ] Atomic commits per phase
- [ ] Convention: feat(scripts): add quality analyzer
- [ ] No conflicts

## Testing

### Manual
- [ ] Run analysis on fresh Laravel project
- [ ] Verify scores make sense
- [ ] Check generated tasks are actionable
- [ ] Test prompt with Claude and Gemini
- [ ] Validate language detection

## Technical Notes

**Prompt Template Structure:**

```markdown
# Code Quality Analysis Request

## Context
Project: {PROJECT_NAME}
Language: {DETECTED_LANGUAGE}
Framework: {DETECTED_FRAMEWORK}
Files analyzed: {FILE_COUNT}

## Instructions
Provide a brutally honest, 100% technical code quality analysis. Be sincere but fair—don't exaggerate positives or negatives. Focus on actionable improvements.

## Scoring Categories (0-100 each)

1. **Architecture & Design**
   - Component separation
   - Dependencies
   - SOLID principles
   - Scalability

2. **Code Quality & Readability**
   - Naming conventions
   - Complexity
   - DRY violations
   - Code smells

3. **Performance & Scalability**
   - N+1 queries
   - Caching strategy
   - Database indexes
   - Algorithm efficiency

4. **Security & Safety**
   - Input validation
   - Authentication/Authorization
   - SQL injection risks
   - XSS vulnerabilities

5. **Testing & Coverage**
   - Test coverage %
   - Test quality
   - Edge cases
   - Integration tests

6. **Documentation**
   - README quality
   - API docs
   - Code comments
   - Architecture docs

7. **Technical Debt**
   - TODO/FIXME count
   - Deprecated code
   - Duplicated code
   - Dead code

## Output Format

For each category:
- Score (0-100)
- 2-3 key findings
- Top 3 actionable improvements
- Priority (Critical/High/Medium/Low)

## Overall Score
Average of all categories with brief justification.

## Critical Issues
List any issues requiring immediate attention (score <50).
```

**Task Generation Logic:**

```bash
# Parse report
CRITICAL_ISSUES=$(grep -A 10 "Score: [0-4][0-9]" report.md)

# For each critical issue
for issue in $CRITICAL_ISSUES; do
  # Extract: category, score, suggestion
  # Generate task file
  cat > .project/backlog/DEBT-$(date +%Y%m%d)-${issue}.md <<EOF
---
title: "Fix: ${ISSUE_NAME}"
priority: P1-M  # Critical issues are P1
estimated_hours: ${ESTIMATED_HOURS}
tags: [technical-debt, quality]
---

# Issue
Current score: ${CURRENT_SCORE}/100
Target score: 80/100

# Problem
${PROBLEM_DESCRIPTION}

# Suggested Fix
${AI_SUGGESTION}

# Related
Quality Report: .project/quality-reports/${DATE}.md
EOF
done
```

**Example Quality Report:**

```markdown
# Code Quality Analysis - 2026-01-18

## Overall Score: 73/100 (Good, with room for improvement)

### 1. Architecture & Design: 82/100 ✅
**Findings:**
- Clear separation of concerns (Controllers, Services, Models)
- Good use of dependency injection
- Some circular dependencies in Services layer

**Improvements:**
1. Break circular dependency: UserService ↔ NotificationService
2. Consider extracting PaymentService interface
3. Add architectural decision records (ADRs)

### 2. Code Quality: 68/100 ⚠️
**Findings:**
- Inconsistent naming (camelCase mixed with snake_case)
- High complexity in OrderController::process() (CC: 18)
- Duplicated validation logic across 5 files

**Improvements:**
1. **[CRITICAL]** Refactor OrderController::process() (split into methods)
2. Extract validation rules to FormRequest classes
3. Enforce PSR-12 with phpcs

### 3. Performance: 58/100 ⚠️
**Findings:**
- 12 N+1 query instances detected
- Missing database indexes on foreign keys
- No caching strategy implemented

**Improvements:**
1. **[CRITICAL]** Fix N+1 in UserController::index() (eager load roles)
2. Add indexes: orders.user_id, payments.order_id
3. Implement Redis caching for frequently accessed data
...
```

## Blockers & Risks

**Current:**
- [ ] None

**Potential:**
1. Risk: AI output format varies between providers
   - Mitigation: Use strict prompt template, parse flexibly
2. Risk: Analysis may be too harsh/lenient
   - Mitigation: Calibrate with real projects, adjust prompt
3. Risk: Generated tasks might be vague
   - Mitigation: Require specific file/line references in prompt

## References

- Static analysis tools: pylint, phpstan, golangci-lint
- Code review best practices
- Technical debt quantification methods

## Completion

- [ ] All DoD checked
- [ ] Time logged
- [ ] Context updated
- [ ] Documentation complete
