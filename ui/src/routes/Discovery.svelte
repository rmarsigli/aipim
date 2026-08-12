<script lang="ts">
    import { getDiscovery } from '../lib/api.js'
    import type { DiscoveryDetail, ProposedChangeset } from '../lib/api.js'
    import { navigate } from '../lib/router.js'
    import { ArrowLeft, AlertTriangle, Check, X, GitBranch, FileText, BookOpen, Link2 } from 'lucide-svelte'

    let { id }: { id: string } = $props()

    let session = $state<DiscoveryDetail | null>(null)
    let loading = $state(true)
    let error = $state<string | null>(null)

    $effect(() => {
        getDiscovery(id)
            .then((d) => {
                session = d
                loading = false
            })
            .catch((err: unknown) => {
                error = String(err)
                loading = false
            })
    })

    // The one in play: the newest proposal that has not been superseded.
    const current = $derived<ProposedChangeset | null>(
        session?.changesets.find((c) => c.status === 'proposed' || c.status === 'applied') ?? null
    )

    const criticalAssumptions = $derived(session?.state.assumptions.filter((a) => a.critical) ?? [])
</script>

<div class="space-y-6">
    <button
        onclick={() => navigate('/discovery')}
        class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
    >
        <ArrowLeft size={14} />
        Back to discovery
    </button>

    {#if error}
        <div class="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300 text-sm">
            Failed to load session: {error}
        </div>
    {:else if loading || !session}
        <div class="h-40 bg-gray-900 border border-gray-800 rounded-lg animate-pulse"></div>
    {:else}
        <div>
            <div class="flex items-center gap-3 mb-1">
                <h1 class="text-2xl font-bold text-gray-100">{session.topic}</h1>
                <span class="text-xs font-mono text-gray-600">{session.id}</span>
            </div>
            <p class="text-gray-500 text-sm">
                {session.status} · v{session.version} · {session.history.length} snapshot{session.history.length === 1
                    ? ''
                    : 's'}
            </p>
        </div>

        {#if criticalAssumptions.length > 0}
            <div class="bg-amber-900/20 border border-amber-800/60 rounded-lg p-4">
                <div class="flex items-center gap-2 text-amber-300 text-sm font-medium mb-2">
                    <AlertTriangle size={14} />
                    {criticalAssumptions.length} critical assumption{criticalAssumptions.length === 1 ? '' : 's'} still open
                </div>
                <ul class="space-y-1.5">
                    {#each criticalAssumptions as assumption}
                        <li class="text-sm text-gray-300 leading-relaxed">
                            {assumption.question}
                            <span class="text-gray-500">→ assumed: {assumption.assumed}</span>
                        </li>
                    {/each}
                </ul>
            </div>
        {/if}

        {#if session.state.problem}
            <section class="bg-gray-900 border border-gray-800 rounded-lg p-5">
                <h2 class="text-sm font-semibold text-gray-300 mb-2">Problem</h2>
                <p class="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">{session.state.problem}</p>
            </section>
        {/if}

        {#if session.state.agreements.length > 0}
            <section class="bg-gray-900 border border-gray-800 rounded-lg p-5">
                <h2 class="text-sm font-semibold text-gray-300 mb-3">Agreements</h2>
                <ul class="space-y-2.5">
                    {#each session.state.agreements as agreement}
                        <li class="flex items-start gap-2.5">
                            <Check size={14} class="text-emerald-500 shrink-0 mt-0.5" />
                            <div>
                                <p class="text-sm text-gray-200 leading-snug">{agreement.statement}</p>
                                <p class="text-xs text-gray-500 mt-0.5 leading-relaxed">{agreement.rationale}</p>
                            </div>
                        </li>
                    {/each}
                </ul>
            </section>
        {/if}

        {#if session.state.alternatives.length > 0}
            <section class="bg-gray-900 border border-gray-800 rounded-lg p-5">
                <h2 class="text-sm font-semibold text-gray-300 mb-1">Alternatives rejected</h2>
                <p class="text-xs text-gray-600 mb-3">The half an ADR usually loses.</p>
                <ul class="space-y-2.5">
                    {#each session.state.alternatives as alternative}
                        <li class="flex items-start gap-2.5">
                            <X size={14} class="text-rose-500 shrink-0 mt-0.5" />
                            <div>
                                <p class="text-sm text-gray-200 leading-snug">{alternative.option}</p>
                                <p class="text-xs text-gray-500 mt-0.5 leading-relaxed">
                                    {alternative.rejectedBecause}
                                </p>
                            </div>
                        </li>
                    {/each}
                </ul>
            </section>
        {/if}

        {#if session.state.grounding.length > 0}
            <section class="bg-gray-900 border border-gray-800 rounded-lg p-5">
                <h2 class="text-sm font-semibold text-gray-300 mb-3">Grounding</h2>
                <ul class="space-y-1.5">
                    {#each session.state.grounding as ref}
                        <li class="flex items-center gap-2 text-sm">
                            <Link2 size={12} class="text-gray-600 shrink-0" />
                            <span class="text-gray-500">{ref.relation}</span>
                            <button
                                onclick={() => navigate(ref.kind === 'task' ? `/task/${ref.id}` : `/decision/${ref.id}`)}
                                class="font-mono text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                                {ref.id}
                            </button>
                            {#if ref.note}<span class="text-gray-600 text-xs">— {ref.note}</span>{/if}
                        </li>
                    {/each}
                </ul>
            </section>
        {/if}

        {#if current}
            <section class="bg-gray-900 border border-gray-800 rounded-lg p-5">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-sm font-semibold text-gray-300">
                        Changeset <span class="font-mono text-xs text-gray-600">{current.id}</span>
                    </h2>
                    <span class="text-xs px-2 py-0.5 rounded border border-gray-700 text-gray-400">
                        {current.status}
                    </span>
                </div>

                {#if current.changeset.tasks.length > 0}
                    <h3 class="text-xs uppercase tracking-wider text-gray-600 mb-2">Tasks</h3>
                    <ul class="space-y-1.5 mb-4">
                        {#each current.changeset.tasks as task}
                            <li class="flex items-center gap-2.5 text-sm">
                                <span class="font-mono text-xs text-gray-600 w-8 shrink-0">{task.localId}</span>
                                <span class="text-emerald-500">+</span>
                                <span class="text-gray-200">{task.title}</span>
                                <span class="text-xs text-gray-600 ml-auto shrink-0">
                                    {task.priority}{task.estimatedHours ? ` · ${task.estimatedHours}h` : ''}
                                </span>
                            </li>
                        {/each}
                    </ul>
                {/if}

                {#if current.changeset.dependencies.length > 0}
                    <h3 class="text-xs uppercase tracking-wider text-gray-600 mb-2">Dependencies</h3>
                    <ul class="space-y-1.5 mb-4">
                        {#each current.changeset.dependencies as dep}
                            <li class="flex items-center gap-2 font-mono text-xs">
                                <GitBranch size={12} class="text-gray-600" />
                                <span class="text-gray-300">{dep.taskRef}</span>
                                <span class="text-gray-600">depends on</span>
                                <span class="text-gray-300">{dep.dependsOnRef}</span>
                            </li>
                        {/each}
                    </ul>
                {/if}

                {#if current.changeset.decisions.length > 0}
                    <h3 class="text-xs uppercase tracking-wider text-gray-600 mb-2">Decisions</h3>
                    <ul class="space-y-1.5 mb-4">
                        {#each current.changeset.decisions as decision}
                            <li class="flex items-start gap-2.5 text-sm">
                                <BookOpen size={13} class="text-teal-500 shrink-0 mt-0.5" />
                                <div>
                                    <p class="text-gray-200 leading-snug">{decision.title}</p>
                                    {#if decision.supersedes?.length}
                                        <p class="text-xs text-amber-500/80 mt-0.5">
                                            supersedes {decision.supersedes.join(', ')}
                                        </p>
                                    {/if}
                                </div>
                            </li>
                        {/each}
                    </ul>
                {/if}

                {#if current.changeset.docs.length > 0}
                    <h3 class="text-xs uppercase tracking-wider text-gray-600 mb-2">Docs</h3>
                    <ul class="space-y-1">
                        {#each current.changeset.docs as doc}
                            <li class="flex items-center gap-2 text-xs font-mono text-gray-400">
                                <FileText size={12} class="text-gray-600" />
                                {doc.path}
                            </li>
                        {/each}
                    </ul>
                {/if}
            </section>
        {/if}

        {#if session.state.openThreads.length > 0}
            <section class="bg-gray-900 border border-gray-800 rounded-lg p-5">
                <h2 class="text-sm font-semibold text-gray-300 mb-3">Open threads</h2>
                <ul class="space-y-1.5">
                    {#each session.state.openThreads as thread}
                        <li class="text-sm text-gray-400 leading-relaxed">· {thread}</li>
                    {/each}
                </ul>
            </section>
        {/if}
    {/if}
</div>
