import { Command } from 'commander'
import chalk from 'chalk'
import { startMcpServer } from '../mcp/server.js'

export function registerMcpCommand(program: Command): void {
    const mcp = program.command('mcp').description('MCP server management')

    mcp.command('start')
        .description('Start the MCP server for AI tool integration')
        .option('-p, --port <port>', 'Port to listen on', '3141')
        .option('--project <path>', 'Project root', process.cwd())
        .action(async (opts: { port: string; project: string }) => {
            try {
                await startMcpServer(opts.project, parseInt(opts.port, 10))
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error)

                console.error(chalk.red(`\nError: ${message}\n`))

                process.exit(1)
            }
        })
}
