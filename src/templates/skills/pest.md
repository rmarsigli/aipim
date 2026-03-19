### Skill: Pest PHP Guidelines
- **Syntax**: Use `test()` or `it()` for top-level cases. Use `describe()` to group related scenarios. Never extend `TestCase` classes unless a third-party package requires it.
- **Assertions**: Chain assertions functionally (`expect($value)->toBeTrue()->toBeGreaterThan(5)`). Avoid PHPUnit aliases like `assertTrue()`/`assertSame()`.
- **Exceptions**: Use `throws(Exception::class)` or `throwsWithMessage()` for expected exceptions. Never wrap assertions in try/catch.
- **Datasets**: Use `with()` for parameterized tests instead of loops. Name dataset entries for readable failure output (`with(['valid email' => ['foo@bar.com']])`).
- **Custom Expectations**: Extract repeated complex assertions into `expect()->extend()`. Do not create helper functions that shadow the expectation API.
- **Hooks**: Use `beforeEach()`/`afterEach()` scoped to the describe block or file. Never share mutable state between tests through static properties.
- **Architecture Tests**: Use `arch()` to enforce structural rules (e.g., `arch()->expect('App\Models')->not->toUse('Illuminate\Support\Facades')`).
- **Skipping**: Use `->skip('reason')` for known-broken tests and `->todo()` for stubs. Never comment out test cases.
