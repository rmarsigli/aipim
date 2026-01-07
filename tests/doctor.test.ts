import { doctor } from '../src/core/doctor.js'
import { createTempDir, cleanupTempDir } from './setup.js'
import fs from 'fs-extra'
import path from 'path'
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'

describe('Doctor', () => {
    let tempDir: string

    beforeEach(async () => {
        tempDir = await createTempDir()
    })

    afterEach(async () => {
        await cleanupTempDir(tempDir)
    })

    test('fails if .project is missing', async () => {
        const results = await doctor.diagnose(tempDir)
        const structure = results.find(r => r.id === 'structure')
        expect(structure?.status).toBe('fail')
    })

    test('warns if partial structure', async () => {
        await fs.ensureDir(path.join(tempDir, '.project'))
        const results = await doctor.diagnose(tempDir)
        const structure = results.find(r => r.id === 'structure')
        expect(structure?.status).toBe('warn')
    })

    test('passes valid structure', async () => {
        await fs.ensureDir(path.join(tempDir, '.project/backlog'))
        await fs.ensureDir(path.join(tempDir, '.project/completed'))
        await fs.ensureDir(path.join(tempDir, '.project/decisions'))
        await fs.ensureDir(path.join(tempDir, '.project/docs'))
        await fs.ensureDir(path.join(tempDir, '.project/ideas'))
        await fs.ensureDir(path.join(tempDir, '.project/reports'))
        
        const results = await doctor.diagnose(tempDir)
    })
})
