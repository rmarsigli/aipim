import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
    evaluateDiscoveryGate,
    explainDiscoveryGate,
    getDiscoveryGateConfig,
    DiscoveryGateConfig
} from '../../src/core/discovery-gate.js'
import { emptyDiscoveryState } from '../../src/core/discovery.js'
import { emptyChangeset } from '../../src/core/changeset.js'
import type { Changeset, DiscoveryState } from '../../src/types/index.js'

const TEST_ROOT = join(process.cwd(), 'tests/__fixtures__/discovery-gate-test')

const OFF: DiscoveryGateConfig = {
    maxOpenCritical: null,
    maxTasksPerChangeset: null,
    requireEstimates: false,
    requireGrounding: false
}

function state(overrides: Partial<DiscoveryState> = {}): DiscoveryState {
    return { ...emptyDiscoveryState(), ...overrides }
}

function changeset(overrides: Partial<Changeset> = {}): Changeset {
    return { ...emptyChangeset(), ...overrides }
}

function task(localId: string, estimatedHours?: number) {
    return { localId, title: localId, taskType: 'feat', priority: 'P2-M', ...(estimatedHours ? { estimatedHours } : {}) }
}

function writeConfig(toml: string): void {
    mkdirSync(join(TEST_ROOT, '.project'), { recursive: true })
    writeFileSync(join(TEST_ROOT, '.project/config.toml'), toml, 'utf8')
}

beforeEach(() => {
    mkdirSync(join(TEST_ROOT, '.project'), { recursive: true })
})

afterEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe('getDiscoveryGateConfig', () => {
    it('should read every field from config.toml', () => {
        writeConfig(
            `[project]\nname = "x"\n\n[discovery]\nmax_open_critical = 0\nmax_tasks_per_changeset = 15\nrequire_estimates = true\nrequire_grounding = true\n`
        )
        expect(getDiscoveryGateConfig(TEST_ROOT)).toEqual({
            maxOpenCritical: 0,
            maxTasksPerChangeset: 15,
            requireEstimates: true,
            requireGrounding: true
        })
    })

    it('should be entirely off without a [discovery] block', () => {
        writeConfig(`[project]\nname = "x"\n`)
        expect(getDiscoveryGateConfig(TEST_ROOT)).toEqual(OFF)
    })

    it('should be entirely off without a config file at all', () => {
        expect(getDiscoveryGateConfig(TEST_ROOT)).toEqual(OFF)
    })

    it('should ignore values of the wrong type instead of trusting them', () => {
        writeConfig(`[project]\nname = "x"\n\n[discovery]\nmax_open_critical = "zero"\nrequire_estimates = "yes"\n`)
        expect(getDiscoveryGateConfig(TEST_ROOT)).toEqual(OFF)
    })
})

describe('evaluateDiscoveryGate', () => {
    it('should be a no-op when nothing is configured', () => {
        const result = evaluateDiscoveryGate(
            OFF,
            changeset({ tasks: Array.from({ length: 40 }, (_, i) => task(`#${i}`)) }),
            state({ assumptions: [{ question: 'q', assumed: 'a', critical: true }] }),
            true
        )
        expect(result).toEqual({ satisfied: true, failures: [] })
    })

    it('should refuse while a critical assumption is open', () => {
        const result = evaluateDiscoveryGate(
            { ...OFF, maxOpenCritical: 0 },
            changeset(),
            state({ assumptions: [{ question: 'which database?', assumed: 'postgres', critical: true }] }),
            true
        )
        expect(result.satisfied).toBe(false)
        expect(result.failures[0]).toContain('which database?')
    })

    it('should ignore non-critical assumptions', () => {
        const result = evaluateDiscoveryGate(
            { ...OFF, maxOpenCritical: 0 },
            changeset(),
            state({ assumptions: [{ question: 'which port?', assumed: '3141', critical: false }] }),
            true
        )
        expect(result.satisfied).toBe(true)
    })

    it('should cap the number of proposed tasks', () => {
        const result = evaluateDiscoveryGate(
            { ...OFF, maxTasksPerChangeset: 3 },
            changeset({ tasks: [task('#1'), task('#2'), task('#3'), task('#4')] }),
            state(),
            true
        )
        expect(result.failures[0]).toContain('limit is 3')
    })

    it('should accept a changeset exactly at the cap', () => {
        const result = evaluateDiscoveryGate(
            { ...OFF, maxTasksPerChangeset: 2 },
            changeset({ tasks: [task('#1'), task('#2')] }),
            state(),
            true
        )
        expect(result.satisfied).toBe(true)
    })

    it('should name the tasks missing an estimate', () => {
        const result = evaluateDiscoveryGate(
            { ...OFF, requireEstimates: true },
            changeset({ tasks: [task('#1', 4), task('#2')] }),
            state(),
            true
        )
        expect(result.failures[0]).toContain('#2')
        expect(result.failures[0]).not.toContain('#1')
    })

    it('should require grounding in a project that has tasks', () => {
        const result = evaluateDiscoveryGate({ ...OFF, requireGrounding: true }, changeset(), state(), true)
        expect(result.failures[0]).toContain('No grounding recorded')
    })

    it('should not require grounding in an empty project, which is why greenfield needs no special case', () => {
        const result = evaluateDiscoveryGate({ ...OFF, requireGrounding: true }, changeset(), state(), false)
        expect(result.satisfied).toBe(true)
    })

    it('should report every failure at once rather than one at a time', () => {
        const result = evaluateDiscoveryGate(
            { maxOpenCritical: 0, maxTasksPerChangeset: 1, requireEstimates: true, requireGrounding: true },
            changeset({ tasks: [task('#1'), task('#2')] }),
            state({ assumptions: [{ question: 'q', assumed: 'a', critical: true }] }),
            true
        )
        expect(result.failures).toHaveLength(4)
    })
})

describe('explainDiscoveryGate', () => {
    it('should point at force while making clear it is recorded', () => {
        const message = explainDiscoveryGate('D001-CS1', { satisfied: false, failures: ['something is missing'] })
        expect(message).toContain('D001-CS1')
        expect(message).toContain('something is missing')
        expect(message).toContain('recorded in the event log')
    })
})
