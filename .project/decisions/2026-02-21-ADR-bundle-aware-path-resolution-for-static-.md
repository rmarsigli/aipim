---
title: "Bundle-aware path resolution for static UI assets"
date: 2026-02-21
status: Accepted
---

# Bundle-aware path resolution for static UI assets

## Rationale

The esbuild bundler compiles all source files into dist/cli.js, so __dirname resolves to dist/ instead of the original dist/mcp/ or dist/commands/ subdirectories. Paths like ../../ui/dist (written assuming unbundled output) resolve incorrectly to /www/html/ui/dist. Fix: use ../ui/dist and ../ui from dist/ context.

## Status

Accepted
