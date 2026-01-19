import { spawn } from 'child_process'
import { logger } from '@/utils/logger.js'

/**
 * Helper to run command with input
 */
function runWithInput(command: string, args: string[], input: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args)

        proc.on('error', (err) => reject(err))

        proc.on('close', (code) => {
            if (code === 0) resolve()
            else reject(new Error(`Command ${command} failed with code ${code}`))
        })

        if (proc.stdin) {
            proc.stdin.write(input)
            proc.stdin.end()
        }
    })
}

/**
 * Copies text to the system clipboard.
 * Tries `clipboardy` first, then falls back to native OS commands (pbcopy, xclip, clip).
 *
 * @param text - Text to copy
 * @returns true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        // Try clipboardy (cross-platform clipboard library)
        const { default: clipboardy } = await import('clipboardy')
        await clipboardy.write(text)
        return true
    } catch {
        logger.debug('Clipboardy not available, trying native clipboard...')
        // Fallback to native OS clipboard
        try {
            const platform = process.platform
            if (platform === 'darwin') {
                // macOS
                await runWithInput('pbcopy', [], text)
                return true
            } else if (platform === 'linux') {
                // Try xclip first, then xsel
                try {
                    await runWithInput('xclip', ['-selection', 'clipboard'], text)
                    return true
                } catch {
                    await runWithInput('xsel', ['--clipboard', '--input'], text)
                    return true
                }
            } else if (platform === 'win32') {
                // Windows
                await runWithInput('clip', [], text)
                return true
            }
        } catch (nativeError) {
            logger.debug('Native clipboard failed', nativeError)
        }
    }
    return false
}
