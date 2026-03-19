import { jest } from '@jest/globals'
import fs from 'fs'
import path from 'path'
import { activeSkillRegistry, ActiveSkillRegistry } from '../../src/mcp/skills/registry.js'
import { ActiveSkill } from '../../src/mcp/skills/types.js'
import { McpTool } from '../../src/mcp/tools/index.js'

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

    it('returns empty array when config file does not exist', () => {
        const tools = activeSkillRegistry.getActiveTools(testRoot)
        expect(tools.length).toBe(0)
    })

    describe('register()', () => {
        it('adds a custom skill that becomes available in getActiveTools', () => {
            const registry = new ActiveSkillRegistry()

            const mockTool: McpTool = {
                schema: {
                    name: 'mock_tool',
                    description: 'A mock tool for testing',
                    inputSchema: { type: 'object', properties: {} }
                },
                handler: () => ({})
            }
            const customSkill: ActiveSkill = { id: 'custom', tools: [mockTool] }
            registry.register(customSkill)

            fs.writeFileSync(path.join(testRoot, '.project/config.toml'), `
[project]
name = "Test"
active_skills = ["custom"]
            `)

            const tools = registry.getActiveTools(testRoot)
            expect(tools.length).toBe(1)
            expect(tools[0].schema.name).toBe('mock_tool')
        })

        it('built-in skills remain available after registering a custom skill', () => {
            const registry = new ActiveSkillRegistry()

            const mockTool: McpTool = {
                schema: { name: 'extra_tool', description: 'extra', inputSchema: { type: 'object', properties: {} } },
                handler: () => ({})
            }
            registry.register({ id: 'extra', tools: [mockTool] })

            fs.writeFileSync(path.join(testRoot, '.project/config.toml'), `
[project]
name = "Test"
active_skills = ["database", "extra"]
            `)

            const tools = registry.getActiveTools(testRoot)
            expect(tools.length).toBe(3) // 2 database tools + 1 extra
            expect(tools.map((t) => t.schema.name)).toContain('aipim_db_schema')
            expect(tools.map((t) => t.schema.name)).toContain('extra_tool')
        })
    })

    describe('config caching', () => {
        it('returns cached result when config file has not changed', () => {
            const registry = new ActiveSkillRegistry()
            const configPath = path.join(testRoot, '.project/config.toml')

            fs.writeFileSync(configPath, `
[project]
name = "Test"
active_skills = ["database"]
            `)

            const first = registry.getActiveTools(testRoot)
            const second = registry.getActiveTools(testRoot)

            expect(first.length).toBe(second.length)
            expect(first.map((t) => t.schema.name)).toEqual(second.map((t) => t.schema.name))
        })
    })
})
