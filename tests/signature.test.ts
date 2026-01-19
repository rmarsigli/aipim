import { signatureManager } from '../src/core/signature.js'
import { describe, test, expect } from '@jest/globals'

describe('SignatureManager', () => {
    const content = '# Hello World\nThis is a test file.'

    test('signs content correctly', () => {
        const signed = signatureManager.sign(content)
        
        expect(signed).toContain(content)
        expect(signed).toContain('<!-- @aipim-signature:')
        expect(signed).toContain('<!-- @aipim-version:')
    })

    test('verifies pristine content', () => {
        const signed = signatureManager.sign(content)
        const status = signatureManager.verify(signed)
        
        expect(status).toBe('pristine')
    })

    test('detects modified content', () => {
        const signed = signatureManager.sign(content)
        // Simulate user modification
        const modified = signed.replace('Hello World', 'Hello Universe')
        
        const status = signatureManager.verify(modified)
        
        expect(status).toBe('modified')
    })

    test('detects legacy content (no signature)', () => {
        const legacy = content
        const status = signatureManager.verify(legacy)
        
        expect(status).toBe('legacy')
    })

    test('re-signing updates signature but keeps content', () => {
        const signed = signatureManager.sign(content)
        
        // Re-sign (should be idempotent if content didn't change, 
        // or update hash if we explicitly pass new content but same logic)
        const resigned = signatureManager.sign(signed)
        
        // Strip metadata to verify core content hasn't duplicated
        // We need to implement a public strip or just check length roughly
        // Better: verify verify() still works
        expect(signatureManager.verify(resigned)).toBe('pristine')
        
        // Verify it didn't append double signatures
        const matches = resigned.match(/@aipim-signature/g)
        expect(matches).toHaveLength(1)
    })
})
