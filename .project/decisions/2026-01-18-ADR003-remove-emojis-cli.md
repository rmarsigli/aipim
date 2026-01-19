---
number: 003
title: "Remove Emojis from CLI Output"
date: 2026-01-18
status: accepted
authors: [AIPIM Team]
tags: [cli, ux, styling]
---

# ADR-003: Remove Emojis from CLI Output

## Status

**Accepted**

Date: 2026-01-18

## Context

**The Problem:**
We are using emojis (e.g., 📋, ✅, ⚠️) in the CLI output to indicate status and section headers. However, these cause rendering issues in some terminals (rendering as `` or widely spaced characters) and disrupt the visual alignment of the interface.

**Context & Constraints:**
- **OS/Terminal Compatibility:** Must look good on Linux/WSL, macOS, and Windows.
- **Aesthetics:** The user aims for a "premium" and "clean" look.
- **Reliability:** Text content must be legible regardless of font support for emojis.

## Decision

**We will use:** Pure ANSI colors and text-based indicators instead of emojis.

**Rationale:**
1.  **Alignment:** Text-based indicators (e.g., `[OK]`, `[WARN]`, `●`) align perfectly in monospaced fonts, whereas emojis often have variable widths.
2.  **Benefit:** Eliminates rendering artifacts and ensures a consistent experience across all terminals.
3.  **Future-proof:** ANSI colors are universally supported, whereas emoji support varies by font and terminal emulator.

## Alternatives Considered

### Option 1: Feature Flag for Emojis
**Pros:** Allows users with good terminal support to see emojis.
**Cons:** Adds configuration complexity. Default experience might still be broken for some.
**Rejected because:** Complexity outweighs the aesthetic benefit of emojis.

### Option 2: Nerd Fonts
**Pros:** High-quality icons.
**Cons:** Requires users to install specific fonts.
**Rejected because:** Too high a barrier to entry for a general-purpose CLI tool.

## Consequences

### Positive
- [x] Consistent rendering across all environments.
- [x] Better visual alignment of lists and headers.
- [x] "Cleaner", more professional aesthetic.

### Negative
- [x] Less colorful "pop" (mitigated by bold ANSI colors).
- [ ] Less visual distinction for quick scanning (mitigated by `[TAGS]`).
