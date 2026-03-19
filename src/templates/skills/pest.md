### Skill: Pest PHP Guidelines
- **Syntax**: Use `test()` or `it()` instead of classes. Do not use PHPUnit classes (`class X extends TestCase`) unless absolutely necessary.
- **Assertions**: Chain assertions functionally (`expect($value)->toBeTrue()->toBeGreaterThan(5)`).
- **Exceptions**: Use `throws(Exception::class)` for expected exceptions.
- **Datasets**: Use Pest datasets (`with()`) for testing multiple inputs instead of loops.
- **Custom Expectations**: If you find yourself asserting the same complex state, create a custom expectation using `expect()->extend()`.
