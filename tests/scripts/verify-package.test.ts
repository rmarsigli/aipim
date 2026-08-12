import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { findMissingArtifacts } from '../../scripts/verify-package.mjs'

const TEST_ROOT = join(process.cwd(), 'tests/__fixtures__/verify-package')

function writePackageJson(files: string[]): void {
    writeFileSync(join(TEST_ROOT, 'package.json'), JSON.stringify({ name: 'x', files }), 'utf8')
}

beforeEach(() => {
    mkdirSync(TEST_ROOT, { recursive: true })
})

afterEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe('findMissingArtifacts', () => {
    it('reports nothing when every declared file exists', () => {
        writePackageJson(['LICENSE'])
        writeFileSync(join(TEST_ROOT, 'LICENSE'), 'MIT', 'utf8')

        expect(findMissingArtifacts(TEST_ROOT)).toEqual([])
    })

    it('reports a declared file that does not exist', () => {
        writePackageJson(['LICENSE'])

        expect(findMissingArtifacts(TEST_ROOT)).toEqual(['LICENSE'])
    })

    it('reports a declared directory that was never built', () => {
        writePackageJson(['ui/dist'])

        expect(findMissingArtifacts(TEST_ROOT)).toEqual(['ui/dist'])
    })

    it('reports a declared directory that exists but is empty', () => {
        writePackageJson(['ui/dist'])
        mkdirSync(join(TEST_ROOT, 'ui/dist'), { recursive: true })

        expect(findMissingArtifacts(TEST_ROOT)).toEqual(['ui/dist'])
    })

    it('accepts a directory that has content', () => {
        writePackageJson(['ui/dist'])
        mkdirSync(join(TEST_ROOT, 'ui/dist'), { recursive: true })
        writeFileSync(join(TEST_ROOT, 'ui/dist/index.html'), '<html></html>', 'utf8')

        expect(findMissingArtifacts(TEST_ROOT)).toEqual([])
    })

    it('reports every missing entry, not just the first', () => {
        writePackageJson(['dist', 'ui/dist', 'LICENSE'])
        writeFileSync(join(TEST_ROOT, 'LICENSE'), 'MIT', 'utf8')

        expect(findMissingArtifacts(TEST_ROOT)).toEqual(['dist', 'ui/dist'])
    })

    it('reports nothing when the package declares no files', () => {
        writePackageJson([])

        expect(findMissingArtifacts(TEST_ROOT)).toEqual([])
    })
})
