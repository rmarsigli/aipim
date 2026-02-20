<script lang="ts">
    import { getEvents } from '../lib/api.js'
    import type { AipimEvent } from '../lib/api.js'
    import { createSSE } from '../lib/sse.js'
    import { navigate } from '../lib/router.js'
    import { onDestroy } from 'svelte'

    // ── icons & labels ─────────────────────────────────────────────
    const EVENT_ICONS: Record<string, string> = {
        'task.created': '+',
        'task.status_changed': '→',
        'task.assigned': '◎',
        'task.comment_added': '💬',
        'task.completed': '✓',
        'task.content_updated': '✎',
        'task.priority_changed': '↑',
        'task.dependency_added': '⤵',
        'task.dependency_removed': '⤴',
        'decision.logged': '📋',
        'session.started': '▶',
        'session.ended': '■',
    }

    const EVENT_COLORS: Record<string, string> = {
        'task.created': 'bg-indigo-500',
        'task.status_changed': 'bg-blue-500',
        'task.assigned': 'bg-purple-500',
        'task.comment_added': 'bg-gray-500',
        'task.completed': 'bg-green-500',
        'task.content_updated': 'bg-yellow-500',
        'task.priority_changed': 'bg-orange-500',
        'task.dependency_added': 'bg-cyan-600',
        'task.dependency_removed': 'bg-red-600',
        'decision.logged': 'bg-teal-500',
        'session.started': 'bg-gray-600',
        'session.ended': 'bg-gray-600',
    }

    const EVENT_TYPE_LABELS: Record<string, string> = {
        'task.created': 'Task Created',
        'task.status_changed': 'Status Changed',
        'task.assigned': 'Task Assigned',
        'task.comment_added': 'Comment Added',
        'task.completed': 'Task Completed',
        'task.content_updated': 'Content Updated',
        'task.priority_changed': 'Priority Changed',
        'task.dependency_added': 'Dependency Added',
        'task.dependency_removed': 'Dependency Removed',
        'decision.logged': 'Decision Logged',
        'session.started': 'Session Started',
        'session.ended': 'Session Ended',
    }

    const ALL_TYPES = Object.keys(EVENT_TYPE_LABELS)

    // ── state ───────────────────────────────────────────────────────
    let events = $state<AipimEvent[]>([])
    let total = $state(0)
    let loading = $state(true)
    let error = $state<string | null>(null)

    // Filters (string for select binding)
    let filterType = $state('all')
    let filterActor = $state('all')
    let filterDays = $state('30')

    // ── load all events (client-side filtering) ────────────────────
    $effect(() => {
        getEvents({ limit: 500 })
            .then((page) => {
                events = [...page.events].reverse() // newest first
                total = page.total
                loading = false
            })
            .catch((err: unknown) => {
                error = String(err)
                loading = false
            })
    })

    // ── SSE: handle all event types ─────────────────────────────────
    const sseHandlers = Object.fromEntries(
        ALL_TYPES.map((type) => [
            type,
            (data: unknown) => {
                events = [data as AipimEvent, ...events]
                total += 1
            },
        ])
    )

    const sse = createSSE('/api/events/stream', sseHandlers)
    onDestroy(() => sse.close())

    // ── derived ─────────────────────────────────────────────────────
    const actors = $derived([...new Set(events.map((e) => e.actor))].sort())

    const filteredEvents = $derived(
        events.filter((event) => {
            if (filterType !== 'all' && event.type !== filterType) return false
            if (filterActor !== 'all' && event.actor !== filterActor) return false
            const days = parseInt(filterDays, 10)
            if (days > 0) {
                const cutoff = Date.now() - days * 86400000
                if (new Date(event.timestamp).getTime() < cutoff) return false
            }
            return true
        })
    )

    const groupedByDay = $derived(buildDayGroups(filteredEvents))

    function buildDayGroups(evs: AipimEvent[]): [string, AipimEvent[]][] {
        const groups = new Map<string, AipimEvent[]>()
        for (const event of evs) {
            const day = event.timestamp.split('T')[0] // YYYY-MM-DD
            if (!groups.has(day)) groups.set(day, [])
            groups.get(day)!.push(event)
        }
        return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))
    }

    // ── event description builders ──────────────────────────────────
    function str(v: unknown): string {
        return typeof v === 'string' ? v : String(v ?? '')
    }

    function eventDescription(event: AipimEvent): string {
        const e = event as Record<string, unknown>
        switch (event.type) {
            case 'task.created':
                return `${str(e.taskId)}: "${str(e.title)}"`
            case 'task.status_changed':
                return `${str(e.taskId)}: ${str(e.from)} → ${str(e.to)}`
            case 'task.comment_added': {
                const text = str(e.text)
                return `${str(e.taskId)}: "${text.length > 60 ? text.slice(0, 60) + '…' : text}"`
            }
            case 'task.completed':
                return `Completed ${str(e.taskId)}${e.notes ? `: ${str(e.notes).slice(0, 40)}` : ''}`
            case 'task.assigned':
                return `${str(e.taskId)} → @${str(e.assignee)}`
            case 'task.priority_changed':
                return `${str(e.taskId)}: ${str(e.from)} → ${str(e.to)}`
            case 'task.content_updated':
                return `Updated ${str(e.taskId)}`
            case 'task.dependency_added':
                return `${str(e.taskId)} depends on ${str(e.dependsOn)}`
            case 'task.dependency_removed':
                return `${str(e.taskId)} no longer depends on ${str(e.dependsOn)}`
            case 'decision.logged':
                return `Decision: ${str(e.title)}`
            case 'session.started':
                return `Session #${str(e.sessionNumber)} started`
            case 'session.ended':
                return `Session #${str(e.sessionNumber)} ended`
            default:
                return event.type
        }
    }

    function getTaskId(event: AipimEvent): string | null {
        return ((event as Record<string, unknown>).taskId as string | undefined) ?? null
    }

    function formatDayHeader(dateStr: string): string {
        const date = new Date(dateStr + 'T12:00:00')
        const today = new Date()
        const yesterday = new Date(today)
        yesterday.setDate(today.getDate() - 1)
        if (date.toDateString() === today.toDateString()) return 'Today'
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
        return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    }

    function formatTime(iso: string): string {
        return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    }

    const selectClass =
        'bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-indigo-600 cursor-pointer'
