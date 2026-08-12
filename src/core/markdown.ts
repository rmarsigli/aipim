/**
 * Markdown the project writes alongside the event log.
 *
 * The log is what the machine reads; these files are what a person reads and
 * what git diffs. Both writers — the MCP tools and changeset application —
 * build them here so a task file looks the same however it was created.
 */

export function slugify(str: string): string {
    return str
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 40)
}

export function today(): string {
    return new Date().toISOString().split('T')[0]
}

export function adrMarkdown(title: string, rationale: string, taskId?: string, supersedes?: string[]): string {
    const taskLine = taskId ? `taskId: ${taskId}\n` : ''
    const supersedesLine = supersedes?.length ? `supersedes: [${supersedes.join(', ')}]\n` : ''
    return `---
title: "${title}"
date: ${today()}
${taskLine}${supersedesLine}status: Accepted
---

# ${title}

## Rationale

${rationale}

## Status

Accepted
`
}

export interface TaskMarkdownInput {
    title: string
    priority: string
    taskType: string
    estimatedHours?: number
    description?: string
}

export function taskMarkdown({ title, priority, taskType, estimatedHours, description }: TaskMarkdownInput): string {
    const estimateLine = typeof estimatedHours === 'number' ? `estimated_hours: ${estimatedHours}\n` : ''
    return `---
title: "${title}"
created: ${new Date().toISOString()}
priority: ${priority}
${estimateLine}status: backlog
tags: [${taskType}]
---

# ${title}
${description ? `\n${description}\n` : ''}
`
}
