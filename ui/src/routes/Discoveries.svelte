<script lang="ts">
    import { getDiscoveries } from '../lib/api.js'
    import type { DiscoverySession } from '../lib/api.js'
    import { navigate } from '../lib/router.js'
    import { Lightbulb, Calendar, User } from 'lucide-svelte'

    let sessions = $state<DiscoverySession[]>([])
    let loading = $state(true)
    let error = $state<string | null>(null)

    $effect(() => {
        getDiscoveries()
            .then((d) => {
                sessions = d
                loading = false
            })
            .catch((err: unknown) => {
                error = String(err)
                loading = false
            })
    })

    const STATUS_STYLES: Record<string, string> = {
        open: 'bg-amber-900/40 text-amber-300 border-amber-800',
        proposed: 'bg-indigo-900/40 text-indigo-300 border-indigo-800',
        applied: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
        abandoned: 'bg-gray-800 text-gray-500 border-gray-700',
    }

    function formatDate(iso: string): string {
        return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    }
</script>

<div class="space-y-6">
    <div>
        <h1 class="text-2xl font-bold text-gray-100 mb-1">Discovery</h1>
        <p class="text-gray-500 text-sm">Brainstorm sessions and the changesets they proposed</p>
    </div>

    {#if error}
        <div class="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300 text-sm">
            Failed to load discoveries: {error}
        </div>
    {:else if loading}
        <div class="space-y-3">
            {#each Array(3) as _}
                <div class="h-20 bg-gray-900 border border-gray-800 rounded-lg animate-pulse"></div>
            {/each}
        </div>
    {:else if sessions.length === 0}
        <div class="text-center py-20 text-gray-600">
            <Lightbulb size={40} class="mx-auto mb-4 opacity-30" />
            <p class="font-medium text-gray-500">No discovery sessions yet.</p>
            <p class="text-sm mt-1">Ask your agent to brainstorm — it will open one.</p>
        </div>
    {:else}
        <div class="space-y-2">
            {#each sessions as session}
                <button
                    onclick={() => navigate(`/discovery/${session.id}`)}
                    class="w-full bg-gray-900 border border-gray-800 hover:border-indigo-700 rounded-lg p-4 text-left transition-colors group"
                >
                    <div class="flex items-start justify-between gap-4">
                        <div class="flex items-start gap-3 min-w-0">
                            <Lightbulb size={16} class="text-amber-500 shrink-0 mt-0.5" />
                            <div class="min-w-0">
                                <p
                                    class="text-sm font-medium text-gray-100 group-hover:text-indigo-300 transition-colors leading-snug"
                                >
                                    {session.topic}
                                </p>
                                <p class="text-xs font-mono text-gray-600 mt-1">{session.id}</p>
                            </div>
                        </div>
                        <div class="flex flex-col items-end gap-1.5 shrink-0">
                            <span
                                class="text-xs px-2 py-0.5 rounded border {STATUS_STYLES[session.status] ??
                                    STATUS_STYLES.abandoned}"
                            >
                                {session.status}
                            </span>
                            <div class="flex items-center gap-1 text-xs text-gray-600">
                                <Calendar size={10} />
                                <span>{formatDate(session.updated_at)}</span>
                            </div>
                            {#if session.actor}
                                <div class="flex items-center gap-1 text-xs text-gray-600">
                                    <User size={10} />
                                    <span>{session.actor.split('@')[0]}</span>
                                </div>
                            {/if}
                        </div>
                    </div>
                </button>
            {/each}
        </div>
    {/if}
</div>
