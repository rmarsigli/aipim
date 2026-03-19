import fs from 'fs'
import path from 'path'
import { aipimDbQuery, aipimDbSchema } from '../../src/mcp/skills/database/index.js'
import { ToolContext } from '../../src/mcp/tools/index.js'
import Database from 'better-sqlite3'

function makeCtx(projectRoot: string): ToolContext {
    return { db: null as unknown as Database.Database, projectRoot, events: [] }
}

describe('database skill — path traversal protection', () => {
    let testRoot: string

    beforeEach(() => {
        testRoot = fs.mkdtempSync(path.join('/tmp', 'aipim-db-test-'))
    })

    afterEach(() => {
        fs.rmSync(testRoot, { recursive: true, force: true })
    })

    it('rejects a relative path that escapes the project root', () => {
        const ctx = makeCtx(testRoot)
        expect(() =>
            aipimDbSchema.handler(ctx, { dbPath: '../../etc/sensitive.db' })
        ).toThrow(/Security Error/)
    })

    it('rejects an absolute path outside the project root', () => {
        const ctx = makeCtx(testRoot)
        expect(() =>
            aipimDbSchema.handler(ctx, { dbPath: '/tmp/other.db' })
        ).toThrow(/Security Error/)
    })

    it('accepts a relative path that stays inside the project root', () => {
        // Create a real SQLite db at .project/data.db so the handler can open it
        fs.mkdirSync(path.join(testRoot, '.project'))
        const db = new Database(path.join(testRoot, '.project/data.db'))
        db.close()

        const ctx = makeCtx(testRoot)
        // Should not throw (file exists and path is within root)
        expect(() =>
            aipimDbSchema.handler(ctx, { dbPath: '.project/data.db' })
        ).not.toThrow()
    })
})

describe('database skill — read-only enforcement', () => {
    let testRoot: string
    let ctx: ToolContext

    beforeEach(() => {
        testRoot = fs.mkdtempSync(path.join('/tmp', 'aipim-db-test-'))
        fs.mkdirSync(path.join(testRoot, '.project'))
        const db = new Database(path.join(testRoot, '.project/data.db'))
        db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)')
        db.close()
        ctx = makeCtx(testRoot)
    })

    afterEach(() => {
        fs.rmSync(testRoot, { recursive: true, force: true })
    })

    it.each([
        ['INSERT', 'INSERT INTO items (name) VALUES ("x")'],
        ['UPDATE', 'UPDATE items SET name = "y" WHERE id = 1'],
        ['DELETE', 'DELETE FROM items WHERE id = 1'],
        ['DROP', 'DROP TABLE items'],
        ['ALTER', 'ALTER TABLE items ADD COLUMN age INTEGER'],
        ['CREATE', 'CREATE TABLE new_table (id INTEGER)'],
        ['TRUNCATE', 'TRUNCATE TABLE items'],
    ])('blocks %s statement', (_verb, query) => {
        expect(() => aipimDbQuery.handler(ctx, { query })).toThrow(/Security Error/)
    })

    it('allows a SELECT query', () => {
        expect(() => aipimDbQuery.handler(ctx, { query: 'SELECT * FROM items' })).not.toThrow()
    })
})
