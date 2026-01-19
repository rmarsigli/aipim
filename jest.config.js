export default {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.ts'],
    extensionsToTreatAsEsm: ['.ts'],
    collectCoverage: false,
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/*.test.ts',
        '!src/cli.ts',
        '!src/prompts/**/*.ts',
        '!src/templates/**/*'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
    coverageThreshold: {
        global: {
            branches: 40,
            functions: 50,
            lines: 50,
            statements: 50
        }
    },
    moduleNameMapper: {
        '^@/(.*)\\.js$': '<rootDir>/src/$1',
        '^@/(.*)$': '<rootDir>/src/$1',
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    transform: {
        '^.+\\.ts$': [
            'ts-jest',
            {
                useESM: true,
                tsconfig: 'tsconfig.json'
            }
        ]
    },
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
}