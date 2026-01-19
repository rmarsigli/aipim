import crypto from 'crypto'
import { version } from '@/version.js'

export type FileStatus = 'pristine' | 'modified' | 'legacy' | 'missing'

interface FileMetadata {
    signature: string
    version: string
    strategy?: string
}

export class SignatureManager {
    private static readonly SIG_PREFIX = '<!-- @aipim-signature:'
    private static readonly VER_PREFIX = '<!-- @aipim-version:'

    /**
     * Signs the content by appending a signature and version.
     * Calculated using SHA-256 of the content (excluding existing metadata).
     *
     * @param content - The file content to sign
     * @param _strategy - Signing strategy (reserved for future use)
     * @returns The content with appended metadata footer
     */
    public sign(content: string, _strategy: string = 'overwrite-if-unchanged'): string {
        const cleanContent = this.stripMetadata(content)
        const hash = this.calculateHash(cleanContent)

        // Ensure content ends with newline before appending metadata
        const spacer = cleanContent.endsWith('\n') ? '' : '\n'

        return `${cleanContent}${spacer}
${SignatureManager.SIG_PREFIX} ${hash} -->
${SignatureManager.VER_PREFIX} ${version} -->
`
    }

    /**
     * Verifies if the file content matches its embedded signature.
     * checks if the calculated hash of the content matches the stored signature.
     *
     * @param content - The raw file content to verify
     * @returns 'pristine' if match, 'modified' if mismatch, 'legacy' if no signature, 'missing' if file missing
     */
    public verify(content: string): FileStatus {
        const metadata = this.extractMetadata(content)

        if (!metadata) {
            return 'legacy'
        }

        const cleanContent = this.stripMetadata(content)
        const currentHash = this.calculateHash(cleanContent)

        return currentHash === metadata.signature ? 'pristine' : 'modified'
    }

    private stripMetadata(content: string): string {
        // Regex to match our specific comments at the end of the file
        // Handles optional newlines before them
        const sigRegex = new RegExp(`\\n${SignatureManager.SIG_PREFIX}.*?-->`, 'g')
        const verRegex = new RegExp(`\\n${SignatureManager.VER_PREFIX}.*?-->`, 'g')

        return content.replace(sigRegex, '').replace(verRegex, '').trim()
    }

    private extractMetadata(content: string): FileMetadata | null {
        // Debug regex matching
        const regexStr = `${SignatureManager.SIG_PREFIX}\\s+([a-f0-9]+)\\s+-->`
        const sigMatch = content.match(new RegExp(regexStr))
        const verMatch = content.match(new RegExp(`${SignatureManager.VER_PREFIX}\\s+([0-9.]+)\\s+-->`))

        if (!sigMatch) {
            // console.log('Signature extract failed:', regexStr, 'Tail:', content.substring(Math.max(0, content.length - 500)))
            return null
        }

        return {
            signature: sigMatch[1],
            version: verMatch ? verMatch[1] : '0.0.0'
        }
    }

    private calculateHash(content: string): string {
        return crypto.createHash('sha256').update(content.trim()).digest('hex')
    }
}

export const signatureManager = new SignatureManager()
