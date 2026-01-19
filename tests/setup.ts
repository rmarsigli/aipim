import fs from 'fs-extra'
import path from 'path'
import os from 'os'
import { jest, beforeAll, afterAll } from '@jest/globals'

export const createTempDir = async (): Promise<string> => {
    const uniqueId = Math.random().toString(36).substring(2, 9)
    const tempDir = path.join(os.tmpdir(), `aipim-test-${Date.now()}-${uniqueId}`)
    await fs.ensureDir(tempDir)
    return tempDir
}

export const cleanupTempDir = async (dir: string): Promise<void> => {
    await fs.remove(dir)
}

// Mock console for silent tests
beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
    jest.restoreAllMocks()
})
