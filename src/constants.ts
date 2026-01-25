export const FILES = {
    PACKAGE_JSON: 'package.json',
    PROJECT_DIR: '.project',
    GIT_DIR: '.git',
    NODE_MODULES: 'node_modules',
    PRE_SESSION_SCRIPT: '.project/scripts/pre-session.sh',
    TASK_TEMPLATE: '.project/_templates/task.md',
    CURRENT_TASK: '.project/current-task.md',
    CURRENT_TASK_FILE: 'current-task.md',
    CONTEXT: '.project/context.md',
    CONTEXT_FILE: 'context.md'
} as const

export const PROMPTS = {
    CLAUDE: 'CLAUDE.md',
    GEMINI: 'GEMINI.md',
    CHATGPT: 'CHATGPT.md',
    CURSOR: 'CURSOR.md',
    CURSOR_RULES: '.cursorrules'
} as const

export const PROJECT_STRUCTURE = [
    'backlog',
    'backlog/archived',
    'completed',
    'decisions',
    'docs',
    'ideas',
    'reports',
    'scripts',
    '_templates'
] as const

export const AI_TOOLS = {
    CLAUDE_CODE: 'claude-code',
    GEMINI: 'gemini',
    CHATGPT: 'chatgpt',
    CURSOR: 'cursor'
} as const
