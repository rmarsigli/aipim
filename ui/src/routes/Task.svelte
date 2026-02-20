<script lang="ts">
    import { getTask } from '../lib/api.js'
    import type { Task } from '../lib/api.js'
    import StatusBadge from '../components/StatusBadge.svelte'
    import PriorityBadge from '../components/PriorityBadge.svelte'
    import { navigate } from '../lib/router.js'

    let { id }: { id: string } = $props()

    let task = $state<Task | null>(null)
    let loading = $state(true)
    let error = $state<string | null>(null)

    $effect(() => {
        loading = true
        error = null
        getTask(id)
            .then((t) => {
                task = t
                loading = false
            })
            .catch((err: unknown) => {
                error = String(err)
                loading = false
            })
    })

    function formatDate(iso: string): string {
        return new Date(iso).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        })
    }
</script>

<div class="max-w-3xl space-y-6">
    <button onclick={() => navigate('/')} class="text-sm text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1">
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
        </div>
    {:else if task}
        <div>
            <div class="flex items-center gap-2 mb-2">
                <span class="text-sm font-mono text-gray-500">{task.id}</span>
                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
                <span class="text-xs text-gray-600 font-mono">{task.task_type}</span>
            </div>
            <h1 class="text-2xl font-bold text-gray-100">{task.title}</h1>
            {#if task.assignee}
                <p class="text-sm text-gray-500 mt-1">Assigned to {task.assignee}</p>
            {/if}
            <p class="text-xs text-gray-600 mt-2">
                Created {formatDate(task.created_at)} · Updated {formatDate(task.updated_at)}
            </p>
        </div>

        {#if task.content}
            <div class="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Content</h2>
                <pre class="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">{task.content}</pre>
            </div>
        {/if}

        {#if task.comments && task.comments.length > 0}
            <div>
                <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Comments ({task.comments.length})
                </h2>
                <div class="space-y-3">
                    {#each task.comments as comment}
                        <div class="bg-gray-900 border border-gray-800 rounded-lg p-3">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="text-xs font-medium text-gray-300">{comment.actor}</span>
                                <span class="text-xs text-gray-600">{formatDate(comment.created_at)}</span>
                            </div>
                            <p class="text-sm text-gray-400">{comment.text}</p>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    {/if}
</div>
