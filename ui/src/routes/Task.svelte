<script lang="ts">
    import { getTask, getTaskEvents, postEvent, putTaskContent } from '../lib/api.js'
    import type { Task, AipimEvent } from '../lib/api.js'
    import StatusBadge from '../components/StatusBadge.svelte'
    import PriorityBadge from '../components/PriorityBadge.svelte'
    import { navigate } from '../lib/router.js'
    import { marked } from 'marked'

    let { id }: { id: string } = $props()

    let task = $state<Task | null>(null)
    let taskEvents = $state<AipimEvent[]>([])
    let loading = $state(true)
    let error = $state<string | null>(null)

    // Edit state
    let editing = $state(false)
    let editContent = $state('')
    let saving = $state(false)
    let saveError = $state<string | null>(null)

    // Comment state
    let newComment = $state('')
    let submittingComment = $state(false)

    $effect(() => {
        loading = true
        error = null
        editing = false
        newComment = ''
        Promise.all([getTask(id), getTaskEvents(id)])
            .then(([t, events]) => {
                task = t
                taskEvents = events
                loading = false
            })
            .catch((err: unknown) => {
                error = String(err)
                loading = false
            })
    })

    // Strip YAML frontmatter before rendering
    function stripFrontmatter(content: string): string {
        return content.replace(/^---[\s\S]*?---\n?/, '')
    }

    // Content is from trusted local .md files — XSS risk is acceptable here
    const renderedContent = $derived(task?.content ? marked.parse(stripFrontmatter(task.content)) : '')

    function startEdit(): void {
        editContent = task?.content ?? ''
        editing = true
        saveError = null
    }

    function cancelEdit(): void {
        editing = false
        saveError = null
    }

    async function saveContent(): Promise<void> {
        if (!task) return
        saving = true
        saveError = null
        try {
            await putTaskContent(task.id, editContent)
            await postEvent({ type: 'task.content_updated', taskId: task.id })
            task = { ...task, content: editContent }
            editing = false
        } catch (err: unknown) {
            saveError = String(err)
        } finally {
            saving = false
        }
    }

    async function submitComment(): Promise<void> {
        if (!task || !newComment.trim()) return
        submittingComment = true
        try {
            await postEvent({ type: 'task.comment_added', taskId: task.id, text: newComment.trim() })
            const updated = await getTask(task.id)
            task = updated
            newComment = ''
        } catch {
            // keep input on failure
        } finally {
            submittingComment = false
        }
    }

    function eventSummary(event: AipimEvent): string {
        const e = event as Record<string, unknown>
        const s = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''))
        switch (event.type) {
            case 'task.created':
                return 'Task created'
            case 'task.status_changed':
                return `${s(e.from)} → ${s(e.to)}`
            case 'task.assigned':
                return `Assigned to @${s(e.assignee)}`
            case 'task.comment_added':
                return 'Comment added'
            case 'task.completed':
                return 'Marked as done'
            case 'task.content_updated':
                return 'Content updated'
            case 'task.priority_changed':
                return `Priority: ${s(e.from)} → ${s(e.to)}`
            default:
                return event.type
        }
    }

    function formatDate(iso: string): string {
        return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    }

    function formatDateTime(iso: string): string {
        return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
</script>

<div class="max-w-3xl space-y-8">
    <button onclick={() => navigate('/')} class="text-sm text-gray-500 hover:text-gray-300 transition-colors">
        ← Back
    </button>

    {#if error}
        <div class="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300 text-sm">
            Failed to load task: {error}
        </div>
    {:else if loading}
        <div class="space-y-4 animate-pulse">
            <div class="h-8 bg-gray-800 rounded w-2/3"></div>
            <div class="h-4 bg-gray-800 rounded w-1/3"></div>
            <div class="h-48 bg-gray-900 border border-gray-800 rounded-lg"></div>
        </div>
    {:else if task}
        <!-- ── Header ──────────────────────────────────────────────── -->
        <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-2 flex-wrap">
                    <span class="text-sm font-mono text-gray-500">{task.id}</span>
                    <StatusBadge status={task.status} />
                    <PriorityBadge priority={task.priority} />
                    <span class="text-xs font-mono text-gray-600">{task.task_type}</span>
                </div>
                <h1 class="text-2xl font-bold text-gray-100 leading-snug">{task.title}</h1>
                <div class="flex items-center gap-2 mt-2 text-xs text-gray-500 flex-wrap">
                    {#if task.assignee}
                        <span>@{task.assignee}</span>
                        <span class="text-gray-700">·</span>
                    {/if}
                    <span>Created {formatDate(task.created_at)}</span>
                    <span class="text-gray-700">·</span>
                    <span>Updated {formatDate(task.updated_at)}</span>
                </div>
            </div>
            {#if !editing}
                <button
                    onclick={startEdit}
                    class="shrink-0 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
                >
                    Edit
                </button>
            {/if}
        </div>

        <!-- ── Content ─────────────────────────────────────────────── -->
        <div class="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <div class="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
                <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Content</h2>
                {#if editing}
                    <div class="flex items-center gap-2">
                        {#if saveError}
                            <span class="text-xs text-red-400">{saveError}</span>
                        {/if}
                        <button
                            onclick={cancelEdit}
                            class="px-2 py-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onclick={saveContent}
                            disabled={saving}
                            class="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded transition-colors"
                        >
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                {/if}
            </div>

            {#if editing}
                <textarea
                    bind:value={editContent}
                    class="w-full bg-gray-950 text-gray-200 text-sm font-mono p-4 resize-none focus:outline-none min-h-80 leading-relaxed"
                    placeholder="Write markdown here…"
                    spellcheck="false"
                ></textarea>
            {:else if task.content}
                <div class="markdown p-5">{@html renderedContent}</div>
            {:else}
                <div class="p-4 py-10 text-center text-sm text-gray-600">
                    No content —
                    <button onclick={startEdit} class="text-indigo-500 hover:text-indigo-400 underline">
                        click Edit to add
                    </button>
                </div>
            {/if}
        </div>

        <!-- ── Comments ────────────────────────────────────────────── -->
        <div>
            <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Comments ({task.comments?.length ?? 0})
            </h2>

            {#if task.comments && task.comments.length > 0}
                <div class="space-y-3 mb-4">
                    {#each task.comments as comment}
                        <div class="bg-gray-900 border border-gray-800 rounded-lg p-3">
                            <div class="flex items-center gap-2 mb-1.5">
                                <span class="text-xs font-medium text-gray-300">{comment.actor}</span>
                                <span class="text-xs text-gray-600">{formatDateTime(comment.created_at)}</span>
                            </div>
                            <p class="text-sm text-gray-400 leading-relaxed">{comment.text}</p>
                        </div>
                    {/each}
                </div>
            {/if}

            <div class="bg-gray-900 border border-gray-800 rounded-lg p-3">
                <textarea
                    bind:value={newComment}
                    placeholder="Add a comment… (Ctrl+Enter to send)"
                    class="w-full bg-transparent text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none min-h-16 leading-relaxed"
                    onkeydown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitComment()
                    }}
                ></textarea>
                <div class="flex justify-end mt-2">
                    <button
                        onclick={submitComment}
                        disabled={submittingComment || !newComment.trim()}
                        class="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded transition-colors"
                    >
                        {submittingComment ? 'Sending…' : 'Send'}
                    </button>
                </div>
            </div>
        </div>

        <!-- ── Event History ───────────────────────────────────────── -->
        {#if taskEvents.length > 0}
            <div>
                <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    History ({taskEvents.length})
                </h2>
                <div>
                    {#each taskEvents as event}
                        <div class="flex items-baseline gap-3 py-2 border-b border-gray-900 text-xs">
                            <span class="text-gray-600 tabular-nums shrink-0 w-28">{formatDateTime(event.timestamp)}</span>
                            <span class="text-gray-400 flex-1">{eventSummary(event)}</span>
                            <span class="text-gray-600 shrink-0">{event.actor}</span>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    {/if}
</div>

<style>
    .markdown :global(h1),
    .markdown :global(h2),
    .markdown :global(h3),
    .markdown :global(h4) {
        color: #e5e7eb;
        font-weight: 600;
        margin-top: 1.25rem;
        margin-bottom: 0.5rem;
        line-height: 1.3;
    }
    .markdown :global(h1) { font-size: 1.25rem; }
    .markdown :global(h2) { font-size: 1.125rem; }
    .markdown :global(h3) { font-size: 1rem; }
    .markdown :global(p) {
        color: #d1d5db;
        font-size: 0.875rem;
        line-height: 1.7;
        margin-bottom: 0.75rem;
    }
    .markdown :global(ul),
    .markdown :global(ol) {
        color: #d1d5db;
        font-size: 0.875rem;
        padding-left: 1.5rem;
        margin-bottom: 0.75rem;
    }
    .markdown :global(li) { margin-bottom: 0.25rem; line-height: 1.6; }
    .markdown :global(li input[type='checkbox']) { margin-right: 0.375rem; }
    .markdown :global(code) {
        background: #111827;
        color: #a5b4fc;
        padding: 0.1rem 0.35rem;
        border-radius: 0.25rem;
        font-size: 0.8125rem;
        font-family: ui-monospace, monospace;
    }
    .markdown :global(pre) {
        background: #111827;
        border: 1px solid #1f2937;
        border-radius: 0.5rem;
        padding: 1rem;
        overflow-x: auto;
        margin-bottom: 1rem;
    }
    .markdown :global(pre code) { background: none; padding: 0; color: #d1d5db; }
    .markdown :global(blockquote) {
        border-left: 3px solid #374151;
        padding-left: 1rem;
        color: #9ca3af;
        margin-bottom: 0.75rem;
        font-style: italic;
    }
    .markdown :global(a) { color: #818cf8; text-decoration: underline; }
    .markdown :global(a:hover) { color: #a5b4fc; }
    .markdown :global(hr) { border-color: #1f2937; margin: 1.25rem 0; }
    .markdown :global(table) {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
        margin-bottom: 1rem;
    }
    .markdown :global(th),
    .markdown :global(td) {
        border: 1px solid #1f2937;
        padding: 0.5rem 0.75rem;
        color: #d1d5db;
    }
    .markdown :global(th) { background: #111827; font-weight: 600; text-align: left; }
</style>
