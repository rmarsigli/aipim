<script lang="ts">
    import { getStats, getTasks } from '../lib/api.js'
    import type { Task, Stats } from '../lib/api.js'
    import TaskCard from '../components/TaskCard.svelte'
    import { navigate } from '../lib/router.js'
    import { Columns, Activity, Plug, BookOpen } from 'lucide-svelte'

    let stats = $state<Stats>({})
    let inProgress = $state<Task[]>([])
    let loading = $state(true)
    let error = $state<string | null>(null)

    const total = $derived(Object.values(stats).reduce((a, b) => a + b, 0))

    $effect(() => {
        Promise.all([getStats(), getTasks({ status: 'in-progress' })])
            .then(([s, tasks]) => {
                stats = s
                inProgress = tasks
                loading = false
            })
            .catch((err: unknown) => {
                error = String(err)
                loading = false
            })
    })

    const statCards = $derived([
        { label: 'Total', value: total, color: 'text-gray-100' },
        { label: 'In Progress', value: stats['in-progress'] ?? 0, color: 'text-blue-400' },
        { label: 'Backlog', value: stats['backlog'] ?? 0, color: 'text-gray-400' },
        { label: 'Blocked', value: stats['blocked'] ?? 0, color: 'text-red-400' },
        { label: 'Done', value: (stats['done'] ?? 0) + (stats['completed'] ?? 0), color: 'text-green-400' },
    ])

    const quickLinks = [
        { path: '/kanban', label: 'Kanban Board', description: 'Drag tasks across columns', icon: Columns },
        { path: '/timeline', label: 'Event Timeline', description: 'Chronological event history', icon: Activity },
        { path: '/decisions', label: 'Decisions', description: 'Architecture Decision Records', icon: BookOpen },
    ]
</script>

<div class="space-y-8">
    <div>
        <h1 class="text-2xl font-bold text-gray-100 mb-1">Dashboard</h1>
        <p class="text-gray-500 text-sm">Project overview</p>
    </div>

    {#if error}
        <div class="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300 text-sm">
            Failed to load data: {error}
        </div>
    {:else if loading}
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {#each Array(5) as _}
                <div class="bg-gray-900 border border-gray-800 rounded-lg p-4 animate-pulse h-20"></div>
            {/each}
        </div>
    {:else}
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {#each statCards as card}
                <div class="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <p class="text-xs text-gray-500 mb-1">{card.label}</p>
                    <p class="text-3xl font-bold {card.color}">{card.value}</p>
                </div>
            {/each}
        </div>
    {/if}

    <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {#each quickLinks as link}
            <button
                onclick={() => navigate(link.path)}
                class="bg-gray-900 border border-gray-800 hover:border-indigo-700 rounded-lg p-5 text-left transition-colors group"
            >
                <link.icon size={20} class="mb-2 text-gray-500 group-hover:text-indigo-400 transition-colors" />
                <h3 class="font-medium text-gray-100 group-hover:text-indigo-300 transition-colors">{link.label}</h3>
                <p class="text-xs text-gray-500 mt-1">{link.description}</p>
            </button>
        {/each}
        <a
            href="/api/tasks"
            target="_blank"
            rel="noopener"
            class="bg-gray-900 border border-gray-800 hover:border-indigo-700 rounded-lg p-5 text-left transition-colors group block"
        >
            <Plug size={20} class="mb-2 text-gray-500 group-hover:text-indigo-400 transition-colors" />
            <h3 class="font-medium text-gray-100 group-hover:text-indigo-300 transition-colors">REST API</h3>
            <p class="text-xs text-gray-500 mt-1">Raw JSON endpoints</p>
        </a>
    </div>

    {#if inProgress.length > 0}
        <div>
            <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">In Progress</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {#each inProgress as task}
                    <TaskCard {task} />
                {/each}
            </div>
        </div>
    {/if}
</div>
