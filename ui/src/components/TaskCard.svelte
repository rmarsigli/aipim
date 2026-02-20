<script lang="ts">
    import type { Task } from '../lib/api.js'
    import StatusBadge from './StatusBadge.svelte'
    import PriorityBadge from './PriorityBadge.svelte'
    import { navigate } from '../lib/router.js'

    let { task }: { task: Task } = $props()
</script>

<div
    class="bg-gray-900 border border-gray-800 rounded-lg p-4 cursor-pointer hover:border-gray-600 transition-colors"
    onclick={() => navigate(`/task/${task.id}`)}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === 'Enter' && navigate(`/task/${task.id}`)}
>
    <div class="flex items-center justify-between gap-2 mb-2">
        <span class="text-xs font-mono text-gray-500">{task.id}</span>
        <PriorityBadge priority={task.priority} />
    </div>
    <p class="text-sm font-medium text-gray-100 mb-3 leading-snug line-clamp-2">{task.title}</p>
    <div class="flex items-center justify-between gap-2">
        <StatusBadge status={task.status} />
        {#if task.assignee}
            <span class="text-xs text-gray-500 truncate max-w-[100px]">{task.assignee}</span>
        {/if}
    </div>
</div>
