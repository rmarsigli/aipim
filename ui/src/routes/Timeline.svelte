<script lang="ts">
    import { getEvents } from '../lib/api.js'
    import type { AipimEvent } from '../lib/api.js'
    import { createSSE } from '../lib/sse.js'
    import { navigate } from '../lib/router.js'
    import { onDestroy } from 'svelte'

    const EVENT_LABELS: Record<string, string> = {
        'task.created': 'Task created',
        'task.status_changed': 'Status changed',
        'task.assigned': 'Task assigned',
        'task.comment_added': 'Comment added',
        'task.completed': 'Task completed',
        'task.content_updated': 'Content updated',
        'task.priority_changed': 'Priority changed',
        'task.dependency_added': 'Dependency added',
        'task.dependency_removed': 'Dependency removed',
        'decision.logged': 'Decision logged',
        'session.started': 'Session started',
        'session.ended': 'Session ended',
    }

    const EVENT_COLORS: Record<string, string> = {
        'task.created': 'bg-indigo-500',
        'task.status_changed': 'bg-blue-500',
        'task.assigned': 'bg-purple-500',
        'task.comment_added': 'bg-gray-500',
        'task.completed': 'bg-green-500',
        'task.content_updated': 'bg-yellow-500',
        'task.priority_changed': 'bg-orange-500',
        'task.dependency_added': 'bg-cyan-500',
        'task.dependency_removed': 'bg-red-500',
        'decision.logged': 'bg-teal-500',
        'session.started': 'bg-gray-600',
        'session.ended': 'bg-gray-600',
    }

    let events = $state<AipimEvent[]>([])
    let total = $state(0)
    let loading = $state(true)
    let error = $state<string | null>(null)

    $effect(() => {
        getEvents({ limit: 50 })
            .then((page) => {
                events = [...page.events].reverse()
                total = page.total
                loading = false
            })
            .catch((err: unknown) => {
                error = String(err)
                loading = false
            })
    })

    const sse = createSSE('/api/events/stream', {
        'task.created': (data) => {
            events = [data as AipimEvent, ...events]
        },
        'task.status_changed': (data) => {
            events = [data as AipimEvent, ...events]
        },
        'task.comment_added': (data) => {
            events = [data as AipimEvent, ...events]
        },
        'task.completed': (data) => {
            events = [data as AipimEvent, ...events]
        },
        'decision.logged': (data) => {
            events = [data as AipimEvent, ...events]
        },
    })

    onDestroy(() => sse.close())

    function formatDate(iso: string): string {
        return new Date(iso).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    function getTaskId(event: AipimEvent): string | null {
        return (event.taskId as string | undefined) ?? null
    }
</script>

<div class="space-y-6">
    <div>
        <h1 class="text-2xl font-bold text-gray-100 mb-1">Event Timeline</h1>
        <p class="text-gray-500 text-sm">{total} events total — newest first, live updates via SSE</p>
    </div>

    {#if error}
        <div class="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300 text-sm">
            Failed to load events: {error}
        </div>
    {:else if loading}
        <div class="space-y-3">
            {#each Array(8) as _}
                <div class="bg-gray-900 border border-gray-800 rounded-lg p-4 h-16 animate-pulse"></div>
            {/each}
        </div>
    {:else if events.length === 0}
        <div class="text-center py-16 text-gray-600">
            <p class="text-4xl mb-3">📭</p>
            <p>No events yet</p>
        </div>
    {:else}
        <div class="relative">
            <div class="absolute left-4 top-0 bottom-0 w-px bg-gray-800"></div>
            <div class="space-y-1 pl-10">
                {#each events as event}
                    {@const taskId = getTaskId(event)}
                    <div class="relative">
                        <div
                            class="absolute -left-6 top-4 w-2 h-2 rounded-full {EVENT_COLORS[event.type] ?? 'bg-gray-500'}"
                        ></div>
                        <div
                            class="bg-gray-900 border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-colors {taskId ? 'cursor-pointer' : ''}"
                            onclick={() => taskId && navigate(`/task/${taskId}`)}
                            role="button"
                            tabindex="0"
                            onkeydown={(e) => e.key === 'Enter' && taskId && navigate(`/task/${taskId}`)}
                        >
                            <div class="flex items-center justify-between gap-2">
                                <div class="flex items-center gap-2 min-w-0">
                                    <span class="text-xs font-medium text-gray-200 shrink-0">
                                        {EVENT_LABELS[event.type] ?? event.type}
                                    </span>
                                    {#if taskId}
                                        <span class="text-xs font-mono text-indigo-400 truncate">{taskId}</span>
                                    {/if}
                                </div>
                                <div class="flex items-center gap-2 shrink-0 text-xs text-gray-500">
                                    <span>{event.actor}</span>
                                    <span>{formatDate(event.timestamp)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>
