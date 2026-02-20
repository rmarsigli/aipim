<script lang="ts">
    let { status }: { status: string } = $props()

    const styles: Record<string, string> = {
        backlog: 'bg-gray-800 text-gray-400',
        'in-progress': 'bg-blue-900/60 text-blue-300',
        review: 'bg-purple-900/60 text-purple-300',
        blocked: 'bg-red-900/60 text-red-300',
        done: 'bg-green-900/60 text-green-300',
        completed: 'bg-green-900/60 text-green-300',
    }

    const labels: Record<string, string> = {
        backlog: 'Backlog',
        'in-progress': 'In Progress',
        review: 'Review',
        blocked: 'Blocked',
        done: 'Done',
        completed: 'Done',
    }
</script>

<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {styles[status] ?? 'bg-gray-800 text-gray-400'}">
    {labels[status] ?? status}
</span>
