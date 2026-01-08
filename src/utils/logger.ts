/* eslint-disable no-console */
import chalk from 'chalk'

class Logger {
    private isVerbose = false

    public setVerbose(verbose: boolean): void {
        this.isVerbose = verbose
    }

    public info(message: string): void {
        console.log(chalk.blue('[INFO]'), message)
    }

    public success(message: string): void {
        console.log(chalk.green('[SUCCESS]'), message)
    }

    public warn(message: string): void {
        console.warn(chalk.yellow('[WARN]'), message)
    }

    public error(message: string | Error): void {
        const msg = message instanceof Error ? message.message : message
        console.error(chalk.red('[ERROR]'), msg)
    }

    public debug(message: string, meta?: unknown): void {
        if (this.isVerbose) {
            console.log(chalk.gray('[DEBUG]'), message)
            if (meta) {
                console.log(chalk.gray(JSON.stringify(meta, null, 2)))
            }
        }
    }
}

export const logger = new Logger()
