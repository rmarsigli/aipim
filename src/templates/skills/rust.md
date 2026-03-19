### Skill: Rust Guidelines
- **Ownership**: Design data flows around ownership from the start. Prefer moving values over cloning. Only `clone()` when ownership cannot be transferred and the cost is acceptable.
- **Error Handling**: Use `Result<T, E>` for all fallible operations. Never use `unwrap()` or `expect()` in library code. In application code, use `expect()` only with a descriptive panic message.
- **`?` Operator**: Propagate errors with `?` instead of manual `match`. Define a crate-level error enum or use `thiserror` for library errors and `anyhow` for application errors.
- **Lifetimes**: Prefer owned types in structs when lifetime complexity outweighs performance gain. Introduce lifetime annotations only when the borrow checker requires it.
- **Traits over Inheritance**: Model behavior with traits. Use trait objects (`dyn Trait`) for runtime polymorphism only when generics create unacceptable compile-time cost.
- **Iterators**: Use iterator chains (`map`, `filter`, `fold`) over manual loops. Prefer `iter()` (borrowing) over `into_iter()` (consuming) when the collection is still needed.
- **Unsafe**: Never use `unsafe` without a documented safety invariant explaining why the code is correct. Isolate `unsafe` blocks to the smallest possible scope.
- **Clippy**: Treat all `clippy::pedantic` warnings as errors in CI. Never suppress a lint without a `// SAFETY:` or `// REASON:` comment.
