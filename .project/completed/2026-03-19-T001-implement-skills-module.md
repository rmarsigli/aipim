---
title: "Implement Skills as Context Modules"
created: 2026-03-19T15:50:00-03:00
last_updated: 2026-03-19T15:50:00-03:00
priority: P1-L
estimated_hours: 11
actual_hours: 0
status: backlog
blockers: []
tags: [backend, cli, skills, core, architecture]
related_files: ["src/cli.ts", "src/core/guidelines.ts", "src/core/installer.ts"]
---

# Task: Implement Skills as Context Modules

## Objective

Implement the "Context Modules" (Skills) architecture for AIPIM, allowing developers to dynamically add fine-grained, tool-specific AI guidelines to an existing project without bloating the base prompt. 

**Success:**
- [ ] Users can run `aipim list skills` to view available contextual modules.
- [ ] Users can run `aipim add skill <name>` to seamlessly inject a skill (e.g., pest, tailwind).
- [ ] Skills gracefully adapt to the environment (e.g., injecting into `CLAUDE.md` slots or generating isolated `.blade.php` files for Laravel Boost contexts).

## Context

**Why:** Currently, AIPIM generates a monolithic prompt file or predefined guidelines upon installation. As projects evolve, developers adopt new tools (like Pest, Tailwind, or Redis) and need a way to easily "teach" their AI agents the strict rules, security gotchas, and specific context of these tools without having to re-run the entire `aipim update` with a new monolithic configuration.

## Implementation

### Phase 1: Architecture & CLI Command (3h)
- [ ] Create `src/commands/add.ts` implementing `add skill <name>`.
- [ ] Create `src/commands/list.ts` implementing `list skills` (using `@inquirer/prompts` if interactive).
- [ ] Register new commands in `src/cli.ts` using Commander.
- [ ] Scaffold `src/core/skills.ts` to manage the logic of reading and fetching skill definitions.

### Phase 2: Skills Library & Templates (2h)
- [ ] Create directory structure `src/templates/skills/`.
- [ ] Author at least 3 initial skill templates (e.g., `pest.md` for Pest PHP, `tailwind.md` for Tailwind CSS best practices, `vue3-composition.md` for Vue 3).
- [ ] Update `tsup.config.ts` or build pipelines if necessary to ensure `skills/` directory is copied to `dist/`.

### Phase 3: Context Injection Engine (4h)
- [ ] Implement logical router in `src/core/skills.ts` to handle skill application based on project type.
- [ ] **Standard Mode:** Implement injector that appends the skill content inside `CLAUDE.md/GEMINI.md/CURSOR.md` (e.g., via the `{{SLOT:guidelines}}` mechanism) and securely recalculates/updates the `@aipim-signature`.
- [ ] **Laravel Boost Mode:** Implement injector that drops the skill content cleanly into `.ai/guidelines/<skill_name>.blade.php` instead of editing the monolithic file.

### Phase 4: Testing & Documentation (2h)
- [ ] Write Jest unit tests (`tests/commands/add-skill.test.ts`) covering both Standard and Laravel Boost injection behaviors.
- [ ] Write Jest unit tests verifying that injecting a duplicate skill refuses to corrupt the file.
- [ ] Update `README.md` and `/docs/basic-usage.md` reflecting the new `skills` capability.

## Definition of Done

### Functionality
- [ ] Works as specified
- [ ] Edge cases: Trying to add a skill that doesn't exist returns a friendly error. Adding a skill twice warns the user and aborts.
- [ ] Error messages user-friendly

### Testing
- [ ] Unit tests: `src/core/skills.ts`, CLI commands
- [ ] Coverage >80% for new modules

### Code Quality
- [ ] PSR-12 / ESLint compliant
- [ ] Complex logic documented
- [ ] No debug statements
- [ ] Clean names

### Documentation
- [ ] Time logged
- [ ] README updated with new `aipim add skill` commands
- [ ] ADR generated detailing the Skills architecture vs Guidelines architecture

### Git
- [ ] Atomic commits mapping directly to the phases (Ex: `feat(core): implement skills injection engine`)
- [ ] Convention: type(scope): msg
- [ ] No conflicts

## Blockers & Risks

**Current:**
- [ ] None

**Potential:**
1. Risk: Signature corruption when injecting into existing `CLAUDE.md` files that have been hand-edited.
   - Mitigation: Ensure `add skill` checks the file signature before proceeding. If invalid (legacy/tampered), warn the user to run `aipim update` first or use a `--force` flag.
