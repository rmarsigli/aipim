<script lang="ts">
    let { priority }: { priority: string } = $props()

    const styles: Record<string, string> = {
        'P1-S': 'text-red-400 border-red-800',
        'P1-M': 'text-red-400 border-red-800',
        'P1-L': 'text-red-400 border-red-800',
        'P2-S': 'text-orange-400 border-orange-800',
        'P2-M': 'text-orange-400 border-orange-800',
        'P2-L': 'text-orange-400 border-orange-800',
        P3: 'text-gray-400 border-gray-700',
        P4: 'text-gray-500 border-gray-800',
    }
</script>

<span class="inline-flex items-center px-1.5 py-0.5 rounded border text-xs font-mono font-medium {styles[priority] ?? 'text-gray-400 border-gray-700'}">
    {priority}
</span>
