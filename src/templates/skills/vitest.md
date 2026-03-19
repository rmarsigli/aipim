### Skill: Vitest / Jest Guidelines
- **Test Structure**: Use `describe` for grouping and `it`/`test` for individual cases. Name tests as complete sentences: `it('should return 404 when user is not found')`.
- **Assertions**: Prefer specific matchers over generic ones (`toEqual` over `toBeTruthy`, `toThrow(ErrorClass)` over `toThrow()`).
- **Mocking**: Use `vi.mock()` / `jest.mock()` at the module level. Clear mocks in `beforeEach` with `vi.clearAllMocks()` to prevent state leak between tests.
- **No Implementation Details**: Test behavior and outcomes, not internal method calls. Avoid asserting on private state or implementation-specific call counts.
- **Isolation**: Each test must be fully self-contained. Never rely on execution order. Use `beforeEach` for setup, `afterEach` for cleanup.
- **Async Tests**: Always `await` async operations. Use `resolves`/`rejects` matchers for Promise assertions (`expect(fn()).resolves.toBe(true)`).
- **Coverage**: Aim for meaningful coverage over high percentage. A 70% coverage on critical paths is better than 95% coverage on trivial getters.
- **Snapshot Tests**: Use snapshot tests sparingly and only for stable, intentional output (e.g., serialized config). Never snapshot dynamic data.
