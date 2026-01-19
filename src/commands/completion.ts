import { Command } from 'commander'

export function completion(program: Command): void {
    const script = generateBashCompletion(program)
    /* eslint-disable-next-line no-console */
    console.log(script)
}

function generateBashCompletion(program: Command): string {
    const commands = program.commands.map((cmd) => cmd.name())
    const cmdOpts = commands.map((cmdName) => {
        const cmd = program.commands.find((c) => c.name() === cmdName)
        const opts =
            cmd?.options.map((o) => {
                const flags = o.flags.split(',')
                // Take the long flag if available, else short. Strip <args> or [args]
                const flag = flags.length > 1 ? flags[1] : flags[0]
                return flag.trim().split(' ')[0]
            }) || []
        return { name: cmdName, opts }
    })

    // Basic bash completion script
    return `
# aipim bash completion

_aipim_completion() {
    local cur prev
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
    
    # Global commands
    local commands="${commands.join(' ')}"
    
    # Options per command
    ${cmdOpts
        .map(
            (c) => `
    if [[ "\${COMP_WORDS[1]}" == "${c.name}" ]]; then
        COMPREPLY=( $(compgen -W "${c.opts.join(' ')}" -- "$cur") )
        return 0
    fi
    `
        )
        .join('')}

    # Main command completion
    if [[ "$prev" == "aipim" ]]; then
        COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
        return 0
    fi
}

complete -F _aipim_completion aipim
`
}
