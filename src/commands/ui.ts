import { Command } from 'commander'
import chalk from 'chalk'
import { spawn, exec } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import { startMcpServer } from '../mcp/server.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
// dist/commands/ui.js → ../../ui
const UI_DIR = join(__dirname, '../../ui')

function openBrowser(url: string): void {
    const cmd =
        process.platform === 'darwin'
            ? `open "${url}"`
            : process.platform === 'win32'
              ? `start "" "${url}"`
              : `xdg-open "${url}" 2>/dev/null || sensible-browser "${url}" 2>/dev/null || true`
    exec(cmd)
}

export function registerUiCommand(program: Command): void {
    program
        .command('ui')
        .description('Start the UI server and open in browser')
        .option('-p, --port <port>', 'Port to listen on', '3141')
        .option('--project <path>', 'Project root', process.cwd())
        .option('--no-open', 'Do not open browser automatically')
        .option('--dev', 'Start Vite dev server with hot reload')
        .action(async (opts: { port: string; project: string; open: boolean; dev: boolean }) => {
            const port = parseInt(opts.port, 10)

            if (opts.dev) {
                // Dev mode: run Vite dev server + Hono API in parallel
                if (!existsSync(UI_DIR)) {
                    console.error(chalk.red(`UI directory not found: ${UI_DIR}`))
                    process.exit(1)
                }

                const nodeModules = join(UI_DIR, 'node_modules')
                if (!existsSync(nodeModules)) {
                    /* eslint-disable no-console */
                    console.log(chalk.yellow('Installing UI dependencies...'))
                    /* eslint-enable no-console */
                    await new Promise<void>((resolve, reject) => {
                        const install = spawn('npm', ['install'], {
                            cwd: UI_DIR,
                            stdio: 'inherit',
                            shell: true
                        })
                        install.on('close', (code) =>
                            code === 0 ? resolve() : reject(new Error(`npm install failed`))
                        )
                    })
                }

                // Start Hono API server (no UI static serving in dev)
                try {
                    /* eslint-disable no-console */
                    console.log(chalk.blue(`Starting API server on port ${port}...`))
                    /* eslint-enable no-console */
                    startMcpServer(opts.project, port).catch(() => {
                        // server may already be running, ignore
                    })
                } catch {
                    // ignore if already running
                }

                // Start Vite dev server
                const vitePort = 5173
                const vite = spawn('npx', ['vite', '--port', String(vitePort)], {
                    cwd: UI_DIR,
                    stdio: 'inherit',
                    shell: true
                })

                vite.on('error', (err) => {
                    console.error(chalk.red(`Vite error: ${err.message}`))
                })

                const devUrl = `http://localhost:${vitePort}/ui/`
                /* eslint-disable no-console */
                console.log(chalk.green(`\nUI dev server: ${devUrl}`))
                console.log(chalk.gray(`API server:    http://localhost:${port}/api/tasks\n`))
                /* eslint-enable no-console */

                if (opts.open) {
                    setTimeout(() => openBrowser(devUrl), 1500)
                }

                process.on('SIGINT', () => {
                    vite.kill()
                    process.exit(0)
                })
            } else {
                // Production mode: serve ui/dist/ via Hono
                try {
                    await startMcpServer(opts.project, port)
                    const url = `http://localhost:${port}/ui/`
                    /* eslint-disable no-console */
                    console.log(chalk.green(`UI available at ${url}`))
                    /* eslint-enable no-console */
                    if (opts.open) openBrowser(url)
                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : String(error)
                    console.error(chalk.red(`\nError: ${message}\n`))
                    process.exit(1)
                }
            }
        })
}
