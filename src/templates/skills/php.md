### Skill: Modern PHP Guidelines
- **Type Declarations**: Always declare parameter types, return types, and property types. Use `never` as the return type for methods that always throw or exit.
- **Named Arguments**: Use named arguments for functions with many parameters or boolean flags (`str_contains(haystack: $str, needle: 'foo')`).
- **Readonly Properties**: Use `readonly` on DTO and Value Object properties that must not change after construction.
- **Enums**: Use backed enums (`enum Status: string`) instead of class constants for finite, well-defined value sets.
- **Nullsafe Operator**: Use `?->` for nullable method chains instead of nested null checks.
- **Match Expression**: Prefer `match` over `switch` for value comparison — it is strict (no type coercion), exhaustive, and returns a value.
- **No Mixed Types**: Avoid `mixed` types. Narrow with union types (`string|int`) or generics via PHPDoc when a strict type is not possible.
- **PSR-12 + Pint**: Follow PSR-12 coding style. Run `./vendor/bin/pint` (or `php-cs-fixer`) before committing. Do not debate formatting in code review.
