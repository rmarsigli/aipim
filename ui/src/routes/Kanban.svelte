<script lang="ts">
    import { getTasks, postEvent } from '../lib/api.js'
    import type { Task } from '../lib/api.js'
    import { createSSE } from '../lib/sse.js'
    import { onDestroy } from 'svelte'
    import Column from '../components/Column.svelte'

    const COLUMNS = [
        { id: 'backlog', label: 'Backlog' },
        { id: 'in-progress', label: 'In Progress' },
        { id: 'review', label: 'Review' },
        { id: 'done', label: 'Done' },
        { id: 'blocked', label: 'Blocked' },
    ]

    let tasks = $state<Task[]>([])
    let loading = $state(true)
    let error = $state<string | null>(null)

    $effect(() => {
        getTasks()
            .then((t) => {
                tasks = t
                loading = false
            })
            .catch((err: unknown) => {
                error = String(err)
                loading = false
            })
    })

    // Live updates via SSE
    const sse = createSSE('/api/events/stream', {
        'task.status_changed': (data) => {
            const { taskId, to } = data as { taskId: string; to: string }
            tasks = tasks.map((t) => (t.id === taskId ? { ...t, status: to, updated_at: new Date().toISOString() } : t))
        },
        'task.created': () => {
            // Reload to get full task data
            getTasks()
                .then((t) => {
                    tasks = t
                })
                .catch(() => {})
        },
        'task.assigned': (data) => {
            const { taskId, assignee } = data as { taskId: string; assignee: string }
            tasks = tasks.map((t) => (t.id === taskId ? { ...t, assignee } : t))
        },
        'task.completed': (data) => {
            const { taskId } = data as { taskId: string }
            tasks = tasks.map((t) => (t.id === taskId ? { ...t, status: 'done', updated_at: new Date().toISOString() } : t))
        },
    })

    onDestroy(() => sse.close())

    function tasksByStatus(colId: string): Task[] {
        const statuses = colId === 'done' ? ['done', 'completed'] : [colId]
        return tasks.filter((t) => statuses.includes(t.status))
    }

    async function handleDrop(taskId: string, newStatus: string): Promise<void> {
        const task = tasks.find((t) => t.id === taskId)
        if (!task) return
        const fromStatus = task.status
        if (fromStatus === newStatus) return

        // Optimistic update
        tasks = tasks.map((t) =>
            t.id === taskId ? { ...t, status: newStatus, updated_at: new Date().toISOString() } : t
        )

        try {
            await postEvent({ type: 'task.status_changed', taskId, from: fromStatus, to: newStatus })
        } catch {
            // Revert on failure
            tasks = tasks.map((t) => (t.id === taskId ? { ...t, status: fromStatus } : t))
        }
    }

    const totalTasks = $derived(tasks.length)
</script>

<div class="space-y-4">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-bold text-gray-100 mb-1">Kanban Board</h1>
            <p class="text-gray-500 text-sm">{totalTasks} tasks · drag to move between columns · live via SSE</p>
        </div>
    </div>

    {#if error}
        <div class="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300 text-sm">
            Failed to load tasks: {error}
        </div>
    {:else if loading}
        <div class="flex gap-4 overflow-x-auto pb-4">
            {#each COLUMNS as _}
                <div class="min-w-64 w-64 shrink-0">
                    <div class="h-6 bg-gray-800 rounded w-24 mb-3 animate-pulse"></div>
                    <div class="space-y-2">
                        {#each Array(3) as _}
                            <div class="h-20 bg-gray-900 border border-gray-800 rounded-lg animate-pulse"></div>
                        {/each}
                    </div>
                </div>
            {/each}
        </div>
    {:else}
        <div class="flex gap-4 overflow-x-auto pb-4 items-start">
            {#each COLUMNS as col}
                <Column
                    label={col.label}
                    tasks={tasksByStatus(col.id)}
                    isBlocked={col.id === 'blocked'}
                    onDrop={(taskId) => handleDrop(taskId, col.id)}
                />
            {/each}
        </div>
    {/if}
</div>
