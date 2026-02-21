<script lang="ts">
    import type { Task } from '../lib/api.js'
    import StatusBadge from './StatusBadge.svelte'
    import PriorityBadge from './PriorityBadge.svelte'
    import { navigate } from '../lib/router.js'
    import { AlertCircle } from 'lucide-svelte'

    interface Props {
        task: Task
        draggable?: boolean
        isBlocked?: boolean
        showStatus?: boolean
    }

    let { task, draggable = false, isBlocked = false, showStatus = true }: Props = $props()

    const PRIORITY_COLORS: Record<string, string> = {
        'P1-S': '#ef4444',
        'P1-M': '#ef4444',
        'P1-L': '#ef4444',
        'P2-S': '#f97316',
        'P2-M': '#f97316',
        'P2-L': '#f97316',
        P3: '#6b7280',
        P4: '#374151',
    }

    function daysSince(iso: string): number {
        return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    }

    function onDragStart(e: DragEvent): void {
        e.dataTransfer?.setData('taskId', task.id)
        e.dataTransfer?.setData('text/plain', task.id)
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
    }

    const borderColor = $derived(PRIORITY_COLORS[task.priority] ?? '#4b5563')
    const assigneeShort = $derived(task.assignee ? task.assignee.split('@')[0] : null)
</script>

<div
    class="bg-gray-900 border border-gray-800 border-l-4 rounded-lg p-3 hover:border-gray-700 transition-colors select-none {draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}"
    style="border-left-color: {borderColor}"
    {draggable}
    ondragstart={draggable ? onDragStart : undefined}
    onclick={() => navigate(`/task/${task.id}`)}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === 'Enter' && navigate(`/task/${task.id}`)}
>
    <div class="flex items-center justify-between gap-1 mb-1.5">
        <span class="text-xs font-mono text-gray-500 shrink-0">{task.id}</span>
        <span class="text-xs font-mono text-gray-600 shrink-0">{task.task_type}</span>
    </div>

    <p class="text-sm font-medium text-gray-100 mb-2 leading-snug line-clamp-2">{task.title}</p>

    <div class="flex items-center justify-between gap-2">
        {#if showStatus}
            <StatusBadge status={task.status} />
        {:else}
            <PriorityBadge priority={task.priority} />
        {/if}

        <div class="flex items-center gap-2 shrink-0">
            {#if isBlocked}
                <span class="flex items-center gap-1 text-xs text-red-400 font-medium">
                    <AlertCircle size={11} />{daysSince(task.updated_at)}d
                </span>
            {/if}
            {#if assigneeShort}
                <span class="text-xs text-gray-500">@{assigneeShort}</span>
            {/if}
        </div>
    </div>
</div>
