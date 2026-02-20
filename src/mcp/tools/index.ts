import Database from 'better-sqlite3'
import { AipimEvent } from '../../types/index.js'

export interface ToolContext {
    db: Database.Database
    projectRoot: string
    events: AipimEvent[]
}

export interface McpToolSchema {
    name: string
    description: string
    inputSchema: {
        type: 'object'
        properties: Record<string, unknown>
        required?: string[]
    }
}

export interface McpTool {
    schema: McpToolSchema
    handler: (ctx: ToolContext, args: Record<string, unknown>) => unknown
}

import { readTools } from './read.js'
import { writeTools } from './write.js'

export const ALL_TOOLS: McpTool[] = [...readTools, ...writeTools]
