<script lang="ts">
    import { getDecision } from '../lib/api.js'
    import { navigate } from '../lib/router.js'
    import { marked } from 'marked'
    import { BookOpen, Calendar, User, Link } from 'lucide-svelte'

    let { id }: { id: string } = $props()

    let decision = $state<Awaited<ReturnType<typeof getDecision>> | null>(null)
    let loading = $state(true)
    let error = $state<string | null>(null)

    $effect(() => {
        loading = true
        error = null
        getDecision(id)
            .then((d) => {
                decision = d
                loading = false
            })
            .catch((err: unknown) => {
                error = String(err)
                loading = false
            })
    })

    function stripFrontmatter(content: string): string {
        return content.replace(/^---[\s\S]*?---\n?/, '')
    }

    const renderedContent = $derived(
        decision?.content ? marked.parse(stripFrontmatter(decision.content)) : ''
    )

    function formatDate(iso: string): string {
        return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    }
</script>

<div class="max-w-3xl space-y-8">
    <button onclick={() => navigate('/decisions')} class="text-sm text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1.5">
        ← Decisions
    </button>

    {#if error}
        <div class="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300 text-sm">
            Failed to load decision: {error}
        </div>
    {:else if loading}
        <div class="space-y-4 animate-pulse">
            <div class="h-8 bg-gray-800 rounded w-2/3"></div>
            <div class="h-4 bg-gray-800 rounded w-1/3"></div>
            <div class="h-48 bg-gray-900 border border-gray-800 rounded-lg"></div>
        </div>
    {:else if decision}
        <div>
            <div class="flex items-center gap-2 mb-3">
                <BookOpen size={16} class="text-teal-500" />
                <span class="text-xs font-mono text-gray-500 uppercase tracking-wider">ADR</span>
            </div>
            <h1 class="text-2xl font-bold text-gray-100 leading-snug mb-3">{decision.title}</h1>
            <div class="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                <div class="flex items-center gap-1.5">
                    <Calendar size={11} />
                    <span>{formatDate(decision.created_at)}</span>
                </div>
                {#if decision.actor}
                    <div class="flex items-center gap-1.5">
                        <User size={11} />
                        <span>{decision.actor}</span>
                    </div>
                {/if}
                {#if decision.task_id}
                    <button
                        onclick={() => navigate(`/task/${decision!.task_id}`)}
                        class="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                        <Link size={11} />
                        <span>{decision.task_id}</span>
                    </button>
                {/if}
            </div>
        </div>

        {#if decision.content}
            <div class="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                <div class="px-4 py-2.5 border-b border-gray-800">
                    <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Content</h2>
                </div>
                <div class="markdown p-5">{@html renderedContent}</div>
            </div>
        {:else}
            <div class="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Rationale</p>
                <p class="text-sm text-gray-300 leading-relaxed">{decision.rationale}</p>
            </div>
        {/if}
    {/if}
</div>

<style>
    .markdown :global(h1),
    .markdown :global(h2),
    .markdown :global(h3),
    .markdown :global(h4) {
        color: #e5e7eb;
        font-weight: 600;
        margin-top: 1.25rem;
        margin-bottom: 0.5rem;
        line-height: 1.3;
    }
    .markdown :global(h1) { font-size: 1.25rem; }
    .markdown :global(h2) { font-size: 1.125rem; }
    .markdown :global(h3) { font-size: 1rem; }
    .markdown :global(p) {
        color: #d1d5db;
        font-size: 0.875rem;
        line-height: 1.7;
        margin-bottom: 0.75rem;
    }
    .markdown :global(ul),
    .markdown :global(ol) {
        color: #d1d5db;
        font-size: 0.875rem;
        padding-left: 1.5rem;
        margin-bottom: 0.75rem;
    }
    .markdown :global(li) { margin-bottom: 0.25rem; line-height: 1.6; }
    .markdown :global(code) {
        background: #111827;
        color: #a5b4fc;
        padding: 0.1rem 0.35rem;
        border-radius: 0.25rem;
        font-size: 0.8125rem;
        font-family: ui-monospace, monospace;
    }
    .markdown :global(pre) {
        background: #111827;
        border: 1px solid #1f2937;
        border-radius: 0.5rem;
        padding: 1rem;
        overflow-x: auto;
        margin-bottom: 1rem;
    }
    .markdown :global(pre code) { background: none; padding: 0; color: #d1d5db; }
    .markdown :global(blockquote) {
        border-left: 3px solid #374151;
        padding-left: 1rem;
        color: #9ca3af;
        margin-bottom: 0.75rem;
        font-style: italic;
    }
    .markdown :global(a) { color: #818cf8; text-decoration: underline; }
    .markdown :global(a:hover) { color: #a5b4fc; }
    .markdown :global(hr) { border-color: #1f2937; margin: 1.25rem 0; }
    .markdown :global(table) {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
        margin-bottom: 1rem;
    }
    .markdown :global(th),
    .markdown :global(td) {
        border: 1px solid #1f2937;
        padding: 0.5rem 0.75rem;
        color: #d1d5db;
    }
    .markdown :global(th) { background: #111827; font-weight: 600; text-align: left; }
</style>