</script>

<div class="space-y-6">
    <!-- Header + Filters -->
    <div class="flex items-start justify-between flex-wrap gap-4">
        <div>
            <h1 class="text-2xl font-bold text-gray-100 mb-1">Event Timeline</h1>
            <p class="text-gray-500 text-sm">
                {filteredEvents.length} of {total} events · live via SSE
            </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
            <select bind:value={filterType} class={selectClass}>
                <option value="all">All types</option>
                {#each ALL_TYPES as type}
                    <option value={type}>{EVENT_TYPE_LABELS[type]}</option>
                {/each}
            </select>

            <select bind:value={filterActor} class={selectClass}>
                <option value="all">All members</option>
                {#each actors as actor}
                    <option value={actor}>{actor}</option>
                {/each}
            </select>

            <select bind:value={filterDays} class={selectClass}>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="0">All time</option>
            </select>
        </div>
    </div>

    <!-- Snippet: shared row content -->
    {#snippet rowContent(event: AipimEvent)}
        <span class="text-xs text-gray-600 font-mono w-11 shrink-0 tabular-nums">
            {formatTime(event.timestamp)}
        </span>
        <span class="text-xs shrink-0 w-5 text-center select-none" aria-hidden="true">
            {EVENT_ICONS[event.type] ?? '·'}
        </span>
        <span class="text-sm text-gray-300 flex-1 min-w-0 truncate">
            {eventDescription(event)}
        </span>
        <span class="text-xs text-gray-600 shrink-0 hidden sm:block">
            {event.actor}
        </span>
    {/snippet}

    <!-- States -->
    {#if error}
        <div class="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300 text-sm">
            Failed to load events: {error}
        </div>
    {:else if loading}
        <div class="space-y-4">
            {#each Array(6) as _}
                <div class="h-10 bg-gray-900 border border-gray-800 rounded-lg animate-pulse"></div>
            {/each}
        </div>
    {:else if filteredEvents.length === 0}
        <div class="text-center py-20 text-gray-600">
            <p class="text-5xl mb-4">📭</p>
            <p class="font-medium text-gray-500">No events yet.</p>
            <p class="text-sm mt-1">Start working on a task to see the timeline.</p>
        </div>
    {:else}
        <!-- Day groups -->
        <div class="space-y-8">
            {#each groupedByDay as [day, dayEvents]}
                <div>
                    <!-- Day header -->
                    <div class="flex items-center gap-3 mb-2">
                        <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                            {formatDayHeader(day)}
                        </h2>
                        <div class="flex-1 h-px bg-gray-800"></div>
                        <span class="text-xs text-gray-700 tabular-nums">{dayEvents.length}</span>
                    </div>

                    <!-- Events -->
                    <div class="relative">
                        <div class="absolute left-3 top-0 bottom-0 w-px bg-gray-800/60"></div>
                        <div class="pl-9 space-y-0.5">
                            {#each dayEvents as event}
                                {@const taskId = getTaskId(event)}
                                <div class="relative">
                                    <!-- timeline dot -->
                                    <div
                                        class="absolute -left-6 top-3 w-2 h-2 rounded-full {EVENT_COLORS[event.type] ?? 'bg-gray-600'}"
                                    ></div>

                                    {#if taskId}
                                        <button
                                            class="flex items-baseline gap-3 px-3 py-2 w-full rounded-lg hover:bg-gray-900 transition-colors text-left"
                                            onclick={() => navigate(`/task/${taskId}`)}
                                        >
                                            {@render rowContent(event)}
                                        </button>
                                    {:else}
                                        <div
                                            class="flex items-baseline gap-3 px-3 py-2 rounded-lg hover:bg-gray-900/50 transition-colors"
                                        >
                                            {@render rowContent(event)}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>
