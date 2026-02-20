<script lang="ts">
    import type { Task } from '../lib/api.js'
    import TaskCard from './TaskCard.svelte'

    interface Props {
        label: string
        tasks: Task[]
        isBlocked?: boolean
        onDrop: (taskId: string) => void
    }

    let { label, tasks, isBlocked = false, onDrop }: Props = $props()

    let dragCounter = $state(0)
    const isDragOver = $derived(dragCounter > 0)

    function handleDragEnter(e: DragEvent): void {
        e.preventDefault()
        dragCounter++
    }

    function handleDragOver(e: DragEvent): void {
        e.preventDefault()
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    }

    function handleDragLeave(): void {
        dragCounter--
    }

    function handleDrop(e: DragEvent): void {
        e.preventDefault()
        dragCounter = 0
        const taskId = e.dataTransfer?.getData('taskId')
        if (taskId) onDrop(taskId)
    }
</script>

<div class="flex flex-col min-w-64 w-64 shrink-0">
    <div class="flex items-center justify-between mb-3 px-1">
        <h2 class="text-sm font-semibold text-gray-300">{label}</h2>
        <span class="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{tasks.length}</span>
    </div>

    <div
        class="flex-1 min-h-32 rounded-lg p-1.5 transition-all {isDragOver
            ? 'bg-indigo-950/40 ring-1 ring-indigo-700/50'
            : 'bg-gray-950/30'}"
        ondragenter={handleDragEnter}
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        ondrop={handleDrop}
        role="region"
        aria-label="{label} column"
        aria-dropeffect="move"
    >
        <div class="space-y-2">
            {#each tasks as task (task.id)}
                <TaskCard {task} draggable={true} {isBlocked} showStatus={false} />
            {:else}
                {#if !isDragOver}
                    <div class="text-center py-8 text-gray-700 text-xs select-none">Empty</div>
                {/if}
            {/each}
        </div>
    </div>
</div>
