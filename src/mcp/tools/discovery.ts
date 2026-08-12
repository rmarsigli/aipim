import {
    currentDiscovery,
    findRelated,
    loadDiscovery,
    openDiscoveries,
    recordDiscoveryState,
    startDiscovery
} from '../../core/discovery.js'
import {
    applyChangeset,
    parseChangeset,
    proposeChangeset,
    resolveWithoutApplying,
    validateChangeset
} from '../../core/changeset.js'
import {
    evaluateDiscoveryGate,
    explainDiscoveryGate,
    getDiscoveryGateConfig,
    projectHasTasks
} from '../../core/discovery-gate.js'
import { getChangeset, getProposedChangeset } from '../../core/db.js'
import type { McpTool, ToolContext } from './index.js'

/**
 * Shape of the distilled state, described once and reused by every tool that
 * accepts or returns it.
 */
const STATE_SCHEMA = {
    type: 'object',
    description: 'The complete distilled state of the session. Always send the whole thing, not a delta.',
    properties: {
        problem: { type: 'string', description: 'The problem in short prose. What hurts.' },
        agreements: {
            type: 'array',
            description: 'What has been settled, and why.',
            items: {
                type: 'object',
                properties: { statement: { type: 'string' }, rationale: { type: 'string' } }
            }
        },
        alternatives: {
            type: 'array',
            description: 'Options considered and dropped. The reason is the point.',
            items: {
                type: 'object',
                properties: { option: { type: 'string' }, rejectedBecause: { type: 'string' } }
            }
        },
        assumptions: {
            type: 'array',
            description:
                'Questions the user skipped, with the premise you adopted instead. Never decide silently — record it here.',
            items: {
                type: 'object',
                properties: {
                    question: { type: 'string' },
                    assumed: { type: 'string' },
                    critical: { type: 'boolean', description: 'True when being wrong here would invalidate the work.' }
                }
            }
        },
        grounding: {
            type: 'array',
            description: 'Existing tasks and decisions this discussion touches. Populate from find_related.',
            items: {
                type: 'object',
                properties: {
                    kind: { type: 'string', enum: ['task', 'decision'] },
                    id: { type: 'string' },
                    relation: { type: 'string', enum: ['overlaps', 'conflicts', 'supersedes'] },
                    note: { type: 'string' }
                }
            }
        },
        openThreads: {
            type: 'array',
            description:
                'Questions you still intend to ask. Not the same as assumptions, which were asked and skipped.',
            items: { type: 'string' }
        }
    }
}

