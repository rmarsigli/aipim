<script lang="ts">
    import { getTasks } from '../lib/api.js'
    import type { Task } from '../lib/api.js'
    import TaskCard from '../components/TaskCard.svelte'

    const COLUMNS = [
        { id: 'backlog', label: 'Backlog' },
        { id: 'in-progress', label: 'In Progress' },
        { id: 'review', label: 'Review' },
        { id: 'blocked', label: 'Blocked' },
        { id: 'done', label: 'Done' },
    ]

    let tasksByStatus = $state<Record<string, Task[]>>({})
    let loading = $state(true)
    let error = $state<string | null>(null)

    $effect(() => {
        getTasks()
            .then((tasks) => {
                const grouped: Record<string, Task[]> = {}
                for (const col of COLUMNS) grouped[col.id] = []
                for (const task of tasks) {
                    const key = task.status === 'completed' ? 'done' : task.status
                    if (grouped[key]) grouped[key].push(task)
                    else grouped[key] = [task]
                }
                tasksByStatus = grouped
                loading = false
            })
            .catch((err: unknown) => {
                error = String(err)
                loading = false
            })
    })
</script>

<div class="space-y-6">
    <div>
        <h1 class="text-2xl font-bold text-gray-100 mb-1">Kanban Board</h1>
        <p class="text-gray-500 text-sm">Drag-and-drop coming in the next release</p>
    </div>

    {#if error}
        <div class="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300 text-sm">
            Failed to load tasks: {error}
        </div>
    {:else if loading}
        <div class="flex gap-4 overflow-x-auto pb-4">
            {#each COLUMNS as _}
                <div class="min-w-64 bg-gray-900 border border-gray-800 rounded-lg p-3 h-48 animate-pulse"></div>
            {/each}
        </div>
    {:else}
        <div class="flex gap-4 overflow-x-auto pb-4 items-start">
            {#each COLUMNS as col}
                {@const tasks = tasksByStatus[col.id] ?? []}
                <div class="min-w-64 w-64 shrink-0">
                    <div class="flex items-center justify-between mb-3">
                        <h2 class="text-sm font-semibold text-gray-300">{col.label}</h2>
                        <span class="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{tasks.length}</span>
                    </div>
                    <div class="space-y-2">
                        {#each tasks as task}
                            <TaskCard {task} />
                        {/each}
                        {#if tasks.length === 0}
                            <div class="border border-dashed border-gray-800 rounded-lg p-4 text-center text-gray-600 text-xs">
                                Empty
                            </div>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>
