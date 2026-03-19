import { jest } from '@jest/globals'
import fs from 'fs'
import path from 'path'
import { activeSkillRegistry } from '../../src/mcp/skills/registry.js'

describe('ActiveSkillRegistry', () => {
    let testRoot: string

    beforeEach(() => {
        testRoot = fs.mkdtempSync(path.join('/tmp', 'aipim-test-mcp-'))
        fs.mkdirSync(path.join(testRoot, '.project'))
    })

    afterEach(() => {
        fs.rmSync(testRoot, { recursive: true, force: true })
    })

    it('returns empty array if no active skills configured', () => {
        fs.writeFileSync(path.join(testRoot, '.project/config.toml'), `
[project]
name = "Test"
        `)
        const tools = activeSkillRegistry.getActiveTools(testRoot)
        expect(tools.length).toBe(0)
    })

    it('returns empty array if active_skills is empty', () => {
        fs.writeFileSync(path.join(testRoot, '.project/config.toml'), `
[project]
name = "Test"
active_skills = []
        `)
        const tools = activeSkillRegistry.getActiveTools(testRoot)
        expect(tools.length).toBe(0)
    })

    it('returns database tools when database skill is active', () => {
        fs.writeFileSync(path.join(testRoot, '.project/config.toml'), `
[project]
name = "Test"
active_skills = ["database"]
        `)
        const tools = activeSkillRegistry.getActiveTools(testRoot)
        expect(tools.length).toBe(2)
        expect(tools[0].schema.name).toBe('aipim_db_schema')
        expect(tools[1].schema.name).toBe('aipim_db_query')
    })
    
    it('ignores non-existent active skills gracefully', () => {
        fs.writeFileSync(path.join(testRoot, '.project/config.toml'), `
[project]
name = "Test"
active_skills = ["database", "does_not_exist_skill"]
        `)
        const tools = activeSkillRegistry.getActiveTools(testRoot)
        expect(tools.length).toBe(2)
    })
})