export const discoveryTools: McpTool[] = [
    {
        schema: {
            name: 'find_related',
            description:
                'Find existing tasks and decisions related to a piece of text. Call this before asking the user anything in a discovery session — it is what stops a discussion from duplicating work or contradicting a decision already made.',
            inputSchema: {
                type: 'object',
                required: ['query'],
                properties: {
                    query: { type: 'string', description: 'The idea, in the user words or yours.' },
                    limit: { type: 'number', description: 'Max results (default 10)' }
                }
            }
        },
        handler: ({ db }: ToolContext, args: Record<string, unknown>): unknown => {
            const limit = typeof args.limit === 'number' ? args.limit : 10
            return { matches: findRelated(db, args.query as string, limit) }
        }
    },

    {
        schema: {
            name: 'start_discovery',
            description:
                'Open a discovery session. Only call this when the user explicitly asks to brainstorm — never on your own initiative in the middle of other work. Ground yourself with get_project_context and find_related before opening one.',
            inputSchema: {
                type: 'object',
                required: ['topic'],
                properties: { topic: { type: 'string', description: 'One line naming what is being explored.' } }
            }
        },
        handler: async ({ db, projectRoot }: ToolContext, args: Record<string, unknown>): Promise<unknown> => {
            // Reported so the caller can offer to resume rather than fork a
            // parallel discussion of the same thing.
            const alreadyOpen = openDiscoveries(db)
            const { sessionId } = await startDiscovery(projectRoot, db, args.topic as string)
            return { sessionId, otherOpenSessions: alreadyOpen }
        }
    },

    {
        schema: {
            name: 'update_discovery_state',
            description:
                'Write the distilled state of a discovery session. Send the complete state every time — it is stored as a snapshot, and each call becomes a new version. Call it after every turn that changed your understanding.',
            inputSchema: {
                type: 'object',
                required: ['sessionId', 'state'],
                properties: {
                    sessionId: { type: 'string', description: 'Session ID, e.g. D001' },
                    state: STATE_SCHEMA
                }
            }
        },
        handler: async ({ db, projectRoot }: ToolContext, args: Record<string, unknown>): Promise<unknown> => {
            const sessionId = args.sessionId as string
            const existing = loadDiscovery(db, sessionId)
            if (!existing) return { error: `Discovery session ${sessionId} not found` }
            if (existing.session.status !== 'open') {
                return { error: `Discovery session ${sessionId} is ${existing.session.status}, not open` }
            }

            const { version } = await recordDiscoveryState(projectRoot, db, sessionId, args.state)
            return { success: true, sessionId, version }
        }
    },

    {
        schema: {
            name: 'get_discovery_state',
            description:
                'Read a discovery session and its latest distilled state. Call this to resume a session — it returns enough to pick up the thread with no chat history. Omit sessionId to get the most recently touched open session.',
            inputSchema: {
                type: 'object',
                properties: { sessionId: { type: 'string', description: 'Session ID, e.g. D001' } }
            }
        },
        handler: ({ db }: ToolContext, args: Record<string, unknown>): unknown => {
            const sessionId = args.sessionId as string | undefined
            const loaded = sessionId ? loadDiscovery(db, sessionId) : currentDiscovery(db)

            if (!loaded) {
                return sessionId
                    ? { error: `Discovery session ${sessionId} not found` }
                    : { message: 'No open discovery session.', openSessions: [] }
            }

            const proposed = getProposedChangeset(db, loaded.session.id)

            return {
                sessionId: loaded.session.id,
                topic: loaded.session.topic,
                status: loaded.session.status,
                startedAt: loaded.session.started_at,
                updatedAt: loaded.session.updated_at,
                version: loaded.version,
                state: loaded.state,
                proposedChangeset: proposed ? { changesetId: proposed.id, changeset: parseChangeset(proposed) } : null
            }
        }
    },

    {
        schema: {
            name: 'propose_changeset',
            description:
                'Propose what a discovery session should change in the project: tasks to create, dependencies between them, decisions to record, docs to write. Recording a proposal never applies it — show the result to the user as a readable diff and only call resolve_changeset once they approve.',
            inputSchema: {
                type: 'object',
                required: ['sessionId', 'changeset'],
                properties: {
                    sessionId: { type: 'string', description: 'Session ID, e.g. D001' },
                    changeset: {
                        type: 'object',
                        properties: {
                            tasks: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        localId: {
                                            type: 'string',
                                            description: 'Local handle starting with #, e.g. "#1". Dependencies use it.'
                                        },
                                        title: { type: 'string' },
                                        taskType: {
                                            type: 'string',
                                            enum: ['feat', 'fix', 'chore', 'docs', 'refactor', 'test']
                                        },
                                        priority: {
                                            type: 'string',
                                            enum: ['P1-S', 'P1-M', 'P1-L', 'P2-S', 'P2-M', 'P2-L', 'P3']
                                        },
                                        estimatedHours: { type: 'number' },
                                        description: { type: 'string' }
                                    }
                                }
                            },
                            dependencies: {
                                type: 'array',
                                description: 'Edges. Either end may be a local ref ("#1") or an existing ID.',
                                items: {
                                    type: 'object',
                                    properties: {
                                        taskRef: { type: 'string' },
                                        dependsOnRef: { type: 'string' }
                                    }
                                }
                            },
                            decisions: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        title: { type: 'string' },
                                        rationale: { type: 'string' },
                                        supersedes: { type: 'array', items: { type: 'string' } }
                                    }
                                }
                            },
                            docs: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: { path: { type: 'string' }, content: { type: 'string' } }
                                }
                            }
                        }
                    }
                }
            }
        },
        handler: async ({ db, projectRoot }: ToolContext, args: Record<string, unknown>): Promise<unknown> => {
            const sessionId = args.sessionId as string
            const session = loadDiscovery(db, sessionId)

            // A changeset exists only inside a session, and sessions only start
            // when the user asks for one. That is what keeps discovery from
            // firing on its own in the middle of unrelated work.
            if (!session) return { error: `Discovery session ${sessionId} not found` }
            if (session.session.status === 'applied' || session.session.status === 'abandoned') {
                return { error: `Discovery session ${sessionId} is already ${session.session.status}` }
            }

            const result = await proposeChangeset(projectRoot, db, sessionId, args.changeset)
            return {
                success: true,
                changesetId: result.changesetId,
                changeset: result.changeset,
                validation: result.validation
            }
        }
    },

    {
        schema: {
            name: 'resolve_changeset',
            description:
                'Resolve a proposed changeset. "applied" creates everything in it as one atomic batch; "abandoned" closes the session without changing anything; "revision_requested" reopens the session so the proposal can be reworked. Only call with "applied" after the user has explicitly approved.',
            inputSchema: {
                type: 'object',
                required: ['sessionId', 'resolution'],
                properties: {
                    sessionId: { type: 'string' },
                    changesetId: { type: 'string', description: 'Defaults to the session current proposal.' },
                    resolution: { type: 'string', enum: ['applied', 'abandoned', 'revision_requested'] },
                    force: {
                        type: 'boolean',
                        description: 'Apply despite failing validators. Recorded in the event log as a bypass.'
                    }
                }
            }
        },
        handler: async ({ db, projectRoot }: ToolContext, args: Record<string, unknown>): Promise<unknown> => {
            const sessionId = args.sessionId as string
            const resolution = args.resolution as 'applied' | 'abandoned' | 'revision_requested'

            const session = loadDiscovery(db, sessionId)
            if (!session) return { error: `Discovery session ${sessionId} not found` }

            const requestedId = args.changesetId as string | undefined
            const row = requestedId ? getChangeset(db, requestedId) : getProposedChangeset(db, sessionId)

            if (resolution !== 'abandoned' && !row) {
                return { error: `No proposed changeset for session ${sessionId}` }
            }
            if (row && row.session_id !== sessionId) {
                return { error: `Changeset ${row.id} does not belong to session ${sessionId}` }
            }

            if (resolution !== 'applied') {
                await resolveWithoutApplying(projectRoot, db, sessionId, row?.id, resolution)
                return { success: true, sessionId, resolution }
            }

            const proposal = row as NonNullable<typeof row>
            const changeset = parseChangeset(proposal)

            // Structural validation is not negotiable: a changeset that fails it
            // cannot be applied coherently at all, so force does not cover it.
            const validation = validateChangeset(db, changeset)
            if (!validation.valid) {
                return { error: `Changeset ${proposal.id} cannot be applied`, errors: validation.errors }
            }

            const force = args.force === true
            const gate = evaluateDiscoveryGate(
                getDiscoveryGateConfig(projectRoot),
                changeset,
                session.state,
                projectHasTasks(db)
            )
            if (!gate.satisfied && !force) {
                return { error: explainDiscoveryGate(proposal.id, gate), failures: gate.failures }
            }

            const applied = await applyChangeset(projectRoot, db, sessionId, proposal.id, changeset, {
                validatorsBypassed: force && !gate.satisfied
            })
            return { success: true, sessionId, resolution, applied }
        }
    }
]
