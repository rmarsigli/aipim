<script lang="ts">
    import { getDecisions } from '../lib/api.js'
    import type { Decision } from '../lib/api.js'
    import { navigate } from '../lib/router.js'
    import { BookOpen, Calendar, User, ArrowRight } from 'lucide-svelte'

    let decisions = $state<Decision[]>([])
    let loading = $state(true)
    let error = $state<string | null>(null)

    $effect(() => {
        getDecisions()
            .then((d) => {
                decisions = d
                loading = false
            })
            .catch((err: unknown) => {
                error = String(err)
                loading = false
            })
    })

    function formatDate(iso: string): string {
        return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    }
</script>

<div class="space-y-6">
    <div>
        <h1 class="text-2xl font-bold text-gray-100 mb-1">Decisions</h1>
        <p class="text-gray-500 text-sm">Architecture Decision Records</p>
    </div>

    {#if error}
        <div class="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300 text-sm">
            Failed to load decisions: {error}
        </div>
    {:else if loading}
        <div class="space-y-3">
            {#each Array(4) as _}
                <div class="h-20 bg-gray-900 border border-gray-800 rounded-lg animate-pulse"></div>
            {/each}
        </div>
    {:else if decisions.length === 0}
        <div class="text-center py-20 text-gray-600">
            <BookOpen size={40} class="mx-auto mb-4 opacity-30" />
            <p class="font-medium text-gray-500">No decisions recorded yet.</p>
            <p class="text-sm mt-1">Use <code class="text-indigo-400">log_decision</code> to document architectural choices.</p>
        </div>
    {:else}
        <div class="space-y-2">
            {#each decisions as decision}
                <button
                    onclick={() => navigate(`/decision/${decision.id}`)}
                    class="w-full bg-gray-900 border border-gray-800 hover:border-indigo-700 rounded-lg p-4 text-left transition-colors group"
                >
                    <div class="flex items-start justify-between gap-4">
                        <div class="flex items-start gap-3 min-w-0">
                            <BookOpen size={16} class="text-teal-500 shrink-0 mt-0.5" />
                            <div class="min-w-0">
                                <p class="text-sm font-medium text-gray-100 group-hover:text-indigo-300 transition-colors leading-snug">
                                    {decision.title}
                                </p>
                                <p class="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                                    {decision.rationale}
                                </p>
                            </div>
                        </div>
                        <div class="flex flex-col items-end gap-1.5 shrink-0">
                            <div class="flex items-center gap-1 text-xs text-gray-600">
                                <Calendar size={10} />
                                <span>{formatDate(decision.created_at)}</span>
                            </div>
                            {#if decision.actor}
                                <div class="flex items-center gap-1 text-xs text-gray-600">
                                    <User size={10} />
                                    <span>{decision.actor.split('@')[0]}</span>
                                </div>
                            {/if}
                        </div>
                    </div>
                </button>
            {/each}
        </div>
    {/if}
</div>
