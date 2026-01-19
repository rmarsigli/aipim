/* eslint-disable no-console */
import chalk from 'chalk'

class Logger {
    private isVerbose = false

    /**
     * Enables verbose logging mode.
     * @param verbose - Whether to enable verbose logging
     */
    public setVerbose(verbose: boolean): void {
        this.isVerbose = verbose
    }

    /**
     * Logs an informational message (blue).
     */
    public info(message: string): void {
        console.log(chalk.blue('[INFO]'), message)
    }

    /**
     * Logs a success message (green).
     */
    public success(message: string): void {
        console.log(chalk.green('[SUCCESS]'), message)
    }

    /**
     * Logs a warning message (yellow).
     */
    public warn(message: string): void {
        console.warn(chalk.yellow('[WARN]'), message)
    }

    /**
     * Logs an error message (red).
     * Handles Error objects by extracting the message.
     */
    public error(message: string | Error): void {
        const msg = message instanceof Error ? message.message : message
        console.error(chalk.red('[ERROR]'), msg)
    }

    /**
     * Logs a debug message (gray) if verbose mode is enabled.
     * @param message - The debug message
     * @param meta - Optional metadata object to print
     */
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
