<script lang="ts">
    import { getPath, navigate } from './lib/router.js'
    import Dashboard from './routes/Dashboard.svelte'
    import Kanban from './routes/Kanban.svelte'
    import Timeline from './routes/Timeline.svelte'
    import TaskView from './routes/Task.svelte'
    import Decisions from './routes/Decisions.svelte'
    import DecisionView from './routes/Decision.svelte'
    import Discoveries from './routes/Discoveries.svelte'
    import DiscoveryView from './routes/Discovery.svelte'
    import { LayoutDashboard, Columns, Activity, BookOpen, Lightbulb } from 'lucide-svelte'

    let route = $state(getPath())

    $effect(() => {
        const handler = (): void => {
            route = getPath()
        }
        window.addEventListener('popstate', handler)
        return () => window.removeEventListener('popstate', handler)
    })

    const taskId = $derived(route.startsWith('/task/') ? route.slice('/task/'.length) : null)
    const decisionId = $derived(route.startsWith('/decision/') ? route.slice('/decision/'.length) : null)
    const discoveryId = $derived(route.startsWith('/discovery/') ? route.slice('/discovery/'.length) : null)

    const navLinks = [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/kanban', label: 'Kanban', icon: Columns },
        { path: '/timeline', label: 'Timeline', icon: Activity },
        { path: '/decisions', label: 'Decisions', icon: BookOpen },
        { path: '/discovery', label: 'Discovery', icon: Lightbulb },
    ]

    function isActive(path: string): boolean {
        if (path === '/') return route === '/'
        return route.startsWith(path)
    }
</script>

<div class="min-h-screen bg-gray-950 text-gray-100">
    <nav class="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-14">
                <button
                    onclick={() => navigate('/')}
                    class="text-sm font-bold text-indigo-400 tracking-wider font-mono hover:text-indigo-300 transition-colors"
                >
                    AIPIM
                </button>
                <div class="flex items-center gap-1">
                    {#each navLinks as link}
                        <button
                            onclick={() => navigate(link.path)}
                            class="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors {isActive(link.path)
                                ? 'bg-gray-800 text-gray-100'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'}"
                        >
                            <link.icon size={14} />
                            {link.label}
                        </button>
                    {/each}
                </div>
            </div>
        </div>
    </nav>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {#if taskId}
            <TaskView id={taskId} />
        {:else if decisionId}
            <DecisionView id={decisionId} />
        {:else if discoveryId}
            <DiscoveryView id={discoveryId} />
        {:else if route === '/kanban'}
            <Kanban />
        {:else if route === '/timeline'}
            <Timeline />
        {:else if route === '/decisions'}
            <Decisions />
        {:else if route === '/discovery'}
            <Discoveries />
        {:else}
            <Dashboard />
        {/if}
    </main>
</div>
