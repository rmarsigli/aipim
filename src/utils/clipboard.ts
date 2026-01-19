import { execSync } from 'child_process'
import { logger } from '@/utils/logger.js'

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
                execSync('pbcopy', { input: text })
                return true
            } else if (platform === 'linux') {
                // Try xclip first, then xsel
                try {
                    execSync('xclip -selection clipboard', { input: text })
                    return true
                } catch {
                    execSync('xsel --clipboard --input', { input: text })
                    return true
                }
            } else if (platform === 'win32') {
                // Windows
                execSync('clip', { input: text })
                return true
            }
        } catch (nativeError) {
            logger.debug('Native clipboard failed', nativeError)
        }
    }
    return false
}
